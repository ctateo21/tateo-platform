/**
 * Product policy for purchase property-tax estimates.
 *
 * County estimators can expose a range based on 85%–100% of purchase price.
 * Havo intentionally shows one estimate and uses the lowest value in that
 * range. Effective-rate fallbacks already embed this policy and must not be
 * multiplied by this ratio a second time.
 */
export const PURCHASE_TAX_LOW_ASSESSMENT_RATIO = 0.85;