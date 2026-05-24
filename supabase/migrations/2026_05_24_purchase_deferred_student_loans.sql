-- Page-2 "Additional Questions" → deferred student loans for DTI.
--
-- Adds two columns to public.purchase_scenarios so the Yes/No answer
-- and dollar balance entered on the Purchase questionnaire Page 2
-- survive refresh / logout / login. The assumed monthly DTI payment
-- is *derived* on the client from the balance + active loan type
-- (1.0% conventional & bank-statement, 0.5% FHA/VA/USDA, 0% DSCR),
-- so it is intentionally NOT persisted — keeping it derived avoids
-- stale values when the user later changes loan type.
--
-- Idempotent: safe to re-run.

alter table public.purchase_scenarios
  add column if not exists has_deferred_student_loans boolean default false,
  add column if not exists deferred_student_loan_balance numeric default 0;
