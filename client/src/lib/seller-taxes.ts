// Estimated capital-gains taxes due when selling a home.
//
// This is an ESTIMATE for planning only — never tax advice. Wording in the
// UI uses "may qualify", "estimated", "potential taxable gain", and points
// users to a tax professional. The calculation is intentionally simple
// (Version 1): adjusted basis = prior purchase price + capital improvements,
// gross gain = sale price − adjusted basis, primary-residence exclusion or
// 1031 deferral applied, then a flat placeholder rate on the taxable gain.
//
// Keep this helper isolated so future upgrades (income-based rates,
// depreciation recapture, selling-cost basis adjustments, etc.) only touch
// this file and every call site picks them up automatically.

export type SellerFilingStatus = "single" | "married";

/** $250,000 primary-residence gain exclusion for a single filer (IRC §121). */
export const SINGLE_EXCLUSION = 250_000;
/** $500,000 primary-residence gain exclusion for married filing jointly. */
export const MARRIED_EXCLUSION = 500_000;
/** Placeholder federal long-term capital-gains rate applied to taxable gain. */
export const ESTIMATED_CAPITAL_GAINS_TAX_RATE = 0.2;

/** Status describing why the estimate is what it is — drives UI messaging. */
export type SellerTaxStatus =
  | "needs_prior_purchase_price"     // can't calculate without a basis
  | "needs_primary_residence_answer" // can't calculate without the 2-of-5 answer
  | "no_gain"                        // sale price ≤ adjusted basis
  | "excluded"                       // primary residence, fully under exclusion
  | "partially_taxable"              // primary residence, gain over exclusion
  | "deferred_1031"                  // non-primary, assuming a 1031 exchange
  | "taxable";                       // non-primary, no 1031

export interface SellerTaxChecklistItem {
  tone: "green" | "red" | "neutral";
  text: string;
}

export interface SellerTaxInput {
  estimatedSalePrice?: number | null;
  priorPurchasePrice?: number | null;
  capitalImprovements?: number | null;
  /** true = primary residence 2 of last 5 yrs, false = not, null/undefined = unanswered. */
  primaryResidence2of5?: boolean | null;
  filingStatus?: SellerFilingStatus | null;
  assume1031Exchange?: boolean | null;
  /** Override the placeholder rate; defaults to ESTIMATED_CAPITAL_GAINS_TAX_RATE. */
  taxRate?: number;
}

