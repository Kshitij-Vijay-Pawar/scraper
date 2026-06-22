import { db } from "../db";
import { leads, Lead, NewLead } from "../db/schema";
import { eq, and, sql, or, inArray, isNull } from "drizzle-orm";

/**
 * Normalizes a string by converting it to lowercase, removing non-alphanumeric characters, and trimming.
 */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Checks if a single lead exists in the database based on the priority rules.
 * Priority: Website -> Phone -> Email -> (Name + Address if others are missing)
 */
export async function findExistingLead(lead: NewLead): Promise<Lead | null> {
  // Priority 1: website
  if (lead.website && lead.website.trim() !== "") {
    const existing = await db
      .select()
      .from(leads)
      .where(eq(leads.website, lead.website.trim()))
      .limit(1);
    if (existing.length > 0) {
      return existing[0];
    }
  }

  // Priority 2: phone
  if (lead.phone && lead.phone.trim() !== "") {
    const existing = await db
      .select()
      .from(leads)
      .where(eq(leads.phone, lead.phone.trim()))
      .limit(1);
    if (existing.length > 0) {
      return existing[0];
    }
  }

  // Priority 3: email
  if (lead.email && lead.email.trim() !== "") {
    const existing = await db
      .select()
      .from(leads)
      .where(eq(leads.email, lead.email.trim()))
      .limit(1);
    if (existing.length > 0) {
      return existing[0];
    }
  }

  // Priority 4: name + address (only if website, phone, and email are missing)
  const hasWebsite = lead.website && lead.website.trim() !== "";
  const hasPhone = lead.phone && lead.phone.trim() !== "";
  const hasEmail = lead.email && lead.email.trim() !== "";
  if (!hasWebsite && !hasPhone && !hasEmail) {
    if (lead.name && lead.address && lead.name.trim() !== "" && lead.address.trim() !== "") {
      const normName = normalize(lead.name);
      const normAddr = normalize(lead.address);
      const existing = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(sql`lower(regexp_replace(${leads.name}, '[^a-zA-Z0-9]', '', 'g'))`, normName),
            eq(sql`lower(regexp_replace(${leads.address}, '[^a-zA-Z0-9]', '', 'g'))`, normAddr)
          )
        )
        .limit(1);
      if (existing.length > 0) {
        return existing[0];
      }
    }
  }

  return null;
}

/**
 * Checks if a lead is a duplicate.
 */
export async function isDuplicate(lead: NewLead): Promise<boolean> {
  const existing = await findExistingLead(lead);
  return existing !== null;
}

/**
 * Filters out duplicates from a list of leads.
 * Uses a batch query to load relevant database records once and tracks duplicates in-memory
 * to handle duplicates within the same scraping run.
 */
export async function filterNewLeads(leadsList: NewLead[]): Promise<{
  newLeads: NewLead[];
  duplicates: NewLead[];
}> {
  const newLeads: NewLead[] = [];
  const duplicates: NewLead[] = [];

  // In-memory sets to prevent duplicates within the same scrape run
  const seenWebsites = new Set<string>();
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const seenNamesAddresses = new Set<string>();

  // Extract non-empty websites, phones, emails, and normalized names/addresses from the batch
  const batchWebsites: string[] = [];
  const batchPhones: string[] = [];
  const batchEmails: string[] = [];
  const batchNormNames: string[] = [];

  for (const lead of leadsList) {
    if (lead.website && lead.website.trim() !== "") {
      batchWebsites.push(lead.website.trim());
    }
    if (lead.phone && lead.phone.trim() !== "") {
      batchPhones.push(lead.phone.trim());
    }
    if (lead.email && lead.email.trim() !== "") {
      batchEmails.push(lead.email.trim());
    }
    if (lead.name) {
      batchNormNames.push(normalize(lead.name));
    }
  }

  // Load matching data from database once using a batch query
  const dbConditions = [];
  if (batchWebsites.length > 0) {
    dbConditions.push(inArray(leads.website, batchWebsites));
  }
  if (batchPhones.length > 0) {
    dbConditions.push(inArray(leads.phone, batchPhones));
  }
  if (batchEmails.length > 0) {
    dbConditions.push(inArray(leads.email, batchEmails));
  }
  if (batchNormNames.length > 0) {
    // Fetch leads where website, phone, email are null and name matches one of our normalized names
    dbConditions.push(
      and(
        isNull(leads.website),
        isNull(leads.phone),
        isNull(leads.email),
        inArray(sql`lower(regexp_replace(${leads.name}, '[^a-zA-Z0-9]', '', 'g'))`, batchNormNames)
      )
    );
  }

  const existingWebsites = new Set<string>();
  const existingPhones = new Set<string>();
  const existingEmails = new Set<string>();
  const existingNamesAddresses = new Set<string>();

  if (dbConditions.length > 0) {
    const dbLeads = await db
      .select()
      .from(leads)
      .where(or(...dbConditions));

    for (const dl of dbLeads) {
      if (dl.website && dl.website.trim() !== "") {
        existingWebsites.add(dl.website.trim());
      }
      if (dl.phone && dl.phone.trim() !== "") {
        existingPhones.add(dl.phone.trim());
      }
      if (dl.email && dl.email.trim() !== "") {
        existingEmails.add(dl.email.trim());
      }
      // Keep track of name + address of those that have no website/phone/email
      if ((!dl.website || dl.website.trim() === "") && 
          (!dl.phone || dl.phone.trim() === "") && 
          (!dl.email || dl.email.trim() === "")) {
        if (dl.name && dl.address) {
          const normKey = `${normalize(dl.name)}|||${normalize(dl.address)}`;
          existingNamesAddresses.add(normKey);
        }
      }
    }
  }

  // Deduplicate sequentially in memory
  for (const lead of leadsList) {
    const web = lead.website?.trim();
    const ph = lead.phone?.trim();
    const em = lead.email?.trim();
    const name = lead.name?.trim();
    const addr = lead.address?.trim();

    let isDupe = false;

    // Priority 1: Website
    if (web && web !== "") {
      if (seenWebsites.has(web) || existingWebsites.has(web)) {
        isDupe = true;
      }
    }

    // Priority 2: Phone
    if (!isDupe && ph && ph !== "") {
      if (seenPhones.has(ph) || existingPhones.has(ph)) {
        isDupe = true;
      }
    }

    // Priority 3: Email
    if (!isDupe && em && em !== "") {
      if (seenEmails.has(em) || existingEmails.has(em)) {
        isDupe = true;
      }
    }

    // Priority 4: Name + Address (only if website, phone, and email are missing)
    const hasWebsite = web && web !== "";
    const hasPhone = ph && ph !== "";
    const hasEmail = em && em !== "";
    if (!isDupe && !hasWebsite && !hasPhone && !hasEmail) {
      if (name && addr && name !== "" && addr !== "") {
        const normKey = `${normalize(name)}|||${normalize(addr)}`;
        if (seenNamesAddresses.has(normKey) || existingNamesAddresses.has(normKey)) {
          isDupe = true;
        }
      }
    }

    if (isDupe) {
      duplicates.push(lead);
    } else {
      newLeads.push(lead);
      // Track in memory for same-run duplicates
      if (web && web !== "") seenWebsites.add(web);
      if (ph && ph !== "") seenPhones.add(ph);
      if (em && em !== "") seenEmails.add(em);
      if (!hasWebsite && !hasPhone && !hasEmail && name && addr && name !== "" && addr !== "") {
        const normKey = `${normalize(name)}|||${normalize(addr)}`;
        seenNamesAddresses.add(normKey);
      }
    }
  }

  return { newLeads, duplicates };
}
