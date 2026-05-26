-- ============================================================================
-- Purchase-with-Cash comprehensive user-answer persistence
-- ============================================================================
-- Mirrors the Purchase-with-Loan 2026_05_28 migration but for
-- `cash_buy_scenarios`. Adds:
--   - Per-field source columns so manual edits can be locked against
--     defaults / Zillow / property-cache writers.
--   - Generic `user_answer_sources jsonb` map for future-proofing.
--   - Persistence of the insurance simulator state (factors + premium)
--     so a logout/login round-trip doesn't lose the user's sim work.
--   - `property_type` (defensive; the 2026_05_27 migration was supposed
--     to add this, but is missing on some Supabase instances).
--
-- All columns are nullable; code paths that read them treat NULL as
-- legacy (no recorded answer / no manual lock) and fall back to existing
-- defaults. Safe to run repeatedly — every statement is
-- `add column if not exists`.
-- ============================================================================

alter table public.cash_buy_scenarios
  -- Defensive: 2026_05_27 was supposed to add this; safe to re-add.
  add column if not exists property_type                 text,
  -- Per-field source columns (manual lock provenance)
  add column if not exists purchase_price_source         text,
  add column if not exists occupancy_type_source         text,
  add column if not exists property_type_source          text,
  add column if not exists property_taxes_source         text,
  add column if not exists homeowners_insurance_source   text,
  add column if not exists seller_concessions_source     text,
  -- Insurance simulator state (was in-memory only)
  add column if not exists insurance_premium_annual      numeric,
  add column if not exists insurance_factors             jsonb,
  -- Generic per-field source map (mirrors purchase_scenarios)
  add column if not exists user_answer_sources           jsonb;
