/**
 * Hillsborough County property tax estimator.
 *
 * Two-step live flow:
 *   1. BasicSearch by street address → PIN + folio
 *   2. TaxEstimator?pin=PIN → millage rates
 *
 * Parcel rates are cached independently of price and homestead status, so a
 * cache hit always recalculates the estimate from the caller's current inputs.
 */

import {
  isHillsboroughCountyAddress,
  normalizeHillsboroughAddressKey,
} from "@shared/hillsborough-county";
import { PURCHASE_TAX_LOW_ASSESSMENT_RATIO } from "@shared/property-tax-policy";
import { totalNonSchoolHomesteadExemptionForYear } from "./property-tax-cache";

export { isHillsboroughCountyAddress };

const HCPA_BASE =
  "https://gis.hcpafl.org/CommonServices/" +
  "property/search";
const HCPA_REFERER =
  "https://gis.hcpafl.org/PropertySearch/" +
  "TaxEstimator.aspx";
const FETCH_TIMEOUT_MS = 8_000;
export const HCPA_CACHE_TTL_MS =
  60 * 24 * 60 * 60 * 1000;

const HCPA_HEADERS = {
  "Referer": HCPA_REFERER,
  "Accept": "application/json, text/plain, */*",
  "X-Requested-With": "XMLHttpRequest",
};

export interface HCPATaxData {
  schoolTaxRate: number;
  nonschoolTaxRate: number;
  totalTaxRate: number;
  nonAdValoremTaxes: number;
  taxDistrict: string;
  justValue: number;
  assessedValue: number;
}

export interface HCPATaxResult {
  annualTax: number;
  monthlyTax: number;
  adValoremTax: number;
  nonAdValoremTax: number;
  taxDistrict: string;
  totalMillageRate: number;
  homestead: boolean;
  folio: string | null;
  source: "hcpa-api" | "hcpa-cache";
}

export interface HCPATaxCacheRecord {
  addressNormalized: string;
  addressDisplay: string;
  pin: string;
  folio: string | null;
  schoolTaxRate: number;
  nonschoolTaxRate: number;
  totalTaxRate: number;
  nonAdValoremTaxes: number;
  taxDistrict: string;
  queriedAt: string;
  expiresAt: string;
}

export interface HCPATaxCacheStore {
  get(addressNormalized: string): Promise<HCPATaxCacheRecord | null>;
  set(record: HCPATaxCacheRecord): Promise<void>;
}

const STREET_SUFFIXES = new Set([
  "ALY", "ALLEY",
  "AVE", "AV", "AVENUE",
  "BLVD", "BOULEVARD",
  "CIR", "CIRCLE",
  "CT", "COURT",
  "DR", "DRIVE",
  "EXPY", "EXPRESSWAY",
  "HWY", "HIGHWAY",
  "LN", "LANE",
  "LOOP",
  "PKWY", "PARKWAY",
  "PL", "PLACE",
  "RD", "ROAD",
  "ST", "STREET",
  "TER", "TERRACE",
  "TRL", "TRAIL",
  "WAY",
]);

const TOKEN_ALIASES: Record<string, string> = {
  NORTH: "N",
  SOUTH: "S",
  EAST: "E",
  WEST: "W",
  NORTHEAST: "NE",
  NORTHWEST: "NW",
  SOUTHEAST: "SE",
  SOUTHWEST: "SW",
};

