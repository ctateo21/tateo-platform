export type QuoteRushPolicyType = "HO3" | "HO6" | "DP3";
export type QuoteRushResidenceUse = "primary" | "secondary" | "investment";
export type QuoteRushRentalTerm = "annual" | "monthly" | "weekly";

export const QUOTERUSH_MONTHS_OCCUPIED = "9 months or more";

export interface QuoteRushPropertyDefaultInput {
  policyType: QuoteRushPolicyType;
  rebuildCost: number;
  newPurchase: boolean;
  purchaseDate: string;
  ho6ResidenceUse?: QuoteRushResidenceUse | "";
  ho6RentalTerm?: QuoteRushRentalTerm | "";
}

export interface QuoteRushPropertyDefaults {
  usageType: "Primary" | "Secondary" | "Investment";
  rentalTerm: "" | "Annual" | "Monthly" | "Weekly";
  monthsOccupied: typeof QUOTERUSH_MONTHS_OCCUPIED;
  newPurchase: "Yes" | "No";
  purchaseDate: string;
  purchasePrice: number;
}

export function isValidQuoteRushDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function formatQuoteRushDate(value: string): string {
  if (!isValidQuoteRushDate(value)) {
    throw new Error("A valid purchase or closing date is required.");
  }
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

export function resolveQuoteRushPropertyDefaults(
  input: QuoteRushPropertyDefaultInput,
): QuoteRushPropertyDefaults {
  if (!Number.isFinite(input.rebuildCost) || input.rebuildCost <= 0) {
    throw new Error("A valid rebuild cost is required.");
  }

  let usageType: QuoteRushPropertyDefaults["usageType"];
  let rentalTerm: QuoteRushPropertyDefaults["rentalTerm"] = "";

  if (input.policyType === "HO3") {
    usageType = "Primary";
  } else if (input.policyType === "DP3") {
    usageType = "Investment";
  } else {
    const usageMap: Record<QuoteRushResidenceUse, QuoteRushPropertyDefaults["usageType"]> = {
      primary: "Primary",
      secondary: "Secondary",
      investment: "Investment",
    };
    if (!input.ho6ResidenceUse) {
      throw new Error("Select how the HO6 residence will be used.");
    }
    usageType = usageMap[input.ho6ResidenceUse];
    if (input.ho6ResidenceUse === "investment") {
      const rentalMap: Record<QuoteRushRentalTerm, Exclude<QuoteRushPropertyDefaults["rentalTerm"], "">> = {
        annual: "Annual",
        monthly: "Monthly",
        weekly: "Weekly",
      };
      if (!input.ho6RentalTerm) {
        throw new Error("Select the rental term for the HO6 investment property.");
      }
      rentalTerm = rentalMap[input.ho6RentalTerm];
    }
  }

  return {
    usageType,
    rentalTerm,
    monthsOccupied: QUOTERUSH_MONTHS_OCCUPIED,
    newPurchase: input.newPurchase ? "Yes" : "No",
    purchaseDate: formatQuoteRushDate(input.purchaseDate),
    purchasePrice: Math.round(
      input.rebuildCost * (input.policyType === "HO6" ? 2 : 1),
    ),
  };
}