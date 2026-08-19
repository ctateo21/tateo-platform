-- Server-only profile attributes used by authenticated integrations.
-- The table is declared in shared/schema.ts for Replit's publish-time
-- development-to-production schema propagation.
create table if not exists private_user_profiles (
  user_id text primary key,
  date_of_birth date not null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);