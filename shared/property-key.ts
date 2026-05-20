// Normalized property key used to match the same physical property across
// the Purchase, Refinance, and Insurance flows. We intentionally key on
// street number + normalized street + optional unit + ZIP5 + state and
// ignore city, because Google Maps, Zillow, and mailing addresses can
// disagree on the city label for the same parcel.

const STREET_ABBR: Record<string, string> = {
  street: "st", str: "st",
  avenue: "ave", av: "ave",
  boulevard: "blvd", blv: "blvd", blvd: "blvd",
  road: "rd", rd: "rd",
  drive: "dr", dr: "dr",
  lane: "ln", ln: "ln",
  court: "ct", ct: "ct",
  circle: "cir", cir: "cir",
  place: "pl", pl: "pl",
  terrace: "ter", ter: "ter",
  parkway: "pkwy", pkwy: "pkwy",
  highway: "hwy", hwy: "hwy",
  trail: "trl", trl: "trl",
  way: "way",
  north: "n", south: "s", east: "e", west: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
};

export function normalizePropertyKey(address: string | undefined | null): string {
  if (!address) return "";
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[1] : "";
  let state = "";
  if (zipMatch && zipMatch.index !== undefined) {
    const before = address.slice(0, zipMatch.index).replace(/[,\s]+$/, "");
    const stMatch = before.match(/\b([A-Za-z]{2})$/);
    if (stMatch) state = stMatch[1].toLowerCase();
  }
  const firstPart = (address.split(",")[0] || "").trim();
  let street = firstPart;
  let unit = "";
  const unitMatch = firstPart.match(/\b(?:apt|apartment|unit|ste|suite|#)\s*([a-z0-9-]+)\b/i);
  if (unitMatch) {
    unit = unitMatch[1].toLowerCase();
    street = firstPart.replace(unitMatch[0], "").trim();
  }
  const tokens = street
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(t => STREET_ABBR[t] ?? t);
  const parts = [tokens.join("-"), unit, zip, state].filter(Boolean);
  return parts.join("-");
}

export type OccupancyType = "primary" | "secondary" | "investment";
export type OccupancySource = "purchase" | "refinance" | "insurance_manual" | "unknown";
