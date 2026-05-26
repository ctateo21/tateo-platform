// Phase 1 — Property VALUE sync across dashboard tabs.
//
// When the user changes the "value" field on Purchase-with-Loan,
// Purchase-with-Cash, Refinance, or Sell-Your-Home, propagate the new
// value to the same property (matched by user_id + normalizedPropertyKey)
// across every other table, recompute Insurance annualPremium /
// monthlyPremium from a 0.75% default, sync Coverage A, and protect
// manual overrides via per-field source columns.
//
// NOT in scope: borrower-profile sync, policy-type sync, occupancy /
// property-type sync. Those land in Phase 2+.
//
// Loop prevention:
//   * `_syncInFlight` flag — wraps every save call the helper makes so
//     the diff-watchers + manual-source stampers in `auth.ts` (which fire
//     the helper) skip while a sync is already running.
//   * Helper writes only when newValue !== existing value — a same-value
//     no-op write never re-enters the diff watcher anyway.
//   * Helper is invoked from save* functions, never from load/hydrate
//     paths — `hydrateFromSupabase` mutates the in-memory caches
//     directly without going through the savers, so it can't trigger
//     sync from stale persisted data.
//
// Source-of-truth columns this helper respects (set by the
// `_stampManualOnValueDiff` helper in auth.ts on user-driven edits):
//
//   purchase_scenarios.price_source              "manual" → skip
//   cash_buy_scenarios.purchase_price_source     "user"   → skip
//   tracked_loans.estimated_home_value_source    "manual" → skip
//   seller_scenarios.estimated_sale_price_source "manual" → skip
//   insurance_scenarios.premium_source           "manual" | "quote" → skip
//   insurance_scenarios.coverage_a_source        "manual" → skip
//
// Sync writes stamp:
//   insurance.coverage_a_source  = "property_value_sync"
//   insurance.premium_source     = "default_0_75_percent"
//   tracked_loans.estimated_home_value_source = "synced"
//   purchase_scenarios.price_source           — left untouched (null)
//   seller_scenarios.estimated_sale_price_source = "refinance" or "zillow"
//
// Insurance heuristic (legacy rows only — premium_source IS NULL):
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
import { getInsuranceCoverageMultiplier } from "./insurance-default";

export type PropertyValueSourceTab =
  | "purchase" | "cash_buy" | "refinance" | "seller";

const DEFAULT_INSURANCE_RATE = 0.0075;
const PREMIUM_MATCH_TOLERANCE_DOLLARS = 1;

let _syncInFlight = false;
/** Diff-watchers + manual-source stampers in auth.ts call this before
 *  firing the helper so a helper-initiated save never re-enters them. */
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
    // legacy heuristic needs the pre-sync candidate values.
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
    if (sourceTab !== "purchase" && matchPurchase) {
      if (matchPurchase.priceSource === "manual") {
        console.log("[property-value-sync] skipped manual override", {
          table: "purchase_scenarios", field: "price",
        });
      } else if (matchPurchase.price !== newValue) {
        const next = purchases.map(p =>
          p.id === matchPurchase.id ? { ...p, price: newValue } : p);
        savePurchaseScenarios(next);
        console.log("[property-value-sync] updated table", { table: "purchase_scenarios", id: matchPurchase.id });
      }
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
    if (sourceTab !== "refinance" && matchLoan) {
      if (matchLoan.estimatedHomeValueSource === "manual") {
        console.log("[property-value-sync] skipped manual override", {
          table: "tracked_loans", field: "estimated_home_value",
        });
      } else if (matchLoan.estimatedHomeValue !== newValue) {
        const next = loans.map(l =>
          l.id === matchLoan.id
            ? { ...l, estimatedHomeValue: newValue, estimatedHomeValueSource: "synced" as const }
            : l);
        saveTrackedLoans(next).catch(() => { /* persist error already toasted */ });
        console.log("[property-value-sync] updated table", { table: "tracked_loans", id: matchLoan.id });
      }
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
      // Apply HO6 half-coverage multiplier so a condo/townhome row
      // doesn't get reset to full-property-value Coverage A on every
      // property-value sync (spec: insurance-ho6-half-coverage-and-premium).
      // Premium derives from the multiplied coverage so the halving
      // cascades automatically.
      const coverageMultiplier = getInsuranceCoverageMultiplier(matchInsurance.policyType);
      const syncedCoverageA = Math.round(newValue * coverageMultiplier);
      const annual = Math.round(syncedCoverageA * DEFAULT_INSURANCE_RATE);
      const writePremium = isInsurancePremiumOverridable(matchInsurance, [
        matchPurchase?.price,
        matchCash?.purchasePrice,
        matchLoan?.estimatedHomeValue,
        matchSeller?.estimatedSalePrice,
      ].filter(isPositive));
      const writeCoverageA = matchInsurance.coverageASource !== "manual";

      if (!writePremium) {
        console.log("[property-value-sync] skipped manual override", {
          table: "insurance_scenarios", field: "annual_premium",
        });
      }
      if (!writeCoverageA) {
        console.log("[property-value-sync] skipped manual override", {
          table: "insurance_scenarios", field: "coverage_a",
        });
      }

      const premiumChanged   = writePremium    && matchInsurance.annualPremium !== annual;
      const coverageAChanged = writeCoverageA  && matchInsurance.coverageA     !== syncedCoverageA;

      if (premiumChanged || coverageAChanged) {
        const next: InsuranceScenario[] = insurances.map(i => {
          if (i.id !== matchInsurance.id) return i;
          const updated: InsuranceScenario = { ...i };
          if (writePremium) {
            updated.annualPremium = annual;
            updated.premiumSource = "default_0_75_percent";
          }
          if (writeCoverageA) {
            updated.coverageA = syncedCoverageA;
            updated.coverageASource = "property_value_sync";
          }
          return updated;
        });
        void saveInsuranceScenarios(next).catch(() => { /* persist error already toasted */ });
        console.log("[property-value-sync] updated table", { table: "insurance_scenarios", id: matchInsurance.id });
        if (premiumChanged) {
          console.log("[property-value-sync] recalculated insurance premium", {
            annual, monthly: Math.round((annual / 12) * 100) / 100,
            policyType: matchInsurance.policyType ?? null,
            coverageMultiplier,
          });
        }
        if (coverageAChanged) {
          console.log("[property-value-sync] synced insurance coverage A", {
            coverageA: syncedCoverageA,
            policyType: matchInsurance.policyType ?? null,
            coverageMultiplier,
          });
        }
      }
    }

    console.log("[property-value-sync] save ok");
  } catch (err: any) {
    console.error("[property-value-sync] save error", { message: err?.message ?? String(err) });
  } finally {
    _syncInFlight = false;
  }
}

/** Honors `insurance_scenarios.premium_source` strictly when set, and
 *  falls back to the legacy heuristic only for null/undefined values
 *  (rows saved before the 2026_05_26 migration). */
function isInsurancePremiumOverridable(
  ins: InsuranceScenario,
  candidateValues: number[],
): boolean {
  const src = ins.premiumSource;
  if (src === "manual" || src === "quote") return false;
  if (src === "default_0_75_percent" || src === "property_value_sync") return true;
  // Legacy row (premium_source IS NULL). Use the smallest-safe heuristic.
  if (ins.annualPremium == null) return true;
  for (const v of candidateValues) {
    const expected = v * DEFAULT_INSURANCE_RATE;
    if (Math.abs(ins.annualPremium - expected) <= PREMIUM_MATCH_TOLERANCE_DOLLARS) return true;
  }
  return false;
}
