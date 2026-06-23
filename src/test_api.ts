import { db } from "./db";
import { searches, leads } from "./db/schema";
import { eq } from "drizzle-orm";
import { enrichSingleLead } from "./services/enrichment";
import express from "express";

const BASE_URL = "http://localhost:3000";

// --- MOCK WEBSITE SERVER ---
const mockServer = express();
mockServer.get("/", (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Home Page</h1>
        <p>Emails found in body: info@test.com and sales@test.com</p>
        <a href="/contact">Go to Contact</a>
        <a href="https://facebook.com/testbusiness">Facebook</a>
      </body>
    </html>
  `);
});

mockServer.get("/contact", (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Contact Us</h1>
        <p>Send enquiries to support@test.com</p>
        <a href="https://instagram.com/testbusiness">Instagram</a>
      </body>
    </html>
  `);
});

mockServer.get("/no-emails", (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>No Emails Page</h1>
        <p>There are no email patterns in this website's HTML source.</p>
      </body>
    </html>
  `);
});

mockServer.get("/dead", (req, res) => {
  res.status(500).send("Internal Server Error");
});

let serverInstance: any;

async function runTests() {
  console.log("----------------------------------------");
  console.log("Starting API & Enrichment Verification Tests...");
  console.log("----------------------------------------");

  // Spin up mock server on port 3001
  serverInstance = mockServer.listen(3001, () => {
    console.log("Mock website server running on port 3001");
  });

  // Wait 1.5s for servers to settle
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // --- API VALIDATION TESTS ---
  console.log("\n[Test 1] Missing Location (Expect 400 Bad Request)");
  try {
    const res = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: "gym" }),
    });
    console.log("Status:", res.status);
    const body = await res.json();
    console.log("Response:", JSON.stringify(body, null, 2));
  } catch (err: any) {
    console.error("Test 1 Failed:", err.message);
  }

  console.log("\n[Test 2] Empty Keyword (Expect 400 Bad Request)");
  try {
    const res = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: "", location: "goa" }),
    });
    console.log("Status:", res.status);
    const body = await res.json();
    console.log("Response:", JSON.stringify(body, null, 2));
  } catch (err: any) {
    console.error("Test 2 Failed:", err.message);
  }

  console.log("\n[Test 3] Null Values (Expect 400 Bad Request)");
  try {
    const res = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: null, location: null }),
    });
    console.log("Status:", res.status);
    const body = await res.json();
    console.log("Response:", JSON.stringify(body, null, 2));
  } catch (err: any) {
    console.error("Test 3 Failed:", err.message);
  }

  // --- DATABASE SCHEMA VALIDATION ---
  console.log("\n[Test 4] Database schema verification...");
  try {
    const latestLeads = await db.select().from(leads).limit(1);
    console.log("Database schema keys in lead records:", Object.keys(latestLeads[0] || {}));
  } catch (err: any) {
    console.error("Test 4 Failed:", err.message);
  }

  // Create a dummy search record for manual lead inserts
  let dummySearchId = "";
  try {
    const [mockSearch] = await db.insert(searches).values({
      keyword: "enrichment-test",
      location: "local",
      status: "completed",
    }).returning();
    dummySearchId = mockSearch.id;
  } catch (err: any) {
    console.error("Failed to create mock search job:", err.message);
  }

  // --- LEAD ENRICHMENT LOGIC TESTS ---
  if (dummySearchId) {
    // Test 5: Enrichment Success (Multiple emails & Subpage crawling & Email priority selection)
    console.log("\n[Test 5] Enrichment: Reachable with multiple emails & contact page (Expect completed, sales@test.com primary)");
    try {
      const [mockLead] = await db.insert(leads).values({
        searchId: dummySearchId,
        name: "Mock Biz 1 - Multi Emails",
        website: "http://localhost:3001",
      }).returning();

      await enrichSingleLead(mockLead.id, mockLead.website!);

      const [updatedLead]: any = await db.select().from(leads).where(eq(leads.id, mockLead.id));
      console.log("Enrichment Status:", updatedLead.enrichmentStatus);
      console.log("Primary Email (Priority Match):", updatedLead.email); // Expect sales@test.com
      console.log("All Emails Found:", updatedLead.emails); // Expect info@, sales@, support@
      console.log("Facebook URL:", updatedLead.facebook);
      console.log("Instagram URL:", updatedLead.instagram);
    } catch (err: any) {
      console.error("Test 5 Failed:", err.message);
    }

    // Test 6: Reachable with NO emails
    console.log("\n[Test 6] Enrichment: Reachable but no emails found (Expect completed, email = null)");
    try {
      const [mockLead] = await db.insert(leads).values({
        searchId: dummySearchId,
        name: "Mock Biz 2 - No Emails",
        website: "http://localhost:3001/no-emails",
      }).returning();

      await enrichSingleLead(mockLead.id, mockLead.website!);

      const [updatedLead]: any = await db.select().from(leads).where(eq(leads.id, mockLead.id));
      console.log("Enrichment Status:", updatedLead.enrichmentStatus);
      console.log("Primary Email:", updatedLead.email);
      console.log("All Emails:", updatedLead.emails);
    } catch (err: any) {
      console.error("Test 6 Failed:", err.message);
    }

    // Test 7: Dead Site
    console.log("\n[Test 7] Enrichment: Dead / Unreachable website (Expect failed, email = null)");
    try {
      const [mockLead] = await db.insert(leads).values({
        searchId: dummySearchId,
        name: "Mock Biz 3 - Dead Web",
        website: "http://localhost:3001/dead",
      }).returning();

      await enrichSingleLead(mockLead.id, mockLead.website!);

      const [updatedLead]: any = await db.select().from(leads).where(eq(leads.id, mockLead.id));
      console.log("Enrichment Status:", updatedLead.enrichmentStatus);
      console.log("Primary Email:", updatedLead.email);
    } catch (err: any) {
      console.error("Test 7 Failed:", err.message);
    }
  }

  console.log("\n----------------------------------------");
  console.log("Tests Completed.");
  console.log("----------------------------------------");
  
  // Shutdown mock website server and exit
  serverInstance.close();
  process.exit(0);
}

runTests();
