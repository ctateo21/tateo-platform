-- ============================================================================
-- Standalone migration: For Sale (seller_scenarios) + AI weekly Market Analysis
-- ============================================================================
-- Run this once in the Supabase SQL editor (Project → SQL → New query → Run).
-- Safe to run multiple times: every statement is idempotent (IF NOT EXISTS /
-- DROP POLICY IF EXISTS / CREATE OR REPLACE patterns).
--
-- After running, your "For Sale" rows will persist across refresh/logout/login
-- and the Market Analysis section will save its weekly Anthropic results.
-- ============================================================================

-- ── 1. seller_scenarios ────────────────────────────────────────────────────
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

create index if not exists seller_scenarios_user_idx
  on public.seller_scenarios(user_id, created_at desc);
create index if not exists seller_scenarios_normalized_key_idx
  on public.seller_scenarios(normalized_property_key);

alter table public.seller_scenarios enable row level security;
drop policy if exists "seller_scenarios_owner" on public.seller_scenarios;
create policy "seller_scenarios_owner" on public.seller_scenarios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 2. listing_market_analyses (weekly AI briefing) ────────────────────────
create table if not exists public.listing_market_analyses (
  id                       text primary key,
  listing_id               text not null,
  user_id                  uuid not null references auth.users(id) on delete cascade,
  property_address         text not null,
  analysis_week_of         date not null,
  generated_at             timestamptz not null default now(),
  next_update_due_at       timestamptz not null,
  status                   text not null default 'draft',
  market_summary           text,
  pricing_analysis         text,
  comps_summary            text,
  online_interest_summary  text,
  showing_summary          text,
  recommended_next_steps   jsonb,
  risk_flags               jsonb,
  price_review_recommended boolean,
  confidence_level         text,
  data_limitations         jsonb,
  raw_prompt               text,
  raw_anthropic_response   text,
  error_message            text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists listing_market_analyses_listing_idx
  on public.listing_market_analyses(listing_id, analysis_week_of desc);
create index if not exists listing_market_analyses_user_idx
  on public.listing_market_analyses(user_id);

alter table public.listing_market_analyses enable row level security;
drop policy if exists "listing_market_analyses_owner" on public.listing_market_analyses;
create policy "listing_market_analyses_owner" on public.listing_market_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
