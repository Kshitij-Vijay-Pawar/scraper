import { Router, Request, Response } from "express";
import { db } from "../../db";
import { searches, leads } from "../../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { addSearchJob } from "../../queue/search.queue";

const router = Router();

const searchSchema = z.object({
  keyword: z.string().min(1),
  location: z.string().min(1),
});

// POST /search - Start a search and queue the job, returning status instantly
router.post("/search", async (req: Request, res: Response): Promise<void> => {
  const parseResult = searchSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: "Validation failed", details: parseResult.error.format() });
    return;
  }

  const { keyword, location } = parseResult.data;

  try {
    // 1. Create a search record in database with pending status and 5% progress (queued)
    const [newSearch] = await db
      .insert(searches)
      .values({
        keyword,
        location,
        status: "pending",
        progress: 5,
      })
      .returning();

    // 2. Queue the job in BullMQ
    const job = await addSearchJob(newSearch.id, keyword, location);

    // 3. Return the response immediately
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

// GET /search/:id - Retrieve search status (No leads returned to optimize polling)
router.get("/search/:id", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const searchRecords = await db
      .select()
      .from(searches)
      .where(eq(searches.id, id))
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

// GET /leads - Retrieve leads, optionally filtered by searchId
router.get("/leads", async (req: Request, res: Response): Promise<void> => {
  try {
    const { searchId } = req.query;

    let allLeads;
    if (searchId && typeof searchId === "string") {
      allLeads = await db
        .select()
        .from(leads)
        .where(eq(leads.searchId, searchId));
    } else {
      allLeads = await db.select().from(leads);
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

export default router;
