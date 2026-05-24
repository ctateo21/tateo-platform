-- ============================================================================
-- Add provenance / "source" columns to seller_scenarios so the Refinance →
-- Sell-Your-Home auto-create flow can safely overwrite system-generated
-- values without ever clobbering a value the user manually edited in the
-- Sell-Your-Home detail view.
-- ============================================================================
-- Idempotent: every statement uses IF NOT EXISTS.
--
-- Allowed values (text, not an enum so the helper can evolve without a
-- second migration):
--   estimated_sale_price_source : 'refinance' | 'zillow' | 'manual'
--   mortgage_payoff_source      : 'refinance_statement' | 'manual'
--   realtor_commission_source   : 'default_5_percent' | 'manual'
--   seller_closing_costs_source : 'default_1_percent' | 'manual'
--
-- NULL is treated as "auto / overridable" by the helper (legacy rows that
-- pre-date this migration).
-- ============================================================================

alter table public.seller_scenarios
  add column if not exists estimated_sale_price_source text,
  add column if not exists mortgage_payoff_source      text,
  add column if not exists realtor_commission_source   text,
  add column if not exists seller_closing_costs_source text;
