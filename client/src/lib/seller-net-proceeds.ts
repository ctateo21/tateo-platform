// Single source of truth for Sell-Your-Home net-proceeds math.
//
// Both the detailed seller view AND the dashboard overview row/card must
// show identical numbers. Before this helper existed they each ran their
// own formula (detail recomputed closing costs from the percent; the
// overview read the raw stored dollar field), which let the two surfaces
// drift. Everything that displays or persists seller numbers should go
// through `calculateSellerNetProceeds` so detail and overview can never
// disagree.
//
// This module is PURE (no I/O, no React) so it is trivially testable and
// reusable from the detail page, the overview, and the save handler.

import { type SellerScenario } from "./auth";
import { getEstimatedSellerTaxesDue } from "./seller-taxes";

/** Default seller closing-cost rate used when a scenario has no explicit
 *  percent and the value isn't a manual dollar override. */
export const DEFAULT_SELLER_CLOSING_PCT = 1.85;

/** Canonical seller closing-cost dollars. A manual entry wins; otherwise
 *  it's derived from the (possibly defaulted) percent of the sale price.
 *  This is the value shown in BOTH the detail breakdown and the overview. */
export function resolveSellerClosingCosts(s: Partial<SellerScenario>): number {
  const sale = s.estimatedSalePrice ?? 0;
  if (s.sellerClosingCostsSource === "manual") {
    return Math.round(s.sellerClosingCosts ?? 0);
  }
  const pct = s.sellerClosingCostsPercent ?? DEFAULT_SELLER_CLOSING_PCT;
  return Math.round(sale * (pct / 100));
}

export interface SellerNetProceeds {
  estimatedSalePrice: number;
  realtorCommission: number;
  sellerClosingCosts: number;
  mortgagePayoff: number;
  buyerConcessions: number;
  repairBudget: number;
  otherSellingCosts: number;
  estimatedTaxesDue: number;
  estimatedNetProceeds: number;
  /** Whether the scenario has enough data to be meaningful (a sale price).
   *  The overview shows "—" when false. */
  hasSalePrice: boolean;
}

/** Compute the full seller net-proceeds breakdown from a scenario.
 *
 * estimatedNetProceeds =
 *   estimatedSalePrice
 *   - mortgagePayoff
 *   - realtorCommission
 *   - sellerClosingCosts
 *   - buyerConcessions
 *   - repairBudget
 *   - otherSellingCosts
 *   - estimatedTaxesDue
 */
export function calculateSellerNetProceeds(s: SellerScenario): SellerNetProceeds {
  const hasSalePrice = s.estimatedSalePrice != null;
  const sale = s.estimatedSalePrice ?? 0;
  const realtorCommission = Math.round(sale * ((s.realtorCommissionPct ?? 0) / 100));
  const sellerClosingCosts = resolveSellerClosingCosts(s);
  const mortgagePayoff = Math.round(s.mortgagePayoff ?? 0);
  const buyerConcessions = Math.round(s.buyerConcessions ?? 0);
  const repairBudget = Math.round(s.repairBudget ?? 0);
  const otherSellingCosts = Math.round(s.otherSellingCosts ?? 0);
  const estimatedTaxesDue = Math.round(getEstimatedSellerTaxesDue(s));
  const estimatedNetProceeds = Math.round(
    sale -
    mortgagePayoff -
    realtorCommission -
    sellerClosingCosts -
    buyerConcessions -
    repairBudget -
    otherSellingCosts -
    estimatedTaxesDue,
  );
  return {
    estimatedSalePrice: sale,
    realtorCommission,
    sellerClosingCosts,
    mortgagePayoff,
    buyerConcessions,
    repairBudget,
    otherSellingCosts,
    estimatedTaxesDue,
    estimatedNetProceeds,
    hasSalePrice,
  };
}
