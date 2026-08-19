-- DOB now lives only in the server-owned private_user_profiles table.
-- Drop the earlier browser-queryable profile column and any legacy values.
alter table public.profiles
  drop column if exists date_of_birth;