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
drop policy if exists "questionnaire_owner_or_anon" on public.questionnaire_responses;
-- Authenticated users can only touch their own rows. Anonymous (pre-signup)
-- responses are allowed with user_id = null so the questionnaire still works
-- for new visitors; they get linked to an account on signup if needed.
create policy "questionnaire_owner_or_anon" on public.questionnaire_responses
  for all
  using  (user_id is null or auth.uid() = user_id)
  with check (user_id is null or auth.uid() = user_id);

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
create policy "submissions_owner_or_anon" on public.submissions
  for all
  using  (user_id is null or auth.uid() = user_id)
  with check (user_id is null or auth.uid() = user_id);

-- ============================================================================
-- Done. Verify in Supabase Dashboard → Table Editor that all 6 tables exist
-- and that RLS is enabled (lock icon next to each table).
-- ============================================================================
