-- User-level library data that's shared across all of a user's routines.
-- Started with break_activities (custom rest-period activities the user has
-- created in one routine and wants to reuse across others). Future user-level
-- collections (favorite scale lists, ear-training presets, etc.) can land in
-- additional jsonb columns here without further migrations.

alter table public.profiles
  add column if not exists break_activities jsonb not null default '[]'::jsonb;
-- Constrain to a JSON array so callers can rely on the shape.
alter table public.profiles
  drop constraint if exists profiles_break_activities_is_array;
alter table public.profiles
  add constraint profiles_break_activities_is_array
  check (jsonb_typeof(break_activities) = 'array');
