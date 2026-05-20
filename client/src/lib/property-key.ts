/**
 * Property-key normalization + cross-tab correlation helpers.
 *
 * Used by the Dashboard's Insurance tab to:
 *   1. Build a stable, address-shape-insensitive key so the same physical
 *      property is recognized whether it was saved under Purchase,
 *      Refinance, or Insurance, and regardless of "St" vs "Street",
 *      "W" vs "West", trailing ", USA", differing city spellings, etc.
 *   2. Persist a manual occupancy override per property key so that once
 *      a user changes occupancy on the Insurance row, automatic
 *      correlation stops overwriting their choice.
 *
 * Compatible with the Zillow/property-cache pattern: matching is based on
 * street number + normalized street name + unit + ZIP5 + state. City is
 * intentionally excluded (Google/Zillow disagree on city spellings for
 * the same address).
 *
 * NOTE on persistence: the override is stored in `localStorage` to avoid
 * a Supabase schema migration as part of this UX fix. A follow-up can
 * promote it to a real column on `insurance_scenarios` when the wider
 * insurance data model lands (linkedPurchaseScenarioId, normalizedPropertyKey,
 * occupancySource, correlationSource, etc.).
 */

export type OccupancyType = "primary" | "secondary" | "investment" | "unknown";

const STREET_SUFFIX_ALIASES: Record<string, string> = {
  st: "street", str: "street", street: "street",
  rd: "road", road: "road",
  ave: "avenue", av: "avenue", avenue: "avenue",
  blvd: "boulevard", boulevard: "boulevard",
  dr: "drive", drive: "drive",
  ln: "lane", lane: "lane",
  ct: "court", court: "court",
  pl: "place", place: "place",
  ter: "terrace", terr: "terrace", terrace: "terrace",
  cir: "circle", circle: "circle",
  pkwy: "parkway", parkway: "parkway",
  hwy: "highway", highway: "highway",
  trl: "trail", trail: "trail",
  way: "way",
  loop: "loop",
};

const DIRECTIONAL_ALIASES: Record<string, string> = {
  n: "north", north: "north",
  s: "south", south: "south",
  e: "east", east: "east",
  w: "west", west: "west",
  ne: "northeast", northeast: "northeast",
  nw: "northwest", northwest: "northwest",
  se: "southeast", southeast: "southeast",
  sw: "southwest", southwest: "southwest",
};

function normalizeToken(tok: string): string {
  const lower = tok.toLowerCase();
  if (DIRECTIONAL_ALIASES[lower]) return DIRECTIONAL_ALIASES[lower];
  if (STREET_SUFFIX_ALIASES[lower]) return STREET_SUFFIX_ALIASES[lower];
  return lower;
}

export interface NormalizedAddress {
  /** Composite key used for cross-tab matching. Empty if address unparseable. */
  key: string;
  streetNumber: string;
  streetName: string;
  unit: string;
  zip5: string;
  state: string;
}

/**
 * Parse a free-form address (typically a Google Places formatted_address
 * like "3102 W Nassau St, Tampa, FL 33614, USA") and produce a normalized
 * key for matching. Returns an empty `key` if the address can't be parsed
 * (caller should treat that as "no match" — never collapse all such rows
 * onto a single shared key).
 */
export function normalizePropertyKey(address: string | undefined | null): NormalizedAddress {
  const empty: NormalizedAddress = { key: "", streetNumber: "", streetName: "", unit: "", zip5: "", state: "" };
  if (!address || typeof address !== "string") return empty;

  const raw = address.trim();
  if (!raw) return empty;

  // Pull ZIP5 + state from the full string before we slice on commas.
  const zipStateMatch = raw.match(/,\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/i);
  const state = zipStateMatch ? zipStateMatch[1].toLowerCase() : "";
  const zip5 = zipStateMatch ? zipStateMatch[2] : "";

  // First comma-separated segment is the street line.
  const streetLine = raw.split(",")[0].trim();
  if (!streetLine) return empty;

  // Extract unit ("Apt 4", "#12", "Unit B", "Ste 200", "Suite 3A") off the end.
  let unit = "";
  let streetCore = streetLine;
  const unitMatch = streetCore.match(/\b(?:apt|apartment|unit|ste|suite|#)\s*([a-z0-9-]+)$/i);
  if (unitMatch) {
    unit = unitMatch[1].toLowerCase();
    streetCore = streetCore.slice(0, unitMatch.index).trim();
  } else {
    const hashMatch = streetCore.match(/#\s*([a-z0-9-]+)$/i);
    if (hashMatch) {
      unit = hashMatch[1].toLowerCase();
      streetCore = streetCore.slice(0, hashMatch.index).trim();
    }
  }

  // Tokenize street line, strip punctuation.
  const tokens = streetCore
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return empty;

  // First numeric token = street number. Remaining = street name parts.
  let streetNumber = "";
  const nameTokens: string[] = [];
  for (const t of tokens) {
    if (!streetNumber && /^\d+[a-z]?$/i.test(t)) {
      streetNumber = t.toLowerCase();
    } else {
      nameTokens.push(normalizeToken(t));
    }
  }

  const streetName = nameTokens.join(" ").trim();
  if (!streetNumber && !streetName) return empty;

  // Composite key. Include ZIP+state when available for tighter matching;
  // fall back to street-only matching when ZIP missing (rare but possible
  // for hand-typed addresses).
  const key = [streetNumber, streetName, unit, zip5, state].join("|");

  return { key, streetNumber, streetName, unit, zip5, state };
}

// ── Manual occupancy overrides (localStorage-backed) ──────────────────────

const OVERRIDE_LS_KEY = "tateo_insurance_overrides_v1";

interface OverrideEntry {
  occupancyType: OccupancyType;
  /** ISO timestamp of when the user set the override. */
  setAt: string;
}

function loadOverrides(): Record<string, OverrideEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDE_LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveOverrides(map: Record<string, OverrideEntry>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OVERRIDE_LS_KEY, JSON.stringify(map));
  } catch {
    // Quota / private mode — swallow; row will fall back to auto-correlation.
  }
}

export function getOccupancyOverride(key: string): OccupancyType | null {
  if (!key) return null;
  const map = loadOverrides();
  return map[key]?.occupancyType ?? null;
}

/**
 * Persist a manual occupancy override for a property key. Passing
 * `"unknown"` clears the override and re-enables automatic correlation.
 */
export function setOccupancyOverride(key: string, occupancy: OccupancyType): void {
  if (!key) return;
  const map = loadOverrides();
  if (occupancy === "unknown") {
    delete map[key];
  } else {
    map[key] = { occupancyType: occupancy, setAt: new Date().toISOString() };
  }
  saveOverrides(map);
}
