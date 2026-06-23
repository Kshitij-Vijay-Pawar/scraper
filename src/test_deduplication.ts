import { db } from "./db";
import { searches, leads, NewLead } from "./db/schema";
import { filterNewLeads, findExistingLead, isDuplicate, normalize } from "./services/deduplication";
import { eq } from "drizzle-orm";

async function runTests() {
  console.log("----------------------------------------");
  console.log("Starting Lead Deduplication Tests...");
  console.log("----------------------------------------");

  // Create a dummy search job to assign to testing leads
  const [testSearch] = await db
    .insert(searches)
    .values({
      keyword: "dedupe-test",
      location: "test-land",
      status: "completed",
    })
    .returning();
  
  const searchId = testSearch.id;
  console.log(`Created dummy search ID: ${searchId}`);

  // Test 1: String Normalization
  console.log("\n[Test 1] String Normalization Helper");
  const norm1 = normalize("ABC Gym");
  const norm2 = normalize("  abc-gym! ");
  console.log(`"ABC Gym" normalized -> "${norm1}"`);
  console.log(`"  abc-gym! " normalized -> "${norm2}"`);
  if (norm1 === "abcgym" && norm2 === "abcgym") {
    console.log("✅ Test 1 Passed: Normalization behaves correctly.");
  } else {
    throw new Error("❌ Test 1 Failed: Normalization mismatch.");
  }

  // Test 2: Website Matching Priority
  console.log("\n[Test 2] Priority 1: Website duplicate matching");
  // Clean up any existing lead with this website to start fresh
  const website = `http://unique-gym-${Date.now()}.com`;
  const lead1: NewLead = {
    searchId,
    name: "Unique Gym Name",
    website,
  };
  const isDupeBefore = await isDuplicate(lead1);
  console.log(`Duplicate check before insert: ${isDupeBefore} (expected false)`);

  // Insert to DB
  await db.insert(leads).values(lead1);

  // Check again
  const isDupeAfter = await isDuplicate(lead1);
  console.log(`Duplicate check after insert: ${isDupeAfter} (expected true)`);
  if (!isDupeBefore && isDupeAfter) {
    console.log("✅ Test 2 Passed: Website duplication detected.");
  } else {
    throw new Error("❌ Test 2 Failed: Website duplicate not detected.");
  }

  // Test 3: Phone Matching Priority
  console.log("\n[Test 3] Priority 2: Phone duplicate matching");
  const phone = `phone-num-${Date.now()}`;
  const leadPhone: NewLead = {
    searchId,
    name: "Unique Phone Gym",
    phone,
  };
  const isPhoneDupeBefore = await isDuplicate(leadPhone);
  console.log(`Duplicate check before insert: ${isPhoneDupeBefore} (expected false)`);

  // Insert to DB
  await db.insert(leads).values(leadPhone);

  // Check again
  const isPhoneDupeAfter = await isDuplicate(leadPhone);
  console.log(`Duplicate check after insert: ${isPhoneDupeAfter} (expected true)`);
  if (!isPhoneDupeBefore && isPhoneDupeAfter) {
    console.log("✅ Test 3 Passed: Phone duplication detected.");
  } else {
    throw new Error("❌ Test 3 Failed: Phone duplicate not detected.");
  }

  // Test 4: Email Matching Priority
  console.log("\n[Test 4] Priority 3: Email duplicate matching");
  const email = `unique-email-${Date.now()}@gmail.com`;
  const leadEmail: NewLead = {
    searchId,
    name: "Unique Email Gym",
    email,
  };
  const isEmailDupeBefore = await isDuplicate(leadEmail);
  console.log(`Duplicate check before insert: ${isEmailDupeBefore} (expected false)`);

  // Insert to DB
  await db.insert(leads).values(leadEmail);

  // Check again
  const isEmailDupeAfter = await isDuplicate(leadEmail);
  console.log(`Duplicate check after insert: ${isEmailDupeAfter} (expected true)`);
  if (!isEmailDupeBefore && isEmailDupeAfter) {
    console.log("✅ Test 4 Passed: Email duplication detected.");
  } else {
    throw new Error("❌ Test 4 Failed: Email duplicate not detected.");
  }

  // Test 5: Name + Address Matching (fallback when website, phone, email are missing)
  console.log("\n[Test 5] Priority 4: Name + Address normalized duplicate matching");
  const gymName = `Dedupe Gym ${Date.now()}`;
  const gymAddress = "123, Goa, India";

  const leadNameAddr1: NewLead = {
    searchId,
    name: gymName,
    address: gymAddress,
  };

  const leadNameAddr2: NewLead = {
    searchId,
    name: gymName + "  -!!!", // slightly different string but normalizes to same
    address: "123, Goa - India",
  };

  const isNameAddrDupeBefore = await isDuplicate(leadNameAddr1);
  console.log(`First check before insert: ${isNameAddrDupeBefore} (expected false)`);

  // Insert first to DB
  await db.insert(leads).values(leadNameAddr1);

  // Check second (which has slightly different formatting but same normalized name + address)
  const isNameAddrDupeAfter = await isDuplicate(leadNameAddr2);
  console.log(`Second check after inserting first: ${isNameAddrDupeAfter} (expected true)`);
  if (!isNameAddrDupeBefore && isNameAddrDupeAfter) {
    console.log("✅ Test 5 Passed: Name + Address duplication detected.");
  } else {
    throw new Error("❌ Test 5 Failed: Name + Address duplicate not detected.");
  }

  // Test 6: Missing Everything (Allow insertion)
  console.log("\n[Test 6] Missing Everything: Allow insertion, do not block");
  const leadMissingEverything1: NewLead = {
    searchId,
    name: "No Info Gym",
  };
  const leadMissingEverything2: NewLead = {
    searchId,
    name: "No Info Gym", // same name but address, phone, website are all missing
  };

  const isMissingDupe = await isDuplicate(leadMissingEverything2);
  console.log(`Duplicate check for missing info lead: ${isMissingDupe} (expected false)`);
  if (!isMissingDupe) {
    console.log("✅ Test 6 Passed: Missing info leads are allowed to insert.");
  } else {
    throw new Error("❌ Test 6 Failed: Missing info lead was incorrectly blocked.");
  }

  // Test 7: Same-scrape contains duplicates (Batch/In-Memory check)
  console.log("\n[Test 7] Same-scrape duplicates (FilterNewLeads)");
  const batchWebsite = `http://batch-gym-${Date.now()}.com`;
  const batchPhone = `batch-phone-${Date.now()}`;
  const batchEmail = `batch-email-${Date.now()}@gmail.com`;

  const scrapeBatch: NewLead[] = [
    { searchId, name: "Batch Gym 1", website: batchWebsite }, // First unique website
    { searchId, name: "Batch Gym 1", website: batchWebsite }, // Duplicate website (should skip)
    { searchId, name: "Batch Gym 2", phone: batchPhone },     // First unique phone
    { searchId, name: "Batch Gym 2", phone: batchPhone },     // Duplicate phone (should skip)
    { searchId, name: "Batch Gym 3", email: batchEmail },     // First unique email
    { searchId, name: "Batch Gym 3", email: batchEmail },     // Duplicate email (should skip)
    { searchId, name: "Batch Gym 4", address: "Goa Road 1" }, // First name+address
    { searchId, name: "Batch Gym 4!!!", address: "Goa Road - 1" }, // Duplicate name+address (should skip)
    { searchId, name: "Batch Gym 5" },                        // Missing info 1 (unique/allowed)
    { searchId, name: "Batch Gym 5" },                        // Missing info 2 (unique/allowed)
  ];

  const { newLeads, duplicates } = await filterNewLeads(scrapeBatch);
  console.log(`Filtered batch leads. New: ${newLeads.length}, Duplicates: ${duplicates.length}`);
  
  // We expect:
  // - Batch Gym 1 (first) -> new
  // - Batch Gym 1 (second) -> dupe
  // - Batch Gym 2 (first) -> new
  // - Batch Gym 2 (second) -> dupe
  // - Batch Gym 3 (first) -> new
  // - Batch Gym 3 (second) -> dupe
  // - Batch Gym 4 (first) -> new
  // - Batch Gym 4 (second) -> dupe
  // - Batch Gym 5 (first) -> new
  // - Batch Gym 5 (second) -> new (allowed because missing details)
  // Total new: 6
  // Total duplicates: 4
  
  if (newLeads.length === 6 && duplicates.length === 4) {
    console.log("✅ Test 7 Passed: Same-scrape batch deduplication matches expected counts.");
  } else {
    console.error(`Expected 6 new and 4 duplicates, but got: New ${newLeads.length}, Duplicates ${duplicates.length}`);
    throw new Error("❌ Test 7 Failed: Same-scrape batch deduplication incorrect.");
  }

  console.log("\n----------------------------------------");
  console.log("All tests completed successfully!");
  console.log("----------------------------------------");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
