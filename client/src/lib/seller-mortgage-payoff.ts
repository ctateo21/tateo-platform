// Shared resolver for the Sell-Your-Home "Mortgage Payoff" value.
//
// Determines the mortgage payoff for a seller scenario using a strict
// source priority (highest wins):
//   1. manual              — user typed it; NEVER auto-overwritten
//   2. statement           — extracted from an uploaded mortgage
//                            statement; NEVER auto-overwritten
//   3. refinance           — current balance from a matching Refinance
//                            tracked-loan (same property)
//   4. amortized_estimate  — estimated from the last recorded sale
//                            price/date via standard amortization
//   5. existing            — whatever value is already saved (unknown
//                            provenance / legacy rows)
//   6. zero                — nothing available → $0
//
// This module is PURE (no I/O, no React) so it is trivially testable
// and can be reused from the seller page, the dashboard, or tests. The
// caller supplies the already-loaded Refinance loans and any last-sold
// data resolved from Zillow / the property cache.

import { type SellerScenario, type TrackedLoan } from "./auth";
import { normalizePropertyKey } from "./property-key";
import {
  estimateMortgageBalanceFromSale,
  SELLER_AMORTIZATION_DEFAULTS,
} from "./mortgage-amortization";

/** Provenance tags the resolver may return / honor. "refinance_statement"
 *  is the legacy tag written by the Refinance→Seller sync; we treat it as
 *  equivalent to "refinance" for matching and display. */
export type ResolvedPayoffSource =
  | "manual"
  | "statement"
  | "refinance"
  | "refinance_statement"
  | "amortized_estimate"
  | "existing"
  | "zero";

export interface LastSoldInfo {
  /** Last recorded sale price (NOT a Zestimate or list price). */
  price?: number | null;
  /** Last recorded sale date (ISO string). */
  date?: string | null;
}

export interface ResolveSellerMortgagePayoffInput {
  sellerScenario: SellerScenario;
  /** All Refinance tracked loans for the signed-in user. */
  trackedLoans: TrackedLoan[];
  /** Last-sold price/date resolved from Zillow / the property cache. */
  propertyCache?: LastSoldInfo;
  /** Pre-normalized key for the seller property (optional — derived
   *  from the address when absent). */
  normalizedPropertyKey?: string;
  /** Seller property address (matching fallback). */
  address?: string;
  /** "Now" for the amortization clock. Defaults to current time. */
  today?: Date;
  /** When true, ignore the manual/statement lock (explicit user
   *  "Reset / Recalculate"). Used only by the Reset button. */
  ignoreManualLock?: boolean;
}

export interface ResolveSellerMortgagePayoffResult {
  /** Resolved payoff dollars (>= 0). */
  value: number;
  /** Where the value came from. */
  source: ResolvedPayoffSource;
  /** Inputs/outputs of the amortization run, when source ===
   *  "amortized_estimate". Persisted to mortgage_payoff_estimate_inputs. */
  estimateInputs?: {
    originalLoanAmount: number;
    annualInterestRate: number;
    termYears: number;
    loanStartDate: string;
    asOfDate: string;
    paymentsMade: number;
    monthlyPayment: number;
    sourceSalePrice: number;
    sourceSaleDate: string;
  };
  /** The matched tracked loan id, when source is a refinance pull. */
  matchedLoanId?: string;
}

function isRefinanceSource(s: string | undefined | null): boolean {
  return s === "refinance" || s === "refinance_statement";
}

/** Finds the Refinance tracked loan for the same property:
 *  1) normalized_property_key  2) exact lowercased address fallback. */
export function findMatchingTrackedLoan(
  loans: TrackedLoan[],
  normalizedKey: string | undefined,
  address: string | undefined,
): TrackedLoan | null {
  const key =
    normalizedKey || normalizePropertyKey(address ?? "").key || "";
  if (key) {
    for (const l of loans) {
      const lk = normalizePropertyKey(l.propertyAddress ?? "").key;
      if (lk && lk === key) return l;
    }
  }
  const addr = (address ?? "").trim().toLowerCase();
  if (!addr) return null;
  return loans.find(l => (l.propertyAddress ?? "").trim().toLowerCase() === addr) ?? null;
}

