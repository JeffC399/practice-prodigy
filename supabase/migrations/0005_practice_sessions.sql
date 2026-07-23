-- Per-routine practice session log. One row per "run" of a routine. While
-- ended_at is null the row represents an in-progress (resumable) session.
-- Per-block detail lives in blocks_state (jsonb array, one entry per block
-- the user has touched). The schema is intentionally permissive so future
-- per-rep telemetry can land without a migration.

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Per-block detail. Each entry shape (TS-validated client-side):
  --   { block_id: string, status: 'completed' | 'skipped' | 'in_progress',
  --     duration_seconds: number, ladder_step?: number, reps_completed?: number }
  blocks_state jsonb not null default '[]'::jsonb,
  -- Resume cursor — which block + rep was active when the user last touched
  -- this session. Used to render "Resume \"X\" — block N of M" on the landing.
  current_block_index integer not null default 0,
  current_rep integer not null default 0,
  created_at timestamptz not null default now(),

  constraint practice_sessions_blocks_state_is_array
    check (jsonb_typeof(blocks_state) = 'array')
);
-- Landing page reads the active (ended_at IS NULL) session per user; index
-- the common query path.
create index if not exists practice_sessions_active_idx
  on public.practice_sessions (user_id, ended_at)
  where ended_at is null;
-- Per-routine history (for future analytics, e.g. "this routine averages X min").
create index if not exists practice_sessions_routine_idx
  on public.practice_sessions (user_id, routine_id, started_at desc);
alter table public.practice_sessions enable row level security;
create policy "Sessions are viewable by their owner"
  on public.practice_sessions
  for select
  using (auth.uid() = user_id);
create policy "Users can insert their own sessions"
  on public.practice_sessions
  for insert
  with check (auth.uid() = user_id);
create policy "Users can update their own sessions"
  on public.practice_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users can delete their own sessions"
  on public.practice_sessions
  for delete
  using (auth.uid() = user_id);
