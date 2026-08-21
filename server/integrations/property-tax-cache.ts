/**
 * General multi-county property-tax purchase-estimate cache.
 *
 * Stored in Supabase (public.property_tax_cache) via supabaseAdmin REST.
 * non_ad_valorem_cache stays in Neon/Drizzle.
 *
 * Cache validity rules (tested in property-tax-cache.test.ts):
 *   • Row must have a valid parcel ID (folio or county-specific ID),
 *     a positive sample_price, non-zero percentages, and a non-empty source.
 *   • Row must not be expired (expires_at > now).
 *   • Caller's purchase price must be within ±20% of sample_price.
 *   • Any rule failure → cache miss → refresh from live API.
 *
 * Cache recomputation (when valid hit):
 *   annualAdValorem = round(selectedPct × currentPrice)
 *   annualTotal     = annualAdValorem + nonAdValoremAmtCents/100
 *   (Fixed NAV does NOT scale with price.)
 *
 * Expiry boundary: rolls to the next Nov 1 (annual FL tax/millage
 * refresh boundary) rather than a blind 365-day TTL.
 */

import { supabaseAdmin } from "../supabase";

// ── Expiry helpers ────────────────────────────────────────────────

/**
 * Returns the next Nov 1 00:00 UTC after `now`.
 * If now is exactly Nov 1 00:00 UTC or later, rolls to the following year.
 *
 * Exported for unit testing.
 */
export function nextTaxRefreshBoundary(now: Date = new Date()): Date {
  const year = now.getUTCFullYear();
  const nov1ThisYear = new Date(Date.UTC(year, 10, 1)); // month 10 = November
  if (now < nov1ThisYear) return nov1ThisYear;
  return new Date(Date.UTC(year + 1, 10, 1));
}

// ── Types ─────────────────────────────────────────────────────────

/** Shape of a property_tax_cache row (Supabase). */
export interface PropertyTaxCacheRow {
  county: string;
  addressNormalized: string;
  addressDisplay: string;
  parcelId: string | null;
  folio: string | null;
  taxDistrict: string | null;
  homesteadAdValoremPct: number;
  nonHomesteadAdValoremPct: number;
  samplePrice: number;
  totalMillage: number | null;
  nonAdValoremAmtCents: number;
  nonAdValoremLines: Array<{ authority: string; amount: number }>;
  source: string;
  expiresAt: Date;
}

/**
 * Determines whether a cached row is valid for the given purchase price.
 * Returns true only when ALL of:
 *   1. parcelId or folio is non-empty (verified parcel identity)
 *   2. both homestead/non-homestead percentages are > 0
 *   3. source is non-empty
 *   4. row is not expired (expiresAt > now)
 *   5. samplePrice > 0 and purchasePrice within ±20% of samplePrice
 *
 * Exported for unit testing.
 */
export function isCacheRowValid(
  row: Pick<
    PropertyTaxCacheRow,
    | "parcelId"
    | "folio"
    | "homesteadAdValoremPct"
    | "nonHomesteadAdValoremPct"
    | "samplePrice"
    | "nonAdValoremAmtCents"
    | "source"
    | "expiresAt"
  >,
  purchasePrice: number,
  now: Date = new Date(),
  options: { requireExactSamplePrice?: boolean } = {},
): boolean {
  // Must have verified parcel identity
  const hasParcel = (row.parcelId && row.parcelId.trim()) ||
                    (row.folio && row.folio.trim());
  if (!hasParcel) return false;
  if (
    !Number.isFinite(row.homesteadAdValoremPct) ||
    row.homesteadAdValoremPct <= 0
  ) return false;
  if (
    !Number.isFinite(row.nonHomesteadAdValoremPct) ||
    row.nonHomesteadAdValoremPct <= 0
  ) return false;
  if (
    !Number.isInteger(row.nonAdValoremAmtCents) ||
    row.nonAdValoremAmtCents < 0
  ) return false;
  if (!row.source || !row.source.trim()) return false;
  if (!Number.isFinite(row.expiresAt.getTime()) || row.expiresAt <= now) {
    return false;
  }
  if (!Number.isFinite(row.samplePrice) || row.samplePrice <= 0) return false;
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) return false;

  const ratio = purchasePrice / row.samplePrice;
  if (ratio < 0.8 || ratio > 1.2) return false;
  if (
    options.requireExactSamplePrice &&
    Math.abs(purchasePrice - row.samplePrice) > 0.005
  ) return false;

  return true;
}

/**
 * Compute the purchase ad-valorem estimate from cached rates.
 * Fixed NAV does NOT scale with price.
 *
 * Exported for unit testing.
 */
