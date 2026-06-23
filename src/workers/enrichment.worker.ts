import { Worker, Job } from "bullmq";
import { db } from "../db";
import { leads, enrichmentJobs } from "../db/schema";
import { eq } from "drizzle-orm";
import { redisConnection } from "../queue/redis";
import { ENRICHMENT_QUEUE, EnrichmentJobPayload } from "../queue/enrichment.queue";
import { enrichSingleLead } from "../services/enrichment";

console.log("Starting Enrichment Worker process...");

/**
 * Enrichment Worker
 *
 * Data Priority Rules:
 * 1. Google Maps data is the primary source of truth (highest priority).
 * 2. Website enrichment is secondary — it may only fill missing (null) fields.
 * 3. Never overwrite any existing non-null Google Maps values.
 *
 * This rule is enforced in enrichSingleLead when saving data:
 * only null fields (email, emails, facebook, instagram, linkedin, twitter) are populated.
 */
export const enrichmentWorker = new Worker<EnrichmentJobPayload>(
  ENRICHMENT_QUEUE,
  async (job: Job<EnrichmentJobPayload>) => {
    const { enrichmentJobId, leadIds, force } = job.data;
    console.log(`[EnrichmentWorker] Processing enrichment job ${enrichmentJobId}, ${leadIds.length} leads, force=${force}`);

    try {
      // 1. Mark enrichment job as running
      await db.update(enrichmentJobs)
        .set({
          status: "running",
          startedAt: new Date(),
        })
        .where(eq(enrichmentJobs.id, enrichmentJobId));

      let completedCount = 0;
      let failedCount = 0;
      const totalLeads = leadIds.length;

      // 2. Process leads in batches of 5
      const batchSize = 5;
      for (let i = 0; i < leadIds.length; i += batchSize) {
        // Check if job has been cancelled
        const currentJob = await db.select({ status: enrichmentJobs.status })
          .from(enrichmentJobs)
          .where(eq(enrichmentJobs.id, enrichmentJobId))
          .limit(1);

        if (currentJob[0]?.status === "cancelled") {
          console.log(`[EnrichmentWorker] Job ${enrichmentJobId} was cancelled. Stopping.`);
          return;
        }

        const batch = leadIds.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (leadId) => {
            try {
              // Fetch the current lead from DB
              const leadRecords = await db.select()
                .from(leads)
                .where(eq(leads.id, leadId))
                .limit(1);

              const lead = leadRecords[0];
              if (!lead) {
                failedCount++;
                return;
              }

              // "Already Enriched" Protection: skip if completed and force=false
              if (lead.enrichmentStatus === "completed" && !force) {
                console.log(`[EnrichmentWorker] Skipping already-enriched lead ${leadId}`);
                completedCount++;
                return;
              }

              // Skip leads without a website — nothing to enrich
              if (!lead.website) {
                completedCount++;
                return;
              }

              // Mark lead as running
              await db.update(leads)
                .set({ enrichmentStatus: "running" })
                .where(eq(leads.id, leadId));

              // Run enrichment — enrichSingleLead respects data priority rules internally
              await enrichSingleLead(leadId, lead.website);
              completedCount++;
            } catch (err) {
              console.error(`[EnrichmentWorker] Failed to enrich lead ${leadId}:`, err);
              failedCount++;

              // Mark individual lead as failed
              await db.update(leads)
                .set({
                  enrichmentStatus: "failed",
                  websiteLastChecked: new Date(),
                })
                .where(eq(leads.id, leadId));
            }
          })
        );

        // Update progress after each batch
        const processed = completedCount + failedCount;
        const progress = Math.round((processed / totalLeads) * 100);

        await db.update(enrichmentJobs)
          .set({
            completedLeads: completedCount,
            failedLeads: failedCount,
            progress,
          })
          .where(eq(enrichmentJobs.id, enrichmentJobId));

        await job.updateProgress(progress);
      }

      // 3. Finalize the enrichment job
      await db.update(enrichmentJobs)
        .set({
          status: "completed",
          progress: 100,
          completedLeads: completedCount,
          failedLeads: failedCount,
          completedAt: new Date(),
        })
        .where(eq(enrichmentJobs.id, enrichmentJobId));

      console.log(`[EnrichmentWorker] Job ${enrichmentJobId} completed. ${completedCount} enriched, ${failedCount} failed.`);
    } catch (error: any) {
      console.error(`[EnrichmentWorker] Job ${enrichmentJobId} failed:`, error);

      await db.update(enrichmentJobs)
        .set({
          status: "failed",
          completedAt: new Date(),
        })
        .where(eq(enrichmentJobs.id, enrichmentJobId));

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

console.log("Enrichment Worker is active and listening for jobs...");

// --- Graceful Shutdown Handler ---
async function shutdown() {
  console.log("\nShutting down enrichment worker process gracefully...");
  try {
    await enrichmentWorker.close();
    await redisConnection.disconnect();
    console.log("Enrichment Worker and Redis connections closed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
