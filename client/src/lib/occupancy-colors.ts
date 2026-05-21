// Single source of truth for property-use / occupancy color theming.
// Used by Dashboard rows, Refinance loan tracker buttons, and the Insurance
// property-use dropdown so the same value always renders the same color.
//
// Color rule (per product spec):
//   primary   -> Blue
//   secondary -> Yellow
//   investment -> Green
//
// Stored values may use a few legacy aliases (e.g. "second_home"); we
// normalize at the display layer only — saved values are not changed.

export type OccupancyKey = "primary" | "secondary" | "investment";

export function normalizeOccupancy(value: string | null | undefined): OccupancyKey | "unknown" {
  if (!value) return "unknown";
  const v = value.toLowerCase().trim();
  if (v === "primary" || v === "primary_home" || v === "primary_residence") return "primary";
  if (v === "secondary" || v === "second_home" || v === "second" || v === "2nd_home") return "secondary";
  if (v === "investment" || v === "investment_property" || v === "rental") return "investment";
  return "unknown";
}

// Tailwind class fragments for the filled/selected state of a pill, badge,
// button, or dropdown trigger. Text color picked for AA contrast on the fill.
const SOLID: Record<OccupancyKey, string> = {
  primary: "bg-blue-600 text-white border-blue-600",
  secondary: "bg-yellow-400 text-yellow-950 border-yellow-400",
  investment: "bg-green-600 text-white border-green-600",
};

const UNKNOWN_SOLID = "bg-muted text-muted-foreground border";

/** Class string for a "selected/filled" pill, badge, button, or trigger. */
export function getOccupancyColor(value: string | null | undefined): string {
  const key = normalizeOccupancy(value);
  return key === "unknown" ? UNKNOWN_SOLID : SOLID[key];
}
