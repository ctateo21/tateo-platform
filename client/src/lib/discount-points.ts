export const DISCOUNT_POINTS_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;
export const DISCOUNT_POINTS_MAX = 3;

export type DiscountPointsLoanType =
  | "conventional"
  | "jumbo"
  | "fha"
  | "va"
  | "usda"
  | "dscr"
  | "bank_statement";

const DISCOUNT_BUYDOWN_CONVENTIONAL: Record<string, number> = {
  "0": 0,
  "0.5": 0.240,
  "1": 0.340,
  "1.5": 0.420,
  "2": 0.500,
  "2.5": 0.710,
  "3": 0.810,
};

const DISCOUNT_BUYDOWN_FHA: Record<string, number> = {
  "0": 0,
  "0.5": 0.094,
  "1": 0.184,
  "1.5": 0.264,
  "2": 0.364,
  "2.5": 0.478,
  "3": 0.562,
};

export function snapDiscountPoints(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  const clamped = Math.max(0, Math.min(DISCOUNT_POINTS_MAX, raw));
  return Math.round(clamped * 2) / 2;
}

export function getDiscountPointsRateReduction(
  pct: number,
  loanType: DiscountPointsLoanType,
): number {
  const key = String(snapDiscountPoints(pct));
  switch (loanType) {
    case "conventional":
    case "jumbo":
    case "dscr":
      return DISCOUNT_BUYDOWN_CONVENTIONAL[key] ?? 0;
    case "fha":
    case "va":
    case "usda":
      return DISCOUNT_BUYDOWN_FHA[key] ?? 0;
    case "bank_statement":
    default:
      return 0;
  }
}

export function calculateDiscountPointsCost(
  baseLoanAmount: number,
  discountPointsPct: number,
): number {
  const amount = Math.max(0, baseLoanAmount);
  const points = snapDiscountPoints(discountPointsPct);
  return Math.round(amount * (points / 100) * 100) / 100;
}