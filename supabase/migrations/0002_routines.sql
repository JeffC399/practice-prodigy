-- Practice routines: one row per saved routine.
-- Block data is stored as opaque JSONB; the client validates against the
-- TypeScript schema in src/lib/practice/schema.ts on read.

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  -- Null user_id = system-owned (templates). Owned rows reference auth.users.
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  data jsonb not null,
  -- System templates are world-readable, not writable by users.
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Invariant: system rows have no owner; user rows do.
  constraint routines_ownership_check
    check ((is_system and user_id is null) or (not is_system and user_id is not null))
);
-- The list page is sorted by updated_at desc; index for that query path.
create index if not exists routines_user_updated_idx
  on public.routines (user_id, updated_at desc)
  where user_id is not null;
create index if not exists routines_system_idx
  on public.routines (is_system)
  where is_system;
alter table public.routines enable row level security;
-- Users see their own routines + all system templates.
create policy "Routines are viewable by owner or if system"
  on public.routines
  for select
  using (auth.uid() = user_id or is_system);
-- Users can only create rows they own (never system rows).
create policy "Users can insert their own routines"
  on public.routines
  for insert
  with check (auth.uid() = user_id and not is_system);
-- Users can only update rows they own (never system rows).
create policy "Users can update their own routines"
  on public.routines
  for update
  using (auth.uid() = user_id and not is_system)
  with check (auth.uid() = user_id and not is_system);
-- Users can only delete rows they own.
create policy "Users can delete their own routines"
  on public.routines
  for delete
  using (auth.uid() = user_id and not is_system);
-- Reuse the touch_updated_at() function defined in 0001_profiles.sql.
drop trigger if exists routines_touch_updated_at on public.routines;
create trigger routines_touch_updated_at
  before update on public.routines
  for each row execute function public.touch_updated_at();
