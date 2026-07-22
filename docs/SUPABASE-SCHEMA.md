# Supabase Schema Reference

> The canonical schema shape for every syncable store in Practice Prodigy. Slice A.3 (Phase 81) ships the sync engine that expects tables in this shape; Slice A.5 (upcoming) writes the actual migrations that apply this shape to `practice-prodigy-dev` and `practice-prodigy-prod`.

**Doc status:** v1 — 2026-07-22
**Related:** `MY-PRACTICE-BUILD-PLAN.md` §2.5 (data model), `ROUTINE-DESIGN.md` §13 (cloud sync design), `src/lib/sync/types.ts` (adapter contract), `docs/SUPABASE-SETUP.md` (project + env-var setup).

---

## 1. The universal table shape

Every syncable table in Practice Prodigy follows this shape:

```sql
create table <table_name> (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index on <table_name> (user_id, updated_at desc);

alter table <table_name> enable row level security;

create policy "own rows" on <table_name>
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Why this shape:

- **`id uuid`** — every row is uniquely addressable. Collection stores generate a random UUID per entity; singleton stores use `id = user_id`.
- **`user_id uuid`** — the RLS anchor. Every row is owned by exactly one user; `on delete cascade` means account deletion wipes everything.
- **`data jsonb`** — opaque payload the app schema-validates on read. Avoids the schema-per-store treadmill; app-level types stay in TypeScript. Downsides (no server-side type checking, no computed indexes on nested fields) are acceptable for our workload.
- **`updated_at timestamptz`** — the sync engine's last-write-wins comparison anchor. Default `now()` handles inserts; app sets it explicitly on updates.
- **Composite index** `(user_id, updated_at desc)` — the sync engine's pull query filters by user and sometimes sorts by recency.
- **RLS enabled + `own rows` policy** — users can only read/write their own rows. Enforced at the Postgres level; no way for a client-side bug to leak another user's data.

---

## 2. Collection vs singleton stores

Two shapes of syncable state, both using the same table structure:

### 2.1 Collection stores — many rows per user

Examples: **drills, sheets, songs, routines, custom patterns, key-sequencer drills, scale-driller drills**.

- One row per entity.
- `id` = a random UUID generated at insert time.
- `data` = the full entity payload (a drill config, a sheet, etc.).
- Adapter's `extractLocal()` returns many rows.
- Adapter's `applyRemote(rows)` replaces or merges the store's entity list.

### 2.2 Singleton stores — one row per user

Examples: **profile, user prefs, appearance code, metronome prefs**.

- Exactly one row per user (or zero, if the user has never touched the store).
- `id` = `user_id` (the sync engine enforces this via `isSingleton: true` on the adapter).
- `data` = the full store state as a single blob.
- Adapter's `extractLocal()` returns exactly one row.
- Adapter's `applyRemote(rows)` replaces the entire store state with `rows[0].data`.

---

## 3. Per-store table names (to be created in Slice A.5)

| Table | Store | Shape | Notes |
|---|---|---|---|
| `profiles` | `useUserPrefs` (Practice Profile fields) | Singleton | Already exists from earlier prototype; will be migrated to v0.5 shape in A.5. |
| `user_prefs` | `useUserPrefs` (appearance + settings) | Singleton | The non-profile parts (theme, palette, etc.) may be split into their own singleton table for cleaner separation. TBD in A.5. |
| `drills` | `useDrillsLibrary` (Arpeggios) | Collection | Existing local drills library. |
| `key_drills` | `useKeyDrillsLibrary` | Collection | Key Sequencer drills. |
| `scale_drills` | `useScaleDrillsLibrary` | Collection | Scale Driller drills. |
| `sheets` | `useSheetsLibrary` | Collection | Lead Sheet Builder sheets. |
| `custom_patterns` | `useCustomPatternsLibrary` | Collection | User-authored arpeggio patterns. |
| `routines` | `useRoutinesLibrary` | Collection | My Practice routines (Slice B). |
| `songs` | `useSongsLibrary` | Collection | My Practice songs (Slice C). |
| `practice_sessions` | Session tracker | Collection | Slice A.12 — session history for reports. |

Notes:
- `chord_drills` (Chords module) added when the module ships (post-Slice-B).
- All tables live in the `public` schema.
- All tables have RLS enabled with the `own rows` policy above.

---

## 4. Migration strategy

Slice A.5 will:
1. **Drop the existing prototype tables** in `practice-prodigy-prod` (currently: 6 migrations `0001_profiles.sql` through `0006_practice_defaults.sql`, with 7 test routines, 5 test sessions, 1 test profile). User explicitly signed off on wiping this in Phase 78's setup.
2. **Author `0007_reset_and_v05_schema.sql`** — one big migration that drops all pre-v0.5 tables and creates the ten tables above with the universal shape + RLS.
3. **Apply to both `practice-prodigy-dev` and `practice-prodigy-prod`.**
4. **Regenerate `src/lib/supabase/database.types.ts`** via `supabase gen types typescript --project-id ...` so all Supabase client calls become type-safe.

---

## 5. Data lifecycle

- **Insert** — `INSERT ... ON CONFLICT (id) DO UPDATE`. The sync engine uses `upsert()` in `sync-engine.ts`.
- **Read** — `SELECT id, data, updated_at FROM <table> WHERE user_id = auth.uid()`. Engine's `pull()` filters implicitly via RLS + explicitly via `.eq("user_id", ...)`.
- **Delete** — collection-store deletions push a "row absent" signal on the next pull. Two options for Slice A.5: (a) hard delete rows on the client's side and let the pull sync do the diff, or (b) add a `deleted_at` tombstone column and soft-delete. Decide during A.5. Soft-delete is safer for multi-device conflict but adds schema complexity.

---

## 6. Retention + user delete

- **Retention** — data lives forever by default. Users can delete individual entities (per-store UI) or the whole account (Settings → Account → Delete).
- **Account delete** — one call to `auth.admin.deleteUser(user_id)` cascades through every table via `on delete cascade`. No orphaned data.
- **Data export** — Settings → Data → Export gathers all rows across all tables (via the `.select()` per table) into one JSON bundle. Slice D+ scope; the schema is compatible today.

---

## 7. Row-level security details

The `own rows` RLS policy uses `auth.uid() = user_id` as its check. Note:

- **`auth.uid()`** is a Supabase Postgres function that returns the JWT's `sub` claim. Available in every RLS policy.
- **On the client**, `supabase.auth.getUser()` (Slice A.1) refreshes the session; RLS reads the fresh JWT on every request.
- **Service-role client** bypasses RLS entirely. Use only in server-side admin ops (e.g. migrations, account-delete cascades). Never in user-controlled surfaces without explicit auth checks.

---

## 8. Schema evolution

- **Add a column** — write a new migration `NNNN_add_<column>.sql` (`ALTER TABLE ... ADD COLUMN ...`) and regenerate `database.types.ts`.
- **Add a table** — same pattern. `NNNN_add_<table>.sql`.
- **Change `data jsonb` shape** — no migration required at the SQL layer. Update the TypeScript type + write a migration function in the store's `persist.migrate` hook. Existing rows are upgraded on read.
- **Rename a table** — avoid. If needed, ship a two-phase migration (create new table, dual-write, backfill, cut over).

---

## 9. Change log

| Date | Change |
|---|---|
| 2026-07-22 | v1 — Initial schema doc. Captures the universal table shape, per-store table list, migration strategy, and RLS pattern. Written as Slice A.3 lands the sync engine; Slice A.5 applies the actual migrations. |
