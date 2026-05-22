// Supabase-backed weekly cache around the Realtor.com Apify scraper.
//
// Goal: scrape memo23/realtor-search-cheerio at most once per (zip,
// propertyType, radius, Friday-cycle) and reuse the saved normalized
// results for every subsequent Market Analysis run in the same week.
// This mirrors the Friday-8AM-ET cadence of listing_market_analyses
// so a seller opening their detail page mid-week never triggers a
// fresh Apify call.
//
// Failure rows are also cached (status="error") with a short cooldown
// so a flaky scraper run doesn't get hammered on every page open.

import { supabaseAdmin } from "../supabase";
import {
  scrapeRealtorCompsForListing,
  type RealtorScrapeResult,
} from "./realtor-apify";
import { currentWeekWindow } from "./listing-market-analysis";

/** How long to wait before re-trying a failed scrape inside the same cycle. */
const ERROR_RETRY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export type RealtorCacheSource = "cache" | "fresh" | "missing" | "error";

export interface RealtorCachedResult extends RealtorScrapeResult {
  /** Where the data came from on this read. */
  source: RealtorCacheSource;
  /** Cache-key used / generated this call (logged + handy for debug). */
  cacheKey: string;
  /** ET date string of the Friday cycle (matches analysis_week_of). */
  weekOf: string;
}

function extractZip(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = /\b(\d{5})(?:-\d{4})?\b/.exec(address);
  return m ? m[1] : null;
}

function buildCacheKey(args: {
  zip: string;
  propertyType: string;
  radius: number;
  weekOf: string;
}): string {
  return `realtor:v1:${args.zip}:${args.propertyType}:${args.radius}:${args.weekOf}`;
}

function emptyResult(): RealtorScrapeResult {
  return { active: [], pending: [], sold: [], total: 0, ok: false, errorMessage: null };
}

/**
 * Public entrypoint used by Market Analysis. Checks Supabase first,
 * scrapes once on miss/stale, saves the normalized result, then
 * returns. Never throws.
 *
 * The cache row is shared across users in the same ZIP — Realtor.com
 * results are not user-private. RLS on the table restricts reads to
 * authenticated users; writes go through the service role only.
 */
