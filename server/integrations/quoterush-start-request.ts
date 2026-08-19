import { z } from "zod";
import {
  isValidQuoteRushDate,
  resolveQuoteRushPropertyDefaults,
  type QuoteRushPropertyDefaults,
} from "@shared/quoterush-property-defaults";

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
  claimsIdx: z.number().int().min(0).max(3),
  aopDeductible: z.number().default(2500),
  floodZone: z.string().default("X"),
  sqFt: z.number().default(0),
  newPurchase: z.boolean(),
  purchaseDate: z.string().refine(isValidQuoteRushDate, {
    message: "A valid purchase or closing date is required.",
  }),
  usageType: z.enum(["primary", "secondary", "investment"]).optional(),
  rentalTerm: z.enum(["annual", "monthly", "weekly"]).optional(),
}).superRefine((value, ctx) => {
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