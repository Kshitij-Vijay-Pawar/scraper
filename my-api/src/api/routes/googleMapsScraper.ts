import { Router, Request, Response } from "express";
import { db } from "../../db";
import { searches, leads, apiKeys } from "../../db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { addSearchJob } from "../../queue/search.queue";
import { authOrApiKeyMiddleware } from "../../middleware/authOrApiKey";
import { auditLogMiddleware } from "../../middleware/auditLog";

const router = Router();
router.use(authOrApiKeyMiddleware);

const searchSchema = z.object({
  keyword: z.string().min(1),
  location: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
});

// GET /searches - Retrieve all searches belonging to user
router.get("/searches", auditLogMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  try {
    const userSearches = await db
      .select()
      .from(searches)
      .where(eq(searches.userId, userId))
      .orderBy(desc(searches.createdAt));
    res.json({
      success: true,
      searches: userSearches,
    });
  } catch (error: any) {
    console.error("Error fetching searches:", error);
    res.status(500).json({ error: "Internal server error fetching searches", message: error.message });
  }
});

// POST /search - Start a search and queue the job, returning status instantly
router.post("/search", auditLogMiddleware, async (req: Request, res: Response): Promise<void> => {
  const parseResult = searchSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: "Validation failed", details: parseResult.error.format() });
    return;
  }

  const { keyword, location, limit = 50 } = parseResult.data;
  const userId = req.user!.id;
  const apiKeyId = req.apiKey?.id || null;

  try {
    // 1. If API key was used, increment its totalSearches and set lastSearchAt
    if (apiKeyId) {
      const now = new Date();
      await db.update(apiKeys)
        .set({
          totalSearches: (req.apiKey!.totalSearches || 0) + 1,
          lastSearchAt: now,
        })
        .where(eq(apiKeys.id, apiKeyId));
    }

    // 2. Create a search record in database
    const [newSearch] = await db
      .insert(searches)
      .values({
        userId,
        apiKeyId,
        keyword,
        location,
        status: "pending",
        progress: 5,
      })
      .returning();

    // 3. Queue the job in BullMQ
    const job = await addSearchJob(newSearch.id, keyword, location, limit);

    // 4. Return the response immediately
    res.json({
      success: true,
      searchId: newSearch.id,
      jobId: job.id,
      status: "pending",
    });
  } catch (error: any) {
    console.error("Error creating search:", error);
    res.status(500).json({ error: "Internal server error during search execution", message: error.message });
  }
});

// GET /search/:id - Retrieve search status
router.get("/search/:id", auditLogMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const searchRecords = await db
      .select()
      .from(searches)
      .where(and(eq(searches.id, id), eq(searches.userId, userId)))
      .limit(1);

    if (searchRecords.length === 0) {
      res.status(404).json({ error: "Search job not found" });
      return;
    }

    res.json({
      success: true,
      search: searchRecords[0],
    });
  } catch (error: any) {
    console.error("Error fetching search results:", error);
    res.status(500).json({ error: "Internal server error fetching search details", message: error.message });
  }
});

// GET /search/:id/results - Retrieve completed search results (leads)
router.get("/search/:id/results", auditLogMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const searchRecords = await db
      .select()
      .from(searches)
      .where(and(eq(searches.id, id), eq(searches.userId, userId)))
      .limit(1);

    if (searchRecords.length === 0) {
      res.status(404).json({ error: "Search job not found" });
      return;
    }

    const results = await db
      .select()
      .from(leads)
      .where(eq(leads.searchId, id));

    res.json({
      success: true,
      searchId: id,
      leads: results,
    });
  } catch (error: any) {
    console.error("Error fetching search leads:", error);
    res.status(500).json({ error: "Internal server error fetching search leads", message: error.message });
  }
});

// GET /leads - Retrieve leads, optionally filtered by searchId
router.get("/leads", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  try {
    const { searchId } = req.query;

    let allLeads;
    if (searchId && typeof searchId === "string") {
      // Ensure ownership of the search
      const searchRecords = await db
        .select()
        .from(searches)
        .where(and(eq(searches.id, searchId), eq(searches.userId, userId)))
        .limit(1);

      if (searchRecords.length === 0) {
        res.status(404).json({ error: "Search job not found or access denied" });
        return;
      }

      allLeads = await db
        .select()
        .from(leads)
        .where(eq(leads.searchId, searchId));
    } else {
      // Retrieve all leads belonging to the user's searches
      const userSearches = await db
        .select({ id: searches.id })
        .from(searches)
        .where(eq(searches.userId, userId));

      const searchIds = userSearches.map(s => s.id);
      if (searchIds.length === 0) {
        allLeads = [];
      } else {
        const { inArray } = await import("drizzle-orm");
        allLeads = await db
          .select()
          .from(leads)
          .where(inArray(leads.searchId, searchIds));
      }
    }

    res.json({
      success: true,
      count: allLeads.length,
      leads: allLeads,
    });
  } catch (error: any) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Internal server error fetching leads", message: error.message });
  }
});

// GET /leads/:id - Retrieve a single lead by ID with search context
router.get("/leads/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const leadRecords = await db
      .select({
        lead: leads,
        search: {
          id: searches.id,
          keyword: searches.keyword,
          location: searches.location,
          status: searches.status,
        }
      })
      .from(leads)
      .innerJoin(searches, eq(leads.searchId, searches.id))
      .where(and(eq(leads.id, id), eq(searches.userId, userId)))
      .limit(1);

    if (leadRecords.length === 0) {
      res.status(404).json({ error: "Lead not found or access denied" });
      return;
    }

    res.json({
      success: true,
      lead: {
        ...leadRecords[0].lead,
        searchKeyword: leadRecords[0].search.keyword,
        searchLocation: leadRecords[0].search.location,
      }
    });
  } catch (error: any) {
    console.error("Error fetching lead:", error);
    res.status(500).json({ error: "Internal server error fetching lead", message: error.message });
  }
});

export default router;
