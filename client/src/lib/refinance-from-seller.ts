// Reverse-direction sync: when the user edits the Sell-Your-Home
// Estimated Sale Price, mirror it into the matching Refinance
// `tracked_loans.estimated_home_value` for the same property
// (user_id is implicit — both stores are scoped to the signed-in
// session via saveTrackedLoans).
//
// Match key: `normalized_property_key` first (durable across
// formatting), case-insensitive `property_address` as fallback.
// Mirrors `seller-from-refinance.ts` so the two directions stay
// symmetric.
//
// Manual-override rule (per spec): the latest user-entered value
// always wins. We do NOT block the update because the refinance
// side was previously edited manually — the user just typed a new
// number, that's the new shared value. Source tracking is left to
// the caller because `TrackedLoan` doesn't carry a source column
// today; the smallest-safe approach is to update the dollar value
// only.
//
// This helper never creates a new Refinance record. Refinance rows
// require a mortgage-statement analysis to seed (loanBalance,
// currentRate, currentPI, lender, etc.) which a seller scenario
// can't supply. If no matching loan exists, we no-op and the seller
// save still persists normally.

import { type SellerScenario, type TrackedLoan } from "./auth";
import { normalizePropertyKey } from "./property-key";

export interface SyncRefinanceFromSellerInput {
  sellerScenario: SellerScenario;
  loans: TrackedLoan[];
}

export interface SyncRefinanceFromSellerResult {
  loans: TrackedLoan[];
  matchedLoanIds: string[];
  changed: boolean;
  action: "updated" | "noop";
}

function findMatchingLoans(
  loans: TrackedLoan[],
  seller: SellerScenario,
): TrackedLoan[] {
  const sellerKey =
    seller.normalizedPropertyKey ||
    normalizePropertyKey(seller.address ?? "").key;
  const matched: TrackedLoan[] = [];
  if (sellerKey) {
    for (const l of loans) {
      const lk = normalizePropertyKey(l.propertyAddress ?? "").key;
      if (lk && lk === sellerKey) matched.push(l);
    }
    if (matched.length > 0) return matched;
  }
  // Fallback: exact lowercased address match.
  const addr = (seller.address ?? "").trim().toLowerCase();
  if (!addr) return matched;
  for (const l of loans) {
    if ((l.propertyAddress ?? "").trim().toLowerCase() === addr) {
      matched.push(l);
    }
  }
  return matched;
}

export function applySellerSalePriceToRefinance(
  input: SyncRefinanceFromSellerInput,
): SyncRefinanceFromSellerResult {
  const { sellerScenario, loans } = input;
  const sale = sellerScenario.estimatedSalePrice;

  if (
    typeof sale !== "number" ||
    !Number.isFinite(sale) ||
    sale <= 0
  ) {
    return { loans, matchedLoanIds: [], changed: false, action: "noop" };
  }

  const matches = findMatchingLoans(loans, sellerScenario);
  if (matches.length === 0) {
    return { loans, matchedLoanIds: [], changed: false, action: "noop" };
  }

  const matchedIds = new Set(matches.map(m => m.id));
  let changed = false;
  const next = loans.map(l => {
    if (!matchedIds.has(l.id)) return l;
    if (l.estimatedHomeValue === sale) return l;
    changed = true;
    return { ...l, estimatedHomeValue: sale };
  });

  return {
    loans: next,
    matchedLoanIds: Array.from(matchedIds),
    changed,
    action: changed ? "updated" : "noop",
  };
}
