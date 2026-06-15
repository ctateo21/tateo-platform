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
