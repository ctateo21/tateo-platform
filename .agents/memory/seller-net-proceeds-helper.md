---
name: Seller net-proceeds shared helper
description: All seller net-proceeds / closing-cost math must flow through one helper to prevent detail/overview drift.
---

# Seller net proceeds & closing costs — single source of truth

Rule: any surface that shows a seller scenario's closing costs or net proceeds
must use `client/src/lib/seller-net-proceeds.ts`:
- `resolveSellerClosingCosts(s)` — manual dollar amount wins, else
  `round(sale * pct/100)` with a shared default percent.
- `calculateSellerNetProceeds(s)` — returns the full breakdown plus
  `estimatedNetProceeds` and `hasSalePrice`. Net formula:
  `sale - mortgagePayoff - realtorCommission - sellerClosingCosts -
  buyerConcessions - repairBudget - otherSellingCosts - estimatedTaxesDue`.

This is consumed by three places that previously each had their own math:
the detail view (seller-estimate.tsx), the dashboard overview (dashboard.tsx
SellersTab), and the autosave handler (which stamps canonical
`sellerClosingCosts` / `netProceeds` / `estimatedTaxesDue` so persisted rows
match what was shown).

**Why:** the detail view recomputed closing costs from a percent while the
overview read the raw stored dollar field and ran a separate formula, so saved
detail numbers didn't reliably appear on the dashboard. Centralizing removed
the drift.

**How to apply:** when no sale price is set, both surfaces must render "—"
(gate on `hasSalePrice`), never $0 / a negative. If you add a new place that
displays these numbers, import the helper instead of re-deriving.
