-- =====================================================================
-- Practice Prodigy — Collections table (Slice I / Phase 148).
--
-- Introduces the cross-module "Collection" concept: a named, colored,
-- optionally-emojified group that can contain drills, key-drills,
-- scale-drills, lead sheets, and songs together. Users create
-- collections to organize related material (e.g. "Learn the Fretboard"
-- spanning arpeggio + scale drills + a lead sheet + a song).
--
-- Shape follows the universal syncable-collection pattern:
--   id text primary key
--   user_id uuid → auth.users(id)
--   data jsonb  → the Collection object (see src/lib/practice/collections.ts)
--   updated_at timestamptz → LWW anchor for sync
--
-- No app-side schema changes to the drill/sheet/song tables — a
-- Collection stores its member refs in its own `data.members` array
-- (typed [{ type: "drill" | "key-drill" | ..., id: string }]). That
-- keeps the change additive: dropping this table simply removes
-- the grouping feature without touching any drill / sheet / song row.
--
-- Deploy order:
--   1. Apply to practice-prodigy-dev first, verify the app boots and
--      collections CRUD works.
--   2. Apply to practice-prodigy-prod when the feature is ready to
--      ship (Slice I complete).
--
-- After applying, regenerate database.types.ts so `collections` shows
-- up in the typed table list.
-- =====================================================================

select public.create_syncable_collection_table('collections');

comment on table public.collections is
  'Cross-module groupings created by the user (Slice I). Members are '
  'stored inside data.members as [{ type, id }] refs into the drill / '
  'sheet / song libraries. Additive schema — dropping this table only '
  'removes the grouping feature.';
