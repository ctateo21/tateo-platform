-- ============================================================================
-- Convert Seller Closing Costs from a $-typed input to a %-typed slider.
-- The dollar amount in `seller_closing_costs` stays; we now also persist the
-- chosen percent so refresh/logout/login restore the slider position
-- consistently and the dollar amount can be re-derived from the sale price.
--
-- Default 1.85% mirrors the client-side default in
-- `client/src/pages/seller-estimate.tsx` and
-- `client/src/lib/seller-from-refinance.ts`.
--
-- `seller_closing_costs_source` now also accepts:
--   'default_percent'  — current default (1.85% of sale price)
--   'percent_manual'   — user moved the slider
--   'manual'           — legacy dollar override (already supported)
--   'default_1_percent' — legacy default (treated as overridable)
-- (Column is plain text — no enum migration needed for new source values.)
-- ============================================================================

alter table public.seller_scenarios
  add column if not exists seller_closing_costs_percent numeric default 1.85;
