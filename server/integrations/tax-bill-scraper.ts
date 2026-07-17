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
  /** Per-authority millage rates from the bill's Ad Valorem table. */
  adValoremMills: Array<{ authority: string; mills: number }> | null;
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
  /** Per-authority millage rates from the bill's Ad Valorem table
   *  ("| NAME | 4.5423 | $assessed | $exempt | $taxable | $tax |"). */
  adValoremMills?: Array<{ authority: string; mills: number }> | null;
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

  // Per-authority millage from the Ad Valorem table:
  // "| ST PETERSBURG | 6.4525 | $402,007.00 | … |"
  const adValoremMills: Array<{ authority: string; mills: number }> =
    [];
  const avSection = md.split(/###?\s*Ad Valorem Taxes/i)[1];
  if (avSection) {
    const avPart =
      avSection.split(/Non-Ad Valorem Assessments/i)[0];
    for (const row of avPart.split("\n")) {
      const m = row.match(
        /^\|\s*([A-Za-z][^|]*?)\s*\|\s*([\d.]+)\s*\|\s*\$[\d,]/
      );
      if (!m) continue;
      const authority = m[1].trim();
      if (/^Total Ad Valorem/i.test(authority)) continue;
      adValoremMills.push({
        authority,
        mills: parseFloat(m[2]),
      });
    }
  }

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
        adValoremMills: adValoremMills.length
          ? adValoremMills
          : null,
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
    adValoremMills: adValoremMills.length ? adValoremMills : null,
  };
}

/** Start a Website Content Crawler run, poll until it finishes, and
 *  return the parsed bills found in its dataset. */
async function runWccScrape(
  account: string,
  county: string
): Promise<{
  bills: ParsedBill[];
  /** Newest "NNNN Annual bill" year listed on the account summary
   *  page — used to detect when the crawl only rendered old bills. */
  newestListedYear: number | null;
}> {
  const empty = { bills: [], newestListedYear: null };
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.log("[nav-scrape] APIFY_TOKEN not set — skipping");
    return empty;
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
    maxCrawlPages: 8,
    maxCrawlDepth: 1,
    maxResults: 8,
    crawlerType: "playwright:firefox",
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"],
    },
    dynamicContentWaitSecs: 90,
    // NOTE: don't use waitForSelector here — the TaxSys content is
    // inside an iframe, so main-document selectors never match and
    // every page gets dropped. Rendering is flaky per page; we rely
    // on merging bills across multiple runs instead (see caller).
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
    return empty;
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
  if (!Array.isArray(items)) return empty;

  const parsed: ParsedBill[] = [];
  let newestListedYear: number | null = null;
  for (const item of items) {
    const md = item?.markdown || item?.text || "";
    const bill = parseBillMarkdown(md);
    if (bill) parsed.push(bill);
    // Account summary pages list "[2025 Annual bill](…)" links.
    for (const m of md.matchAll(/\[(\d{4}) Annual bill\]/g)) {
      const y = parseInt(m[1], 10);
      if (!newestListedYear || y > newestListedYear) {
        newestListedYear = y;
      }
    }
  }
  return { bills: parsed, newestListedYear };
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
  let newestListedYear: number | null = null;
  // The Tax Collector SPA renders slowly and inconsistently; a run
  // can capture pages while they still say "Loading..." — including
  // the NEWEST bill, while older bills render fine (stale millage!).
  // Retry until the newest listed annual bill actually parsed.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      console.log(
        `[nav-scrape] ${account} — incomplete parse` +
        ` (have ${bills.length} bills, newest listed ` +
        `${newestListedYear ?? "?"}), retrying…`
      );
    }
    try {
      const run = await runWccScrape(account, county);
      // Merge results across attempts; keep the max listed year seen.
      bills = bills.concat(run.bills);
      if (
        run.newestListedYear &&
        (!newestListedYear || run.newestListedYear > newestListedYear)
      ) {
        newestListedYear = run.newestListedYear;
      }
    } catch (e: any) {
      console.error("[nav-scrape] scrape error:", e?.message);
    }
    const haveNewest =
      newestListedYear !== null &&
      bills.some(b => b.isAnnual && b.year === newestListedYear);
    if (haveNewest || (bills.length && newestListedYear === null)) {
      break;
    }
  }

  // Fail closed: only trust parses with lines and a positive total,
  // or bills that explicitly state there are no assessments.
  const valid = bills.filter(
    b => (b.total > 0 && b.lines.length > 0) || b.noAssessments
  );
  // Rank merged bills: newest year first; among same-year duplicates
  // (bills merged across retry runs) prefer richer parses — ones that
  // carry per-authority mills, then ones with more assessment lines.
  const annuals = valid
    .filter(b => b.isAnnual && b.year)
    .sort(
      (a, b) =>
        (b.year ?? 0) - (a.year ?? 0) ||
        (b.adValoremMills ? 1 : 0) - (a.adValoremMills ? 1 : 0) ||
        b.lines.length - a.lines.length
    );
  const best = annuals[0] ?? valid[0] ?? null;

  // Freshness: if the account summary listed a newer annual bill than
  // the one we parsed (its page failed to render), or — when the
  // summary never rendered — the parsed bill is older than last year,
  // treat the data as stale. Serve it, but only cache it short-term
  // so a later request re-scrapes instead of locking in old millage
  // for 180 days.
  const isFresh =
    best?.year != null &&
    (newestListedYear !== null
      ? best.year >= newestListedYear
      : best.year >= new Date().getFullYear() - 1);
  if (best && !isFresh) {
    console.warn(
      `[nav-scrape] ${account} — best parsed bill year ${best.year} ` +
      `is stale (newest listed: ${newestListedYear ?? "unknown"}); ` +
      `caching short-term only`
    );
  }

  const expiresAt = new Date();
  if (best && isFresh) {
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
      adValoremMills: best?.adValoremMills ?? null,
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
            adValoremMills: row.adValoremMills ?? null,
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
