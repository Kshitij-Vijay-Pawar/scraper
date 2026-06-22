import Redis from "ioredis";

const maxRetriesPerRequest = null; // Required by BullMQ

export const redisConnection = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest })
  : new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest,
    });

console.log(`Redis connection initialized using environment config.`);