export function resolveSellerMortgagePayoff(
  input: ResolveSellerMortgagePayoffInput,
): ResolveSellerMortgagePayoffResult {
  const {
    sellerScenario: s,
    trackedLoans,
    propertyCache,
    normalizedPropertyKey,
    address,
    today = new Date(),
    ignoreManualLock = false,
  } = input;

  const existingValue =
    typeof s.mortgagePayoff === "number" && Number.isFinite(s.mortgagePayoff)
      ? s.mortgagePayoff
      : 0;
  const src = s.mortgagePayoffSource;

  // 1 + 2: locked sources win unless the caller explicitly resets.
  if (!ignoreManualLock) {
    if (src === "manual") {
      console.log("[seller-payoff] skipped refill because manual");
      return { value: existingValue, source: "manual" };
    }
    if (src === "statement") {
      console.log("[seller-payoff] skipped refill because statement");
      return { value: existingValue, source: "statement" };
    }
  }

  // 3: matching Refinance scenario balance.
  const key = normalizedPropertyKey ?? s.normalizedPropertyKey;
  const addr = address ?? s.address;
  console.log("[seller-payoff] seller address", addr);
  console.log("[seller-payoff] normalized property key", key ?? normalizePropertyKey(addr ?? "").key);
  const match = findMatchingTrackedLoan(trackedLoans, key, addr);
  console.log("[seller-payoff] refinance matches found", match ? 1 : 0);
  if (match && Number.isFinite(match.loanBalance) && match.loanBalance > 0) {
    console.log("[seller-payoff] refinance balance field used", "loanBalance");
    console.log("[seller-payoff] refinance balance value", match.loanBalance);
    return { value: Math.round(match.loanBalance), source: "refinance", matchedLoanId: match.id };
  }

  // 4: amortized estimate from the last recorded sale.
  const salePrice = propertyCache?.price;
  const saleDate = propertyCache?.date;
  if (
    typeof salePrice === "number" && Number.isFinite(salePrice) && salePrice > 0 &&
    typeof saleDate === "string" && saleDate.trim() !== "" &&
    !Number.isNaN(new Date(saleDate).getTime())
  ) {
    console.log("[seller-payoff] no refinance match, estimating amortized balance");
    console.log("[seller-payoff] last sold price", salePrice);
    console.log("[seller-payoff] last sold date", saleDate);
    const { annualInterestRate, termYears } = SELLER_AMORTIZATION_DEFAULTS;
    const originalLoanAmount = Math.round(salePrice);
    const asOf = today.toISOString();
    const est = estimateMortgageBalanceFromSale({
      originalLoanAmount,
      annualInterestRate,
      termYears,
      loanStartDate: saleDate,
      asOfDate: today,
    });
    console.log("[seller-payoff] original loan amount", originalLoanAmount);
    console.log("[seller-payoff] assumed rate", annualInterestRate);
    console.log("[seller-payoff] assumed term", termYears);
    console.log("[seller-payoff] payments made", est.paymentsMade);
    console.log("[seller-payoff] monthly payment", est.monthlyPayment);
    console.log("[seller-payoff] estimated remaining balance", est.remainingBalance);
    return {
      value: est.remainingBalance,
      source: "amortized_estimate",
      estimateInputs: {
        originalLoanAmount,
        annualInterestRate,
        termYears,
        loanStartDate: saleDate,
        asOfDate: asOf,
        paymentsMade: est.paymentsMade,
        monthlyPayment: est.monthlyPayment,
        sourceSalePrice: originalLoanAmount,
        sourceSaleDate: saleDate,
      },
    };
  }

  // 5: keep whatever is already saved (legacy / unknown provenance).
  if (existingValue > 0) {
    return { value: existingValue, source: isRefinanceSource(src) ? "refinance" : "existing" };
  }

  // 6: nothing available.
  return { value: 0, source: "zero" };
}
