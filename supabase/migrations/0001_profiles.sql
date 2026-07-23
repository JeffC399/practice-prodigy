-- Practice Prodigy initial schema.
-- Only `profiles` is included here; practice_sessions, scores, and
-- custom_patterns will land in a later migration once the scoring engine
-- shape is finalized (MVP step 5).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  default_instrument text check (default_instrument in ('guitar', 'bass')),
  default_strings smallint check (default_strings in (4, 5, 6)),
  a4_hz numeric(5, 1) not null default 440.0
    check (a4_hz between 430.0 and 450.0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are viewable by their owner"
  on public.profiles
  for select
  using (auth.uid() = id);
create policy "Profiles are insertable by their owner"
  on public.profiles
  for insert
  with check (auth.uid() = id);
create policy "Profiles are updatable by their owner"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
-- Auto-create a profile row whenever a new auth user is provisioned.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- Keep updated_at fresh on profile mutations.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
