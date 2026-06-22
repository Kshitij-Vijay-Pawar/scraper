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

  const client = axios.create({
    timeout: 8000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    },
    validateStatus: () => true, // Don't throw errors for 4xx/5xx pages to extract content
  });

  try {
    // 1. Visit homepage
    const response = await client.get(websiteUrl);
    if (response.status >= 400 && response.status !== 404) {
      // If we got a connection error or severe server failure, mark as failed
      throw new Error(`HTTP Error ${response.status}`);
    }

    const html = response.data;
    if (typeof html !== "string") {
      throw new Error("Invalid response format");
    }

    const $ = cheerio.load(html);

    // Extract emails from mailto anchors
    $('a[href^="mailto:"]').each((_, element) => {
      const href = $(element).attr("href") || "";
      const email = href.replace(/mailto:/i, "").split("?")[0]?.trim();
      if (email && isValidEmail(email)) {
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
          scrapedEmails.add(email);
        }
      });
    }

    // Extract social media links from anchors
    $("a[href]").each((_, element) => {
      const href = $(element).attr("href")?.trim();
      if (!href) return;

      if (/facebook\.com\/(?!sharer|plugins|groups)/i.test(href)) {
        facebook = href;
      } else if (/instagram\.com\//i.test(href)) {
        instagram = href;
      } else if (/linkedin\.com\/(?!share|company\/[^/]+\/shared)/i.test(href)) {
        linkedin = href;
      } else if (/(twitter\.com|x\.com)\//i.test(href)) {
        twitter = href;
      }
    });

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
          // Only scrape internal links
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

          // Extract mailto links
          sub$('a[href^="mailto:"]').each((_, elem) => {
            const href = sub$(elem).attr("href") || "";
            const email = href.replace(/mailto:/i, "").split("?")[0]?.trim();
            if (email && isValidEmail(email)) {
              scrapedEmails.add(email);
            }
          });

          // Extract regex matches
          const subMatches = sub$("body").text().match(emailRegex);
          if (subMatches) {
            subMatches.forEach(email => {
              if (isValidEmail(email)) {
                scrapedEmails.add(email);
              }
            });
          }
        }
      } catch (subErr) {
        console.warn(`Failed to crawl subpage ${pageUrl}:`, subErr);
      }
    }

    const allEmails = Array.from(scrapedEmails);
    const primaryEmail = selectPrimaryEmail(allEmails);

    // Save enrichment results to DB
    await db.update(leads)
      .set({
        email: primaryEmail,
        emails: allEmails,
        facebook,
        instagram,
        linkedin,
        twitter,
        enrichmentStatus: "completed",
        websiteLastChecked: new Date(),
      })
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

// Bulk enrich a list of leads in batches of 5
export async function enrichLeads(leadsList: { id: string; website: string | null }[]): Promise<void> {
  const targetLeads = leadsList.filter(l => l.website);
  console.log(`Starting enrichment for ${targetLeads.length} leads in batches of 5...`);

  const batchSize = 5;
  for (let i = 0; i < targetLeads.length; i += batchSize) {
    const batch = targetLeads.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(targetLeads.length / batchSize)}...`);
    
    await Promise.all(
      batch.map(lead => enrichSingleLead(lead.id, lead.website!))
    );
  }
  console.log("Enrichment completed.");
}
