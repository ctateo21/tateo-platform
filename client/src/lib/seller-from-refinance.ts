// Auto-populates a Sell-Your-Home (`seller_scenarios`) draft from a
// refinance `TrackedLoan` whenever the user uploads a mortgage
// statement OR edits the estimated home value / loan balance in the
// Refinance tab.
//
// Match key: `normalized_property_key` first (durable across
// formatting changes), case-insensitive `full_address` as fallback.
// Matching is scoped to the current user implicitly via
// `saveSellerScenarios`, which only ever persists rows for
// `_session.id`.
//
// Manual-override protection is now provenance-based via the
// `*_source` columns added by 2026_05_24_seller_scenario_sources.sql.
// For each refinance-derived field we overwrite ONLY when the
// existing row's source is NOT `"manual"`. NULL/undefined source is
// treated as "auto" (overridable) — legacy rows that pre-date the
// migration still get refreshed from the latest refinance values.
//
// Priority order for `estimated_sale_price` (matches the user's spec):
//   1. Manual seller edit       (source = "manual"          → never overwritten)
//   2. Refinance UI value       (source = "refinance"       → wins over Zillow)
//   3. Zillow / property cache  (source = "zillow"          → fallback)
//   4. blank/undefined          (source = NULL              → fillable by anyone)
//
// This module never triggers Market Analysis. Auto-created scenarios
// are always status="draft"; Market Analysis is gated to
// "ready_to_list" | "listed" elsewhere (seller-estimate page,
// /api/listing-market-analysis route, weekly scheduler).

import {
  type SellerScenario,
  type SellerScenarioStatus,
  type TrackedLoan,
} from "./auth";
import { normalizePropertyKey } from "./property-key";

export interface SyncSellerFromRefinanceInput {
  trackedLoan: TrackedLoan;
  scenarios: SellerScenario[];
  /** Optional photos pulled from the Zillow / property cache lookup
   *  that already runs after a statement upload. Used only to seed
   *  a new scenario or to backfill an empty photo on an existing
   *  one — never to overwrite photos a user has chosen. */
  photos?: { primaryPhotoUrl?: string; propertyPhotos?: string[] };
  /** Stable id factory. Centralized so tests can inject a
   *  deterministic id; in production this is `crypto.randomUUID`. */
  makeId?: () => string;
}

export interface SyncSellerFromRefinanceResult {
  scenarios: SellerScenario[];
  scenarioId: string;
  /** True when the matched/created scenario actually changed and the
   *  caller should persist via `saveSellerScenarios`. */
  changed: boolean;
  action: "created" | "updated" | "noop";
}

const DEFAULT_REALTOR_COMMISSION_PCT = 5;
const DEFAULT_SELLER_CLOSING_COSTS_PCT = 0.01;

function defaultMakeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `seller-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pickPositive(...vals: Array<number | undefined | null>): number | undefined {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return undefined;
}

/** Net proceeds = price − payoff − commission$ − closing − concessions − repairs − other.
 *  Mirrors the formula the seller-estimate page uses for display. */
function computeNetProceeds(s: Pick<SellerScenario,
  | "estimatedSalePrice" | "mortgagePayoff" | "realtorCommissionPct"
  | "sellerClosingCosts" | "buyerConcessions" | "repairBudget" | "otherSellingCosts"
>): number | undefined {
  const price = s.estimatedSalePrice;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return undefined;
  const commissionPct = typeof s.realtorCommissionPct === "number" ? s.realtorCommissionPct : 0;
  const commissionDollars = price * (commissionPct / 100);
  const payoff = s.mortgagePayoff ?? 0;
  const closing = s.sellerClosingCosts ?? 0;
  const concessions = s.buyerConcessions ?? 0;
  const repairs = s.repairBudget ?? 0;
  const other = s.otherSellingCosts ?? 0;
  return Math.round(price - payoff - commissionDollars - closing - concessions - repairs - other);
}

/** True when this field can be safely overwritten by refinance. A
 *  field is locked only when its source is explicitly "manual". Any
 *  other value (refinance/zillow/default/NULL) is overridable so
 *  fresh refinance data always beats stale Zillow/cache values. */
function isOverridable(source: string | undefined | null): boolean {
  return source !== "manual";
}

/** Builds the canonical seller-scenario shape from a refinance tracked
 *  loan + (optionally) a previously-existing scenario. */
function mergeFromRefinance(
  existing: SellerScenario | null,
  trackedLoan: TrackedLoan,
  photos: SyncSellerFromRefinanceInput["photos"],
  makeId: () => string,
): { next: SellerScenario; changed: boolean } {
  const address = trackedLoan.propertyAddress;
  const normalizedKey = normalizePropertyKey(address).key || undefined;
  const refSalePrice = pickPositive(trackedLoan.estimatedHomeValue);
  const refPayoff = pickPositive(trackedLoan.loanBalance);
  const now = new Date().toISOString();

  // ── Debug logs (kept terse; user explicitly asked for these) ──
  console.log("[refi-to-seller] refinance estimated home value field", {
    field: "TrackedLoan.estimatedHomeValue",
    value: trackedLoan.estimatedHomeValue,
  });
  console.log("[refi-to-seller] refinance value used", { refSalePrice, refPayoff });
  console.log("[refi-to-seller] existing seller value", {
    estimatedSalePrice: existing?.estimatedSalePrice,
    estimatedSalePriceSource: existing?.estimatedSalePriceSource,
    mortgagePayoff: existing?.mortgagePayoff,
    mortgagePayoffSource: existing?.mortgagePayoffSource,
  });

  if (!existing) {
    // Brand-new scenario: seed every refinance-derived field and
    // stamp provenance so subsequent edits in seller-estimate can
    // be detected as manual overrides.
    const salePrice = refSalePrice;
    const sellerClosingCosts = salePrice
      ? Math.round(salePrice * DEFAULT_SELLER_CLOSING_COSTS_PCT)
      : undefined;
    const draft: SellerScenario = {
      id: makeId(),
      address,
      normalizedPropertyKey: normalizedKey,
      savedAt: now,
      updatedAt: now,
      estimatedSalePrice: salePrice,
      estimatedSalePriceSource: salePrice != null ? "refinance" : undefined,
      mortgagePayoff: refPayoff,
      mortgagePayoffSource: refPayoff != null ? "refinance_statement" : undefined,
      realtorCommissionPct: DEFAULT_REALTOR_COMMISSION_PCT,
      realtorCommissionSource: "default_5_percent",
      sellerClosingCosts,
      sellerClosingCostsSource: sellerClosingCosts != null ? "default_1_percent" : undefined,
      buyerConcessions: 0,
      repairBudget: 0,
      otherSellingCosts: 0,
      status: "draft",
      primaryPhotoUrl: photos?.primaryPhotoUrl,
      propertyPhotos: photos?.propertyPhotos,
    };
    draft.netProceeds = computeNetProceeds(draft);
    console.log("[refi-to-seller] manual override true/false", { false: true });
    console.log("[refi-to-seller] final seller estimated sale price", { value: draft.estimatedSalePrice });
    console.log("[refi-to-seller] seller status", { status: draft.status });
    return { next: draft, changed: true };
  }

  // Existing scenario: overwrite ONLY fields whose source is not
  // "manual". Legacy rows (source == null/undefined) are treated as
  // overridable so refinance data still wins until the user touches
  // the field in seller-estimate.
  const next: SellerScenario = { ...existing };
  let changed = false;
  let manualOverrideAny = false;

  if (!next.normalizedPropertyKey && normalizedKey) {
    next.normalizedPropertyKey = normalizedKey;
    changed = true;
  }

  // ESTIMATED SALE PRICE — refinance UI value wins over Zillow.
  if (typeof refSalePrice === "number" && isOverridable(next.estimatedSalePriceSource)) {
    if (next.estimatedSalePrice !== refSalePrice) {
      next.estimatedSalePrice = refSalePrice;
      next.estimatedSalePriceSource = "refinance";
      changed = true;
    }
  } else if (!isOverridable(next.estimatedSalePriceSource)) {
    manualOverrideAny = true;
  }

  // MORTGAGE PAYOFF — refresh from latest statement unless user-locked.
  if (typeof refPayoff === "number" && isOverridable(next.mortgagePayoffSource)) {
    if (next.mortgagePayoff !== refPayoff) {
      next.mortgagePayoff = refPayoff;
      next.mortgagePayoffSource = "refinance_statement";
      changed = true;
    }
  } else if (!isOverridable(next.mortgagePayoffSource)) {
    manualOverrideAny = true;
  }

  // REALTOR COMMISSION — re-apply 5% default only if user hasn't
  // touched it. We don't re-derive from a changing sale price; the
  // commission is a percent, not a dollar amount.
  if (isOverridable(next.realtorCommissionSource)) {
    if (next.realtorCommissionPct !== DEFAULT_REALTOR_COMMISSION_PCT) {
      next.realtorCommissionPct = DEFAULT_REALTOR_COMMISSION_PCT;
      next.realtorCommissionSource = "default_5_percent";
      changed = true;
    }
  } else {
    manualOverrideAny = true;
  }

  // SELLER CLOSING COSTS — re-derive 1% of the current sale price
  // whenever the sale price changed and the user hasn't locked it.
  if (isOverridable(next.sellerClosingCostsSource) && typeof next.estimatedSalePrice === "number") {
    const newClosing = Math.round(next.estimatedSalePrice * DEFAULT_SELLER_CLOSING_COSTS_PCT);
    if (next.sellerClosingCosts !== newClosing) {
      next.sellerClosingCosts = newClosing;
      next.sellerClosingCostsSource = "default_1_percent";
      changed = true;
    }
  } else if (!isOverridable(next.sellerClosingCostsSource)) {
    manualOverrideAny = true;
  }

  // The remaining cost buckets default to 0 only when blank. We never
  // overwrite a non-undefined value here — the helper has no signal
  // about user intent for these and the existing zero is fine.
  if (next.buyerConcessions == null)  { next.buyerConcessions = 0;  changed = true; }
  if (next.repairBudget == null)      { next.repairBudget = 0;      changed = true; }
  if (next.otherSellingCosts == null) { next.otherSellingCosts = 0; changed = true; }

  // Photos: backfill empty slots only, never overwrite user choices.
  if (!next.primaryPhotoUrl && photos?.primaryPhotoUrl) {
    next.primaryPhotoUrl = photos.primaryPhotoUrl;
    changed = true;
  }
  if ((!next.propertyPhotos || next.propertyPhotos.length === 0) && photos?.propertyPhotos?.length) {
    next.propertyPhotos = photos.propertyPhotos;
    changed = true;
  }

  if (changed) {
    next.netProceeds = computeNetProceeds(next);
    next.updatedAt = now;
    // Status is preserved — never auto-advance past whatever the
    // user picked. This is also what keeps Market Analysis safe:
    // an auto-update from refinance never bumps status above draft.
    next.status = (existing.status ?? "draft") as SellerScenarioStatus;
  }
  console.log("[refi-to-seller] manual override true/false", { hasManual: manualOverrideAny });
  console.log("[refi-to-seller] final seller estimated sale price", { value: next.estimatedSalePrice });
  console.log("[refi-to-seller] seller status", { status: next.status });
  return { next, changed };
}

function findExistingScenario(
  scenarios: SellerScenario[],
  trackedLoan: TrackedLoan,
): SellerScenario | null {
  const normalizedKey = normalizePropertyKey(trackedLoan.propertyAddress).key;
  if (normalizedKey) {
    const byKey = scenarios.find(s => s.normalizedPropertyKey === normalizedKey);
    if (byKey) return byKey;
  }
  const addr = trackedLoan.propertyAddress.trim().toLowerCase();
  if (!addr) return null;
  return scenarios.find(s => (s.address ?? "").trim().toLowerCase() === addr) ?? null;
}

/**
 * Public helper. Returns the next scenarios array (or the original
 * array unchanged when there was nothing to do) plus the id of the
 * matched/created seller scenario.
 *
 * The caller persists via `saveSellerScenarios` when
 * `changed === true`. Persistence is kept out of this module so the
 * merge stays pure and trivially testable.
 */
export function createOrUpdateSellerScenarioFromRefinance(
  input: SyncSellerFromRefinanceInput,
): SyncSellerFromRefinanceResult | null {
  const { trackedLoan, scenarios, photos, makeId = defaultMakeId } = input;
  const address = trackedLoan.propertyAddress?.trim();
  if (!address || address.toLowerCase() === "unknown address") return null;

  const existing = findExistingScenario(scenarios, trackedLoan);
  const { next, changed } = mergeFromRefinance(existing, trackedLoan, photos, makeId);

  if (!changed && existing) {
    return { scenarios, scenarioId: existing.id, changed: false, action: "noop" };
  }

  const nextScenarios = existing
    ? scenarios.map(s => (s.id === existing.id ? next : s))
    : [next, ...scenarios];

  return {
    scenarios: nextScenarios,
    scenarioId: next.id,
    changed: true,
    action: existing ? "updated" : "created",
  };
}
