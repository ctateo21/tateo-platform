-- ============================================================================
-- Purchase scenarios — property type + source provenance
-- ============================================================================
-- Adds a manual-vs-Zillow tracked Property Type to each saved purchase
-- scenario, surfaced on Page 3 ("Purchase Details") under the price field.
--
-- `property_type_source` distinguishes:
--   'manual'  → user picked it, never overwrite from Zillow refresh
--   'zillow'  → seeded from Zillow scraper, OK to refresh
--   'default' → fell back to "Single Family Residence" with no data
--
-- Idempotent. Run once in the Supabase SQL editor.
-- ============================================================================

alter table public.purchase_scenarios
  add column if not exists property_type        text default 'Single Family Residence',
  add column if not exists property_type_source text default 'default'
    check (property_type_source in ('manual','zillow','default'));
