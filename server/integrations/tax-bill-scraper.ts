/**
 * Hillsborough Tax Collector bill scraper.
 *
 * The Property Appraiser's TaxEstimator API returns 0 for
 * nonAdValoremTaxes on every parcel, but real bills carry CDD fees,
 * solid waste, stormwater, etc. Those live only on the Tax Collector's
 * site (hillsborough.county-taxes.com), which is behind Cloudflare bot
 * protection — plain server-side fetch is blocked.
 *
 * This module runs an Apify headless-browser actor (apify/web-scraper)
 * to load the parcel's account page, follow its bill links, and parse
 * the "Non-Ad Valorem Assessments" table from the latest annual bill.
 * Results are cached in non_ad_valorem_cache (keyed by folio) so each
 * parcel is only scraped once per cache window.
 *
 * NOTE: the Apify account must have approved permissions for the
 * apify/web-scraper actor (one-time approval in the Apify console).
 */

import { db } from "../db";
import { nonAdValoremCache } from "@shared/schema";
import { eq } from "drizzle-orm";

const CACHE_DAYS = 180;
const APIFY_ACTOR = "apify~web-scraper";
const APIFY_RUN_TIMEOUT_SECS = 120;

export interface NonAdValoremResult {
  folio: string;
  billYear: number | null;
  lines: Array<{ authority: string; amount: number }>;
  total: number;
  fromCache: boolean;
}

/** Browser-side page function executed by the Apify actor. Declared as
 *  a string because it runs inside the scraped page's context. */
const PAGE_FUNCTION = `async function pageFunction(context) {
  const { request, page } = context;
  const isBill = /\\/bills\\//.test(request.url);
  if (!isBill) {
    // Parcel summary page — wait for the XHR-loaded bill links so the
    // crawler's linkSelector can enqueue them, then produce no item.
    await page.waitForSelector("a[href*='/bills/']", { timeout: 60000 })
      .catch(() => {});
    return null;
  }
  await page.waitForFunction(
    () => /Non-Ad Valorem Assessments/i.test(document.body.innerText),
    { timeout: 60000 }
  ).catch(() => {});
  return await page.evaluate(() => {
    const txt = document.body.innerText;
    const yearMatch = txt.match(/(\\d{4})\\s*\\u200d?\\s*Annual bill/i);
    const seg = (txt.split(/Non-Ad Valorem Assessments/i)[1] || "")
      .split(/Parcel details|Print \\(PDF\\)|If Paid By/i)[0];
    const lines = [];
    let total = 0;
    for (const row of seg.split("\\n")) {
      const m = row.match(
        /^\\s*([A-Z][A-Z0-9 \\/\\.\\-&'()]+?)[\\t ]+\\$?([\\d,]+\\.\\d{2})\\s*$/
      );
      if (!m) continue;
      const authority = m[1].trim();
      const amount = parseFloat(m[2].replace(/,/g, ""));
      if (/^Total Non-Ad Valorem/i.test(authority)) {
        total = amount;
      } else if (!/^(Levying authority|Rate|Amount)$/i.test(authority)) {
        lines.push({ authority, amount });
      }
    }
    if (!total && lines.length) {
      total = Math.round(
        lines.reduce((s, l) => s + l.amount, 0) * 100
      ) / 100;
    }
    return {
      url: location.href,
      year: yearMatch ? parseInt(yearMatch[1], 10) : null,
      isAnnual: /Annual bill/i.test(txt),
      lines,
      total,
    };
  });
}`;

/** Run the Apify actor synchronously and return parsed bill items. */
async function scrapeBills(account: string): Promise<
  Array<{ year: number | null; isAnnual: boolean; lines: Array<{ authority: string; amount: number }>; total: number }>
> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.log("[nav-scrape] APIFY_TOKEN not set — skipping");
    return [];
  }

  const input = {
    startUrls: [{
      url: `https://hillsborough.county-taxes.com/public/real_estate/parcels/${account}`,
    }],
    linkSelector: "a[href*='/bills/']",
    globs: [
      { glob: "https://hillsborough.county-taxes.com/**/bills/*" },
      { glob: "https://county-taxes.net/**/bills/*" },
    ],
    pageFunction: PAGE_FUNCTION,
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"],
    },
    maxPagesPerCrawl: 4,
    maxResultsPerCrawl: 3,
    maxConcurrency: 2,
    pageLoadTimeoutSecs: 60,
  };

  const url =
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}` +
    `/run-sync-get-dataset-items?token=${token}` +
    `&timeout=${APIFY_RUN_TIMEOUT_SECS}&memory=4096`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout((APIFY_RUN_TIMEOUT_SECS + 20) * 1000),
  });

  const data = await resp.json();
  if (!resp.ok || !Array.isArray(data)) {
    console.error(
      "[nav-scrape] Apify run failed:",
      JSON.stringify(data).slice(0, 300)
    );
    return [];
  }
  return data.filter((d: any) => d && Array.isArray(d.lines));
}

/**
 * Get the parcel's actual non-ad valorem assessments (CDD etc.) from
 * the latest annual tax bill. Checks the DB cache first; on a miss,
 * scrapes via Apify (~15–60s) and caches the result.
 * Returns null when the data can't be obtained.
 */
export async function getNonAdValoremForFolio(
  folio: string
): Promise<NonAdValoremResult | null> {
  const account = folio.startsWith("A") ? folio : `A${folio}`;
  const cleanFolio = account.slice(1);

  // Cache check
  try {
    const rows = await db
      .select()
      .from(nonAdValoremCache)
      .where(eq(nonAdValoremCache.folio, cleanFolio))
      .limit(1);
    if (rows.length) {
      const row = rows[0];
      if (row.expiresAt > new Date() && row.status === "success") {
        return {
          folio: cleanFolio,
          billYear: row.billYear,
          lines: row.lines ?? [],
          total: (row.totalNonAdValorem ?? 0) / 100,
          fromCache: true,
        };
      }
      if (row.expiresAt > new Date() && row.status === "error") {
        // Recent failed attempt — don't hammer Apify on every request.
        return null;
      }
      // Expired — drop and re-scrape.
      await db
        .delete(nonAdValoremCache)
        .where(eq(nonAdValoremCache.folio, cleanFolio));
    }
  } catch (e: any) {
    console.error("[nav-scrape] cache read failed:", e?.message);
  }

  console.log(`[nav-scrape] scraping bill for account ${account}…`);
  let items: Awaited<ReturnType<typeof scrapeBills>> = [];
  try {
    items = await scrapeBills(account);
  } catch (e: any) {
    console.error("[nav-scrape] scrape error:", e?.message);
  }

  // Only trust items that actually parsed assessment lines with a
  // positive total (fail closed on malformed pages). Prefer the
  // newest annual bill.
  const valid = items.filter(
    i => i.total > 0 && i.lines.length > 0
  );
  const annuals = valid
    .filter(i => i.isAnnual && i.year)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const best = annuals[0] ?? valid[0] ?? null;

  const expiresAt = new Date();
  if (best) {
    expiresAt.setDate(expiresAt.getDate() + CACHE_DAYS);
    try {
      await db
        .insert(nonAdValoremCache)
        .values({
          folio: cleanFolio,
          accountNumber: account,
          billYear: best.year,
          status: "success",
          lines: best.lines,
          totalNonAdValorem: Math.round(best.total * 100),
          expiresAt,
        })
        .onConflictDoNothing({ target: nonAdValoremCache.folio });
    } catch (e: any) {
      console.error("[nav-scrape] cache write failed:", e?.message);
    }
    console.log(
      `[nav-scrape] ${account} year=${best.year}` +
      ` total=$${best.total} lines=${best.lines.length}`
    );
    return {
      folio: cleanFolio,
      billYear: best.year,
      lines: best.lines,
      total: best.total,
      fromCache: false,
    };
  }

  // Failed — cache the failure briefly (1 day) to avoid repeat cost.
  expiresAt.setDate(expiresAt.getDate() + 1);
  try {
    await db
      .insert(nonAdValoremCache)
      .values({
        folio: cleanFolio,
        accountNumber: account,
        status: "error",
        lines: [],
        totalNonAdValorem: 0,
        expiresAt,
      })
      .onConflictDoNothing({ target: nonAdValoremCache.folio });
  } catch {}
  console.log(`[nav-scrape] ${account} — no bill data obtained`);
  return null;
}
