import { Router, Request, Response } from "express";
import { ExportService, SearchNotFoundError, NoLeadsFoundError } from "../../services/export.service";
import { authOrApiKeyMiddleware } from "../../middleware/authOrApiKey";
import { db } from "../../db";
import { searches } from "../../db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();
router.use(authOrApiKeyMiddleware);

// Middleware to verify search ownership before export
const checkSearchOwnership = async (req: Request, res: Response, next: any): Promise<void> => {
  const { searchId } = req.params;
  const userId = req.user!.id;

  try {
    const searchRecords = await db
      .select()
      .from(searches)
      .where(and(eq(searches.id, searchId), eq(searches.userId, userId)))
      .limit(1);

    if (searchRecords.length === 0) {
      res.status(404).json({ success: false, message: "Search not found" });
      return;
    }
    next();
  } catch (error) {
    console.error("Error checking search ownership for export:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

router.get("/csv/:searchId", checkSearchOwnership, async (req: Request, res: Response): Promise<void> => {
  const { searchId } = req.params;
  try {
    const csvContent = await ExportService.exportToCsv(searchId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="leads.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    if (error instanceof SearchNotFoundError) {
      res.status(404).json({ success: false, message: "Search not found" });
    } else if (error instanceof NoLeadsFoundError) {
      res.status(404).json({ success: false, message: "No leads found" });
    } else {
      console.error("CSV Export error:", error);
      res.status(500).json({ success: false, message: "Export failed" });
    }
  }
});

router.get("/excel/:searchId", checkSearchOwnership, async (req: Request, res: Response): Promise<void> => {
  const { searchId } = req.params;
  try {
    const buffer = await ExportService.exportToExcel(searchId);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="leads.xlsx"');
    res.status(200).send(buffer);
  } catch (error) {
    if (error instanceof SearchNotFoundError) {
      res.status(404).json({ success: false, message: "Search not found" });
    } else if (error instanceof NoLeadsFoundError) {
      res.status(404).json({ success: false, message: "No leads found" });
    } else {
      console.error("Excel Export error:", error);
      res.status(500).json({ success: false, message: "Export failed" });
    }
  }
});

export default router;
