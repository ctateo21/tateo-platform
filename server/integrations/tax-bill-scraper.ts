/**
 * Hillsborough Tax Collector bill scraper.
 *
 * The Property Appraiser's TaxEstimator API returns 0 for
 * nonAdValoremTaxes on every parcel, but real bills carry CDD fees,
 * solid waste, stormwater, etc. Those live only on the Tax Collector's
 * site (hillsborough.county-taxes.com), which is behind Cloudflare bot
 * protection — plain server-side fetch is blocked, and even Apify's
 * standard web-scraper (Chrome) gets 403s. Apify's Website Content
 * Crawler with playwright:firefox + residential proxies gets through.
 *
 * A scrape takes ~2-4 minutes (SPA needs a long dynamic-content wait),
 * so scrapes run in the background: the tax route returns immediately
 * with `pending`, the client re-polls, and the parsed result is cached
 * in non_ad_valorem_cache (keyed by folio) so each parcel is only
 * scraped once per cache window.
 */

import { db } from "../db";
import { nonAdValoremCache } from "@shared/schema";
import { eq } from "drizzle-orm";

const CACHE_DAYS = 180;
const FAILURE_CACHE_MINUTES = 10;
const APIFY_ACTOR = "apify~website-content-crawler";
const RUN_TIMEOUT_SECS = 360;
const POLL_INTERVAL_MS = 15_000;

export interface NonAdValoremResult {
  folio: string;
  billYear: number | null;
  lines: Array<{ authority: string; amount: number }>;
  total: number;
  fromCache: boolean;
  /** Total ad valorem millage from the bill (e.g. 19.9197), when
   *  the bill's millage row parsed. */
  totalMillage: number | null;
}

/** Folios with a scrape currently running (dedupe concurrent misses). */
const inFlight = new Set<string>();

interface ParsedBill {
  year: number | null;
  isAnnual: boolean;
  lines: Array<{ authority: string; amount: number }>;
  total: number;
  /** Bill explicitly states there are no non-ad valorem
   *  assessments — a valid $0 result, not a parse failure. */
  noAssessments?: boolean;
  /** Total ad valorem millage from the bill's
   *  "Total Ad Valorem Taxes" row (e.g. 19.9197). */
  totalMillage?: number | null;
}

/** Parse the "Non-Ad Valorem Assessments" markdown table from a
 *  crawled bill page. Returns null when the page has no NAV section. */
