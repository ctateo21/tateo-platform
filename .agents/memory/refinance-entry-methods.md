---
name: Refinance entry methods
description: The 4 ways loans enter the refinance tab and the rules each must follow.
---

Four entry methods on the Refinance tab, persisted in `tracked_loans.entry_method`: `statement` (legacy default), `closing_disclosure`, `manual`, `free_and_clear`.

- **Shared add pipeline:** all flows must go through the page's `commitNewLoan` (local state → awaited Supabase save + toast → seller mirror → auto Zillow). Statement/CD/manual go via the occupancy dialog (`pendingAnalysis` + `pendingExtras`); free & clear collects occupancy in its own form and commits directly.
- **CD timing:** extract the first payment date directly or infer it as one month after the prepaid-interest-through date. CD balances remain at original principal before that date and then amortize from the original schedule on every surface. Persist the first payment date; closing-date-minus-one-month is only a legacy fallback.
- **CD value/LTV:** the CD sale price is the assumed appraised value and automatic Zillow/cross-tab updates must not replace it. A deliberate pencil edit may override it. Calculate conventional PMI from the final funded note; financed costs/escrows over 80% LTV require PMI and the UI must show the cash needed to remain at or below 80%.
- **CD PDFs must go to Anthropic as native document blocks, not pdfParse text** — text extraction drops checkbox glyphs, so the page-1 Loan Type (VA/FHA) box is invisible to the model and it returns null. Text input is only a fallback for .txt uploads.
- **CD extraction is strictly validated server-side** (address, loan amount, rate 0.5–15%, term 12–480 mo, closing date required & not future) — an invalid extraction throws instead of tracking a zero/garbage loan. Keep this if the prompt changes.
- **Free & clear rows** write 0s into the NOT NULL loan columns (no schema loosening); `free_and_clear=true`. LoanCard: only the Cash-Out tab renders; pricing must NOT use the 0 balance — it mirrors CashOutSection's default max-LTV slider amount, otherwise the sub-$250k loan-size adjustment is skipped.
- **Why:** architect review found free&clear pricing from balance 0 misprices quotes, and unvalidated Anthropic JSON let empty loans into tracking.
- **Internal-user gating:** accounts with @tateoco.com emails are lenders tracking their client book — they get per-loan credit score inputs and are exempt from borrower-facing questions (DTI qualification check on cash-out/2nd-lien tabs). Gate is a client-side email-suffix check in refinance.tsx.
- **DTI check** (dti-check.tsx): prefills income+debts from the SAME manual-income purchase scenario; session cache is scoped to user id (review flagged cross-account leak via module cache); HELOCs qualify at the fully-amortizing repayment payment.
- Both `/api/analyze-statement` and `/api/analyze-closing-disclosure` share an in-memory per-IP rate limit (10 per 10 min) because each call spends Anthropic credits and the routes are unauthenticated.
