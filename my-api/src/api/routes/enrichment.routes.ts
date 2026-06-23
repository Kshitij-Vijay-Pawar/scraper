import { Router, Request, Response } from "express";
import { db } from "../../db";
import { searches, leads, enrichmentJobs } from "../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { addEnrichmentJob, enrichmentQueue } from "../../queue/enrichment.queue";
import { authOrApiKeyMiddleware } from "../../middleware/authOrApiKey";
import { auditLogMiddleware } from "../../middleware/auditLog";

const router = Router();
router.use(authOrApiKeyMiddleware);

const MAX_LEADS_PER_JOB = 500;

// --- POST /enrich/leads - Enrich specific leads ---
const enrichLeadsSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
  force: z.boolean().optional().default(false),
});

router.post("/enrich/leads", auditLogMiddleware, async (req: Request, res: Response): Promise<void> => {
  const parseResult = enrichLeadsSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: "Validation failed", details: parseResult.error.format() });
    return;
  }

  const { leadIds, force } = parseResult.data;
  const userId = req.user!.id;

  if (leadIds.length > MAX_LEADS_PER_JOB) {
    res.status(400).json({
      success: false,
      error: `Too many leads. Maximum ${MAX_LEADS_PER_JOB} leads per job. You sent ${leadIds.length}.`,
    });
    return;
  }

  try {
    // Verify ownership: all leads must belong to user's searches
    const userSearches = await db
      .select({ id: searches.id })
      .from(searches)
      .where(eq(searches.userId, userId));

    const userSearchIds = userSearches.map(s => s.id);
    if (userSearchIds.length === 0) {
      res.status(404).json({ error: "No searches found or access denied" });
      return;
    }

    const ownedLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(
        inArray(leads.id, leadIds),
        inArray(leads.searchId, userSearchIds),
      ));

    const ownedLeadIds = ownedLeads.map(l => l.id);
    if (ownedLeadIds.length === 0) {
      res.status(404).json({ error: "No matching leads found or access denied" });
      return;
    }

    // Create the enrichment job record
    const [enrichmentJob] = await db.insert(enrichmentJobs)
      .values({
        userId,
        totalLeads: ownedLeadIds.length,
      })
      .returning();

    // Queue the job
    await addEnrichmentJob(enrichmentJob.id, ownedLeadIds, force);

    res.json({
      success: true,
      jobId: enrichmentJob.id,
      totalLeads: ownedLeadIds.length,
    });
  } catch (error: any) {
    console.error("Error creating enrichment job:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

// --- POST /enrich/search/:searchId - Enrich all leads in a search ---
const enrichSearchSchema = z.object({
  force: z.boolean().optional().default(false),
});

router.post("/enrich/search/:searchId", auditLogMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { searchId } = req.params;
  const userId = req.user!.id;

  const parseResult = enrichSearchSchema.safeParse(req.body);
  const force = parseResult.success ? parseResult.data.force : false;

  try {
    // Verify ownership
    const searchRecords = await db
      .select()
      .from(searches)
      .where(and(eq(searches.id, searchId), eq(searches.userId, userId)))
      .limit(1);

    if (searchRecords.length === 0) {
      res.status(404).json({ error: "Search not found or access denied" });
      return;
    }

    // Get all leads for this search
    const searchLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.searchId, searchId));

    if (searchLeads.length === 0) {
      res.json({ success: true, message: "No leads found for this search", jobId: null });
      return;
    }

    if (searchLeads.length > MAX_LEADS_PER_JOB) {
      res.status(400).json({
        success: false,
        error: `Too many leads (${searchLeads.length}). Maximum ${MAX_LEADS_PER_JOB} per job. Please select specific leads instead.`,
      });
      return;
    }

    const leadIds = searchLeads.map(l => l.id);

    // Create the enrichment job record
    const [enrichmentJob] = await db.insert(enrichmentJobs)
      .values({
        userId,
        totalLeads: leadIds.length,
      })
      .returning();

    // Queue the job
    await addEnrichmentJob(enrichmentJob.id, leadIds, force);

    res.json({
      success: true,
      jobId: enrichmentJob.id,
      totalLeads: leadIds.length,
    });
  } catch (error: any) {
    console.error("Error creating enrichment job for search:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

// --- GET /enrich/:jobId - Get enrichment progress ---
router.get("/enrich/:jobId", auditLogMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { jobId } = req.params;
  const userId = req.user!.id;

  try {
    const jobRecords = await db
      .select()
      .from(enrichmentJobs)
      .where(and(eq(enrichmentJobs.id, jobId), eq(enrichmentJobs.userId, userId)))
      .limit(1);

    if (jobRecords.length === 0) {
      res.status(404).json({ error: "Enrichment job not found" });
      return;
    }

    const job = jobRecords[0];
    const totalLeads = job.totalLeads ?? 0;
    const completedLeads = job.completedLeads ?? 0;
    const failedLeads = job.failedLeads ?? 0;
    const remainingLeads = Math.max(0, totalLeads - completedLeads - failedLeads);

    // Calculate currentlyProcessing: leads that are in "running" status
    // This is an approximation based on the batch being processed
    const currentlyProcessing = job.status === "running" ? Math.min(5, remainingLeads) : 0;

    res.json({
      success: true,
      id: job.id,
      status: job.status,
      progress: job.progress ?? 0,
      totalLeads,
      completedLeads,
      failedLeads,
      remainingLeads,
      currentlyProcessing,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } catch (error: any) {
    console.error("Error fetching enrichment job:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

// --- DELETE /enrich/:jobId - Cancel an enrichment job ---
router.delete("/enrich/:jobId", auditLogMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { jobId } = req.params;
  const userId = req.user!.id;

  try {
    const jobRecords = await db
      .select()
      .from(enrichmentJobs)
      .where(and(eq(enrichmentJobs.id, jobId), eq(enrichmentJobs.userId, userId)))
      .limit(1);

    if (jobRecords.length === 0) {
      res.status(404).json({ error: "Enrichment job not found" });
      return;
    }

    const job = jobRecords[0];

    if (job.status === "completed" || job.status === "cancelled" || job.status === "failed") {
      res.status(400).json({ error: `Cannot cancel a job that is already ${job.status}` });
      return;
    }

    // Mark as cancelled in DB — the worker checks for cancellation between batches
    await db.update(enrichmentJobs)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(eq(enrichmentJobs.id, jobId));

    // Attempt to remove from BullMQ queue if still waiting
    try {
      const bullJobs = await enrichmentQueue.getJobs(["waiting", "delayed"]);
      for (const bullJob of bullJobs) {
        if (bullJob.data.enrichmentJobId === jobId) {
          await bullJob.remove();
          break;
        }
      }
    } catch (queueErr) {
      console.warn("Could not remove job from BullMQ queue:", queueErr);
    }

    res.json({ success: true, message: "Enrichment job cancelled" });
  } catch (error: any) {
    console.error("Error cancelling enrichment job:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

export default router;
