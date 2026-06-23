import axios from "axios";
import * as cheerio from "cheerio";
import { db } from "../db";
import { leads } from "../db/schema";
import { eq } from "drizzle-orm";

interface ScrapedData {
  emails: string[];
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  twitter: string | null;
}

// Normalize URLs to start with http/https
function normalizeUrl(url: string): string {
  if (!url) return "";
  let cleanUrl = url.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = "http://" + cleanUrl;
  }
  return cleanUrl;
}

// Clean and prioritize emails
function selectPrimaryEmail(emails: string[]): string | null {
  if (emails.length === 0) return null;

  const priorities = [/^sales@/i, /^contact@/i, /^info@/i, /^support@/i, /^admin@/i];

  for (const regex of priorities) {
    const matched = emails.find(e => regex.test(e));
    if (matched) return matched.toLowerCase();
  }

  return emails[0]!.toLowerCase();
}

// Clean up false-positive email strings (e.g. image URLs or assets)
function isValidEmail(email: string): boolean {
  const invalidExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js", ".html", ".php"];
  const lower = email.toLowerCase();
  return !invalidExtensions.some(ext => lower.endsWith(ext));
}

// Enrich a single lead by crawling its website
// DATA PRIORITY RULES:
// 1. Google Maps data is the primary source of truth (highest priority).
// 2. Website enrichment may only fill fields that are currently null.
// 3. Never overwrite existing non-null Google Maps values.
export async function enrichSingleLead(leadId: string, rawWebsite: string): Promise<void> {
  const websiteUrl = normalizeUrl(rawWebsite);
  if (!websiteUrl) {
    await db.update(leads)
      .set({
        enrichmentStatus: "failed",
        websiteLastChecked: new Date(),
      })
      .where(eq(leads.id, leadId));
    return;
  }

  const scrapedEmails = new Set<string>();
  let facebook: string | null = null;
  let instagram: string | null = null;
  let linkedin: string | null = null;
  let twitter: string | null = null;

  // Track which page provided the data
  let emailSource: string | null = null;
  let socialSource: string | null = null;

  const client = axios.create({
    timeout: 8000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    },
    validateStatus: () => true, // Don't throw errors for 4xx/5xx pages to extract content
  });

  // Helper to identify page type from URL for source tracking
  function getPageType(pageUrl: string): string {
    const lower = pageUrl.toLowerCase();
    if (/\b(contact)\b/i.test(lower)) return "contact";
    if (/\b(about)\b/i.test(lower)) return "about";
    if (/\b(team)\b/i.test(lower)) return "team";
    if (/\b(support)\b/i.test(lower)) return "support";
    return "homepage";
  }

  // Helper to extract emails and socials from a cheerio document
  function extractFromPage($: cheerio.CheerioAPI, pageType: string) {
    // Extract emails from mailto anchors
    $('a[href^="mailto:"]').each((_, element) => {
      const href = $(element).attr("href") || "";
      const email = href.replace(/mailto:/i, "").split("?")[0]?.trim();
      if (email && isValidEmail(email)) {
        if (scrapedEmails.size === 0) emailSource = pageType;
        scrapedEmails.add(email);
      }
    });

    // Extract emails using regex on raw body text
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const bodyText = $("body").text();
    const bodyMatches = bodyText.match(emailRegex);
    if (bodyMatches) {
      bodyMatches.forEach(email => {
        if (isValidEmail(email)) {
          if (scrapedEmails.size === 0) emailSource = pageType;
          scrapedEmails.add(email);
        }
      });
    }

    // Extract social media links from anchors
    $("a[href]").each((_, element) => {
      const href = $(element).attr("href")?.trim();
      if (!href) return;

      if (/facebook\.com\/(?!sharer|plugins|groups)/i.test(href)) {
        if (!facebook) socialSource = pageType;
        facebook = facebook || href;
      } else if (/instagram\.com\//i.test(href)) {
        if (!instagram && !socialSource) socialSource = pageType;
        instagram = instagram || href;
      } else if (/linkedin\.com\/(?!share|company\/[^/]+\/shared)/i.test(href)) {
        if (!linkedin && !socialSource) socialSource = pageType;
        linkedin = linkedin || href;
      } else if (/(twitter\.com|x\.com)\//i.test(href)) {
        if (!twitter && !socialSource) socialSource = pageType;
        twitter = twitter || href;
      }
    });
  }

  try {
    // 1. Visit homepage
    const response = await client.get(websiteUrl);
    if (response.status >= 400 && response.status !== 404) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const html = response.data;
    if (typeof html !== "string") {
      throw new Error("Invalid response format");
    }

    const $ = cheerio.load(html);
    extractFromPage($, "homepage");

    // 2. Discover subpages (e.g. contact, about)
    const subpagesToVisit = new Set<string>();
    const domain = new URL(websiteUrl).origin;

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href")?.trim();
      if (!href) return;

      const contactOrAbout = /\b(contact|about|team|support)\b/i.test(href);
      if (contactOrAbout) {
        try {
          const resolvedUrl = new URL(href, websiteUrl);
          if (resolvedUrl.origin === domain && resolvedUrl.href !== websiteUrl) {
            subpagesToVisit.add(resolvedUrl.href);
          }
        } catch (e) {
          // ignore invalid relative links
        }
      }
    });

    // Limit crawling to at most 3 internal subpages
    const pagesToScrape = Array.from(subpagesToVisit).slice(0, 3);
    for (const pageUrl of pagesToScrape) {
      try {
        console.log(`Crawling subpage: ${pageUrl}`);
        const subResponse = await client.get(pageUrl);
        const subHtml = subResponse.data;
        if (typeof subHtml === "string") {
          const sub$ = cheerio.load(subHtml);
          const pageType = getPageType(pageUrl);
          extractFromPage(sub$, pageType);
        }
      } catch (subErr) {
        console.warn(`Failed to crawl subpage ${pageUrl}:`, subErr);
      }
    }

    const allEmails = Array.from(scrapedEmails);
    const primaryEmail = selectPrimaryEmail(allEmails);

    // 3. Enforce Data Priority Rules:
    // Fetch existing lead to check which fields are already populated from Google Maps.
    // Only populate fields that are currently null.
    const existingLeadRecords = await db.select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);
    const existingLead = existingLeadRecords[0];

    const updateData: Record<string, any> = {
      enrichmentStatus: "completed",
      websiteLastChecked: new Date(),
    };

    // Only fill null fields — never overwrite Google Maps data
    if (existingLead) {
      if (existingLead.email === null && primaryEmail) {
        updateData.email = primaryEmail;
      }
      if (existingLead.emails === null || (Array.isArray(existingLead.emails) && existingLead.emails.length === 0)) {
        if (allEmails.length > 0) updateData.emails = allEmails;
      }
      if (existingLead.facebook === null && facebook) updateData.facebook = facebook;
      if (existingLead.instagram === null && instagram) updateData.instagram = instagram;
      if (existingLead.linkedin === null && linkedin) updateData.linkedin = linkedin;
      if (existingLead.twitter === null && twitter) updateData.twitter = twitter;
    } else {
      // Lead doesn't exist (shouldn't happen), set all fields
      if (primaryEmail) updateData.email = primaryEmail;
      if (allEmails.length > 0) updateData.emails = allEmails;
      if (facebook) updateData.facebook = facebook;
      if (instagram) updateData.instagram = instagram;
      if (linkedin) updateData.linkedin = linkedin;
      if (twitter) updateData.twitter = twitter;
    }

    // Track enrichment source
    if (emailSource) updateData.emailSource = emailSource;
    if (socialSource) updateData.socialSource = socialSource;

    // Save enrichment results to DB
    await db.update(leads)
      .set(updateData)
      .where(eq(leads.id, leadId));

  } catch (error: any) {
    console.error(`Enrichment failed for lead ${leadId} (${websiteUrl}):`, error.message);
    await db.update(leads)
      .set({
        enrichmentStatus: "failed",
        websiteLastChecked: new Date(),
      })
      .where(eq(leads.id, leadId));
  }
}