function streetOnly(address: string): string {
  return (address.split(",")[0] ?? "")
    .replace(
      /\s+(?:#|APT(?:ARTMENT)?|UNIT|STE|SUITE)\s*[-A-Z0-9]*.*$/i,
      "",
    )
    .trim();
}

function unitFromAddress(address: string): string | null {
  const street = address.split(",")[0] ?? "";
  const match = street.match(
    /(?:^|\s)(?:#|APT(?:ARTMENT)?|UNIT|STE|SUITE)\s*[-#]?([A-Z0-9-]+)/i,
  );
  return match?.[1]
    ? match[1].toUpperCase().replace(/[^A-Z0-9]/g, "")
    : null;
}

function normalizedStreetTokens(address: string): string[] {
  const tokens = streetOnly(address)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(token => TOKEN_ALIASES[token] ?? token);

  if (tokens.length > 1 && STREET_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens;
}

/**
 * Search the complete street first. If HCPA returns no candidates, retry only
 * by removing a recognized trailing street suffix. We never fall back to the
 * old fixed-token truncation that changed "W Bay to Bay" into "W Bay".
 */
export function streetQueriesForSearch(fullAddress: string): string[] {
  const fullStreet = streetOnly(fullAddress)
    .replace(/\s+/g, " ")
    .trim();
  if (!fullStreet) return [];

  const rawTokens = fullStreet.split(/\s+/);
  const last = (rawTokens[rawTokens.length - 1] ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (rawTokens.length > 2 && STREET_SUFFIXES.has(last)) {
    return [
      fullStreet,
      rawTokens.slice(0, -1).join(" "),
    ];
  }
  return [fullStreet];
}

export function streetAddressMatches(
  requestedAddress: string,
  candidateAddress: string,
): boolean {
  const requested = normalizedStreetTokens(requestedAddress);
  const candidate = normalizedStreetTokens(candidateAddress);
  if (requested.length < 2 || candidate.length < 2) return false;
  if (requested[0] !== candidate[0]) return false;
  if (requested.length !== candidate.length) return false;
  if (!requested.every((token, index) => token === candidate[index])) {
    return false;
  }

  // A building-level street match is not enough for condos or suites. If
  // either side identifies a unit, both must identify the same unit.
  const requestedUnit = unitFromAddress(requestedAddress);
  const candidateUnit = unitFromAddress(candidateAddress);
  return requestedUnit === candidateUnit;
}

function cityFromAddress(address: string): string {
  return (address.split(",")[1] ?? "")
    .trim()
    .toUpperCase();
}

function candidateCity(address: string): string {
  return cityFromAddress(address)
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type FetchImplementation = typeof fetch;

export function areHcpaRatesValid(rates: {
  schoolTaxRate: unknown;
  nonschoolTaxRate: unknown;
  totalTaxRate: unknown;
}): rates is {
  schoolTaxRate: number;
  nonschoolTaxRate: number;
  totalTaxRate: number;
} {
  return (
    typeof rates.schoolTaxRate === "number" &&
    Number.isFinite(rates.schoolTaxRate) &&
    rates.schoolTaxRate >= 0 &&
    typeof rates.nonschoolTaxRate === "number" &&
    Number.isFinite(rates.nonschoolTaxRate) &&
    rates.nonschoolTaxRate >= 0 &&
    typeof rates.totalTaxRate === "number" &&
    Number.isFinite(rates.totalTaxRate) &&
    rates.totalTaxRate > 0
  );
}

/** Step 1: Resolve address → PIN via BasicSearch with strict street matching. */
export async function lookupPIN(
  address: string,
  fetchImpl: FetchImplementation = fetch,
): Promise<{ pin: string; folio: string | null } | null> {
  const inputCity = cityFromAddress(address);

  for (const query of streetQueriesForSearch(address)) {
    const search = new URLSearchParams({
      address: query,
      pagesize: "100",
      page: "1",
    });
    const resp = await fetchImpl(
      `${HCPA_BASE}/BasicSearch?${search.toString()}`,
      {
        headers: HCPA_HEADERS,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!resp.ok) return null;

    const results = await resp.json();
    if (!Array.isArray(results) || !results.length) {
      continue;
    }

    const streetMatches = results.filter((candidate: any) => {
      const matches =
        typeof candidate?.address === "string" &&
        streetAddressMatches(address, candidate.address);
      if (!matches) {
        console.log("[hcpa-tax] street mismatch, rejecting");
      }
      return matches;
    });
    if (!streetMatches.length) return null;

    const cityMatches = inputCity
      ? streetMatches.filter(
          (candidate: any) =>
            candidateCity(String(candidate.address ?? "")) ===
            candidateCity(`,${inputCity}`),
        )
      : streetMatches;
    if (!cityMatches.length) {
      console.log("[hcpa-tax] city mismatch, rejecting");
      return null;
    }

    const best = cityMatches[0];
    if (typeof best?.pin !== "string" || !best.pin) return null;
    return {
      pin: best.pin,
      folio:
        typeof best.folio === "string" && best.folio
          ? best.folio
          : null,
    };
  }
  return null;
}

/** Step 2: Fetch tax data by PIN. Exported as fetchHcpaRatesForPin for the general tax service. */
export async function fetchHcpaRatesForPin(
  pin: string,
  fetchImpl: FetchImplementation = fetch,
): Promise<HCPATaxData | null> {
  return fetchTaxData(pin, fetchImpl);
}

async function fetchTaxData(
  pin: string,
  fetchImpl: FetchImplementation = fetch,
): Promise<HCPATaxData | null> {
  const url =
    `${HCPA_BASE}/TaxEstimator?pin=` +
    encodeURIComponent(pin);

  const resp = await fetchImpl(url, {
    headers: HCPA_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) return null;

  const data = await resp.json();

  // Validate we got useful data back
  if (!areHcpaRatesValid(data ?? {})) {
    return null;
  }

  // The endpoint returns rotating decoy/obfuscated
  // JSON for unknown PINs — only trust a response
  // that echoes back the exact PIN we asked for.
  if (
    typeof data?.parcelID === "string" &&
    data.parcelID !== pin
  ) {
    console.log(
      "[hcpa-tax] decoy response (parcelID mismatch), rejecting"
    );
    return null;
  }

  return {
    schoolTaxRate: data.schoolTaxRate,
    nonschoolTaxRate: data.nonschoolTaxRate,
    totalTaxRate: data.totalTaxRate,
    nonAdValoremTaxes:
      typeof data.nonAdValoremTaxes === "number" &&
      Number.isFinite(data.nonAdValoremTaxes) &&
      data.nonAdValoremTaxes >= 0
        ? data.nonAdValoremTaxes
        : 0,
    taxDistrict: data.taxDistrict ?? "",
    justValue: data.justValue ?? 0,
    assessedValue: data.assessedValue ?? 0,
  };
}

/** Calculate the ad valorem tax portion using
 *  HCPA's exact formula.
 *
 *  Low estimate = purchasePrice × 0.85 as the
 *  taxable base (matches HCPA website lower bound).
 *  NonAdValorem (CDD) is added separately on top.
 */
export function calcAdValorem(
  purchasePrice: number,
  homestead: boolean,
  schoolRate: number,
  nonSchoolRate: number,
  totalRate: number,
  nonSchoolHomesteadExemption = 50_000,
): number {
  // HCPA low estimate: 85% of purchase price
  const taxableBase =
    purchasePrice * PURCHASE_TAX_LOW_ASSESSMENT_RATIO;

  if (!homestead) {
    return Math.round(
      taxableBase * (totalRate / 1000)
    );
  }

  // Homestead exemption:
  //   $25k off ALL taxes (school + non-school)
  //   the indexed second exemption phases in above $50k and applies to
  //   NON-SCHOOL taxes only
  const schoolTaxable = Math.max(
    0, taxableBase - 25_000
  );
  const schoolTax =
    schoolTaxable * (schoolRate / 1000);

  const maxAdditionalExemption = Math.max(
    0,
    nonSchoolHomesteadExemption - 25_000,
  );
  const additionalExemption = Math.max(
    0,
    Math.min(taxableBase - 50_000, maxAdditionalExemption),
  );
  const nonSchoolTaxable = Math.max(
    0,
    taxableBase - 25_000 - additionalExemption,
  );
  const nonSchoolTax =
    nonSchoolTaxable * (nonSchoolRate / 1000);

  return Math.round(schoolTax + nonSchoolTax);
}

function taxResultFromRates(params: {
  purchasePrice: number;
  isPrimaryResidence: boolean;
  pin: string;
  folio: string | null;
  taxData: HCPATaxData;
  source: HCPATaxResult["source"];
  rateYear: number;
}): HCPATaxResult {
  const adValorem = calcAdValorem(
    params.purchasePrice,
    params.isPrimaryResidence,
    params.taxData.schoolTaxRate,
    params.taxData.nonschoolTaxRate,
    params.taxData.totalTaxRate,
    totalNonSchoolHomesteadExemptionForYear(params.rateYear),
  );
  const nonAdValorem = Math.round(
    params.taxData.nonAdValoremTaxes ?? 0,
  );
  const annualTax = adValorem + nonAdValorem;
  return {
    annualTax,
    monthlyTax: Math.round((annualTax / 12) * 100) / 100,
    adValoremTax: adValorem,
    nonAdValoremTax: nonAdValorem,
    taxDistrict: params.taxData.taxDistrict,
    totalMillageRate: params.taxData.totalTaxRate,
    homestead: params.isPrimaryResidence,
    folio: params.folio,
    source: params.source,
  };
}

export interface GetHillsboroughTaxOptions {
  fetchImpl?: FetchImplementation;
  cacheStore?: HCPATaxCacheStore;
  now?: number;
}

/** Main export: resolve address → full tax
 *  estimate including CDD/non-ad valorem.
 *  Returns null on any API failure. */
export async function getHillsboroughTax(params: {
  address: string;
  purchasePrice: number;
  isPrimaryResidence: boolean;
}, options: GetHillsboroughTaxOptions = {}): Promise<HCPATaxResult | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cacheStore = options.cacheStore;
  const now = options.now ?? Date.now();
  const addressNormalized =
    normalizeHillsboroughAddressKey(params.address);

  const cached = cacheStore
    ? await cacheStore.get(addressNormalized)
    : null;
  if (
    cached &&
    new Date(cached.expiresAt).getTime() > now &&
    cached.folio &&
    areHcpaRatesValid(cached)
  ) {
    const result = taxResultFromRates({
      purchasePrice: params.purchasePrice,
      isPrimaryResidence: params.isPrimaryResidence,
      pin: cached.pin,
      folio: cached.folio,
      taxData: {
        schoolTaxRate: cached.schoolTaxRate,
        nonschoolTaxRate: cached.nonschoolTaxRate,
        totalTaxRate: cached.totalTaxRate,
        nonAdValoremTaxes: cached.nonAdValoremTaxes,
        taxDistrict: cached.taxDistrict,
        justValue: 0,
        assessedValue: 0,
      },
      source: "hcpa-cache",
      rateYear: new Date(now).getUTCFullYear(),
    });
    console.log("[hcpa-tax] cache hit");
    return result;
  }

  // Step 1: address → PIN
  const found = await lookupPIN(params.address, fetchImpl);
  if (!found) {
    console.log(
      "[hcpa-tax] PIN not found for:",
      params.address
    );
    return null;
  }
  const pin = found.pin;
  console.log("[hcpa-tax] PIN:", pin);

  // Step 2: PIN → tax data
  const taxData = await fetchTaxData(pin, fetchImpl);
  if (!taxData) {
    console.log("[hcpa-tax] TaxEstimator failed");
    return null;
  }
  console.log("[hcpa-tax] taxData:", {
    district:     taxData.taxDistrict,
    totalMills:   taxData.totalTaxRate,
    nonAdValorem: taxData.nonAdValoremTaxes,
  });

  const folio =
    found.folio ??
    (cached?.pin === pin ? cached.folio : null);
  const result = taxResultFromRates({
    purchasePrice: params.purchasePrice,
    isPrimaryResidence: params.isPrimaryResidence,
    pin,
    folio,
    taxData,
    source: "hcpa-api",
    rateYear: new Date(now).getUTCFullYear(),
  });

  console.log(
    `[hcpa-tax] ${taxData.taxDistrict}` +
    ` mills=${taxData.totalTaxRate}` +
    ` homestead=${params.isPrimaryResidence}` +
    ` adVal=$${result.adValoremTax}` +
    ` nonAdVal=$${result.nonAdValoremTax}` +
    ` total=$${result.annualTax}`
  );

  // A cache entry without folio would suppress the separate Tax Collector
  // CDD lookup on a later hit. Skip incomplete writes rather than replacing
  // a previously usable row with less parcel identity.
  if (folio && cacheStore) {
    await cacheStore.set({
      addressNormalized,
      addressDisplay: params.address.trim(),
      pin,
      folio,
      schoolTaxRate: taxData.schoolTaxRate,
      nonschoolTaxRate: taxData.nonschoolTaxRate,
      totalTaxRate: taxData.totalTaxRate,
      nonAdValoremTaxes:
        cached?.pin === pin
          ? cached.nonAdValoremTaxes
          : taxData.nonAdValoremTaxes,
      taxDistrict: taxData.taxDistrict,
      queriedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + HCPA_CACHE_TTL_MS).toISOString(),
    });
  }

  return result;
}
