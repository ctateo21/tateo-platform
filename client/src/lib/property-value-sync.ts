// Phase 1 — Property VALUE sync across dashboard tabs.
//
// When the user changes the "value" field on Purchase-with-Loan,
// Purchase-with-Cash, Refinance, or Sell-Your-Home, propagate the new
// value to the same property (matched by user_id + normalizedPropertyKey)
// across every other table, recompute Insurance annualPremium /
// monthlyPremium from a 0.75% default, and protect manual overrides.
//
// NOT in scope: borrower-profile sync, policy-type sync, occupancy /
// property-type sync. Those land in Phase 2+.
//
// Loop prevention:
//   * `_syncInFlight` flag — wraps every save call the helper makes so
//     the diff-watchers in `auth.ts` (which fire the helper) skip while
//     a sync is already running.
//   * Helper writes only when newValue !== existing value — a same-value
//     no-op write never re-enters the diff watcher anyway.
//   * Helper is invoked from save* functions, never from load/hydrate
//     paths — `hydrateFromSupabase` mutates the in-memory caches
//     directly without going through the savers, so it can't trigger
//     sync from stale persisted data.
//
// Required source-of-truth columns the protection logic checks (when
// the field exists in the TS model). Columns marked (MIGRATION) do not
// exist yet — see returnMessage in syncPropertyValueAcrossTabs's
// summary docblock for the SQL needed before stronger protection is
// possible. Until then we use the smallest-safe heuristic noted below.
//
//   purchase_scenarios.price                — no source column (MIGRATION needed: price_source)
//   cash_buy_scenarios.purchase_price       — purchase_price_source ("user" = manual)
//   tracked_loans.estimated_home_value      — no source column (MIGRATION needed: estimated_home_value_source)
//   seller_scenarios.estimated_sale_price   — estimated_sale_price_source ("manual" = locked)
//   insurance_scenarios.annual_premium      — no source column (MIGRATION needed: premium_source + coverage_a + coverage_a_source)
//
// Insurance heuristic until premium_source exists:
//   Treat the current annualPremium as "default-derived (overridable)"
//   when it's missing OR when it equals 0.75% of one of the candidate
//   pre-sync values across the matching property's other tables
//   (within $1). Otherwise treat as manual / quoted and skip.

import {
  getPurchaseScenarios, savePurchaseScenarios,
  getCashBuyScenarios, saveCashBuyScenarios,
  getTrackedLoans,     saveTrackedLoans,
  getSellerScenarios,  saveSellerScenarios,
  getInsuranceScenarios, saveInsuranceScenarios,
  type InsuranceScenario,
  type SellerScenario,
} from "./auth";
import { normalizePropertyKey } from "./property-key";

export type PropertyValueSourceTab =
  | "purchase" | "cash_buy" | "refinance" | "seller";

const DEFAULT_INSURANCE_RATE = 0.0075;
const PREMIUM_MATCH_TOLERANCE_DOLLARS = 1;

let _syncInFlight = false;
/** Diff-watchers in auth.ts call this before firing the helper so a
 *  helper-initiated save never re-enters the watcher. */
export function isPropertyValueSyncInFlight(): boolean { return _syncInFlight; }

function keyOf(address: string | undefined | null): string {
  return normalizePropertyKey(address).key;
}

function isPositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

interface SyncArgs {
  userId: string | null | undefined;
  normalizedPropertyKey: string | undefined;
  sourceTab: PropertyValueSourceTab;
  newValue: number;
}

/**
 * Sync a property's value across all 5 dashboard tables.
 *
 * Returns synchronously. Save-to-Supabase happens via the existing
 * fire-and-forget save* enqueue; the caller does not need to await.
 *
 * No-ops when:
 *   - userId is missing (anonymous user — nothing to sync)
 *   - normalizedPropertyKey is empty (can't match safely)
 *   - newValue is not a positive number
 *   - a sync is already in flight (loop guard)
 */
