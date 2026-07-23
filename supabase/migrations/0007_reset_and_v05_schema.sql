-- =====================================================================
-- Practice Prodigy — v0.5 schema reset (Phase 83 / Slice A.5).
--
-- Wipes the prototype schema (migrations 0001–0006) and installs the
-- universal-shape schema documented in docs/SUPABASE-SCHEMA.md.
--
-- Universal shape for every syncable table:
--     id uuid primary key
--     user_id uuid references auth.users(id) on delete cascade
--     data jsonb not null
--     updated_at timestamptz not null default now()
--
-- Plus a composite index on (user_id, updated_at desc) and an
-- "own rows" RLS policy on `auth.uid() = user_id`.
--
-- Prototype cleanup:
--   - Trigger `on_auth_user_created` on auth.users
--   - Function `handle_new_user()` (auto-provisioned old profile rows)
--   - Function `touch_updated_at()` (row-level updated_at trigger)
--   - Tables `practice_sessions`, `routines`, `profiles`
--
-- Idempotent: every drop uses IF EXISTS, so this migration is safe to
-- run against the fresh `practice-prodigy-dev` project (no-op drops)
-- and against `practice-prodigy-prod` (wipes 7 test routines / 5 test
-- sessions / 1 test profile — user signed off in Phase 78).
--
-- After this migration lands, regenerate src/lib/supabase/database.types.ts
-- via `supabase gen types typescript --project-id <ref>` so the sync
-- engine's `as any` cast in src/lib/sync/sync-engine.ts can come out.
-- =====================================================================


-- =====================================================================
-- 1. Tear down prototype schema.
-- =====================================================================

-- Drop the auth trigger BEFORE dropping the function it calls.
drop trigger if exists on_auth_user_created on auth.users;

-- Drop tables in reverse dependency order.
-- CASCADE catches any triggers, indexes, and policies still attached.
drop table if exists public.practice_sessions cascade;
drop table if exists public.routines cascade;
drop table if exists public.profiles cascade;

-- Drop leftover helper functions.
drop function if exists public.handle_new_user() cascade;
drop function if exists public.touch_updated_at() cascade;


-- =====================================================================
-- 2. Helper: reusable row-level updated_at trigger.
--
-- The sync engine sets `updated_at` explicitly on every push, but any
-- direct SQL edit (Supabase Studio, admin scripts, seed data) benefits
-- from an auto-touch to keep last-write-wins consistent.
-- =====================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =====================================================================
-- 3. Universal syncable-table factory.
--
-- Reusable helper that stamps a table with the standard 4-column
-- shape, composite index, RLS enablement, and "own rows" policy.
-- Keeps the ten table definitions below to one line each — one place
-- to change if the shape evolves.
-- =====================================================================

create or replace function public.create_syncable_table(table_name text)
returns void
language plpgsql
as $$
begin
  execute format(
    $sql$
      create table public.%1$I (
        id uuid primary key,
        user_id uuid not null references auth.users(id) on delete cascade,
        data jsonb not null,
        updated_at timestamptz not null default now()
      );
      create index %1$I_user_updated_idx
        on public.%1$I (user_id, updated_at desc);
      alter table public.%1$I enable row level security;
      create policy "own rows" on public.%1$I
        for all
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
      create trigger %1$I_touch_updated_at
        before update on public.%1$I
        for each row execute function public.touch_updated_at();
    $sql$,
    table_name
  );
end;
$$;


-- =====================================================================
-- 4. v0.5 tables (all use the universal shape).
--
-- Per docs/SUPABASE-SCHEMA.md §3. Split into two shapes:
--   Singleton (id = user_id):   profiles, user_prefs
--   Collection (id = uuid()):   drills, key_drills, scale_drills,
--                               sheets, custom_patterns, routines,
--                               songs, practice_sessions
-- The engine enforces id=user_id for singletons via `isSingleton:true`
-- on the adapter — no schema-level distinction needed.
-- =====================================================================

select public.create_syncable_table('profiles');
select public.create_syncable_table('user_prefs');
select public.create_syncable_table('drills');
select public.create_syncable_table('key_drills');
select public.create_syncable_table('scale_drills');
select public.create_syncable_table('sheets');
select public.create_syncable_table('custom_patterns');
select public.create_syncable_table('routines');
select public.create_syncable_table('songs');
select public.create_syncable_table('practice_sessions');


-- =====================================================================
-- 5. Cleanup: the factory has done its job. Keep it around as a
-- documented helper for future table additions (Slice B/C add more).
-- =====================================================================

comment on function public.create_syncable_table(text) is
  'Stamps a table with the Practice Prodigy universal syncable shape: '
  '(id uuid pk, user_id uuid fk, data jsonb, updated_at tstz) + '
  'composite user/recency index + RLS "own rows" policy + touch trigger. '
  'See docs/SUPABASE-SCHEMA.md.';