export async function getOrFetchRealtorComps(args: {
  address: string;
  zip?: string | null;
  propertyType?: string | null;
  normalizedPropertyKey?: string | null;
  /** Skip the cache lookup and force a fresh scrape. Admin/debug only. */
  forceRefresh?: boolean;
}): Promise<RealtorCachedResult> {
  const cycle = currentWeekWindow();
  const zip = args.zip || extractZip(args.address);
  const propertyType = (args.propertyType || "any").toLowerCase();
  const radius = 0; // scraper currently searches by ZIP only

  if (!zip) {
    console.log("[realtor-cache] skipping — no ZIP in address");
    return {
      ...emptyResult(),
      source: "missing",
      cacheKey: `realtor:v1::${propertyType}:${radius}:${cycle.weekOfStr}`,
      weekOf: cycle.weekOfStr,
    };
  }

  const cacheKey = buildCacheKey({ zip, propertyType, radius, weekOf: cycle.weekOfStr });
  console.log("[realtor-cache] lookup key", { cacheKey });

  // ── 1. Try the cache ────────────────────────────────────────────────
  if (supabaseAdmin && !args.forceRefresh) {
    const { data, error } = await supabaseAdmin
      .from("realtor_market_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (error) {
      console.warn("[realtor-cache] lookup failed:", error.message);
    } else if (data) {
      const row = data as any;
      const isCurrentCycle = row.cache_week_of === cycle.weekOfStr;
      const ageMs = Date.now() - new Date(row.generated_at || row.created_at || 0).getTime();
      const cooledDown = row.status === "error" ? ageMs >= ERROR_RETRY_COOLDOWN_MS : false;

      if (isCurrentCycle && row.status === "success") {
        console.log("[realtor-cache] hit", { cacheKey, status: row.status, ageMinutes: Math.round(ageMs / 60000) });
        console.log("[realtor-cache] using cached results", {
          active: row.active_comps?.length ?? 0,
          pending: row.pending_comps?.length ?? 0,
          sold: row.sold_comps?.length ?? 0,
        });
        const active = Array.isArray(row.active_comps) ? row.active_comps : [];
        const pending = Array.isArray(row.pending_comps) ? row.pending_comps : [];
        const sold = Array.isArray(row.sold_comps) ? row.sold_comps : [];
        return {
          active, pending, sold,
          total: active.length + pending.length + sold.length,
          ok: active.length + pending.length + sold.length > 0,
          errorMessage: null,
          source: "cache",
          cacheKey,
          weekOf: cycle.weekOfStr,
        };
      }
      if (isCurrentCycle && row.status === "empty") {
        // Honest empty for this cycle — don't re-scrape until next Friday.
        console.log("[realtor-cache] hit (empty)", { cacheKey });
        return {
          ...emptyResult(),
          source: "cache",
          cacheKey,
          weekOf: cycle.weekOfStr,
        };
      }
      if (isCurrentCycle && row.status === "error" && !cooledDown) {
        // Recent failure — back off until the cooldown expires.
        console.log("[realtor-cache] hit (error, cooling down)", {
          cacheKey,
          minutesUntilRetry: Math.max(0, Math.round((ERROR_RETRY_COOLDOWN_MS - ageMs) / 60000)),
        });
        return {
          ...emptyResult(),
          errorMessage: row.error_message || null,
          source: "error",
          cacheKey,
          weekOf: cycle.weekOfStr,
        };
      }
      console.log("[realtor-cache] stale", {
        cacheKey,
        savedWeek: row.cache_week_of,
        currentWeek: cycle.weekOfStr,
        status: row.status,
      });
    } else {
      console.log("[realtor-cache] miss", { cacheKey });
    }
  }

  // ── 2. Run the scraper ─────────────────────────────────────────────
  let scraped: RealtorScrapeResult = emptyResult();
  try {
    scraped = await scrapeRealtorCompsForListing({
      address: args.address,
      zip,
      propertyType: args.propertyType,
    });
  } catch (e: any) {
    scraped.errorMessage = e?.message || String(e);
    console.warn("[realtor-scraper] threw:", scraped.errorMessage);
  }
  console.log("[realtor-scraper] results count", {
    active: scraped.active.length,
    pending: scraped.pending.length,
    sold: scraped.sold.length,
  });

  // ── 3. Persist (success | empty | error) ───────────────────────────
  const status: "success" | "empty" | "error" =
    scraped.errorMessage ? "error" : scraped.total > 0 ? "success" : "empty";

  if (supabaseAdmin) {
    const row = {
      id:
        (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
          ? crypto.randomUUID()
          : `rmc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      cache_key: cacheKey,
      normalized_property_key: args.normalizedPropertyKey ?? null,
      property_address: args.address,
      zip,
      city: null,
      state: null,
      property_type: propertyType,
      search_radius_miles: radius,
      search_params: { zip, propertyType, radius, source: "memo23/realtor-search-cheerio" },
      active_comps: scraped.active,
      pending_comps: scraped.pending,
      sold_comps: scraped.sold,
      raw_realtor_response: scraped,
      normalized_results: {
        active: scraped.active,
        pending: scraped.pending,
        sold: scraped.sold,
      },
      data_sources: { source: "Realtor.com", actor: "memo23/realtor-search-cheerio" },
      cache_week_of: cycle.weekOfStr,
      generated_at: new Date().toISOString(),
      next_update_due_at: cycle.nextUpdateDueAt.toISOString(),
      status,
      error_message: scraped.errorMessage,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    console.log("[realtor-cache] saving results", { cacheKey, status, total: scraped.total });
    const { error: upsertErr } = await supabaseAdmin
      .from("realtor_market_cache")
      .upsert(row, { onConflict: "cache_key" });
    if (upsertErr) {
      console.warn("[realtor-cache] save failed:", upsertErr.message);
    } else {
      console.log("[realtor-cache] save ok", { cacheKey });
    }
  }

  return {
    ...scraped,
    source: status === "error" ? "error" : "fresh",
    cacheKey,
    weekOf: cycle.weekOfStr,
  };
}
