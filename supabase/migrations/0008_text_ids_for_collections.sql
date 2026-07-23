-- =====================================================================
-- Practice Prodigy — text ids for collection tables (Phase 85 / A.5).
--
-- Discovered while wiring the drills SyncAdapter: all five collection
-- stores (drills, sheets, key_drills, scale_drills, custom_patterns)
-- plus routines/songs/practice_sessions generate client-side ids in
-- the form `drill_l7f2ab_x9k2m` — a prefix + Date.now(base36) + random
-- suffix. Postgres rejects those as `id uuid`.
--
-- Fix: change the 8 collection tables' `id` column from `uuid` to
-- `text`. Singleton tables (profiles, user_prefs) keep `id uuid`
-- because their id equals user_id (which IS a uuid).
--
-- Tables are empty (0007 just landed), so DROP + CREATE is safe. Also
-- introduces `create_syncable_collection_table()` alongside the
-- existing `create_syncable_table()` — same factory pattern, id type
-- being the only difference. Slice B/C add more collection tables
-- via the new helper.
--
-- After this migration, regenerate database.types.ts so the id
-- columns type as `string` instead of the uuid-branded string.
-- =====================================================================


-- 1. New factory: collection tables use `id text primary key`.
create or replace function public.create_syncable_collection_table(table_name text)
returns void
language plpgsql
as $$
begin
  execute format(
    $sql$
      create table public.%1$I (
        id text primary key,
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


-- 2. Drop and recreate the 8 collection tables with text ids.
drop table if exists public.drills cascade;
drop table if exists public.key_drills cascade;
drop table if exists public.scale_drills cascade;
drop table if exists public.sheets cascade;
drop table if exists public.custom_patterns cascade;
drop table if exists public.routines cascade;
drop table if exists public.songs cascade;
drop table if exists public.practice_sessions cascade;

select public.create_syncable_collection_table('drills');
select public.create_syncable_collection_table('key_drills');
select public.create_syncable_collection_table('scale_drills');
select public.create_syncable_collection_table('sheets');
select public.create_syncable_collection_table('custom_patterns');
select public.create_syncable_collection_table('routines');
select public.create_syncable_collection_table('songs');
select public.create_syncable_collection_table('practice_sessions');


-- 3. Doc.
comment on function public.create_syncable_collection_table(text) is
  'Stamps a collection table (many rows per user) with the Practice '
  'Prodigy universal syncable shape but with `id text primary key` '
  'to accept client-generated prefix-based ids. See docs/SUPABASE-SCHEMA.md. '
  'Singleton tables (one row per user) still use create_syncable_table() '
  'so their id can be a uuid = user_id.';