export function parseBillMarkdown(md: string): ParsedBill | null {
  if (!/Non-Ad Valorem Assessments/i.test(md)) return null;

  // "## 2025\u200d Annual bill" (note the zero-width joiner)
  const yearMatch = md.match(/##\s*(\d{4})\S*\s*Annual bill/i);
  const isAnnual = /Annual bill/i.test(md);

  const seg = md
    .split(/###\s*Non-Ad Valorem Assessments/i)[1];
  if (!seg) return null;
  const section = seg.split(/\n##[^#]/)[0];

  // "| Total Ad Valorem Taxes | 19.9197 | ... | $2,288.68 |"
  const millMatch = md.match(
    /\|\s*Total Ad Valorem Taxes\s*\|\s*([\d.]+)\s*\|/i
  );
  const totalMillage = millMatch ? parseFloat(millMatch[1]) : null;

  const lines: Array<{ authority: string; amount: number }> = [];
  let total = 0;
  for (const row of section.split("\n")) {
    // "| BERRY BAY CDD |     | $2,978.04 |"
    const m = row.match(
      /^\|\s*([A-Za-z][^|]*?)\s*\|[^|]*\|\s*\$([\d,]+\.\d{2})\s*\|/
    );
    if (!m) continue;
    const authority = m[1].trim();
    const amount = parseFloat(m[2].replace(/,/g, ""));
    if (/^Total Non-Ad Valorem/i.test(authority)) {
      total = amount;
    } else if (!/^(Rate|Amount|Levying authority)$/i.test(authority)) {
      lines.push({ authority, amount });
    }
  }
  if (!lines.length) {
    // Some bills (e.g. Pinellas) explicitly say "No Non-Ad Valorem
    // assessments." — that's a trustworthy $0, not a failed parse.
    if (/No Non-Ad Valorem assessments/i.test(section)) {
      return {
        year: yearMatch ? parseInt(yearMatch[1], 10) : null,
        isAnnual,
        lines: [],
        total: 0,
        noAssessments: true,
        totalMillage,
      };
    }
    return null;
  }
  if (!total) {
    total =
      Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  }
  return {
    year: yearMatch ? parseInt(yearMatch[1], 10) : null,
    isAnnual,
    lines,
    total,
    totalMillage,
  };
}

/** Start a Website Content Crawler run, poll until it finishes, and
 *  return the parsed bills found in its dataset. */
async function runWccScrape(
  account: string,
  county: string
): Promise<ParsedBill[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.log("[nav-scrape] APIFY_TOKEN not set — skipping");
    return [];
  }

  // Pinellas's TaxSys instance 404s on direct /parcels/<account>
  // URLs; its search endpoint redirects to the account summary, and
  // the bill links (on county-taxes.net) only load within the same
  // crawl session. Other counties serve the parcel page directly.
  const startUrl =
    county === "pinellas"
      ? `https://pinellas.county-taxes.com/public/search/property_tax?search_query=${account}`
      : `https://${county}.county-taxes.com/public/real_estate/parcels/${account}`;
  const input = {
    startUrls: [{ url: startUrl }],
    includeUrlGlobs: [{ glob: "**/bills/*" }],
    maxCrawlPages: 5,
    maxCrawlDepth: 1,
    maxResults: 5,
    crawlerType: "playwright:firefox",
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"],
    },
    dynamicContentWaitSecs: 60,
    expandIframes: true,
    saveMarkdown: true,
  };

  const startResp = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?token=${token}` +
    `&timeout=${RUN_TIMEOUT_SECS}&memory=4096`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  const startData = await startResp.json();
  const runId = startData?.data?.id;
  const datasetId = startData?.data?.defaultDatasetId;
  if (!startResp.ok || !runId) {
    console.error(
      "[nav-scrape] Apify run start failed:",
      JSON.stringify(startData).slice(0, 300)
    );
    return [];
  }
  console.log(`[nav-scrape] Apify run ${runId} started for ${account}`);

  // Poll until the run terminates
  const deadline = Date.now() + (RUN_TIMEOUT_SECS + 60) * 1000;
  let status = "RUNNING";
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const st = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
    ).then(r => r.json()).catch(() => null);
    status = st?.data?.status ?? status;
    if (
      ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)
    ) break;
  }
  console.log(`[nav-scrape] run ${runId} finished: ${status}`);

  // Fetch whatever items exist even on timeout — a partial crawl may
  // still include the bill page.
  const items = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true`
  ).then(r => r.json()).catch(() => []);
  if (!Array.isArray(items)) return [];

  const parsed: ParsedBill[] = [];
  for (const item of items) {
    const md = item?.markdown || item?.text || "";
    const bill = parseBillMarkdown(md);
    if (bill) parsed.push(bill);
  }
  return parsed;
}

/** Background scrape + cache write for one folio.
 *  Works for any Tyler TaxSys county (<county>.county-taxes.com);
 *  Hillsborough account numbers carry an "A" prefix, other counties
 *  use the parcel identifier as-is. */
