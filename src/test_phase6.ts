import { db } from "./db";
import { users, apiKeys, apiUsageLogs } from "./db/schema";
import { eq } from "drizzle-orm";

const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("==================================================");
  console.log("Starting Phase 6: Auth & API Keys Verification...");
  console.log("==================================================");

  // Cleanup past test users to avoid duplicate key conflicts
  const testEmailA = "usera@test.com";
  const testEmailB = "userb@test.com";
  
  try {
    await db.delete(users).where(eq(users.email, testEmailA));
    await db.delete(users).where(eq(users.email, testEmailB));
    console.log("Cleaned up existing test users.");
  } catch (err) {
    console.warn("Cleanup warning (may be first run):", err);
  }

  // --- Test 1: Register User A ---
  console.log("\n[Test 1] Register User A...");
  let userA: any;
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "User A",
        email: testEmailA,
        password: "password123",
      }),
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Body:", JSON.stringify(data, null, 2));
    if (res.status !== 201) throw new Error("Registration A failed");
    userA = data.user;
  } catch (err: any) {
    console.error("Test 1 Failed:", err.message);
    process.exit(1);
  }

  // --- Test 2: Login User A & User B ---
  console.log("\n[Test 2] Login User A...");
  let tokenA = "";
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmailA,
        password: "password123",
      }),
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Body:", JSON.stringify(data, null, 2));
    if (res.status !== 200) throw new Error("Login A failed");
    tokenA = data.token;
  } catch (err: any) {
    console.error("Test 2 Failed:", err.message);
    process.exit(1);
  }

  console.log("\n[Test 2.1] Register & Login User B...");
  let tokenB = "";
  try {
    await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "User B",
        email: testEmailB,
        password: "password123",
      }),
    });
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmailB,
        password: "password123",
      }),
    });
    const data = await res.json();
    tokenB = data.token;
    console.log("User B logged in successfully.");
  } catch (err: any) {
    console.error("Test 2.1 Failed:", err.message);
    process.exit(1);
  }

  // --- Test 2.2: Retrieve Current User Profile ---
  console.log("\n[Test 2.2] Get Current User Profile (/auth/me)...");
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${tokenA}` },
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Profile User A:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Test 2.2 Failed:", err.message);
  }

  // --- Test 3: Create API key ---
  console.log("\n[Test 3] Create API key for User A...");
  let apiKeyA = "";
  try {
    const res = await fetch(`${BASE_URL}/api-keys`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Production Key" }),
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Body (Raw API Key shown once):", JSON.stringify(data, null, 2));
    if (res.status !== 201) throw new Error("API Key creation failed");
    apiKeyA = data.apiKey;
  } catch (err: any) {
    console.error("Test 3 Failed:", err.message);
    process.exit(1);
  }

  // --- Test 3.1: List API keys ---
  console.log("\n[Test 3.1] List API keys for User A...");
  let keyRecordId = "";
  try {
    const res = await fetch(`${BASE_URL}/api-keys`, {
      headers: { "Authorization": `Bearer ${tokenA}` },
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Body (Prefixed keys listed, hash hidden):", JSON.stringify(data, null, 2));
    keyRecordId = data[0].id;
  } catch (err: any) {
    console.error("Test 3.1 Failed:", err.message);
  }

  // --- Test 4: Use API Key to create Search ---
  console.log("\n[Test 4] Use API Key to call POST /search...");
  let searchIdA = "";
  try {
    const res = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: {
        "x-api-key": apiKeyA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword: "dentist",
        location: "Miami",
      }),
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Body:", JSON.stringify(data, null, 2));
    if (res.status !== 200) throw new Error("Search creation failed");
    searchIdA = data.searchId;
  } catch (err: any) {
    console.error("Test 4 Failed:", err.message);
    process.exit(1);
  }

  // Verify usage log and API key statistics in database
  console.log("\n[Test 4.1] Verify API Key statistics and Audit Logs in Database...");
  try {
    const [keyStats] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyRecordId)).limit(1);
    console.log("API Key usage stats - totalSearches:", keyStats.totalSearches, "requestsToday:", keyStats.requestsToday);
    console.log("API Key lastSearchAt:", keyStats.lastSearchAt);

    const logs = await db.select().from(apiUsageLogs).where(eq(apiUsageLogs.apiKeyId, keyRecordId));
    console.log("Audit Logs written in DB for this key:", logs.map(l => ({ endpoint: l.endpoint, status: l.statusCode })));
  } catch (err: any) {
    console.error("Test 4.1 Failed:", err.message);
  }

  // --- Test 5: Revoke API key ---
  console.log("\n[Test 5] Revoking API key...");
  try {
    const res = await fetch(`${BASE_URL}/api-keys/${keyRecordId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${tokenA}` },
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Body:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Test 5 Failed:", err.message);
  }

  console.log("\n[Test 5.1] Reuse Revoked API Key (Expect 401 Unauthorized)...");
  try {
    const res = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: {
        "x-api-key": apiKeyA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword: "dentist",
        location: "Miami",
      }),
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Body:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Test 5.1 Failed:", err.message);
  }

  // --- Test 6: Verify search ownership ---
  console.log("\n[Test 6] Verify search ownership (User B fetching User A's search - Expect 404/401)...");
  try {
    const res = await fetch(`${BASE_URL}/search/${searchIdA}`, {
      headers: { "Authorization": `Bearer ${tokenB}` },
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Body:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Test 6 Failed:", err.message);
  }

  console.log("\n==================================================");
  console.log("Verification finished.");
  console.log("==================================================");
  process.exit(0);
}

runTests();
