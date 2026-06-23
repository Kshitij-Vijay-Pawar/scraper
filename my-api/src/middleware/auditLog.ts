import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { apiUsageLogs } from "../db/schema";

export const auditLogMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  res.on("finish", async () => {
    try {
      if (req.user) {
        const userId = req.user.id;
        const apiKeyId = req.apiKey?.id || null;
        const endpoint = `${req.method} ${req.baseUrl || ""}${req.path}`;
        const statusCode = res.statusCode;

        await db.insert(apiUsageLogs).values({
          userId,
          apiKeyId,
          endpoint,
          statusCode,
        });
      }
    } catch (err) {
      console.error("Failed to write api_usage_log:", err);
    }
  });
  next();
};
