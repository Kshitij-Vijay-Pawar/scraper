import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { db } from "../db";
import { apiKeys, users } from "../db/schema";
import { eq } from "drizzle-orm";

export const apiKeyMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let rawKey: string | undefined;

    if (req.headers["x-api-key"]) {
      rawKey = req.headers["x-api-key"] as string;
    } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      const token = req.headers.authorization.split(" ")[1];
      if (token && token.startsWith("sk_live_")) {
        rawKey = token;
      }
    }

    if (!rawKey) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "Missing or invalid API key" });
      return;
    }

    const hash = createHash("sha256").update(rawKey).digest("hex");

    const keyRecords = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1);
    if (keyRecords.length === 0) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "Invalid API key" });
      return;
    }

    const apiKeyRecord = keyRecords[0];
    if (!apiKeyRecord.isActive) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "API key is revoked" });
      return;
    }

    const userRecords = await db.select().from(users).where(eq(users.id, apiKeyRecord.userId)).limit(1);
    if (userRecords.length === 0) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "User not found" });
      return;
    }

    const user = userRecords[0];
    if (!user.isActive) {
      res.status(401).json({ success: false, error: "Unauthorized", message: "User account is suspended" });
      return;
    }

    // Update usage tracking statistics (rate limit/last request stats)
    const now = new Date();
    await db.update(apiKeys)
      .set({
        lastUsedAt: now,
        lastRequestAt: now,
        requestsToday: apiKeyRecord.requestsToday + 1,
      })
      .where(eq(apiKeys.id, apiKeyRecord.id));

    req.user = user;
    req.apiKey = {
      ...apiKeyRecord,
      lastUsedAt: now,
      lastRequestAt: now,
      requestsToday: apiKeyRecord.requestsToday + 1,
    };

    next();
  } catch (error) {
    console.error("API Key Middleware error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
