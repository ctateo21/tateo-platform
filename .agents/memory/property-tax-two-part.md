---
name: Two-part property-tax architecture
description: Durable separation rules for purchase estimates versus refinance current-owner bills
---

**Rule:** Purchase-tax estimates and refinance current-owner bills are separate products. A refinance lookup accepts an address only and may return `ready` only from an actual annual bill total; it must never use purchase price, original price, Zillow value, or a purchase-estimate formula.

**Why:** Mixing estimate inputs into a current-owner bill can produce a plausible but false escrow figure and can also poison shared caches with values that scale differently.

**How to apply:** Keep separate cache tables and provenance labels. Purchase caching may recompute ad valorem from guarded rates while keeping non-ad-valorem dollars fixed; current-bill caching stores only verified annual totals with their tax year and source.

**Cache rule:** Effective-rate cache rows for counties with fixed exemptions, including Hillsborough and Pinellas, may be reused only at their exact sample price. Linear formula counties may reuse rates within the ±20% price guardrail.

**Why:** Fixed-dollar homestead exemptions make the effective percentage change as price changes, so scaling one sample's percentage to a different price understates or overstates tax.