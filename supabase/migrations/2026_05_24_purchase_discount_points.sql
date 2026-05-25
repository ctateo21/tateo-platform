-- Discount Points on Purchase with Loan (Page 4 → See My Estimate).
-- Persists the user's selected discount-point buydown so the scenario
-- restores with the same closing-cost / rate impact after refresh /
-- logout / login. All columns are nullable / default 0 so existing
-- purchase_scenarios rows continue to load unchanged.
alter table public.purchase_scenarios
  add column if not exists discount_points_percent numeric default 0,
  add column if not exists discount_points_cost numeric default 0,
  add column if not exists discount_points_rate_reduction numeric default 0,
  add column if not exists rate_before_discount_points numeric,
  add column if not exists rate_after_discount_points numeric;
