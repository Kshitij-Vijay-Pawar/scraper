import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export interface EnrichmentJobPayload {
  enrichmentJobId: string;
  leadIds: string[];
  force: boolean;
}

export const ENRICHMENT_QUEUE = "enrichment";

export const enrichmentQueue = new Queue<EnrichmentJobPayload>(ENRICHMENT_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

/**
 * Adds a new enrichment job to the queue.
 */
export async function addEnrichmentJob(enrichmentJobId: string, leadIds: string[], force: boolean = false) {
  const job = await enrichmentQueue.add(
    "enrichment",
    { enrichmentJobId, leadIds, force },
  );
  return job;
}
