-- ============================================================================
-- Purchase-with-Cash flood insurance persistence
-- ============================================================================
-- Adds the annual flood insurance estimate to `cash_buy_scenarios` so the
-- Cash Buy flow can persist the system-estimated flood premium, matching the
-- `annual_flood_ins` column already used by purchase_scenarios (Purchase with
-- Loan). The value is $0 when the property is not in a FEMA required-insurance
-- flood zone, and a default estimate (currently $2,000/yr) when it is.
--
-- Nullable; readers treat NULL as "no recorded flood estimate" and fall back
-- to the live FEMA flood-zone lookup. Safe to run repeatedly.
-- ============================================================================

alter table public.cash_buy_scenarios
  add column if not exists annual_flood_ins numeric;
