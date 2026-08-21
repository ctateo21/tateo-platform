---
name: Supabase vs Neon DB split
description: Which Postgres holds which tables, and why the agent can't ALTER seller/property tables directly.
---

# Two separate Postgres databases

This app talks to TWO Postgres databases:

- **Neon** (`DATABASE_URL`) — holds only a small set of server-managed tables
  (e.g. `user_subscriptions`). The agent CAN run migrations here.
- **User's Supabase** (`VITE_SUPABASE_URL` + service role key) — holds the
  user-facing scenario data: `seller_scenarios`, `purchase_scenarios`,
  `cash_buy_scenarios`, `property_cache`, alerts, etc. The agent **cannot** run
  `ALTER TABLE` here — there is no migration runner wired to Supabase from the
  agent environment.

**Why it matters:** when adding columns to any Supabase-backed table, you must:
1. Add the columns to `supabase/schema.sql` (canonical) AND a dated file under
   `supabase/migrations/` (idempotent `add column if not exists`). The USER
   applies it manually in the Supabase SQL editor.
2. Add the new column names to the relevant `*_OPTIONAL_COLUMNS` list in
   `client/src/lib/auth.ts` (e.g. `SELLER_OPTIONAL_COLUMNS`). The persistence
   layer strips-and-retries unknown columns and warns the user, so saves keep
   working before the migration is applied. Skipping step 2 means every save
   fails for users on the old schema.

**How to apply:** any new persisted field on a Supabase table → schema.sql +
migration + optional-columns list, all three, every time.

## Partial legacy-draft migrations

**Rule:** Supabase upgrade migrations must tolerate optional legacy tables being
absent and retain old draft columns while relaxing incompatible `NOT NULL`
constraints before the finalized writer omits them.

**Why:** shared projects can have only part of a historical draft applied; an
unconditional backfill can fail on a missing legacy table, while a preserved
legacy required field can reject a new-format upsert even after the new columns
exist.

**How to apply:** guard optional backfills with `to_regclass`, inspect legacy
columns through `information_schema`, copy historical values where present, and
drop only the incompatible `NOT NULL` constraint—never the legacy column.

**Migration-free alternative (preferred for small scalar/UI fields):** stash the
value inside the existing `user_answer_sources` jsonb column instead of a new
column. It already round-trips end-to-end (rowToInsurance/insuranceToRow and is
in `INSURANCE_OPTIONAL_COLUMNS`), so NO schema.sql/migration is needed.
**Why:** avoids forcing the user to run SQL for every new field.
Examples already living there: `factor_*` insurance picks, and the insurance
detail view's `aop_deductible`, `carrier`, `flood_zone`/`flood_zone_source`
(flood zone resolved from `GET /api/flood-zone`, FEMA NFHL). Reuse the existing
dedicated `*_source` columns (e.g. `aop_deductible_source`, `carrier_source`)
for manual-lock provenance when they already exist.
