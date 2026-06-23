import { Router, Request, Response } from "express";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";
import { db } from "../../db";
import { apiKeys } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../../middleware/auth";

const router = Router();

const createKeySchema = z.object({
  name: z.string().min(1, "API Key name is required"),
});

// Protect all API key management endpoints with JWT auth middleware
router.use(authMiddleware);

// POST /api-keys - Create a new API key
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parseResult = createKeySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: "Validation failed", details: parseResult.error.format() });
    return;
  }

  const { name } = parseResult.data;
  const userId = req.user!.id;

  try {
    const randomHex = randomBytes(24).toString("hex");
    const rawKey = `sk_live_${randomHex}`;
    const keyPrefix = `sk_live_${randomHex.substring(0, 4)}`;
    const hash = createHash("sha256").update(rawKey).digest("hex");

    await db.insert(apiKeys).values({
      userId,
      name,
      keyHash: hash,
      keyPrefix,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      apiKey: rawKey,
    });
  } catch (error: any) {
    console.error("Error generating API Key:", error);
    res.status(500).json({ success: false, error: "Internal server error", message: error.message });
  }
});

// GET /api-keys - List API keys for the user
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        lastSearchAt: apiKeys.lastSearchAt,
        totalSearches: apiKeys.totalSearches,
        totalLeadsScraped: apiKeys.totalLeadsScraped,
        requestsToday: apiKeys.requestsToday,
        lastRequestAt: apiKeys.lastRequestAt,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)));

    res.json(keys);
  } catch (error: any) {
    console.error("Error listing API Keys:", error);
    res.status(500).json({ success: false, error: "Internal server error", message: error.message });
  }
});

// DELETE /api-keys/:id - Revoke an API key
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    // Only allow users to revoke their own active keys
    const result = await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ success: false, message: "API key not found or already inactive" });
      return;
    }

    res.json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (error: any) {
    console.error("Error revoking API Key:", error);
    res.status(500).json({ success: false, error: "Internal server error", message: error.message });
  }
});

export default router;
