---
name: Two-part property-tax architecture
description: Durable separation rules for purchase estimates versus refinance current-owner bills
---

**Rule:** Purchase-tax estimates and refinance current-owner bills are separate products. A refinance lookup accepts an address only and may return `ready` only from an actual annual bill total; it must never use purchase price, original price, Zillow value, or a purchase-estimate formula.

**Why:** Mixing estimate inputs into a current-owner bill can produce a plausible but false escrow figure and can also poison shared caches with values that scale differently.

**How to apply:** Keep separate cache tables and provenance labels. Purchase caching may recompute ad valorem from guarded rates while keeping non-ad-valorem dollars fixed; current-bill caching stores only verified annual totals with their tax year and source.

**Refinance automation rule:** Start the address-only current-bill lookup automatically for every refinance, without requiring the user to expand a card or click a lookup button. Persist the verified annual total and include its monthly equivalent in proposed refinance PITI. Never overwrite a manually entered tax amount with a late automatic response.

**Why:** The user explicitly wants the actual tax bill to autopopulate and be included in every refinance analysis.

**Cache rule:** Effective-rate cache rows for counties with fixed exemptions, including Hillsborough and Pinellas, may be reused only at their exact sample price. Linear formula counties may reuse rates within the ±20% price guardrail.

**Why:** Fixed-dollar homestead exemptions make the effective percentage change as price changes, so scaling one sample's percentage to a different price understates or overstates tax.

**County-routing rule:** Treat official situs ZIP lists as candidate coverage, not proof of county identity. If a ZIP belongs to multiple formula-only counties, do not pick the first match; use a parcel-level verifier or fall back to the generic estimate.

**Why:** Florida ZIP boundaries cross county lines, and formula-only county routes cannot reject an address from the wrong side of the boundary. A static priority can therefore apply the wrong county's rate while appearing successful.

**How to apply:** Keep shared ZIPs in every authoritative county set. Hillsborough may lead when its strict parcel matcher can reject and continue; other shared ZIPs must remain conservative until an equally strict county verifier exists.