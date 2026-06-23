import { db } from "../db";
import { searches, leads } from "../db/schema";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";

// Custom errors to handle different HTTP response scenarios
export class SearchNotFoundError extends Error {
  constructor() {
    super("Search not found");
    this.name = "SearchNotFoundError";
  }
}

export class NoLeadsFoundError extends Error {
  constructor() {
    super("No leads found");
    this.name = "NoLeadsFoundError";
  }
}

const HEADERS = [
  "Name",
  "Phone",
  "Email",
  "Website",
  "Address",
  "Rating",
  "Reviews",
  "Facebook",
  "Instagram",
  "LinkedIn",
  "Twitter",
  "Latitude",
  "Longitude"
];

function mapLeadsToExportData(dbLeads: any[]) {
  return dbLeads.map(lead => ({
    "Name": lead.name ?? "",
    "Phone": lead.phone ?? "",
    "Email": lead.email ?? "",
    "Website": lead.website ?? "",
    "Address": lead.address ?? "",
    "Rating": lead.rating !== null && lead.rating !== undefined ? lead.rating : "",
    "Reviews": lead.reviews !== null && lead.reviews !== undefined ? lead.reviews : "",
    "Facebook": lead.facebook ?? "",
    "Instagram": lead.instagram ?? "",
    "LinkedIn": lead.linkedin ?? "",
    "Twitter": lead.twitter ?? "",
    "Latitude": lead.latitude !== null && lead.latitude !== undefined ? lead.latitude : "",
    "Longitude": lead.longitude !== null && lead.longitude !== undefined ? lead.longitude : ""
  }));
}

function generateCsv(data: Record<string, any>[], headers: string[]): string {
  const escapeValue = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.join(",");
  const rows = data.map(row => 
    headers.map(header => escapeValue(row[header])).join(",")
  );

  return [headerRow, ...rows].join("\r\n");
}

export class ExportService {
  private static async getLeadsForSearch(searchId: string) {
    let searchRecords;
    try {
      searchRecords = await db
        .select()
        .from(searches)
        .where(eq(searches.id, searchId))
        .limit(1);
    } catch (err) {
      // Catch invalid UUID formatting/query errors and treat as not found
      throw new SearchNotFoundError();
    }

    if (searchRecords.length === 0) {
      throw new SearchNotFoundError();
    }

    const leadRecords = await db
      .select()
      .from(leads)
      .where(eq(leads.searchId, searchId));

    if (leadRecords.length === 0) {
      throw new NoLeadsFoundError();
    }

    return mapLeadsToExportData(leadRecords);
  }

  public static async exportToCsv(searchId: string): Promise<string> {
    const data = await this.getLeadsForSearch(searchId);
    return generateCsv(data, HEADERS);
  }

  public static async exportToExcel(searchId: string): Promise<Buffer> {
    const data = await this.getLeadsForSearch(searchId);
    
    const worksheet = XLSX.utils.json_to_sheet(data, { header: HEADERS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return buffer as Buffer;
  }
}