async function scrapeAndCache(
  cleanFolio: string,
  county: string = "hillsborough",
  accountOverride?: string
): Promise<void> {
  const account =
    accountOverride ??
    (county === "hillsborough" ? `A${cleanFolio}` : cleanFolio);
  console.log(
    `[nav-scrape] scraping ${county} bill for account ${account}…`
  );
  let bills: ParsedBill[] = [];
  // The Tax Collector SPA renders slowly and inconsistently; a run can
  // finish before the bill links appear. Retry once on an empty parse.
  for (let attempt = 0; attempt < 2 && !bills.length; attempt++) {
    if (attempt > 0) {
      console.log(`[nav-scrape] ${account} — empty parse, retrying…`);
    }
    try {
      bills = await runWccScrape(account, county);
    } catch (e: any) {
      console.error("[nav-scrape] scrape error:", e?.message);
    }
  }

  // Fail closed: only trust parses with lines and a positive total,
  // or bills that explicitly state there are no assessments.
  const valid = bills.filter(
    b => (b.total > 0 && b.lines.length > 0) || b.noAssessments
  );
  const annuals = valid
    .filter(b => b.isAnnual && b.year)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const best = annuals[0] ?? valid[0] ?? null;

  const expiresAt = new Date();
  if (best) {
    expiresAt.setDate(expiresAt.getDate() + CACHE_DAYS);
  } else {
    expiresAt.setMinutes(
      expiresAt.getMinutes() + FAILURE_CACHE_MINUTES
    );
  }
  try {
    await db
      .delete(nonAdValoremCache)
      .where(eq(nonAdValoremCache.folio, cleanFolio));
    await db.insert(nonAdValoremCache).values({
      folio: cleanFolio,
      accountNumber: account,
      billYear: best?.year ?? null,
      status: best ? "success" : "error",
      lines: best?.lines ?? [],
      totalNonAdValorem: Math.round((best?.total ?? 0) * 100),
      totalMillage: best?.totalMillage
        ? Math.round(best.totalMillage * 10000)
        : null,
      expiresAt,
    });
  } catch (e: any) {
    console.error("[nav-scrape] cache write failed:", e?.message);
  }
  console.log(
    best
      ? `[nav-scrape] ${account} year=${best.year} total=$${best.total} lines=${best.lines.length}`
      : `[nav-scrape] ${account} — no bill data obtained`
  );
}

export type NonAdValoremLookup =
  | { state: "ready"; data: NonAdValoremResult }
  | { state: "pending" }
  | { state: "unavailable" };

/**
 * Non-blocking lookup of a parcel's non-ad valorem assessments.
 * - Cache hit → "ready" with data.
 * - Cache miss → kicks off a background Apify scrape (~2-4 min) and
 *   returns "pending"; callers should re-poll.
 * - Recent failure cached → "unavailable" (retry after short TTL).
 */
export async function getNonAdValoremForFolio(
  folio: string,
  county: string = "hillsborough",
  accountOverride?: string
): Promise<NonAdValoremLookup> {
  // Only Hillsborough uses the A-prefixed account format.
  const bareFolio =
    county === "hillsborough" && folio.startsWith("A")
      ? folio.slice(1)
      : folio;
  // Namespace non-Hillsborough cache keys by county so identical
  // parcel strings in different counties can never collide.
  // (Hillsborough stays un-prefixed for existing cache rows.)
  const cleanFolio =
    county === "hillsborough" ? bareFolio : `${county}:${bareFolio}`;

  try {
    const rows = await db
      .select()
      .from(nonAdValoremCache)
      .where(eq(nonAdValoremCache.folio, cleanFolio))
      .limit(1);
    if (rows.length && rows[0].expiresAt > new Date()) {
      const row = rows[0];
      if (row.status === "success") {
        return {
          state: "ready",
          data: {
            folio: cleanFolio,
            billYear: row.billYear,
            lines: row.lines ?? [],
            total: (row.totalNonAdValorem ?? 0) / 100,
            fromCache: true,
            totalMillage: row.totalMillage
              ? row.totalMillage / 10000
              : null,
          },
        };
      }
      // Recent failed attempt — don't hammer Apify.
      return inFlight.has(cleanFolio)
        ? { state: "pending" }
        : { state: "unavailable" };
    }
  } catch (e: any) {
    console.error("[nav-scrape] cache read failed:", e?.message);
    return { state: "unavailable" };
  }

  if (inFlight.has(cleanFolio)) return { state: "pending" };

  inFlight.add(cleanFolio);
  // cleanFolio may carry a "county:" cache prefix — the actual tax
  // site account must always be the bare parcel identifier.
  scrapeAndCache(
    cleanFolio,
    county,
    accountOverride ??
      (county === "hillsborough" ? undefined : bareFolio)
  )
    .catch(e =>
      console.error("[nav-scrape] background scrape failed:", e?.message)
    )
    .finally(() => inFlight.delete(cleanFolio));
  return { state: "pending" };
}
