-- ============================================================================
-- Tateo & Co — Supabase schema
-- Paste this entire file into Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to re-run: uses `if not exists` / `or replace` everywhere.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles  (1-to-1 with auth.users; stores app-level account fields)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null,
  email        text not null,
  phone        text,
  agent        text,
  invited_user jsonb,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own"  on public.profiles;
drop policy if exists "profiles_update_own"  on public.profiles;
drop policy if exists "profiles_insert_own"  on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- NOTE: `agent` is intentionally NOT copied from raw_user_meta_data.
  -- The agent role must only be granted by a service-role/admin process
  -- (e.g. an UPDATE run from the Supabase SQL editor or via the service key).
  insert into public.profiles (id, name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. tracked_loans  (refinance dashboard)
-- ----------------------------------------------------------------------------
create table if not exists public.tracked_loans (
  id                         text primary key,
  user_id                    uuid not null references auth.users(id) on delete cascade,
  property_address           text not null,
  lender                     text,
  loan_balance               numeric not null,
  current_rate               numeric not null,
  current_pi                 numeric not null,
  monthly_payment            numeric not null,
  estimated_home_value       numeric not null,
  estimated_remaining_years  numeric not null,
  property_type              text not null default 'primary',
  added_at                   timestamptz not null default now(),
  balance_as_of              timestamptz
);

create index if not exists tracked_loans_user_idx on public.tracked_loans(user_id);

alter table public.tracked_loans enable row level security;
drop policy if exists "tracked_loans_owner" on public.tracked_loans;
create policy "tracked_loans_owner" on public.tracked_loans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. purchase_scenarios  (saved property estimates)
-- ----------------------------------------------------------------------------
create table if not exists public.purchase_scenarios (
  id                text primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  address           text not null,
  saved_at          timestamptz not null default now(),
  price             numeric,
  monthly_payment   numeric,
  down_payment      numeric,
  interest_rate     numeric,
  cash_to_close     numeric,
  dti               numeric,
  qualifies         boolean,
  down_payment_pct  numeric,
  loan_type         text
);

create index if not exists purchase_scenarios_user_idx on public.purchase_scenarios(user_id);

alter table public.purchase_scenarios enable row level security;
drop policy if exists "purchase_scenarios_owner" on public.purchase_scenarios;
create policy "purchase_scenarios_owner" on public.purchase_scenarios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. insurance_scenarios
-- ----------------------------------------------------------------------------
create table if not exists public.insurance_scenarios (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  address         text not null,
  saved_at        timestamptz not null default now(),
  annual_premium  numeric,
  coverage_type   text
);

create index if not exists insurance_scenarios_user_idx on public.insurance_scenarios(user_id);

alter table public.insurance_scenarios enable row level security;
drop policy if exists "insurance_scenarios_owner" on public.insurance_scenarios;
create policy "insurance_scenarios_owner" on public.insurance_scenarios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. questionnaire_responses  (multi-step questionnaire autosave)
-- ----------------------------------------------------------------------------
create table if not exists public.questionnaire_responses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  session_id  text not null,
  step_name   text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  unique (session_id, step_name)
);

create index if not exists questionnaire_responses_user_idx on public.questionnaire_responses(user_id);
create index if not exists questionnaire_responses_session_idx on public.questionnaire_responses(session_id);

