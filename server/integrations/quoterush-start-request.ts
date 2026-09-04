import { z } from "zod";
import {
  isValidQuoteRushDate,
  resolveQuoteRushPropertyDefaults,
  type QuoteRushPropertyDefaults,
} from "@shared/quoterush-property-defaults";

function isClaimDateWithinFiveYears(value: string): boolean {
  if (!isValidQuoteRushDate(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const oldest = new Date(Date.UTC(
    today.getUTCFullYear() - 5,
    today.getUTCMonth(),
    today.getUTCDate(),
    0,
    0,
    0,
  ));
  const latest = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    23,
    59,
    59,
  ));
  return date >= oldest && date <= latest;
}

const quoteRushStartSchema = z.object({
  address: z.string().min(5),
  coverageA: z.number().positive(),
  policyType: z.enum(["HO3", "HO6", "DP3"]).default("HO3"),
  // Exact inputs from the redesigned insurance estimate. Keep the legacy
  // indices optional for other callers that have not yet collected them.
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
  roofYear: z.number().int().min(1800).max(2100).optional(),
  openingProtection: z.boolean().optional(),
  roofShape: z.enum(["Hip", "Flat", "Gable"]).optional(),
  secondaryWaterResistance: z.enum(["Yes", "No", "Unknown"]).optional(),
  yearIdx: z.number().int().min(0).max(3).default(1),
  roofIdx: z.number().int().min(0).max(3).default(1),
  constIdx: z.number().int().min(0).max(2),
  windIdx: z.number().int().min(0).max(2),
  hurrIdx: z.number().int().min(0).max(2),
  hasClaims: z.boolean(),
  claimRecords: z.array(z.object({
    lossDate: z.string().refine(isClaimDateWithinFiveYears, {
      message: "Claim loss date must be within the past five years.",
    }),
    claimDetail: z.string().trim().min(1).max(250),
    amount: z.number().positive(),
    paid: z.boolean(),
    priorResidence: z.boolean(),
  })).max(3),
  hasMortgage: z.boolean().optional(),
  aopDeductible: z.number().default(2500),
  floodZone: z.string().default(""),
  sqFt: z.number().default(0),
  // The browser reports a lock only after a person has edited an auto-filled
  // characteristic. Absent locks preserve backward-compatible explicit input.
  propertyCharacteristicLocks: z.object({
    floodZone: z.boolean().optional(),
    yearBuilt: z.boolean().optional(),
    squareFeet: z.boolean().optional(),
    construction: z.boolean().optional(),
  }).optional(),
  newPurchase: z.boolean(),
  purchaseDate: z.string().refine(isValidQuoteRushDate, {
    message: "A valid purchase or closing date is required.",
  }),
  usageType: z.enum(["primary", "secondary", "investment"]).optional(),
  rentalTerm: z.enum(["annual", "monthly", "weekly"]).optional(),
}).superRefine((value, ctx) => {
  if (value.hasClaims && value.claimRecords.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["claimRecords"],
      message: "Enter between one and three claim details.",
    });
  }
  if (!value.hasClaims && value.claimRecords.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["claimRecords"],
      message: "Remove claim details or answer yes to prior claims.",
    });
  }
  if (value.policyType !== "HO6") return;
  if (!value.usageType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["usageType"],
      message: "Residence use is required for an HO6 policy.",
    });
  }
  if (value.usageType === "investment" && !value.rentalTerm) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rentalTerm"],
      message: "Rental term is required for an HO6 investment property.",
    });
  }
});

export type QuoteRushStartRequest = z.infer<typeof quoteRushStartSchema>;

export function prepareQuoteRushStartRequest(
  body: unknown,
  resolveDefaults: typeof resolveQuoteRushPropertyDefaults = resolveQuoteRushPropertyDefaults,
): {
  request: QuoteRushStartRequest;
  propertyDefaults: QuoteRushPropertyDefaults;
} {
  const request = quoteRushStartSchema.parse(body);
  const propertyDefaults = resolveDefaults({
    policyType: request.policyType,
    rebuildCost: request.coverageA,
    newPurchase: request.newPurchase,
    purchaseDate: request.purchaseDate,
    ho6ResidenceUse: request.usageType,
    ho6RentalTerm: request.rentalTerm,
  });

  return { request, propertyDefaults };
}