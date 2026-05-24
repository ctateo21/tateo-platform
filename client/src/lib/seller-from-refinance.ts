// Auto-populates a Sell Your Home (`seller_scenarios`) draft from a
// refinance `TrackedLoan` whenever the user uploads a mortgage
// statement in the Refinance tab.
//
// Match key: `normalized_property_key` (with a case-insensitive
// `full_address` fallback for older rows that pre-date the
// normalized key column). Matching is scoped to the current user
// implicitly via `saveSellerScenarios`, which only ever persists
// rows for `_session.id`.
//
// Manual-override protection without a schema migration:
//   - For a brand-new scenario we fill every refinance-derived
//     field (estimated_sale_price, mortgage_payoff, the 5%/1%
//     defaults, and the four zero-valued cost fields).
//   - For an existing scenario we only fill a field if the user
//     hasn't touched it yet (current value is `undefined`/`null`).
//     A value of 0 is treated as a deliberate user edit and is
//     preserved — same convention the seller-estimate UI uses when
//     it persists "user cleared this to zero" intent.
//
// We intentionally do NOT add `*_source` columns to the table; the
// "only fill when blank" rule covers every acceptance test below
// without a migration, and a future migration can layer real source
// tracking on top of this helper without changing the call sites.

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
   *  caller should persist via `saveSellerScenarios`. False when the
   *  existing scenario already had all user-set values (no-op). */
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

/** Net proceeds = sale price − payoff − commission$ − closing − concessions − repairs − other.
 *  Mirrors the formula the seller-estimate page uses for its UI display. */
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

/** "Blank" = field has never been set by the user. We deliberately
 *  treat 0 as a real user edit (cleared default) so we never bounce
 *  a hand-cleared commission/closing-costs back to the 5%/1% seeds. */
function isBlank(v: number | undefined | null): boolean {
  return v === undefined || v === null;
}

/** Builds the canonical seller-scenario shape from a refinance tracked
 *  loan + (optionally) a previously-existing scenario. Returns the next
 *  scenario object (always a new reference when anything changed) and
 *  whether anything actually changed. */
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

  if (!existing) {
    // Brand-new scenario: seed every refinance-derived field. Costs
    // that have no refinance signal default to 0 so net_proceeds is
    // immediately computable and the UI shows a real number.
    const salePrice = refSalePrice;
    const commissionPct = DEFAULT_REALTOR_COMMISSION_PCT;
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
      mortgagePayoff: refPayoff,
      realtorCommissionPct: commissionPct,
      sellerClosingCosts,
      buyerConcessions: 0,
      repairBudget: 0,
      otherSellingCosts: 0,
      status: "draft",
      primaryPhotoUrl: photos?.primaryPhotoUrl,
      propertyPhotos: photos?.propertyPhotos,
    };
    draft.netProceeds = computeNetProceeds(draft);
    return { next: draft, changed: true };
  }

  // Existing scenario: fill only blank fields. A 0 is treated as a
  // user edit and preserved (see isBlank()).
  const next: SellerScenario = { ...existing };
  let changed = false;

  // Backfill normalized key on legacy rows that don't have one.
  if (!next.normalizedPropertyKey && normalizedKey) {
    next.normalizedPropertyKey = normalizedKey;
    changed = true;
  }

  if (isBlank(next.estimatedSalePrice) && typeof refSalePrice === "number") {
    next.estimatedSalePrice = refSalePrice;
    changed = true;
  }
  if (isBlank(next.mortgagePayoff) && typeof refPayoff === "number") {
    next.mortgagePayoff = refPayoff;
    changed = true;
  }
  if (isBlank(next.realtorCommissionPct)) {
    next.realtorCommissionPct = DEFAULT_REALTOR_COMMISSION_PCT;
    changed = true;
  }
  if (isBlank(next.sellerClosingCosts) && typeof next.estimatedSalePrice === "number") {
    next.sellerClosingCosts = Math.round(next.estimatedSalePrice * DEFAULT_SELLER_CLOSING_COSTS_PCT);
    changed = true;
  }
  if (isBlank(next.buyerConcessions)) { next.buyerConcessions = 0; changed = true; }
  if (isBlank(next.repairBudget))     { next.repairBudget = 0;     changed = true; }
  if (isBlank(next.otherSellingCosts)){ next.otherSellingCosts = 0; changed = true; }

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
    // user picked (draft/reviewing/ready_to_list/listed/sold).
    next.status = (existing.status ?? "draft") as SellerScenarioStatus;
  }
  return { next, changed };
}

/** Find an existing seller scenario for the given tracked-loan address.
 *  Prefers the normalized property key (durable across formatting
 *  changes) and falls back to a case-insensitive full-address match
 *  for older rows persisted before normalization shipped. */
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
 * The caller is responsible for persisting via `saveSellerScenarios`
 * when `changed === true`. We keep persistence out of this module so
 * it stays pure and trivially testable.
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
