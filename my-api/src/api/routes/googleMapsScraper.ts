import { Router, Request, Response } from "express";
import { db } from "../../db";
import { searches, leads, apiKeys } from "../../db/schema";
import { eq, and, desc, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { addSearchJob } from "../../queue/search.queue";
import { authOrApiKeyMiddleware } from "../../middleware/authOrApiKey";
import { auditLogMiddleware } from "../../middleware/auditLog";
import { enrichLeads } from "../../services/enrichment";

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

const enrichSchema = z.object({
  leadId: z.string().uuid().optional(),
  leadIds: z.array(z.string().uuid()).optional(),
  searchId: z.string().uuid().optional(),
}).refine(data => data.leadId || (data.leadIds && data.leadIds.length > 0) || data.searchId, {
  message: "Must provide either leadId, leadIds, or searchId",
});

// POST /leads/enrich - Manually trigger enrichment for specific leads
router.post("/leads/enrich", auditLogMiddleware, async (req: Request, res: Response): Promise<void> => {
  const parseResult = enrichSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: "Validation failed", details: parseResult.error.format() });
    return;
  }

  const { leadId, leadIds, searchId } = parseResult.data;
  const userId = req.user!.id;

  try {
    const userSearches = await db
      .select({ id: searches.id })
      .from(searches)
      .where(eq(searches.userId, userId));
      
    const userSearchIds = userSearches.map(s => s.id);

    if (userSearchIds.length === 0) {
      res.status(404).json({ error: "No searches found or access denied" });
      return;
    }

    const conditions = [inArray(leads.searchId, userSearchIds)];
    
    const specificConditions = [];
    if (leadId) specificConditions.push(eq(leads.id, leadId));
    if (leadIds && leadIds.length > 0) specificConditions.push(inArray(leads.id, leadIds));
    if (searchId) specificConditions.push(eq(leads.searchId, searchId));
    
    if (specificConditions.length > 0) {
       conditions.push(or(...specificConditions)!);
    }
    
    const targetLeads = await db
      .select({ id: leads.id, website: leads.website })
      .from(leads)
      .where(and(...conditions));
      
    const leadsToEnrich = targetLeads.filter(l => l.website);

    if (leadsToEnrich.length === 0) {
      res.json({ success: true, message: "No valid leads found with a website to enrich.", count: 0 });
      return;
    }
    
    const targetLeadIds = leadsToEnrich.map(l => l.id);
    await db.update(leads)
      .set({ enrichmentStatus: "pending" })
      .where(inArray(leads.id, targetLeadIds));

    // Trigger async enrichment
    enrichLeads(leadsToEnrich).catch(err => {
      console.error("Manual enrichment failed:", err);
    });

    res.json({
      success: true,
      message: "Enrichment started in the background",
      count: leadsToEnrich.length
    });
  } catch (error: any) {
    console.error("Error triggering enrichment:", error);
    res.status(500).json({ error: "Internal server error triggering enrichment", message: error.message });
  }
});

export default router;
