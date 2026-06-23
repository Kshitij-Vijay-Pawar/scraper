import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { db } from "../db";
import { users, apiKeys } from "../db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-jwt-secret-key-12345";

export const authOrApiKeyMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    if (rawKey) {
      // Authenticate via API Key
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
      return;
    }

    // Try JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token) {
        let decoded: any;
        try {
          decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
          res.status(401).json({ success: false, error: "Unauthorized", message: "Invalid or expired token" });
          return;
        }

        const userId = decoded.userId;
        if (!userId) {
          res.status(401).json({ success: false, error: "Unauthorized", message: "Invalid token payload" });
          return;
        }

        const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (userRecords.length === 0) {
          res.status(401).json({ success: false, error: "Unauthorized", message: "User not found" });
          return;
        }

        const user = userRecords[0];
        if (!user.isActive) {
          res.status(401).json({ success: false, error: "Unauthorized", message: "User account is suspended" });
          return;
        }

        req.user = user;
        next();
        return;
      }
    }

    res.status(401).json({ success: false, error: "Unauthorized", message: "Authentication required" });
  } catch (error) {
    console.error("Auth or API Key Middleware error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
