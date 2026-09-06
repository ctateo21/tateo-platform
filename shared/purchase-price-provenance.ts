/**
 * Purchase price and Coverage A are deliberately separate concepts. This
 * resolver only chooses among transaction/property-value records that already
 * exist; callers must not seed it with rebuild cost.
 *
 * Within a precedence tier, the order below is deterministic rather than a
 * claim that one provider is better: Purchase-with-Loan, Cash Buy, then tracked
 * loan. Legacy/coarse Zillow and default values are market-value assumptions,
 * because they do not prove a contract or prior sale.
 */
export type PurchasePriceProvenance =
  | "user-confirmed-contract"
  | "user-confirmed-property-value"
  | "listing"
  | "prior-sale"
  | "property-value"
  | "unknown";

export interface PurchasePriceCandidateInput {
  manual?: {
    value?: number | null;
    newPurchase: boolean;
  };
  purchaseScenario?: {
    price?: number | null;
    priceSource?: "manual" | "zillow" | "default";
  };
  cashBuyScenario?: {
    purchasePrice?: number | null;
    purchasePriceSource?:
      | "default"
      | "user"
      | "zillow_cache"
      | "zillow_listing"
      | "zillow_sold"
      | "zillow_zestimate";
  };
  trackedLoan?: {
    originalPurchasePrice?: number | null;
    estimatedHomeValue?: number | null;
  };
}

export interface ResolvedPurchasePrice {
  value: number | null;
  source: PurchasePriceProvenance;
}

function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/**
 * Resolve only authentic persisted candidates, in this order:
 * confirmed contract/value; exact listing; prior sale/original purchase;
 * market-value estimates; unknown (manual confirmation required).
 */
export function resolvePurchasePriceProvenance(
  input: PurchasePriceCandidateInput,
): ResolvedPurchasePrice {
  const manual = positive(input.manual?.value);
  if (manual !== null) {
    return {
      value: manual,
      source: input.manual!.newPurchase
        ? "user-confirmed-contract"
        : "user-confirmed-property-value",
    };
  }

  const purchasePrice = positive(input.purchaseScenario?.price);
  const cashPrice = positive(input.cashBuyScenario?.purchasePrice);
  const originalPurchasePrice = positive(input.trackedLoan?.originalPurchasePrice);
  const estimatedHomeValue = positive(input.trackedLoan?.estimatedHomeValue);

  // Manual Purchase and Cash Buy edits are confirmed transaction facts.
  if (purchasePrice !== null && input.purchaseScenario?.priceSource === "manual") {
    return { value: purchasePrice, source: "user-confirmed-contract" };
  }
  if (cashPrice !== null && input.cashBuyScenario?.purchasePriceSource === "user") {
    return { value: cashPrice, source: "user-confirmed-contract" };
  }

  // Only Cash Buy currently persists exact listing-vs-sold Zillow provenance.
  if (
    cashPrice !== null &&
    input.cashBuyScenario?.purchasePriceSource === "zillow_listing"
  ) {
    return { value: cashPrice, source: "listing" };
  }

  if (
    cashPrice !== null &&
    input.cashBuyScenario?.purchasePriceSource === "zillow_sold"
  ) {
    return { value: cashPrice, source: "prior-sale" };
  }
  if (originalPurchasePrice !== null) {
    return { value: originalPurchasePrice, source: "prior-sale" };
  }

  // Purchase `zillow`/`default`, all non-exact Cash Buy Zillow/cache/default
  // values (including legacy missing provenance), and tracked estimates are
  // market/current-value fallbacks, not transaction facts.
  if (purchasePrice !== null) {
    return { value: purchasePrice, source: "property-value" };
  }
  if (cashPrice !== null) {
    return { value: cashPrice, source: "property-value" };
  }
  if (estimatedHomeValue !== null) {
    return { value: estimatedHomeValue, source: "property-value" };
  }

  return { value: null, source: "unknown" };
}