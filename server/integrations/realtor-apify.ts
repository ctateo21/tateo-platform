// Realtor.com scraper via Apify actor `memo23/realtor-search-cheerio`.
//
// Pulls active (and where supported, pending/sold) listings around a ZIP
// to feed our weekly Market Analysis comps. This is best-effort: any
// failure logs and returns empty arrays so the Anthropic recap can still
// run with whatever else is connected.

import type { ListingCompInput } from "./listing-market-analysis";

const ACTOR_ID = "memo23~realtor-search-cheerio";
const APIFY_RUN_TIMEOUT_MS = 90_000;

export interface RealtorScrapeResult {
  active: ListingCompInput[];
  pending: ListingCompInput[];
  sold: ListingCompInput[];
  /** raw count across all buckets — for logging / data_sources display */
  total: number;
  /** Did the scraper actually run + return rows? */
  ok: boolean;
  /** Set when the run failed; null on success. */
  errorMessage: string | null;
}

const EMPTY: RealtorScrapeResult = {
  active: [], pending: [], sold: [], total: 0, ok: false, errorMessage: null,
};

function extractZip(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = /\b(\d{5})(?:-\d{4})?\b/.exec(address);
  return m ? m[1] : null;
}

function searchUrlForZip(zip: string, kind: "buy" | "pending" | "sold"): string {
  const base = `https://www.realtor.com/realestateandhomes-search/${zip}`;
  // Realtor.com URL convention: `/show-pending` and `/show-recently-sold`
  // are filter suffixes. Active is the bare ZIP page.
  if (kind === "pending") return `${base}/show-pending`;
  if (kind === "sold")    return `${base}/show-recently-sold`;
  return base;
}

/**
 * Run the actor synchronously and return raw dataset rows.
 *
 * The actor input shape is not strictly documented; we send the broadest
 * common shape (`startUrls` + `maxItems`) which works for most
 * memo23/Cheerio search actors. If a future actor revision needs a
 * different shape, this throws and the caller falls back gracefully.
 */
async function runActor(startUrl: string, maxItems: number): Promise<unknown[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not configured");

  const url =
    `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(token)}&clean=1`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APIFY_RUN_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url: startUrl }],
        maxItems,
        proxy: { useApifyProxy: true },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Apify ${ACTOR_ID} returned ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as any).items)) return (data as any).items;
    if (data && Array.isArray((data as any).data))  return (data as any).data;
    if (data && typeof data === "object") return [data];
    return [];
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("Realtor scraper timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Normalization ────────────────────────────────────────────────────
// Realtor.com Cheerio scrapers return inconsistent field names across
// revisions. We accept a wide set of aliases and fall back to null when
// nothing matches. Never fabricate.

function pickNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/[^\d.]/g, "");
      if (cleaned) {
        const n = Number(cleaned);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return null;
}

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function formatAddress(row: any): string | null {
  // Try a flat string first.
  const flat = pickString(row?.address, row?.full_address, row?.formatted_address, row?.location?.address?.line);
  if (flat) return flat;
  // Otherwise piece together a structured address.
  const a = row?.location?.address ?? row?.address_obj ?? {};
  const line = pickString(a?.line, a?.street, a?.address_line);
  const city = pickString(a?.city, a?.locality);
  const state = pickString(a?.state_code, a?.state);
  const zip = pickString(a?.postal_code, a?.zip, a?.zipcode);
  const parts = [line, city, state, zip].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function normalize(row: any, fallbackStatus: "active" | "pending" | "sold"): ListingCompInput | null {
  if (!row || typeof row !== "object") return null;

  const desc = row.description ?? row.property ?? {};
  const price = pickNumber(row.list_price, row.price, row.sold_price, desc.list_price, desc.price);
  const sqft  = pickNumber(row.sqft, desc.sqft, row.building_size?.size);
  const beds  = pickNumber(row.beds, desc.beds, row.bedrooms);
  const baths = pickNumber(row.baths, desc.baths, row.bathrooms, row.baths_consolidated);
  const dom   = pickNumber(row.days_on_market, row.dom, desc.days_on_market);
  const pps   = price != null && sqft && sqft > 0 ? Math.round(price / sqft) : null;
  const address = formatAddress(row);
  const url = pickString(row.url, row.rdc_web_url, row.permalink, row.href);
  const statusRaw = pickString(row.status, row.listing_status, row.prop_status)?.toLowerCase() ?? fallbackStatus;
  const status =
    statusRaw.includes("pending") || statusRaw.includes("contingent") ? "pending"
    : statusRaw.includes("sold")    || statusRaw.includes("closed")    ? "sold"
    : "active";

  // Require at minimum an address and a price to consider it a usable comp.
  if (!address || price == null) return null;

  const noteBits: string[] = ["per Realtor.com"];
  if (url) noteBits.push(url);
  return {
    address, price, sqft, beds, baths, daysOnMarket: dom,
    pricePerSqft: pps, status, notes: noteBits.join(" • "),
  };
}

/**
 * Public entrypoint. Always returns a result — never throws — so the
 * caller can keep generating the recap even if the scraper is down.
 */
export async function scrapeRealtorCompsForListing(args: {
  address: string;
  zip?: string | null;
  propertyType?: string | null;
  maxItems?: number;
}): Promise<RealtorScrapeResult> {
  const zip = args.zip || extractZip(args.address);
  if (!zip) {
    return { ...EMPTY };
  }
  const cap = args.maxItems ?? 20;


  // Run active first; sold/pending best-effort (the actor may or may not
  // honor the /show-pending and /show-recently-sold filters depending on
  // its scraping rules — we accept whatever comes back).
  const result: RealtorScrapeResult = { active: [], pending: [], sold: [], total: 0, ok: false, errorMessage: null };
  try {
    const [activeRows, pendingRows, soldRows] = await Promise.all([
      runActor(searchUrlForZip(zip, "buy"),     cap).catch((e) => { console.warn("[market-data] realtor active scrape failed:", e?.message); return [] as unknown[]; }),
      runActor(searchUrlForZip(zip, "pending"), Math.min(cap, 10)).catch((e) => { console.warn("[market-data] realtor pending scrape failed:", e?.message); return [] as unknown[]; }),
      runActor(searchUrlForZip(zip, "sold"),    Math.min(cap, 10)).catch((e) => { console.warn("[market-data] realtor sold scrape failed:", e?.message); return [] as unknown[]; }),
    ]);

    for (const r of activeRows)  { const n = normalize(r, "active");  if (n) result.active.push(n); }
    for (const r of pendingRows) { const n = normalize(r, "pending"); if (n) result.pending.push(n); }
    for (const r of soldRows)    { const n = normalize(r, "sold");    if (n) result.sold.push(n); }

    result.total = result.active.length + result.pending.length + result.sold.length;
    result.ok = result.total > 0;
  } catch (err: any) {
    result.errorMessage = err?.message || String(err);
    console.warn("[market-data] Realtor.com scraper failed:", result.errorMessage);
  }
  return result;
}
