import { chromium } from "playwright";
import { NewLead } from "../db/schema";

/**
 * Searches Google Maps for a given keyword and location,
 * extracts details for each business, and returns them as a list of NewLead.
 */
export const searchGoogleMaps = async (
  searchId: string,
  keyword: string,
  location: string,
  limit: number = 50
): Promise<NewLead[]> => {
  console.log(`Starting scraper for search ${searchId} (${keyword} in ${location}, limit: ${limit})...`);
  
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  const leadsToInsert: NewLead[] = [];

  try {
    // Navigate to Google Maps
    await page.goto("https://www.google.com/maps", { waitUntil: "domcontentloaded" });

    // Handle potential Google consent/cookie page redirect
    const initialUrl = page.url();
    console.log(`Initial page URL: ${initialUrl}`);
    if (initialUrl.includes("consent.google.com")) {
      console.log("Cookie consent screen detected, accepting cookies...");
      try {
        const acceptButton = page.locator('button:has-text("Accept all"), button:has-text("Agree"), button:has-text("I agree"), button:has-text("Accept")').first();
        if (await acceptButton.count() > 0) {
          await acceptButton.click();
          await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 });
        } else {
          const formSubmit = page.locator('form button').last();
          if (await formSubmit.count() > 0) {
            await formSubmit.click();
            await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 });
          }
        }
        console.log(`Navigated after consent to: ${page.url()}`);
      } catch (consentErr) {
        console.warn("Failed to automatically bypass consent page:", consentErr);
      }
    }

    // Type query and search
    const searchQuery = `${keyword} ${location}`;
    const searchQueryInputSelector = "input#searchboxinput, input[name='q'], #searchboxinput, input[type='text']";
    try {
      await page.waitForSelector(searchQueryInputSelector, { timeout: 10000 });
      await page.fill(searchQueryInputSelector, searchQuery);
      await page.keyboard.press("Enter");
    } catch (timeoutErr) {
      console.error(`Timeout waiting for searchbox. Current URL: ${page.url()}, Page Title: ${await page.title()}`);
      throw timeoutErr;
    }

    // Wait for the results panel list of places to appear
    console.log("Waiting for results list to load...");
    try {
      await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 });
    } catch (err) {
      console.log("No place links found initially. Search may have returned no results or direct location match.");
    }

    // Scroll results panel to load more listings
    const scrollableSelector = 'div[role="feed"]';
    let lastHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 15;

    console.log("Scrolling results list to load more places...");
    while (scrollAttempts < maxScrollAttempts) {
      const feedExists = await page.$(scrollableSelector);
      if (!feedExists) {
        break;
      }

      await page.evaluate((selector) => {
        const feed = document.querySelector(selector);
        if (feed) {
          feed.scrollBy(0, 5000);
        }
      }, scrollableSelector);

      await page.waitForTimeout(2000);

      const newHeight = await page.evaluate((selector) => {
        const feed = document.querySelector(selector);
        return feed ? feed.scrollHeight : 0;
      }, scrollableSelector);

      if (newHeight === lastHeight) {
        break;
      }
      lastHeight = newHeight;
      scrollAttempts++;
    }

    // Extract all place URLs
    const placeUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
      return anchors.map(a => (a as HTMLAnchorElement).href);
    });

    const uniqueUrls = Array.from(new Set(placeUrls));
    console.log(`Found ${uniqueUrls.length} unique places to scrape.`);

    // Go to each place details page and extract information
    for (const url of uniqueUrls.slice(0, limit)) { // Limit to requested count
      try {
        console.log(`Scraping place URL: ${url}`);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("h1", { timeout: 10000 });

        // Extract Name
        const name = await page.locator("h1").first().textContent().then(t => t?.trim() || "Unknown Business");

        // Extract Rating
        const rating = await page.evaluate(() => {
          const ratingElement = document.querySelector("div.F7nice span[aria-hidden='true']");
          return ratingElement ? parseFloat(ratingElement.textContent || "0") : null;
        });

        // Extract Reviews Count
        const reviews = await page.evaluate(() => {
          const reviewsElement = document.querySelector("div.F7nice span[aria-label*='reviews']");
          if (reviewsElement) {
            const label = reviewsElement.getAttribute("aria-label");
            const match = label ? label.match(/\d+/) : null;
            return match ? parseInt(match[0], 10) : null;
          }
          return null;
        });

        // Extract Address
        const address = await page.evaluate(() => {
          const addressBtn = document.querySelector("button[data-item-id='address']");
          return addressBtn ? addressBtn.textContent?.trim() || null : null;
        });

        // Extract Phone Number
        const phone = await page.evaluate(() => {
          const phoneBtn = document.querySelector("button[data-item-id^='phone:tel:']");
          if (phoneBtn) {
            const itemId = phoneBtn.getAttribute("data-item-id");
            return itemId ? itemId.replace("phone:tel:", "").trim() : null;
          }
          return null;
        });

        // Extract Website
        const website = await page.evaluate(() => {
          const webAnchor = document.querySelector("a[data-item-id='authority']");
          return webAnchor ? webAnchor.getAttribute("href") || null : null;
        });

        // Extract Latitude / Longitude from the final page URL
        const currentUrl = page.url();
        let latitude: number | null = null;
        let longitude: number | null = null;
        
        const coordsMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordsMatch) {
          latitude = parseFloat(coordsMatch[1]);
          longitude = parseFloat(coordsMatch[2]);
        } else {
          const dataCoordsMatch = currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
          if (dataCoordsMatch) {
            latitude = parseFloat(dataCoordsMatch[1]);
            longitude = parseFloat(dataCoordsMatch[2]);
          }
        }

        leadsToInsert.push({
          searchId,
          name,
          phone,
          website,
          address,
          rating,
          reviews,
          latitude,
          longitude,
        });
      } catch (placeErr) {
        console.error(`Error scraping individual place at ${url}:`, placeErr);
      }
    }
  } catch (error) {
    console.error("Fatal error during scraping session:", error);
    throw error;
  } finally {
    try {
      // Prevent hanging on close
      await Promise.race([
        browser.close(),
        new Promise((resolve) => setTimeout(resolve, 5000))
      ]);
    } catch (closeErr) {
      console.error("Error closing browser:", closeErr);
    }
  }

  return leadsToInsert;
};

export default searchGoogleMaps;