import { db } from "./db";
import { searches, leads } from "./db/schema";
import { eq } from "drizzle-orm";

const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("=========================================");
  console.log("Running Export System Tests...");
  console.log("=========================================");

  // Test Case 3: Invalid searchId (UUID formatting error or not found)
  console.log("\n[Test 1] GET /export/csv/invalid-uuid (Expect 404 - Search not found)");
  try {
    const res = await fetch(`${BASE_URL}/export/csv/invalid-uuid`);
    console.log("Status:", res.status);
    const body = await res.json();
    console.log("Response:", JSON.stringify(body, null, 2));
  } catch (err: any) {
    console.error("Test 1 Failed:", err.message);
  }

  console.log("\n[Test 2] GET /export/csv/00000000-0000-0000-0000-000000000000 (Expect 404 - Search not found)");
  try {
    const res = await fetch(`${BASE_URL}/export/csv/00000000-0000-0000-0000-000000000000`);
    console.log("Status:", res.status);
    const body = await res.json();
    console.log("Response:", JSON.stringify(body, null, 2));
  } catch (err: any) {
    console.error("Test 2 Failed:", err.message);
  }

  // Test Case 4: Search exists but no leads
  console.log("\n[Test 3] Search exists but no leads (Expect 404 - No leads found)");
  let emptySearchId = "";
  try {
    const [emptySearch] = await db.insert(searches).values({
      keyword: "empty-test",
      location: "nowhere",
      status: "completed",
    }).returning();
    emptySearchId = emptySearch.id;

    const res = await fetch(`${BASE_URL}/export/csv/${emptySearchId}`);
    console.log("Status:", res.status);
    const body = await res.json();
    console.log("Response:", JSON.stringify(body, null, 2));
  } catch (err: any) {
    console.error("Test 3 Failed:", err.message);
  }

  // Test Case 1 & 2: Successful CSV & Excel Export
  console.log("\n[Test 4] GET /export/csv/:searchId (Expect 200, CSV body with headers)");
  let searchWithLeadsId = "";
  let leadId = "";
  try {
    const [testSearch] = await db.insert(searches).values({
      keyword: "export-test",
      location: "somewhere",
      status: "completed",
    }).returning();
    searchWithLeadsId = testSearch.id;

    const [testLead] = await db.insert(leads).values({
      searchId: searchWithLeadsId,
      name: "Acme Corp, Inc.", // include comma to test CSV escaping
      phone: "+1234567890",
      email: "info@acme.com",
      website: "https://acme.com",
      address: '123 Road, "Big City"', // include quotes to test escaping
      rating: 4.5,
      reviews: 120,
      facebook: "https://facebook.com/acme",
      instagram: "https://instagram.com/acme",
      linkedin: "https://linkedin.com/company/acme",
      twitter: "https://twitter.com/acme",
      latitude: 40.7128,
      longitude: -74.0060,
    }).returning();
    leadId = testLead.id;

    const res = await fetch(`${BASE_URL}/export/csv/${searchWithLeadsId}`);
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type"));
    console.log("Content-Disposition:", res.headers.get("content-disposition"));
    const text = await res.text();
    console.log("CSV Content:\n", text);
  } catch (err: any) {
    console.error("Test 4 Failed:", err.message);
  }

  console.log("\n[Test 5] GET /export/excel/:searchId (Expect 200, xlsx content)");
  try {
    const res = await fetch(`${BASE_URL}/export/excel/${searchWithLeadsId}`);
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type"));
    console.log("Content-Disposition:", res.headers.get("content-disposition"));
    const arrayBuffer = await res.arrayBuffer();
    console.log("Excel Buffer length:", arrayBuffer.byteLength, "bytes");
  } catch (err: any) {
    console.error("Test 5 Failed:", err.message);
  }

  // Cleanup
  console.log("\nCleaning up test data...");
  try {
    if (emptySearchId) {
      await db.delete(searches).where(eq(searches.id, emptySearchId));
    }
    if (searchWithLeadsId) {
      await db.delete(searches).where(eq(searches.id, searchWithLeadsId));
    }
    console.log("Cleanup completed.");
  } catch (err: any) {
    console.error("Cleanup failed:", err.message);
  }

  process.exit(0);
}

runTests();
