---
name: Hillsborough property tax estimate
description: Durable accuracy constraints for HCPA parcel matching and caching
---

**Rule:** Treat HCPA address search as fuzzy, not authoritative. Use parcel rates only after exact normalized house, full street, unit, and postal-city identity; otherwise fall back safely. Cache parcel identity/rates rather than a final scenario tax, and bind assessments to the same PIN/folio.

**Why:** Live investigation found that a truncated multi-word street search returned a different real parcel with plausible tax data. ZIPs can also cross county lines, and cached final taxes become wrong when price, homestead, or parcel identity changes.

**How to apply:** Never relax matching to city-only or a street substring. Recalculate from current scenario inputs on every cache hit, preserve folio/assessment metadata only for the same PIN, and allow a rejected shared-ZIP HCPA lookup to continue to a supported neighboring county.

## Purchase estimate basis

**Rule:** Show one purchase property-tax estimate, never a range. When a county method has an 85%–100% purchase-price range, use the 85% low end across every supported county.

**Why:** The user explicitly chose the lowest estimate as Havo's product policy. Mixing Hillsborough's low end with observed parcel values or full-price estimates in other counties made equivalent scenarios inconsistent.

**How to apply:** Current-owner just/assessed values must not raise a purchase estimate. Keep live and cached millage calculations on the same year-aware exemptions and rounding; effective-rate fallbacks already embed the low end, so never multiply them by 85% again.