export function computeFromCache(
  row: Pick<
    PropertyTaxCacheRow,
    | "homesteadAdValoremPct"
    | "nonHomesteadAdValoremPct"
    | "nonAdValoremAmtCents"
  >,
  purchasePrice: number,
  homestead: boolean
): { adValoremTax: number; nonAdValoremTax: number; annualTax: number } {
  const pct = homestead
    ? row.homesteadAdValoremPct
    : row.nonHomesteadAdValoremPct;
  const adValoremTax = Math.round(purchasePrice * pct);
  const nonAdValoremTax = Math.round(row.nonAdValoremAmtCents) / 100;
  return { adValoremTax, nonAdValoremTax, annualTax: adValoremTax + nonAdValoremTax };
}

// ── Supabase REST helpers ─────────────────────────────────────────

function rowFromSupabase(r: Record<string, unknown>): PropertyTaxCacheRow {
  return {
    county: String(r.county ?? ""),
    addressNormalized: String(r.address_normalized ?? ""),
    addressDisplay: String(r.address_display ?? ""),
    parcelId: r.parcel_id ? String(r.parcel_id) : null,
    folio: r.folio ? String(r.folio) : null,
    taxDistrict: r.tax_district ? String(r.tax_district) : null,
    homesteadAdValoremPct: parseFloat(String(r.homestead_ad_valorem_pct ?? "0")),
    nonHomesteadAdValoremPct: parseFloat(String(r.non_homestead_ad_valorem_pct ?? "0")),
    samplePrice: typeof r.sample_price === "number" ? r.sample_price : 0,
    totalMillage: r.total_millage != null ? parseFloat(String(r.total_millage)) : null,
    nonAdValoremAmtCents: typeof r.non_ad_valorem_amt_cents === "number"
      ? r.non_ad_valorem_amt_cents
      : 0,
    nonAdValoremLines: Array.isArray(r.non_ad_valorem_lines)
      ? (r.non_ad_valorem_lines as Array<{ authority: string; amount: number }>)
      : [],
    source: String(r.source ?? ""),
    expiresAt: new Date(String(r.expires_at ?? "")),
  };
}

/** Read a cache row by county + normalized address. Returns null on miss or error. */
export async function getPropertyTaxCacheRow(
  county: string,
  addressNormalized: string
): Promise<PropertyTaxCacheRow | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from("property_tax_cache")
      .select("*")
      .eq("county", county)
      .eq("address_normalized", addressNormalized)
      .maybeSingle();
    if (error) {
      console.error("[ptc] cache read failed:", error.message);
      return null;
    }
    if (!data) return null;
    return rowFromSupabase(data as Record<string, unknown>);
  } catch (e: any) {
    console.error("[ptc] cache read failed:", e?.message);
    return null;
  }
}

export interface WritePropertyTaxCacheParams {
  county: string;
  addressNormalized: string;
  addressDisplay: string;
  parcelId: string | null;
  folio: string | null;
  taxDistrict: string | null;
  homesteadAdValoremPct: number;
  nonHomesteadAdValoremPct: number;
  samplePrice: number;
  totalMillage?: number | null;
  nonAdValoremAmtCents: number;
  nonAdValoremLines: Array<{ authority: string; amount: number }>;
  source: string;
  now?: Date;
}

/** Upsert a cache row (conflict on county + address_normalized). */
export async function writePropertyTaxCache(
  params: WritePropertyTaxCacheParams
): Promise<void> {
  if (!supabaseAdmin) return;
  const now = params.now ?? new Date();
  const expiresAt = nextTaxRefreshBoundary(now);
  try {
    const row = {
      county: params.county,
      address_normalized: params.addressNormalized,
      address_display: params.addressDisplay,
      parcel_id: params.parcelId,
      folio: params.folio,
      tax_district: params.taxDistrict,
      homestead_ad_valorem_pct: String(params.homesteadAdValoremPct),
      non_homestead_ad_valorem_pct: String(params.nonHomesteadAdValoremPct),
      sample_price: params.samplePrice,
      total_millage: params.totalMillage != null ? String(params.totalMillage) : null,
      non_ad_valorem_amt_cents: params.nonAdValoremAmtCents,
      non_ad_valorem_lines: params.nonAdValoremLines,
      source: params.source,
      queried_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
    const { error } = await supabaseAdmin
      .from("property_tax_cache")
      .upsert(row, { onConflict: "county,address_normalized" });
    if (error) {
      console.error("[ptc] cache write failed:", error.message);
    }
  } catch (e: any) {
    console.error("[ptc] cache write failed:", e?.message);
  }
}
