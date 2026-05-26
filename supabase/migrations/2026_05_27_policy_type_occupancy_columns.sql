-- ============================================================================
-- Phase 2 follow-up: Policy Type sync — occupancy + physical property type
-- ============================================================================
-- Adds the columns the Insurance auto-default rule needs from each source
-- tab so HO3 / HO6 / DP3 can be picked correctly:
--
--   purchase_scenarios.occupancy_type     -- Primary / Secondary / Investment
--                                            (property_type already exists)
--   cash_buy_scenarios.property_type      -- Single Family / Condo / Townhouse / etc.
--                                            (occupancy_type already exists)
--   tracked_loans.occupancy_type          -- Primary / Secondary / Investment
--   tracked_loans.physical_property_type  -- Single Family / Condo / Townhouse / etc.
--
-- Notes on tracked_loans: the legacy `property_type` column historically
-- holds the occupancy value (primary/secondary/investment), not the
-- physical structure. We keep that column for backward compatibility
-- (existing rows continue to load) and add two new, semantically clean
-- columns that the policy-type rule reads.
--
-- All columns are nullable text — the code paths that read them treat
-- NULL as "unknown" and fall back to the existing legacy values. Safe to
-- run repeatedly; every statement is `add column if not exists`.
-- ============================================================================

alter table public.purchase_scenarios
  add column if not exists occupancy_type text;

alter table public.cash_buy_scenarios
  add column if not exists property_type text;

alter table public.tracked_loans
  add column if not exists occupancy_type         text,
  add column if not exists physical_property_type text;
