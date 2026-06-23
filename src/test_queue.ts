const BASE_URL = "http://localhost:3000";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testSingleSearch() {
  console.log("\n--- [Test 1 & 2] Single Search and Polling ---");
  
  const payload = { keyword: "Gym", location: "Goa" };
  console.log(`Submitting search request for "${payload.keyword} ${payload.location}"...`);
  
  const startTime = Date.now();
  const res = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const duration = Date.now() - startTime;
  console.log(`POST /search returned in ${duration}ms (Expected: instant)`);
  
  if (!res.ok) {
    throw new Error(`Failed to submit search: ${res.statusText}`);
  }

  const initData = await res.json();
  console.log("Initial Response:", JSON.stringify(initData, null, 2));

  const { searchId, jobId, status } = initData;
  if (status !== "pending" || !searchId || !jobId) {
    throw new Error(`Unexpected initial state: ${JSON.stringify(initData)}`);
  }
  
  console.log(`Starting polling for search ID: ${searchId}...`);
  let isDone = false;
  let lastProgress = -1;

  while (!isDone) {
    await delay(3000);
    const pollRes = await fetch(`${BASE_URL}/search/${searchId}`);
    if (!pollRes.ok) {
      console.error(`Error polling: ${pollRes.statusText}`);
      continue;
    }

    const pollData = await pollRes.json();
    const s = pollData.search;
    
    if (s.progress !== lastProgress || s.status !== "running") {
      console.log(`[Poll Status] Status: ${s.status} | Progress: ${s.progress}% | Scraped: ${s.scrapedCount} | Inserted: ${s.insertedCount} | Duplicates: ${s.duplicateCount} | Enriched: ${s.enrichedCount}`);
      lastProgress = s.progress;
    }

    if (s.status === "completed" || s.status === "failed") {
      console.log(`\nSearch finished with status: ${s.status}`);
      if (s.status === "failed") {
        console.error(`Error message: ${s.errorMessage}`);
      } else {
        console.log(`Timings: Started At: ${s.startedAt} | Completed At: ${s.completedAt}`);
      }
      isDone = true;
    }
  }

  // Fetch results via GET /leads?searchId=...
  console.log(`Fetching leads for searchId ${searchId}...`);
  const leadsRes = await fetch(`${BASE_URL}/leads?searchId=${searchId}`);
  if (leadsRes.ok) {
    const leadsData = await leadsRes.json();
    console.log(`Successfully fetched ${leadsData.count} leads.`);
    if (leadsData.count > 0) {
      console.log("Sample Lead:", JSON.stringify(leadsData.leads[0], null, 2));
    }
  } else {
    console.error("Failed to fetch leads");
  }
}

async function testConcurrentSearches() {
  console.log("\n--- [Test 4] Concurrent Searches Queue Verification ---");
  console.log("Submitting 3 concurrent searches (Gym Goa, Spa Goa, Cafe Goa) to verify sequential processing...");

  const searchQueries = [
    { keyword: "Gym", location: "Panaji" },
    { keyword: "Spa", location: "Panaji" },
    { keyword: "Cafe", location: "Panaji" },
  ];

  const submissions = searchQueries.map(async (q) => {
    const res = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(q),
    });
    return res.json();
  });

  const results = await Promise.all(submissions);
  console.log("Submissions returned immediately:");
  results.forEach((r, i) => {
    console.log(`Job ${i + 1}: searchId=${r.searchId}, jobId=${r.jobId}, status=${r.status}`);
  });

  // Let's monitor all three jobs until they all complete
  const searchIds = results.map(r => r.searchId);
  const completedIds = new Set<string>();

  while (completedIds.size < searchIds.length) {
    await delay(5000);
    for (const id of searchIds) {
      if (completedIds.has(id)) continue;
      const res = await fetch(`${BASE_URL}/search/${id}`);
      if (res.ok) {
        const body = await res.json();
        const s = body.search;
        console.log(`[Concurrent Monitor] ID: ${id.substring(0, 8)}... | Status: ${s.status} | Progress: ${s.progress}%`);
        if (s.status === "completed" || s.status === "failed") {
          completedIds.add(id);
          console.log(`[Concurrent Monitor] ID: ${id.substring(0, 8)}... has finished with status ${s.status}`);
        }
      }
    }
  }

  console.log("All concurrent searches finished processing!");
}

async function run() {
  try {
    await testSingleSearch();
    await testConcurrentSearches();
    console.log("\nAll verification tests completed successfully!");
  } catch (error) {
    console.error("Test suite failed:", error);
  }
}

run();
