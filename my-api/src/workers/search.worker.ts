import { Worker, Job } from "bullmq";
import { db } from "../db";
import { searches, leads } from "../db/schema";
import { eq } from "drizzle-orm";
import { redisConnection } from "../queue/redis";
import { SEARCH_QUEUE, SearchJobPayload } from "../queue/search.queue";
import { searchGoogleMaps } from "../services/googleMapsScraper";
import { filterNewLeads } from "../services/deduplication";
import { enrichLeads } from "../services/enrichment";
import { attachWorkerEvents } from "./worker.events";

console.log("Starting Search Worker process...");

export const searchWorker = new Worker<SearchJobPayload>(
  SEARCH_QUEUE,
  async (job: Job<SearchJobPayload>) => {
    const { searchId, keyword, location } = job.data;
    console.log(`[Worker] Processing job ${job.id} for searchId: ${searchId}`);

    try {
      // 1. Update search status = running, progress = 10, startedAt = now()
      await db.update(searches)
        .set({
          status: "running",
          progress: 10,
          startedAt: new Date(),
        })
        .where(eq(searches.id, searchId));
      await job.updateProgress(10);

      // 2. Run Google Maps Scraper (progress = 40)
      await db.update(searches)
        .set({ progress: 40 })
        .where(eq(searches.id, searchId));
      await job.updateProgress(40);

      const scrapedLeads = await searchGoogleMaps(searchId, keyword, location);

      // Update scraped count and set progress = 60
      await db.update(searches)
        .set({
          scrapedCount: scrapedLeads.length,
          progress: 60,
        })
        .where(eq(searches.id, searchId));
      await job.updateProgress(60);

      // 3. Perform Deduplication
      const { newLeads, duplicates } = await filterNewLeads(scrapedLeads);

      let insertedLeads: { id: string; website: string | null }[] = [];
      let insertedCount = 0;
      const duplicateCount = duplicates.length;

      if (newLeads.length > 0) {
        insertedLeads = await db.insert(leads).values(
          newLeads.map(l => ({ ...l, searchId }))
        ).returning({
          id: leads.id,
          website: leads.website,
        });
        insertedCount = insertedLeads.length;
      }

      await db.update(searches)
        .set({
          insertedCount,
          duplicateCount,
          totalLeads: insertedCount,
        })
        .where(eq(searches.id, searchId));

      // 4. Perform website email and social enrichment (progress = 80)
      await db.update(searches)
        .set({ progress: 80 })
        .where(eq(searches.id, searchId));
      await job.updateProgress(80);

      if (insertedLeads.length > 0) {
        try {
          await enrichLeads(insertedLeads);
        } catch (enrichErr) {
          console.error(`[Worker] Enrichment error for search ${searchId}:`, enrichErr);
        }
      }

      // 5. Save/finalize statistics (progress = 95)
      await db.update(searches)
        .set({ progress: 95 })
        .where(eq(searches.id, searchId));
      await job.updateProgress(95);

      // Calculate enriched count
      const dbInsertedLeads = await db.select().from(leads).where(eq(leads.searchId, searchId));
      const enrichedCount = dbInsertedLeads.filter(l =>
        l.enrichmentStatus === "completed" &&
        (l.email !== null ||
         l.facebook !== null ||
         l.instagram !== null ||
         l.linkedin !== null ||
         l.twitter !== null)
      ).length;

      // 6. Set status = completed, progress = 100, completedAt = now()
      await db.update(searches)
        .set({
          enrichedCount,
          status: "completed",
          progress: 100,
          completedAt: new Date(),
        })
        .where(eq(searches.id, searchId));
      await job.updateProgress(100);

      console.log(`[Worker] Job ${job.id} for searchId: ${searchId} completed successfully.`);
    } catch (error: any) {
      console.error(`[Worker] Job ${job.id} (searchId: ${searchId}) failed:`, error);
      
      const attemptsMade = job.attemptsMade; // attempts already made before this run
      const maxAttempts = job.opts.attempts ?? 1;

      if (attemptsMade + 1 >= maxAttempts) {
        // Final attempt failed
        await db.update(searches)
          .set({
            status: "failed",
            errorMessage: error.message || String(error),
            completedAt: new Date(),
          })
          .where(eq(searches.id, searchId));
      } else {
        // Intermediate failure, keep status running, update error message for visibility
        await db.update(searches)
          .set({
            errorMessage: `Attempt ${attemptsMade + 1} failed: ${error.message || String(error)}`,
          })
          .where(eq(searches.id, searchId));
      }

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Process searches sequentially to avoid resource contention/timeouts
  }
);

// Attach event logging
attachWorkerEvents(searchWorker);

console.log("Search Worker is active and listening for jobs...");

// --- Graceful Shutdown Handler ---
async function shutdown() {
  console.log("\nShutting down worker process gracefully...");
  try {
    await searchWorker.close();
    await redisConnection.disconnect();
    console.log("Worker and Redis connections closed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
