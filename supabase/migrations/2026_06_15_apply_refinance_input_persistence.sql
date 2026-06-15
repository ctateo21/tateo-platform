-- Persist the remaining user-editable Refinance inputs on tracked_loans.
-- These controls previously lived only in React component state and reset
-- on every reload/login:
--   * refi_goal                  — which goal tab the user had open
--   * finance_fees               — "finance closing costs into the loan" toggle
--   * include_escrows            — "include escrow reserve" toggle
--   * cash_out_new_loan_amount   — Cash-Out tab slider (new loan amount)
--   * home_equity_product        — 2nd-lien product (heloc / he_loan)
--   * home_equity_borrow_amount  — Home-Equity tab slider (borrow amount)
--
-- Idempotent: safe to run more than once.

ALTER TABLE tracked_loans ADD COLUMN IF NOT EXISTS refi_goal text;
ALTER TABLE tracked_loans ADD COLUMN IF NOT EXISTS finance_fees boolean;
ALTER TABLE tracked_loans ADD COLUMN IF NOT EXISTS include_escrows boolean;
ALTER TABLE tracked_loans ADD COLUMN IF NOT EXISTS cash_out_new_loan_amount numeric;
ALTER TABLE tracked_loans ADD COLUMN IF NOT EXISTS home_equity_product text;
ALTER TABLE tracked_loans ADD COLUMN IF NOT EXISTS home_equity_borrow_amount numeric;
