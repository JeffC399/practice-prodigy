-- Per-user practice defaults + per-instrument fret counts.
--
-- `practice_defaults` is a single jsonb blob holding the user's preferred
-- defaults for new scale/arpeggio blocks (display mode, root display, fret
-- range, subdivision, anticipation settings, etc.). Validated by Zod on read
-- — same pattern as `break_activities`. Keeping it as a single jsonb column
-- lets us evolve the shape without DB migrations every time we add a setting.
--
-- `guitar_fret_count` / `bass_fret_count` are dedicated columns because they
-- have real numeric constraints we want enforced at the DB level — they bound
-- every fretRange the user can pick on either instrument.

alter table public.profiles
  add column if not exists practice_defaults jsonb not null default '{}'::jsonb,
  add column if not exists guitar_fret_count smallint not null default 24
    check (guitar_fret_count between 18 and 27),
  add column if not exists bass_fret_count smallint not null default 24
    check (bass_fret_count between 18 and 24);
-- Constrain practice_defaults to a JSON object so callers can rely on the
-- shape (no top-level arrays / scalars).
alter table public.profiles
  drop constraint if exists profiles_practice_defaults_is_object;
alter table public.profiles
  add constraint profiles_practice_defaults_is_object
  check (jsonb_typeof(practice_defaults) = 'object');
