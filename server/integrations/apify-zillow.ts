/**
 * Apify Zillow Scraper integration.
 *
 * Calls the Apify Actor (ENK9p4RZHg0iVso52) synchronously, normalizes its
 * output into our PropertyScenario model, and parses listing descriptions
 * for insurance-relevant clues (roof age, impact windows, etc.).
 *
 * Caching of results lives in the route handler (server/routes.ts) so this
 * module stays a pure I/O + transform layer.
 */

const APIFY_ACTOR_ID = "ENK9p4RZHg0iVso52";
const APIFY_RUN_TIMEOUT_MS = 90_000; // hard ceiling per request

// ── Types ───────────────────────────────────────────────────────────
export type PropertyTypeNorm =
  | "Single Family" | "Townhome" | "Condo" | "Multifamily"
  | "Manufactured" | "Land" | "Other";

export type OccupancyType = "Primary" | "Secondary" | "Investment" | "";

export interface ParsedInsuranceClues {
  roofYear: number | null;
  roofConditionText: string | null;
  hasImpactWindows: boolean | null;
  hasImpactDoors: boolean | null;
  hasImpactGarageDoor: boolean | null;
  hasHurricaneShutters: boolean | null;
  updatedElectrical: boolean | null;
  updatedPlumbing: boolean | null;
  updatedHVAC: boolean | null;
  floodZoneMentioned: boolean | null;
  windMitigationMentioned: boolean | null;
  rawMatchedPhrases: string[];
}

export interface PropertyScenario {
  source: "Zillow via Apify";
  address: string;
  zillowUrl: string;
  zestimate: number | null;
  listingPrice: number | null;
  purchasePrice: number | null;
  estimatedHomeValue: number | null;
  hoaMonthly: number | null;
  propertyType: PropertyTypeNorm | "";
  yearBuilt: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  lotSize: number | null;
  photos: string[];
  listingDescription: string;
  parsedInsuranceClues: ParsedInsuranceClues;
  insurancePolicyType: "HO3" | "HO6" | "DP3" | "";
  occupancyType: OccupancyType;
  rawZillowData: unknown;
  lastPulledAt: string;
}

// ── Apify HTTP call ─────────────────────────────────────────────────
function isZillowUrl(input: string): boolean {
  return /^https?:\/\/(www\.)?zillow\.com\//i.test(input.trim());
}

/**
 * Run the actor synchronously and return the dataset rows. We use
 * `run-sync-get-dataset-items` so we don't have to poll. The actor accepts
 * either `startUrls` (Zillow URL) or `addresses` (free-form address strings).
 */
