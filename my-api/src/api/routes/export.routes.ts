import { Router, Request, Response } from "express";
import { ExportService, SearchNotFoundError, NoLeadsFoundError } from "../../services/export.service";

const router = Router();

router.get("/csv/:searchId", async (req: Request, res: Response): Promise<void> => {
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

router.get("/excel/:searchId", async (req: Request, res: Response): Promise<void> => {
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