export interface SellerTaxEstimate {
  adjustedCostBasis: number;
  grossEstimatedGain: number;
  exclusionAmount: number;
  excludedGain: number;
  taxableGain: number;
  estimatedTaxRate: number;
  estimatedTaxesDue: number;
  status: SellerTaxStatus;
  messages: string[];
  checklistItems: SellerTaxChecklistItem[];
}

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function toNum(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/**
 * Core estimate. Pure function — no side effects, no I/O. See the file
 * header for the Version 1 rules. Returns a fully-zeroed result (plus a
 * `status` explaining why) when inputs are insufficient, so callers can
 * always render Net Proceeds without special-casing.
 */
export function calculateSellerEstimatedTaxesDue(input: SellerTaxInput): SellerTaxEstimate {
  const rate = typeof input.taxRate === "number" && input.taxRate >= 0
    ? input.taxRate
    : ESTIMATED_CAPITAL_GAINS_TAX_RATE;
  const sale = toNum(input.estimatedSalePrice);
  const improvements = Math.max(0, toNum(input.capitalImprovements));
  const prior = input.priorPurchasePrice;
  const primary = input.primaryResidence2of5;

  const zero: SellerTaxEstimate = {
    adjustedCostBasis: 0,
    grossEstimatedGain: 0,
    exclusionAmount: 0,
    excludedGain: 0,
    taxableGain: 0,
    estimatedTaxRate: rate,
    estimatedTaxesDue: 0,
    status: "no_gain",
    messages: [],
    checklistItems: [],
  };

  // 1. Missing prior purchase price — can't establish a cost basis.
  if (prior == null || !(prior > 0)) {
    return {
      ...zero,
      status: "needs_prior_purchase_price",
      messages: ["Add the previous purchase price to estimate taxes."],
    };
  }

  const adjustedCostBasis = prior + improvements;
  const grossEstimatedGain = Math.max(0, sale - adjustedCostBasis);

  // 2. Unanswered primary-residence question — can't pick an exclusion path.
  if (primary == null) {
    return {
      ...zero,
      adjustedCostBasis,
      grossEstimatedGain,
      status: "needs_primary_residence_answer",
      messages: ["Answer the primary residence question to estimate taxes."],
    };
  }

  // 3. No gain — sale price at/below adjusted basis.
  if (grossEstimatedGain <= 0) {
    return {
      ...zero,
      adjustedCostBasis,
      grossEstimatedGain: 0,
      status: "no_gain",
      messages: ["Sale price is at or below your adjusted cost basis — no estimated gain."],
      checklistItems: [{ tone: "green", text: "No estimated capital gain." }],
    };
  }

  // 4. Primary residence — apply the §121 exclusion.
  if (primary === true) {
    const exclusionAmount = input.filingStatus === "married" ? MARRIED_EXCLUSION : SINGLE_EXCLUSION;
    const excludedGain = Math.min(grossEstimatedGain, exclusionAmount);
    const taxableGain = Math.max(0, grossEstimatedGain - exclusionAmount);
    const estimatedTaxesDue = Math.round(taxableGain * rate);
    if (taxableGain <= 0) {
      return {
        adjustedCostBasis,
        grossEstimatedGain,
        exclusionAmount,
        excludedGain,
        taxableGain: 0,
        estimatedTaxRate: rate,
        estimatedTaxesDue: 0,
        status: "excluded",
        messages: [`Estimated gain is under the ${money(exclusionAmount)} exclusion.`],
        checklistItems: [
          { tone: "green", text: `Estimated gain is under the ${money(exclusionAmount)} exclusion.` },
        ],
      };
    }
    return {
      adjustedCostBasis,
      grossEstimatedGain,
      exclusionAmount,
      excludedGain,
      taxableGain,
      estimatedTaxRate: rate,
      estimatedTaxesDue,
      status: "partially_taxable",
      messages: [`${money(exclusionAmount)} may be excluded.`],
      checklistItems: [
        { tone: "green", text: `${money(exclusionAmount)} may be excluded.` },
        { tone: "red", text: `Potential taxable gain: ${money(taxableGain)}` },
      ],
    };
  }

  // 5. Not a primary residence, assuming a 1031 exchange — gain deferred.
  if (input.assume1031Exchange === true) {
    return {
      adjustedCostBasis,
      grossEstimatedGain,
      exclusionAmount: 0,
      excludedGain: 0,
      taxableGain: 0,
      estimatedTaxRate: rate,
      estimatedTaxesDue: 0,
      status: "deferred_1031",
      messages: ["Estimated taxes assume a qualifying 1031 exchange."],
      checklistItems: [
        { tone: "green", text: "Estimated taxes assume a qualifying 1031 exchange." },
      ],
    };
  }

  // 6. Not a primary residence, no 1031 — whole gain is taxable.
  const taxableGain = grossEstimatedGain;
  const estimatedTaxesDue = Math.round(taxableGain * rate);
  return {
    adjustedCostBasis,
    grossEstimatedGain,
    exclusionAmount: 0,
    excludedGain: 0,
    taxableGain,
    estimatedTaxRate: rate,
    estimatedTaxesDue,
    status: "taxable",
    messages: [`Potential taxable gain: ${money(taxableGain)}`],
    checklistItems: [
      { tone: "red", text: `Potential taxable gain: ${money(taxableGain)}` },
    ],
  };
}

/** Shape of the seller-scenario fields this module reads. Structural so it
 *  accepts a full SellerScenario without importing it (avoids a cycle). */
export interface SellerTaxScenarioFields {
  estimatedSalePrice?: number | null;
  priorPurchasePrice?: number | null;
  capitalImprovements?: number | null;
  primaryResidence2of5?: boolean | null;
  filingStatus?: SellerFilingStatus | null;
  assume1031Exchange?: boolean | null;
}

/** Build the calculator input from a seller scenario. */
export function sellerScenarioToTaxInput(s: SellerTaxScenarioFields): SellerTaxInput {
  return {
    estimatedSalePrice: s.estimatedSalePrice ?? 0,
    priorPurchasePrice: s.priorPurchasePrice ?? null,
    capitalImprovements: s.capitalImprovements ?? 0,
    primaryResidence2of5: s.primaryResidence2of5 ?? null,
    filingStatus: s.filingStatus ?? null,
    assume1031Exchange: s.assume1031Exchange ?? false,
  };
}

/** Full estimate for a seller scenario (overview + detail share this). */
export function estimateSellerTaxes(s?: SellerTaxScenarioFields | null): SellerTaxEstimate {
  if (!s) return calculateSellerEstimatedTaxesDue({});
  return calculateSellerEstimatedTaxesDue(sellerScenarioToTaxInput(s));
}

/**
 * Estimated taxes due (dollars) for a seller scenario. Thin wrapper kept for
 * every existing call site (overview cards, detail view, net-proceeds math).
 */
export function getEstimatedSellerTaxesDue(s?: SellerTaxScenarioFields | null): number {
  return estimateSellerTaxes(s).estimatedTaxesDue;
}