async function runApify(addressOrUrl: string): Promise<unknown[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not configured on the server");

  const input: Record<string, unknown> = isZillowUrl(addressOrUrl)
    ? { startUrls: [{ url: addressOrUrl.trim() }] }
    : { addresses: [addressOrUrl.trim()] };

  const url =
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(token)}&clean=1`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APIFY_RUN_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Apify returned ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    // Apify usually returns a raw array of dataset items, but some actor
    // configurations wrap it as `{ items: [...] }` or `{ data: [...] }`.
    // Accept any of those shapes so a future actor-side change doesn't 502 us.
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as any).items)) return (data as any).items;
    if (data && Array.isArray((data as any).data)) return (data as any).data;
    if (data && typeof data === "object") return [data]; // single-result fallback
    throw new Error("Apify response shape was not recognized");
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("Apify run timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Normalization helpers ───────────────────────────────────────────
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize Zillow's home-type strings into our restricted set.
 * Zillow values seen in the wild: SINGLE_FAMILY, CONDO, TOWNHOUSE,
 * MULTI_FAMILY, MANUFACTURED, LOT, APARTMENT, "Single Family Residence", etc.
 */
function normalizePropertyType(raw: unknown): PropertyTypeNorm | "" {
  if (!raw) return "";
  const s = String(raw).toUpperCase().replace(/[^A-Z]/g, "");
  if (s.includes("CONDO") || s === "APARTMENT") return "Condo";
  if (s.includes("TOWN")) return "Townhome";
  if (s.includes("MULTI")) return "Multifamily";
  if (s.includes("MANUFACTURED") || s.includes("MOBILE")) return "Manufactured";
  if (s.includes("LOT") || s.includes("LAND")) return "Land";
  if (s.includes("SINGLE") || s.includes("SFR") || s.includes("HOUSE")) return "Single Family";
  return "Other";
}

/**
 * Convert HOA fee into a monthly number. Zillow exposes either
 * `monthlyHoaFee` (already monthly) or `hoaFee` with a frequency like
 * "Annually" / "Quarterly". We coerce everything to monthly.
 */
function normalizeHoaMonthly(raw: any): number | null {
  if (raw == null) return null;
  // Simple numeric/monthly cases.
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return num(raw);
  // Object cases: { value, frequency } or { amount, period }.
  const value = num(raw.value ?? raw.amount ?? raw.fee);
  if (value == null) return null;
  const freq = String(raw.frequency ?? raw.period ?? raw.unit ?? "monthly").toLowerCase();
  if (freq.startsWith("ann") || freq.includes("year")) return Math.round((value / 12) * 100) / 100;
  if (freq.startsWith("quart")) return Math.round((value / 3) * 100) / 100;
  if (freq.startsWith("semi")) return Math.round((value / 6) * 100) / 100;
  return value; // monthly by default
}

function pickAddress(p: any): string {
  if (typeof p.address === "string") return p.address;
  const a = p.address ?? {};
  return [a.streetAddress, a.city, a.state, a.zipcode].filter(Boolean).join(", ");
}

function pickPhotos(p: any): string[] {
  if (Array.isArray(p.photos)) {
    return p.photos.map((ph: any) => (typeof ph === "string" ? ph : ph?.url ?? ph?.mixedSources?.jpeg?.[0]?.url)).filter(Boolean);
  }
  if (Array.isArray(p.images)) return p.images.filter((x: any) => typeof x === "string");
  if (typeof p.imgSrc === "string") return [p.imgSrc];
  return [];
}

function pickDescription(p: any): string {
  return String(p.description ?? p.homeDescription ?? p.listingDescription ?? p.caption ?? "");
}

// ── Insurance-clue parser ───────────────────────────────────────────
/**
 * Scan a free-form listing description for insurance-relevant features.
 * All `false`/null distinctions matter: `null` means "not mentioned",
 * `true`/`false` mean we found explicit language either way (we never
 * assert false unless the description directly negates the feature, which
 * is uncommon — so most negatives stay null).
 */
export function parseInsuranceClues(description: string): ParsedInsuranceClues {
  const clues: ParsedInsuranceClues = {
    roofYear: null,
    roofConditionText: null,
    hasImpactWindows: null,
    hasImpactDoors: null,
    hasImpactGarageDoor: null,
    hasHurricaneShutters: null,
    updatedElectrical: null,
    updatedPlumbing: null,
    updatedHVAC: null,
    floodZoneMentioned: null,
    windMitigationMentioned: null,
    rawMatchedPhrases: [],
  };
  if (!description) return clues;
  const text = description.toLowerCase();
  const matched = new Set<string>();

  const record = (phrase: string) => matched.add(phrase);

  // Roof year: capture phrases like "new roof 2021", "roof replaced in 2020",
  // "2022 roof", "roof (2019)". Accept any 4-digit year 1950..currentYear+1.
  const currentYear = new Date().getFullYear();
  const yearPatterns: RegExp[] = [
    /\b(?:new|newer|recently\s+replaced|replaced|installed|updated)\s+roof[^.\n]{0,40}?(\b(?:19|20)\d{2}\b)/i,
    /\broof[^.\n]{0,40}?(?:replaced|installed|updated|new)[^.\n]{0,20}?(\b(?:19|20)\d{2}\b)/i,
    /\b(\b(?:19|20)\d{2}\b)\s+roof\b/i,
    /\broof\s*\(?\s*(\b(?:19|20)\d{2}\b)\s*\)?/i,
  ];
  for (const re of yearPatterns) {
    const m = text.match(re);
    if (m) {
      const year = Number(m[1]);
      if (year >= 1950 && year <= currentYear + 1) {
        clues.roofYear = year;
        record(m[0]);
        break;
      }
    }
  }

  // Roof condition language (independent of year).
  const roofCondRe = /\b(new roof|newer roof|recently replaced roof|roof recently replaced|roof replacement|updated roof|brand new roof)\b/i;
  const roofCondMatch = text.match(roofCondRe);
  if (roofCondMatch) {
    clues.roofConditionText = roofCondMatch[0];
    record(roofCondMatch[0]);
  }

  // Impact / hurricane features. We deliberately distinguish windows, doors,
  // and garage doors because insurers price them separately.
  const check = (key: keyof ParsedInsuranceClues, patterns: RegExp[]) => {
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        (clues as any)[key] = true;
        record(m[0]);
        return;
      }
    }
  };

  // Negation-aware feature detection: skip matches preceded by "no", "not",
  // "without", "lacks", or "missing" within ~3 words (e.g. "no impact windows"
  // should NOT set hasImpactWindows=true). We strip those phrases out of the
  // search text up-front so the existing positive regexes work as intended.
  const NEG = /\b(no|not|without|lacks|lacking|missing|none)\s+([a-z\- ]{0,30}?)\b/gi;
  const positiveText = text.replace(NEG, "");
  const checkPos = (key: keyof ParsedInsuranceClues, patterns: RegExp[]) => {
    for (const re of patterns) {
      const m = positiveText.match(re);
      if (m) {
        (clues as any)[key] = true;
        record(m[0]);
        return;
      }
    }
  };

  checkPos("hasImpactWindows", [
    /\b(impact|hurricane[- ]impact|hurricane[- ]rated)\s+windows?\b/i,
    /\bimpact[- ]rated\s+windows?\b/i,
    /\bhurricane\s+windows?\b/i,
  ]);
  checkPos("hasImpactDoors", [
    /\b(impact|hurricane[- ]impact|hurricane[- ]rated)\s+doors?\b/i,
    /\bimpact[- ]rated\s+doors?\b/i,
  ]);
  checkPos("hasImpactGarageDoor", [
    /\bhurricane[- ]rated\s+garage\s+door\b/i,
    /\bimpact\s+garage\s+door\b/i,
    /\bimpact[- ]rated\s+garage\b/i,
  ]);
  checkPos("hasHurricaneShutters", [
    /\b(hurricane|storm|accordion|roll[- ]down)\s+shutters?\b/i,
  ]);
  checkPos("updatedElectrical", [
    /\b(updated|new|new(ly)?\s+installed|upgraded)\s+electrical\b/i,
    /\belectrical\s+(updated|upgraded|replaced)\b/i,
  ]);
  checkPos("updatedPlumbing", [
    /\b(updated|new|upgraded|re-?piped|repipe)\s+plumbing\b/i,
    /\bplumbing\s+(updated|upgraded|replaced|repiped)\b/i,
  ]);
  checkPos("updatedHVAC", [
    /\b(updated|new|upgraded|replaced)\s+(hvac|a\/?c|air\s+conditioning|ac\s+unit)\b/i,
    /\b(hvac|a\/?c|air\s+conditioning)\s+(updated|upgraded|replaced|new)\b/i,
  ]);
  // Flood zone: use raw text (not positiveText) so "not in a flood zone"
  // still flags the topic as mentioned — but record whether it was negated.
  if (/\bflood\s+zone\b/i.test(text)) {
    clues.floodZoneMentioned = true;
    record(text.match(/[^.]*\bflood\s+zone\b[^.]*/i)?.[0]?.trim() ?? "flood zone");
  }
  checkPos("windMitigationMentioned", [
    /\bwind\s+mitigation\b/i,
    /\bwind[- ]mit\b/i,
  ]);

  clues.rawMatchedPhrases = Array.from(matched);
  return clues;
}

// ── Insurance policy-type rule ──────────────────────────────────────
export function derivePolicyType(
  propertyType: PropertyTypeNorm | "",
  occupancy: OccupancyType,
): "HO3" | "HO6" | "DP3" | "" {
  if (!propertyType) return "";
  // Condos / Townhomes are always HO6 regardless of occupancy.
  if (propertyType === "Condo" || propertyType === "Townhome") return "HO6";
  // Detached residential: HO3 for owner-occupied, DP3 for investment.
  const detached: PropertyTypeNorm[] = ["Single Family", "Multifamily", "Manufactured", "Other"];
  if (detached.includes(propertyType)) {
    if (occupancy === "Investment") return "DP3";
    return "HO3"; // Primary, Secondary, or unspecified
  }
  return ""; // Land has no homeowner policy
}

// ── Top-level normalize ─────────────────────────────────────────────
function normalizeOne(row: any): PropertyScenario {
  const description = pickDescription(row);
  const propertyType = normalizePropertyType(row.homeType ?? row.propertyType ?? row.hdpData?.homeInfo?.homeType);
  const zestimate = num(row.zestimate ?? row.zestimateValue ?? row.priceHistory?.[0]?.price);
  const listingPrice = num(row.price ?? row.listPrice ?? row.unformattedPrice);
  const purchasePrice = listingPrice ?? zestimate;
  const estimatedHomeValue = zestimate ?? listingPrice;
  const clues = parseInsuranceClues(description);

  return {
    source: "Zillow via Apify",
    address: pickAddress(row),
    zillowUrl: String(row.url ?? row.hdpUrl ?? row.detailUrl ?? ""),
    zestimate,
    listingPrice,
    purchasePrice,
    estimatedHomeValue,
    hoaMonthly: normalizeHoaMonthly(row.monthlyHoaFee ?? row.hoaFee ?? row.hoa),
    propertyType,
    yearBuilt: num(row.yearBuilt),
    bedrooms: num(row.bedrooms),
    bathrooms: num(row.bathrooms),
    squareFeet: num(row.livingArea ?? row.livingAreaValue ?? row.squareFeet),
    lotSize: num(row.lotSize ?? row.lotAreaValue ?? row.lotAreaSize),
    photos: pickPhotos(row),
    listingDescription: description,
    parsedInsuranceClues: clues,
    insurancePolicyType: derivePolicyType(propertyType, ""),
    occupancyType: "",
    rawZillowData: row,
    lastPulledAt: new Date().toISOString(),
  };
}

/**
 * Public entry point used by the route handler. Returns the normalized
 * scenario for the first Zillow result, or throws a descriptive error.
 */
export async function fetchZillowProperty(addressOrUrl: string): Promise<PropertyScenario> {
  const input = addressOrUrl?.trim();
  if (!input) throw new Error("Missing address or Zillow URL");

  const rows = await runApify(input);
  if (rows.length === 0) {
    throw new Error("No Zillow results found for that address");
  }
  const normalized = normalizeOne(rows[0]);

  // Fail-safe: a "successful" Apify run can still return a row with no
  // address and no valuation. That's garbage for downstream consumers, so
  // surface it as a 404 rather than silently caching empty data.
  const hasAnyValuation = normalized.zestimate != null || normalized.listingPrice != null;
  if (!normalized.address && !hasAnyValuation) {
    throw new Error("No Zillow results found for that address");
  }
  return normalized;
}
