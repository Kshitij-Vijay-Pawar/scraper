import { db } from "./db";
import { searches } from "./db/schema";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  console.log("Testing database connection...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL);
  try {
    const results = await db.select().from(searches).limit(5);
    console.log("Success! Found searches:", results);
    const { leads } = await import("./db/schema");
    const leadsCount = await db.select().from(leads);
    console.log("Found leads count:", leadsCount.length);
    const latestLeads = leadsCount.filter(l => l.searchId === "1e285f19-e7d0-47b1-92b9-56e649525754");
    console.log("Latest leads count:", latestLeads.length);
    console.log("Sample latest lead:", latestLeads[0]);
  } catch (err) {
    console.error("Connection failed:", err);
  }
  process.exit(0);
}

test();
