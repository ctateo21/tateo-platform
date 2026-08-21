import { z } from "zod";

/**
 * Refinance tax lookups are intentionally address-only. Keeping this schema
 * separate makes it impossible to accidentally accept purchase-estimate
 * inputs such as purchasePrice or estimatedHomeValue.
 */
export const currentTaxBillRequestSchema = z
  .object({
    address: z.string().trim().min(5),
  })
  .strict();