export function syncPropertyValueAcrossTabs(args: SyncArgs): void {
  const { userId, normalizedPropertyKey, sourceTab, newValue } = args;
  if (!userId || !normalizedPropertyKey || !isPositive(newValue)) return;
  if (_syncInFlight) return;

  console.log("[property-value-sync] source tab", { tab: sourceTab });
  console.log("[property-value-sync] user id", { userId });
  console.log("[property-value-sync] normalized property key", { key: normalizedPropertyKey });
  console.log("[property-value-sync] new value", { value: newValue });

  _syncInFlight = true;
  try {
    // Snapshot every table BEFORE we mutate anything — the insurance
    // heuristic needs the pre-sync candidate values.
    const purchases   = getPurchaseScenarios();
    const cashBuys    = getCashBuyScenarios();
    const loans       = getTrackedLoans();
    const sellers     = getSellerScenarios();
    const insurances  = getInsuranceScenarios();

    const matchPurchase = purchases.find(p =>
      keyOf(p.address) === normalizedPropertyKey);
    const matchCash = cashBuys.find(c =>
      keyOf(c.address) === normalizedPropertyKey
      || c.normalizedPropertyKey === normalizedPropertyKey);
    const matchLoan = loans.find(l =>
      keyOf(l.propertyAddress) === normalizedPropertyKey);
    const matchSeller = sellers.find(s =>
      keyOf(s.address) === normalizedPropertyKey
      || s.normalizedPropertyKey === normalizedPropertyKey);
    const matchInsurance = insurances.find(i =>
      keyOf(i.address) === normalizedPropertyKey);

    console.log("[property-value-sync] matching purchase found", { found: !!matchPurchase });
    console.log("[property-value-sync] matching cash buy found", { found: !!matchCash });
    console.log("[property-value-sync] matching refinance found", { found: !!matchLoan });
    console.log("[property-value-sync] matching seller found", { found: !!matchSeller });
    console.log("[property-value-sync] matching insurance found", { found: !!matchInsurance });

    // ── Purchase-with-Loan ────────────────────────────────────────
    if (sourceTab !== "purchase" && matchPurchase && matchPurchase.price !== newValue) {
      const next = purchases.map(p =>
        p.id === matchPurchase.id ? { ...p, price: newValue } : p);
      savePurchaseScenarios(next);
      console.log("[property-value-sync] updated table", { table: "purchase_scenarios", id: matchPurchase.id });
    }

    // ── Cash Buy ──────────────────────────────────────────────────
    if (sourceTab !== "cash_buy" && matchCash) {
      // Manual-override protection: skip when the user has explicitly
      // set the cash-buy price (purchasePriceSource === "user").
      if (matchCash.purchasePriceSource === "user") {
        console.log("[property-value-sync] skipped manual override", {
          table: "cash_buy_scenarios", field: "purchase_price",
        });
      } else if (matchCash.purchasePrice !== newValue) {
        const next = cashBuys.map(c =>
          c.id === matchCash.id
            // We keep the existing purchasePriceSource (e.g. "zillow_*"
            // / "default") so subsequent Zillow refreshes still behave
            // correctly — we never stamp "user" here because the user
            // didn't edit this row directly.
            ? { ...c, purchasePrice: newValue }
            : c);
        saveCashBuyScenarios(next);
        console.log("[property-value-sync] updated table", { table: "cash_buy_scenarios", id: matchCash.id });
      }
    }

    // ── Refinance / tracked_loans ────────────────────────────────
    if (sourceTab !== "refinance" && matchLoan && matchLoan.estimatedHomeValue !== newValue) {
      // tracked_loans has no estimated_home_value_source column yet —
      // always overridable. (MIGRATION needed for stronger protection.)
      const next = loans.map(l =>
        l.id === matchLoan.id ? { ...l, estimatedHomeValue: newValue } : l);
      saveTrackedLoans(next).catch(() => { /* persist error already toasted */ });
      console.log("[property-value-sync] updated table", { table: "tracked_loans", id: matchLoan.id });
    }

    // ── Sell-Your-Home ───────────────────────────────────────────
    if (sourceTab !== "seller" && matchSeller) {
      if (matchSeller.estimatedSalePriceSource === "manual") {
        console.log("[property-value-sync] skipped manual override", {
          table: "seller_scenarios", field: "estimated_sale_price",
        });
      } else if (matchSeller.estimatedSalePrice !== newValue) {
        const pct = matchSeller.sellerClosingCostsPercent;
        const newClosing =
          matchSeller.sellerClosingCostsSource !== "manual" && typeof pct === "number"
            ? Math.round(newValue * (pct / 100))
            : matchSeller.sellerClosingCosts;
        const stamped: SellerScenario = {
          ...matchSeller,
          estimatedSalePrice: newValue,
          // Stamp source by where the value came from so a future
          // refinance upload still beats Zillow/cache but never a true
          // manual entry. "refinance" for refi origin, "zillow" used
          // for purchase/cash origins (closest existing enum value)
          // — both are overridable, neither blocks future refi auto-fill.
          estimatedSalePriceSource:
            sourceTab === "refinance" ? "refinance" : "zillow",
          sellerClosingCosts: newClosing,
        };
        const next = sellers.map(s => s.id === matchSeller.id ? stamped : s);
        saveSellerScenarios(next);
        console.log("[property-value-sync] updated table", { table: "seller_scenarios", id: matchSeller.id });
        console.log("[property-value-sync] recalculated values", {
          table: "seller_scenarios", sellerClosingCosts: newClosing,
        });
      }
    }

    // ── Insurance ────────────────────────────────────────────────
    if (matchInsurance) {
      // Candidate pre-sync values to check whether existing premium
      // looks like a 0.75%-default of any of them (i.e. overridable).
      const candidates: number[] = [
        matchPurchase?.price,
        matchCash?.purchasePrice,
        matchLoan?.estimatedHomeValue,
        matchSeller?.estimatedSalePrice,
      ].filter(isPositive);

      if (isInsurancePremiumOverridable(matchInsurance.annualPremium, candidates)) {
        const annual = Math.round(newValue * DEFAULT_INSURANCE_RATE);
        if (matchInsurance.annualPremium !== annual) {
          const next: InsuranceScenario[] = insurances.map(i =>
            i.id === matchInsurance.id ? { ...i, annualPremium: annual } : i);
          void saveInsuranceScenarios(next).catch(() => { /* persist error already toasted */ });
          console.log("[property-value-sync] updated table", { table: "insurance_scenarios", id: matchInsurance.id });
          console.log("[property-value-sync] recalculated insurance premium", {
            annual, monthly: Math.round((annual / 12) * 100) / 100,
          });
        }
      } else {
        console.log("[property-value-sync] skipped manual override", {
          table: "insurance_scenarios", field: "annual_premium",
        });
      }
    }

    console.log("[property-value-sync] save ok");
  } catch (err: any) {
    console.error("[property-value-sync] save error", { message: err?.message ?? String(err) });
  } finally {
    _syncInFlight = false;
  }
}

/** Until insurance_scenarios has a `premium_source` column, treat the
 *  existing annualPremium as overridable when it's missing OR when it
 *  matches 0.75% of any pre-sync candidate value (within $1). */
function isInsurancePremiumOverridable(
  currentPremium: number | undefined,
  candidateValues: number[],
): boolean {
  if (currentPremium == null) return true;
  for (const v of candidateValues) {
    const expected = v * DEFAULT_INSURANCE_RATE;
    if (Math.abs(currentPremium - expected) <= PREMIUM_MATCH_TOLERANCE_DOLLARS) return true;
  }
  return false;
}
