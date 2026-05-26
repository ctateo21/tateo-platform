-- ============================================================================
-- Purchase-with-Loan comprehensive borrower-answer persistence
-- ============================================================================
-- Earlier migrations covered price / property_type / occupancy / monthly
-- income. This migration closes the remaining gaps so EVERY user-edited
-- field across Pages 1-4 of the Purchase-with-Loan flow round-trips through
-- `purchase_scenarios` and reloads exactly as entered, surviving refresh /
-- logout / login / address change.
--
-- All columns are nullable; code paths that read them treat NULL as
-- legacy (no recorded answer) and fall back to the in-memory default.
-- Safe to run repeatedly — every statement is `add column if not exists`.
--
-- Field map (Inputs field → column):
--   Page 1 — Borrower Details
--     monthlyDebts            → monthly_debts            numeric
--     creditScore             → credit_score             integer
--     reserves                → reserves                 numeric
--   Page 2 — Additional Questions
--     isVeteran               → is_veteran               boolean
--     vaDisability            → va_disability            boolean
--     vaDisabilityRating100   → va_disability_rating_100 boolean
--     vaLoanUse               → va_loan_use              text
--     hasMortgage             → has_mortgage             boolean
--     currentLoanFHA          → current_loan_fha         boolean
--     hasRentalIncome         → has_rental_income        boolean
--     monthlyRentalIncome     → monthly_rental_income    numeric
--     rentalType              → rental_type              text
--   Page 3 — Purchase Details (also editable from Page 4)
--     sellerConcessions       → seller_concessions       numeric (dollars)
--     sellerConcessionsMode   → seller_concessions_mode  text    (percent|amount)
--     annualTaxes             → annual_taxes             numeric
--     annualHOIns             → annual_ho_ins            numeric
--     annualFloodIns          → annual_flood_ins         numeric
--     hoaMonthly              → hoa_monthly              numeric
--     cddAnnual               → cdd_annual               numeric
--     impactWindows           → impact_windows           boolean
--     roofAttachment          → roof_attachment          text
--     swr                     → swr                      boolean
--
--   Source map (per-field manual-lock provenance for fields whose values
--   have other in-app writers — currently `annual_ho_ins` is overwritten
--   by the 0.75%-of-price default effect, and future writers can grow):
--     userAnswerSources       → user_answer_sources      jsonb
--       { "annual_ho_ins": "manual" | "default" | "simulator",
--         "annual_taxes":  "manual" | "default",
--         "hoa_monthly":   "manual" | "zillow" | "default",
--         ... }
-- ============================================================================

alter table public.purchase_scenarios
  -- Page 1
  add column if not exists monthly_debts            numeric,
  add column if not exists credit_score             integer,
  add column if not exists reserves                 numeric,
  -- Page 2
  add column if not exists is_veteran               boolean,
  add column if not exists va_disability            boolean,
  add column if not exists va_disability_rating_100 boolean,
  add column if not exists va_loan_use              text,
  add column if not exists has_mortgage             boolean,
  add column if not exists current_loan_fha         boolean,
  add column if not exists has_rental_income        boolean,
  add column if not exists monthly_rental_income    numeric,
  add column if not exists rental_type              text,
  -- Page 3 / 4
  add column if not exists seller_concessions       numeric,
  add column if not exists seller_concessions_mode  text,
  add column if not exists annual_taxes             numeric,
  add column if not exists annual_ho_ins            numeric,
  add column if not exists annual_flood_ins         numeric,
  add column if not exists hoa_monthly              numeric,
  add column if not exists cdd_annual               numeric,
  add column if not exists impact_windows           boolean,
  add column if not exists roof_attachment          text,
  add column if not exists swr                      boolean,
  -- Generic per-field source map
  add column if not exists user_answer_sources      jsonb;
