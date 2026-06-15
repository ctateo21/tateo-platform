---
name: Adding a persisted field to tracked_loans (refinance scenarios)
description: The checklist + gotchas for making any new user-editable refinance input survive reload/login.
---

# Persisting a new tracked_loans field

To make a new user-editable Refinance input round-trip to Supabase, you must touch
**all** of these or it silently won't persist / won't typecheck:

1. **Both `TrackedLoan` interfaces** — there are two structurally-identical copies:
   `client/src/lib/auth.ts` and `client/src/components/refi/loan-tracker.tsx`. Add the
   optional field to both (component uses its own; auth.ts mapper uses its own).
2. **`rowToTrackedLoan`** (auth.ts) — read + validate the column (enum/number guards).
3. **`trackedLoanToRow`** (auth.ts) — conditional spread write (only include when defined,
   mirroring `occupancy_type`), so undefined never clobbers an existing value.
4. **`TRACKED_LOAN_OPTIONAL_COLUMNS`** (auth.ts) — add the snake_case column name so the
   strip-retry lets saves succeed on un-migrated schemas.
5. **A migration** under `supabase/migrations/` (idempotent `ADD COLUMN IF NOT EXISTS`).
   The agent CANNOT run DDL — the user must run it in the Supabase SQL editor.

**Why:** `persistTrackedLoans` calls `notifyError` (which toasts "Refinance didn't fully
save") on *every* missing-column strip-retry, so shipping the writer before the user runs
the migration produces scary toasts until they do. Ship code + tell them to run the migration.

## React wiring gotchas (LoanCard)
- The card **does not remount** when persisted rows arrive after async hydration (parent
  re-renders under the same loan id). `useState` initializers don't re-run, so add a
  hydration-sync `useEffect` keyed on `loan.<field>` that `setState` only when the prop
  differs — mirror the existing `loanType`/`propertyType` pattern. Without it, the next
  edit writes the stale local default back and clobbers the persisted value.
- Persist **sliders on `onValueCommit`**, not `onValueChange` — the shadcn Slider spreads
  props to Radix so `onValueCommit` works; using `onValueChange` spams Supabase upserts
  during drag.
- Cash-out: persist the slider's **new loan amount** (`cashOutNewLoanAmount`), not the
  derived cash-out (= newLoanAmount − balance).
