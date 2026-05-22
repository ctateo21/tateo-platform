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
  insert into public.profiles (id, name, email, phone, agent)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'agent'
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
-- 4b. seller_scenarios  (consumer-side seller dashboard tab)
-- ----------------------------------------------------------------------------
-- Saved "what if I sold?" scenarios for homeowners considering selling. Mirrors
-- the purchase/insurance_scenarios pattern: text PK chosen client-side, owner
-- RLS, idempotent create. Net proceeds are recomputed in the UI from the
-- stored inputs — we only persist the inputs + a single derived snapshot.
create table if not exists public.seller_scenarios (
  id                       text primary key,
  user_id                  uuid not null references auth.users(id) on delete cascade,
  full_address             text not null,
  normalized_property_key  text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  estimated_sale_price     numeric,
  mortgage_payoff          numeric,
  seller_closing_costs     numeric,
  realtor_commission       numeric,
  buyer_concessions        numeric,
  repair_budget            numeric,
  other_selling_costs      numeric,
  net_proceeds             numeric,
  status                   text not null default 'draft',
  primary_photo_url        text,
  property_photos          jsonb
);

create index if not exists seller_scenarios_user_idx on public.seller_scenarios(user_id);

alter table public.seller_scenarios enable row level security;
drop policy if exists "seller_scenarios_owner" on public.seller_scenarios;
create policy "seller_scenarios_owner" on public.seller_scenarios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4b-cash. cash_buy_scenarios  (Cash Buy dashboard tab)
-- ----------------------------------------------------------------------------
-- Saved cash-purchase scenarios: no mortgage, no DTI, no qualification. Mirrors
-- purchase_scenarios/seller_scenarios shape (text PK chosen client-side, owner
-- RLS, idempotent create). Cash-to-close is recomputed in the UI from the
-- stored inputs — we persist a single derived snapshot for dashboard cards.
create table if not exists public.cash_buy_scenarios (
  id                          text primary key,
  user_id                     uuid not null references auth.users(id) on delete cascade,
  full_address                text not null,
  normalized_property_key     text,
  purchase_price              numeric,
  cash_to_close               numeric,
  buyer_closing_costs         numeric,
  closing_costs_percent       numeric,
  closing_costs_source        text,
  seller_concessions_mode     text,
  seller_concessions_percent  numeric,
  seller_concessions_amount   numeric,
  property_taxes              numeric,
  homeowners_insurance        numeric,
  hoa_amount                  numeric,
  hoa_frequency               text,
  hoa_source                  text,
  occupancy_type              text,
  status                      text,
  primary_photo_url           text,
  property_photos             jsonb,
  zillow_cache_key            text,
  property_cache_id           text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists cash_buy_scenarios_user_idx on public.cash_buy_scenarios(user_id);

alter table public.cash_buy_scenarios enable row level security;
drop policy if exists "cash_buy_scenarios_owner" on public.cash_buy_scenarios;
create policy "cash_buy_scenarios_owner" on public.cash_buy_scenarios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4c. listing_market_analyses  (AI-generated weekly seller listing analysis)
-- ----------------------------------------------------------------------------
-- One row per (listing_id, analysis_week_of). Generated server-side via
-- Anthropic at most once per Friday-aligned week per listing. We always read
-- the most recent row for the listing; staleness is computed off
-- next_update_due_at so the lazy refresh path can decide whether to regenerate.
create table if not exists public.listing_market_analyses (
  id                      text primary key,
  listing_id              text not null,
  user_id                 uuid not null references auth.users(id) on delete cascade,
  property_address        text not null,
  analysis_week_of        date not null,
  generated_at            timestamptz not null default now(),
  next_update_due_at      timestamptz not null,
  status                  text not null default 'draft',
  market_summary          text,
  pricing_analysis        text,
  comps_summary           text,
  online_interest_summary text,
  showing_summary         text,
  recommended_next_steps  jsonb,
  risk_flags              jsonb,
  price_review_recommended boolean,
  confidence_level        text,
  data_limitations        jsonb,
  raw_prompt              text,
  raw_anthropic_response  text,
  error_message           text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists listing_market_analyses_listing_idx
  on public.listing_market_analyses(listing_id, analysis_week_of desc);
create index if not exists listing_market_analyses_user_idx
  on public.listing_market_analyses(user_id);

alter table public.listing_market_analyses enable row level security;
drop policy if exists "listing_market_analyses_owner" on public.listing_market_analyses;
create policy "listing_market_analyses_owner" on public.listing_market_analyses
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

-- Tell PostgREST to reload its schema cache so new tables are visible to the
-- REST API immediately (avoids "Could not find the table" errors).
notify pgrst, 'reload schema';

-- ============================================================================
-- Done. Verify in Supabase Dashboard → Table Editor that all 7 tables exist
-- and that RLS is enabled (lock icon next to each table).
-- ============================================================================
