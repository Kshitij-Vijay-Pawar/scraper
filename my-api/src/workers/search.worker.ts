import { Worker, Job } from "bullmq";
import { db } from "../db";
import { searches, leads, apiKeys } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { redisConnection } from "../queue/redis";
import { SEARCH_QUEUE, SearchJobPayload } from "../queue/search.queue";
import { searchGoogleMaps } from "../services/googleMapsScraper";
import { filterNewLeads } from "../services/deduplication";
import { attachWorkerEvents } from "./worker.events";

console.log("Starting Search Worker process...");

export const searchWorker = new Worker<SearchJobPayload>(
  SEARCH_QUEUE,
  async (job: Job<SearchJobPayload>) => {
    const { searchId, keyword, location, limit = 50 } = job.data;
    console.log(`[Worker] Processing job ${job.id} for searchId: ${searchId}, limit: ${limit}`);

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

      // 2. Run Google Maps Scraper (progress = 30)
      await db.update(searches)
        .set({ progress: 30 })
        .where(eq(searches.id, searchId));
      await job.updateProgress(30);

      const scrapedLeads = await searchGoogleMaps(searchId, keyword, location, limit);

      // Update scraped count and set progress = 60
      await db.update(searches)
        .set({
          scrapedCount: scrapedLeads.length,
          progress: 60,
        })
        .where(eq(searches.id, searchId));
      await job.updateProgress(60);

      // Increment totalLeadsScraped for the API Key if the search was run via API Key
      const searchRecords = await db
        .select({ apiKeyId: searches.apiKeyId })
        .from(searches)
        .where(eq(searches.id, searchId))
        .limit(1);
      const searchRecord = searchRecords[0];
      if (searchRecord && searchRecord.apiKeyId) {
        await db.update(apiKeys)
          .set({
            totalLeadsScraped: sql`${apiKeys.totalLeadsScraped} + ${scrapedLeads.length}`,
          })
          .where(eq(apiKeys.id, searchRecord.apiKeyId));
      }

      // 3. Perform Deduplication (progress = 80)
      await db.update(searches)
        .set({ progress: 80 })
        .where(eq(searches.id, searchId));
      await job.updateProgress(80);

      const { newLeads, duplicates } = await filterNewLeads(scrapedLeads);

      let insertedCount = 0;
      const duplicateCount = duplicates.length;

      if (newLeads.length > 0) {
        const insertedLeads = await db.insert(leads).values(
          newLeads.map(l => ({ ...l, searchId }))
        ).returning({
          id: leads.id,
        });
        insertedCount = insertedLeads.length;
      }

      // 4. Finalize - Set status = completed, progress = 100, completedAt = now()
      // Enrichment is no longer performed automatically — it is a separate manual operation.
      await db.update(searches)
        .set({
          insertedCount,
          duplicateCount,
          totalLeads: insertedCount,
          status: "completed",
          progress: 100,
          completedAt: new Date(),
        })
        .where(eq(searches.id, searchId));
      await job.updateProgress(100);

      console.log(`[Worker] Job ${job.id} for searchId: ${searchId} completed successfully. ${insertedCount} leads inserted, ${duplicateCount} duplicates skipped.`);
    } catch (error: any) {
      console.error(`[Worker] Job ${job.id} (searchId: ${searchId}) failed:`, error);
      
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 1;

      if (attemptsMade + 1 >= maxAttempts) {
        await db.update(searches)
          .set({
            status: "failed",
            errorMessage: error.message || String(error),
            completedAt: new Date(),
          })
          .where(eq(searches.id, searchId));
      } else {
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
    concurrency: 1,
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
