// Shared helper: hydrate a ListingInput with data already cached in
// `property_cache` (Zillow/Apify normalized payload). Used by both the
// /api/listing-market-analysis route and the weekly precompute job so
// both paths feed Anthropic the same enriched input.
import { supabaseAdmin } from "../supabase";
import { buildNormalizedPropertyKey } from "./apify-zillow";
import type { ListingInput } from "./listing-market-analysis";

export async function enrichListingFromPropertyCache(
  input: ListingInput,
): Promise<ListingInput> {
  if (!supabaseAdmin) return input;
  const enriched: ListingInput = { ...input };
  try {
    const cacheKey = input.normalizedPropertyKey || buildNormalizedPropertyKey(input.address);
    if (!cacheKey) return enriched;
    const { data: cached } = await supabaseAdmin
      .from("property_cache")
      .select("normalized")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    const norm = cached?.normalized as Record<string, any> | null | undefined;
    if (!norm) return enriched;

    enriched.beds          = enriched.beds          ?? (typeof norm.bedrooms   === "number" ? norm.bedrooms   : null);
    enriched.baths         = enriched.baths         ?? (typeof norm.bathrooms  === "number" ? norm.bathrooms  : null);
    enriched.sqft          = enriched.sqft          ?? (typeof norm.squareFeet === "number" ? norm.squareFeet : null);
    enriched.lotSize       = enriched.lotSize       ?? (typeof norm.lotSize    === "number" ? norm.lotSize    : null);
    enriched.yearBuilt     = enriched.yearBuilt     ?? (typeof norm.yearBuilt  === "number" ? norm.yearBuilt  : null);
    enriched.hoa           = enriched.hoa           ?? (typeof norm.hoaMonthly === "number" ? norm.hoaMonthly : null);
    enriched.propertyType  = enriched.propertyType  ?? (typeof norm.propertyType === "string" ? norm.propertyType : null);
    enriched.zillowValue   = enriched.zillowValue   ?? (typeof norm.zestimate === "number" ? norm.zestimate
                                                       : typeof norm.estimatedHomeValue === "number" ? norm.estimatedHomeValue
                                                       : null);
    enriched.listPrice     = enriched.listPrice     ?? (typeof norm.listingPrice === "number" ? norm.listingPrice : null);
    enriched.lastSoldPrice = enriched.lastSoldPrice ?? (typeof norm.soldPrice === "number" ? norm.soldPrice : null);
    enriched.lastSoldDate  = enriched.lastSoldDate  ?? (typeof norm.soldDate === "string"  ? norm.soldDate : null);
    enriched.photoCount    = enriched.photoCount    ?? (Array.isArray(norm.photos) ? norm.photos.length : null);
    enriched.primaryPhotoUrl = enriched.primaryPhotoUrl ?? (Array.isArray(norm.photos) && typeof norm.photos[0] === "string" ? norm.photos[0] : null);
    enriched.city          = enriched.city          ?? (typeof norm.displayCity === "string" ? norm.displayCity
                                                       : typeof norm.googleCity === "string" ? norm.googleCity : null);
    enriched.zip           = enriched.zip           ?? (typeof norm.zip === "string" ? norm.zip
                                                       : typeof norm.zipCode === "string" ? norm.zipCode : null);
    enriched.daysOnMarket  = enriched.daysOnMarket  ?? (typeof norm.daysOnZillow   === "number" ? norm.daysOnZillow   : null);
    enriched.listDate      = enriched.listDate      ?? (typeof norm.listDate       === "string" ? norm.listDate       : null);
    enriched.priorPriceCuts = enriched.priorPriceCuts ?? (typeof norm.priorPriceCuts === "number" ? norm.priorPriceCuts : null);
    enriched.onlineViews   = enriched.onlineViews   ?? (typeof norm.pageViewCount  === "number" ? norm.pageViewCount  : null);
    enriched.onlineSaves   = enriched.onlineSaves   ?? (typeof norm.favoriteCount  === "number" ? norm.favoriteCount  : null);
    enriched.normalizedPropertyKey = enriched.normalizedPropertyKey ?? cacheKey;
  } catch (e: any) {
    console.warn("[listing-enrichment] property_cache lookup failed:", e?.message);
  }
  return enriched;
}