alter table public.questionnaire_responses enable row level security;
-- Drop any previous overly-permissive policy from earlier drafts.
drop policy if exists "questionnaire_owner_or_anon" on public.questionnaire_responses;
drop policy if exists "questionnaire_owner"        on public.questionnaire_responses;
-- Strict: only the authenticated owner can read/write their rows.
-- Anonymous (pre-signup) drafts must go through a trusted server endpoint
-- using the service-role key — never the anon key.
create policy "questionnaire_owner" on public.questionnaire_responses
  for all
  using      (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6. submissions  (generic form submission log)
-- ----------------------------------------------------------------------------
create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  kind        text not null,
  data        jsonb not null,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

create index if not exists submissions_user_idx on public.submissions(user_id);

alter table public.submissions enable row level security;
drop policy if exists "submissions_owner_or_anon" on public.submissions;
drop policy if exists "submissions_owner"         on public.submissions;
create policy "submissions_owner" on public.submissions
  for all
  using      (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 7. property_cache  (Zillow-via-Apify lookups; 24h TTL handled in app code)
-- ----------------------------------------------------------------------------
-- Cache key is the normalized address or Zillow URL. Shared across all users
-- (no user_id) — Zillow data isn't user-specific, and reusing cache across
-- accounts saves Apify credits.
create table if not exists public.property_cache (
  cache_key     text primary key,
  normalized    jsonb not null,
  raw           jsonb,
  fetched_at    timestamptz not null default now()
);

create index if not exists property_cache_fetched_idx on public.property_cache(fetched_at);

alter table public.property_cache enable row level security;

-- Anyone signed in can read; writes happen server-side via the service role
-- key (which bypasses RLS), so no insert/update policy is needed here.
drop policy if exists "property_cache_read" on public.property_cache;
create policy "property_cache_read" on public.property_cache
  for select
  using (auth.uid() is not null);

-- ----------------------------------------------------------------------------
-- 8. listings + weekly_recaps  (Seller Listing Dashboard)
-- ----------------------------------------------------------------------------
-- Agents = any profile row whose `agent` text field is non-null (matches the
-- existing AGENTS list in client/src/lib/auth.ts: christian / omar / kyle / team).
-- Sellers = regular users who own listings via `seller_id`.
--
-- Protect the `agent` column on profiles from being changed by anyone other
-- than the service role. Without this, the existing `profiles_update_own`
-- policy lets any user UPDATE their own row including `agent`, which would
-- allow self-elevation to full agent privileges. This trigger lets normal
-- users edit name/email/phone but silently preserves the old `agent` value.
create or replace function public.prevent_agent_self_elevation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.agent is distinct from old.agent then
    new.agent := old.agent;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_agent on public.profiles;
create trigger profiles_protect_agent
  before update on public.profiles
  for each row execute function public.prevent_agent_self_elevation();

-- Clear any agent values that may have been set via raw_user_meta_data on
-- signup before the trigger above was installed. Service role bypasses RLS.
-- Comment-out the next line if you have legitimate agents seeded via signup.
-- update public.profiles set agent = null where agent is not null and id not in (select id from public.profiles where ...);

-- Helper to identify agents without recursive RLS lookups.
create or replace function public.is_agent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and agent is not null
  );
$$;

create table if not exists public.listings (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade,
  address         text not null,
  unit            text,
  city            text not null,
  state           text not null,
  zip             text not null,
  mls_number      text,
  list_price      integer not null,
  beds            integer,
  baths           numeric,
  sqft            integer,
  community       text,
  status          text not null default 'active', -- active|pending|sold
  list_date       date,
  last_updated    timestamptz not null default now()
);

create index if not exists listings_seller_idx on public.listings(seller_id);
-- Idempotency for the demo seeder and to prevent duplicate MLS records per seller.
create unique index if not exists listings_seller_mls_uidx
  on public.listings(seller_id, mls_number)
  where mls_number is not null;

alter table public.listings enable row level security;
drop policy if exists "listings_seller_read" on public.listings;
drop policy if exists "listings_agent_all"   on public.listings;
-- Sellers read their own listings.
create policy "listings_seller_read" on public.listings
  for select using (auth.uid() = seller_id);
-- Agents have full access to all listings.
create policy "listings_agent_all" on public.listings
  for all using (public.is_agent()) with check (public.is_agent());

create table if not exists public.weekly_recaps (
  id                       uuid primary key default gen_random_uuid(),
  listing_id               uuid not null references public.listings(id) on delete cascade,
  recap_date               date not null default current_date,
  days_on_market           integer,
  avg_market_dom           integer,
  list_price               integer,
  recommended_price_low    integer,
  recommended_price_high   integer,
  projected_sale_low       integer,
  projected_sale_high      integer,

  zillow_daily_views_est   integer,
  zillow_daily_saves_est   numeric,
  zillow_heat_index_est    numeric,
  realtor_weekly_views_est integer,
  realtor_weekly_saves_est integer,
  redfin_weekly_views_est  integer,
  redfin_hot_home          boolean,

  comp_1_address text, comp_1_price integer, comp_1_dom integer, comp_1_status text,
  comp_2_address text, comp_2_price integer, comp_2_dom integer, comp_2_status text,
  comp_3_address text, comp_3_price integer, comp_3_dom integer, comp_3_status text,

  market_inventory_months numeric,
  market_median_price     integer,
  market_sale_to_list_pct numeric,

  market_summary       text,
  engagement_summary   text,
  price_drop_rationale text,
  next_steps           text[],
  agent_notes          text,

  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists weekly_recaps_listing_idx on public.weekly_recaps(listing_id, recap_date desc);
-- One recap per listing per day; makes the demo seeder race-safe and prevents
-- accidental duplicates from agents clicking save twice in the editor.
create unique index if not exists weekly_recaps_listing_date_uidx
  on public.weekly_recaps(listing_id, recap_date);

alter table public.weekly_recaps enable row level security;
drop policy if exists "weekly_recaps_seller_read" on public.weekly_recaps;
drop policy if exists "weekly_recaps_agent_all"   on public.weekly_recaps;
-- Sellers see only PUBLISHED recaps for listings they own.
create policy "weekly_recaps_seller_read" on public.weekly_recaps
  for select using (
    published = true and exists (
      select 1 from public.listings l
      where l.id = weekly_recaps.listing_id and l.seller_id = auth.uid()
    )
  );
-- Agents have full access.
create policy "weekly_recaps_agent_all" on public.weekly_recaps
  for all using (public.is_agent()) with check (public.is_agent());

-- Agents need to read all profiles (to display seller names in admin).
drop policy if exists "profiles_agent_read_all" on public.profiles;
create policy "profiles_agent_read_all" on public.profiles
  for select using (public.is_agent());

-- Tell PostgREST to reload its schema cache so new tables are visible to the
-- REST API immediately (avoids "Could not find the table" errors).
notify pgrst, 'reload schema';

-- ============================================================================
-- Done. Verify in Supabase Dashboard → Table Editor that all 7 tables exist
-- and that RLS is enabled (lock icon next to each table).
-- ============================================================================
