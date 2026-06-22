import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export interface SearchJobPayload {
  searchId: string;
  keyword: string;
  location: string;
}

export const SEARCH_QUEUE = "search";

export const searchQueue = new Queue<SearchJobPayload>(SEARCH_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

/**
 * Adds a new search scraping job to the queue.
 */
export async function addSearchJob(searchId: string, keyword: string, location: string) {
  const job = await searchQueue.add(
    "search",
    { searchId, keyword, location },
    {
      // Optional overrides can go here
    }
  );
  return job;
}
