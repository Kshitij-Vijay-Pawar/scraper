import { Worker } from "bullmq";
import { db } from "../db";
import { searches } from "../db/schema";
import { eq } from "drizzle-orm";

export function attachWorkerEvents(worker: Worker) {
  worker.on("completed", (job) => {
    console.log(`[Worker Event] Job ${job?.id} (searchId: ${job?.data?.searchId}) completed successfully.`);
  });

  worker.on("failed", async (job, err) => {
    console.error(`[Worker Event] Job ${job?.id} (searchId: ${job?.data?.searchId}) failed:`, err);

    // Stalled Job Handling
    const isStalled = err.message?.toLowerCase().includes("stalled") || 
                      job?.failedReason?.toLowerCase().includes("stalled");

    if (isStalled && job?.data?.searchId) {
      console.warn(`[Worker Event] Stalled job detected for search ${job.data.searchId}. Restoring search status to failed.`);
      try {
        await db.update(searches)
          .set({
            status: "failed",
            errorMessage: "Worker crashed or stalled",
            completedAt: new Date(),
          })
          .where(eq(searches.id, job.data.searchId));
      } catch (dbErr) {
        console.error("[Worker Event] Failed to update search status for stalled job:", dbErr);
      }
    }
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[Worker Event] Job ${jobId} has stalled!`);
  });

  worker.on("progress", (job, progress) => {
    console.log(`[Worker Event] Job ${job?.id} (searchId: ${job?.data?.searchId}) progress: ${progress}%`);
  });
}
