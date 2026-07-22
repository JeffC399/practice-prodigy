# My Practice — Build Plan

> Slice-by-slice, phase-by-phase implementation plan for the My Practice v1 flagship. Companion to [`ROUTINE-DESIGN.md`](./ROUTINE-DESIGN.md) which defines the design target.

**Plan status:** v1 — 2026-07-22
**Design source:** ROUTINE-DESIGN.md v0.2 flagship
**Total estimated effort:** ~5–6 months across 8 slices (extended by ~1–2 weeks in ROUTINE-DESIGN.md v0.3 for self-rated proficiency levels, ~1 week in v0.4 for methodology-per-item + Routine Overview, and ~1 day in v0.5 for methodology scoping; see per-slice notes for where the work lands)
**Delivery model:** feature-flagged behind `NEXT_PUBLIC_MY_PRACTICE_ENABLED`; the module ships to production incrementally as each slice completes; dogfooded internally before public flip

---

## 0. How To Use This Doc

Each slice below is a **buildable unit of scope** with:

- **Goal** — one-sentence intent
- **Prerequisites** — what must be true before starting
- **Success criteria** — how we know the slice is done
- **Phases** — sequential sub-slices with concrete deliverables (each phase → one commit / one PR / one deploy)
- **New files** — files created during the slice
- **Modified files** — existing files that get changes
- **Data model changes** — new stores, migrations, cloud-sync tables
- **Risks + mitigations** — top risks specific to this slice
- **Rollout notes** — how it ships safely

Phases within a slice are numbered by slice letter + phase index (**A.1, A.2, B.1**, etc.) to keep the plan stable. When implemented, each phase gets assigned a global Phase-N number (Phase 70+ continuing the app's sequential numbering).

The interior order of phases within a slice is flexible — a phase can be reordered or subdivided during implementation. **The slice boundaries are the commitment.** Each slice ends with a merge to `main` and a Vercel deploy behind the feature flag.

---

## 1. Prerequisites — Before Slice A Starts

**Design + approval:**
- [ ] ROUTINE-DESIGN.md v0.2 reviewed by user, any change requests addressed
- [ ] This build plan reviewed by user, sequencing agreed
- [ ] User confirms scope (all 7 capabilities in v1) is still what they want

**Platform:**
- [ ] Supabase project created (dev + prod projects; dev auto-resets weekly)
- [ ] Vercel project already exists (yes ✓)
- [ ] Environment variable convention agreed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only for admin ops)
- [ ] Feature flag `NEXT_PUBLIC_MY_PRACTICE_ENABLED` added to Vercel env (defaults to `"false"` in prod, `"true"` in dev/preview)

**Content authoring (parallel track — can start immediately, no code dependency):**
- [ ] Draft the 6–8 methodology articles (draft first, review second)
- [ ] Draft the 6–8 methodology templates (routine JSON)
- [ ] Draft starter routines (used in onboarding step 3)

**No blockers on existing modules** — every existing module keeps working exactly as it does today until Slice A introduces the session tracker. Session tracking is additive; it does not modify existing module behavior.

---

## 2. Slice A — Foundation

**Duration:** ~3 weeks (10–14 phases)
**Slice goal:** ship the platform substrate that every subsequent slice depends on. Nothing user-facing yet — this is pipe-laying. At slice end, we have cloud sync working, session tracking recording data, and the empty My Practice module shell rendering at `/my-practice`.

**Prerequisites:** §1 complete.

### 2.1 Success criteria

- Users can sign in with email magic link OR Google OR Apple.
- Sign-in creates a Supabase user + a corresponding `profile` row.
- On sign-in on a new device, sync pulls the user's existing state (drills, sheets, prefs) down.
- Users can sign out.
- Anonymous users still get full local-only functionality; a "Sign in to sync" chip appears in the header.
- Every drilling module (Arpeggios, KS, Scales, Metronome, LSB playback) reports its practice time to a central session tracker.
- Session tracker persists sessions to cloud (Supabase) + local (Zustand persist).
- 5-minute inactivity auto-ends sessions.
- `/my-practice` route renders a stub page ("Coming soon — Slice B") behind the feature flag.

### 2.2 Phase breakdown

| Phase | Deliverable | Est. |
|---|---|---|
| **A.1** | Supabase client wiring + auth surface | 2d |
| **A.2** | Auth UI (sign-in / sign-out / account chip in header) | 2d |
| **A.3** | Sync layer: local-first with cloud-write background push (generic per-store) | 3d |
| **A.4** | Migration prompt on first sign-in (existing local data → cloud) | 1d |
| **A.5** | Sync wiring for existing stores: drills, sheets, prefs, custom patterns, key drills, scale drills, LSB sheets | 3d |
| **A.6** | Session tracker store (`useSessionTracker`) + inactivity detection | 2d |
| **A.7** | Session tracker wire-up in Arpeggios drill session | 1d |
| **A.8** | Session tracker wire-up in Key Sequencer, Scale Driller, Metronome, LSB playback | 2d |
| **A.9** | Category concept + module-default category tags | 1d |
| **A.10** | Per-saved-item category override (small edit UI in each save-drill form) | 2d |
| **A.11** | `/my-practice` route stub + feature flag gating + registry promotion | 1d |
| **A.12** | Cloud sync for sessions table + retention / delete API | 2d |
| **A.13** | E2E test: sign in on device 1, add drill, sign in device 2, drill appears | 1d |
| **A.14** | **Proficiency data model** — `ProficiencyLevel` + `CategoryLevel` types; `levels` field on `profiles` table; `SessionCategoryFeedback` type; `category_feedback` column on `practice_sessions` table (v0.3) | 1d |
| **A.15** | Slice A polish + docs + deploy behind flag | 1d |

### 2.3 New files

```
src/lib/supabase/
  client.ts           - Supabase browser client (uses NEXT_PUBLIC_ vars)
  server.ts           - Server-side admin client (service role)
  auth.ts             - Sign-in / sign-out / session helpers

src/lib/sync/
  sync-engine.ts      - Generic local-first + cloud-write engine
  sync-store.ts       - Registration of syncable stores
  conflict-resolver.ts - Last-write-wins per entity

src/lib/tracking/
  session-tracker.ts  - Central store, session start/end/inactivity
  category-defaults.ts - Per-module default category map

src/lib/practice/
  types.ts            - PracticeSession + SessionItem + CategoryId
  categories.ts       - The 10 built-in categories + user-defined type

src/components/shell/
  account-menu.tsx    - Sign-in status chip + dropdown in header

src/app/api/auth/
  callback/route.ts   - OAuth callback handler

src/app/my-practice/
  page.tsx            - Feature-flagged stub page
```

### 2.4 Modified files

```
src/components/shell/site-header.tsx     - Add account chip
src/lib/state/user-prefs.ts              - Add syncable wrapper
src/lib/state/drills-library.ts          - Wrap in sync-engine
src/lib/key-sequencer/library-store.ts   - Wrap in sync-engine
src/lib/scale-driller/library-store.ts   - Wrap in sync-engine
src/lib/state/sheets-library.ts          - Wrap in sync-engine
src/lib/state/custom-patterns.ts         - Wrap in sync-engine
src/lib/audio/metronome.ts               - Emit tracker events (start/stop)
src/app/practice/session/page.tsx        - Emit tracker events
src/app/practice/keys/session/page.tsx   - Emit tracker events
src/app/practice/scales/session/page.tsx - Emit tracker events
src/app/metronome/page.tsx               - Emit tracker events
src/app/sheets/[id]/page.tsx             - Emit tracker events on playback
src/lib/modules/registry.ts              - Promote my-practice to bucket: "now"
```

### 2.5 Data model — Supabase schema

```sql
-- Users are provisioned via Supabase Auth (auth.users table).
-- Application data lives in public schema, one row per user.

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  depth text not null default 'standard',       -- 'standard' | 'deep'
  instrument text,
  skill_level text,
  primary_goals jsonb default '[]'::jsonb,
  focus_areas jsonb default '[]'::jsonb,
  typical_session_minutes integer,
  practice_frequency text,
  genres jsonb default '[]'::jsonb,
  weaknesses jsonb default '[]'::jsonb,
  repertoire_priorities jsonb default '[]'::jsonb,
  preferred_methods jsonb default '[]'::jsonb,
  ai_provider text,
  ai_model text,
  ai_agency text not null default 'passive',    -- 'passive' | 'active'
  ai_key_encrypted text,                        -- encrypted-at-rest AI key
  custom_categories jsonb default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table practice_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  routine_execution_id uuid,                    -- FK once routines table lands (Slice B)
  items jsonb not null default '[]'::jsonb,     -- SessionItem[] inline for now
  created_at timestamptz not null default now()
);

create index on practice_sessions (user_id, started_at desc);

-- Row-Level Security (RLS): users can only read/write their own rows.
alter table profiles enable row level security;
create policy "own profile" on profiles for all using (auth.uid() = user_id);

alter table practice_sessions enable row level security;
create policy "own sessions" on practice_sessions for all using (auth.uid() = user_id);

-- Existing entities (drills / sheets / prefs) each get their own table with
-- the same shape:
--   id uuid, user_id uuid, data jsonb, updated_at timestamptz
-- Data lives in jsonb to avoid a schema-per-store treadmill. Migrations happen
-- via the app's TypeScript layer, not SQL.
```

### 2.6 Risks + mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing users lose local data on migration | Very high | Migration is opt-in with a preview screen ("we'll copy these 8 drills"); the local copy stays until user confirms |
| Sync race conditions on multi-device | Medium | Last-write-wins with timestamps; visible "syncing / synced" chip so the user sees state |
| Session tracker fires on Tuner use | Low | Tuner explicitly excluded from tracker wire-up |
| Supabase RLS misconfigured — user sees another user's data | Very high | Every table has explicit RLS policies; test suite verifies policies before ship |
| Sign-in flow breaks on iOS PWA installed app | Medium | Test explicitly on iOS Safari + PWA before slice ship |
| Encryption key management for AI keys | Medium | Server-side encryption with Supabase Vault OR simple client-side encryption using the user's session — decide during A.1 |

### 2.7 Rollout notes

- Feature flag `NEXT_PUBLIC_MY_PRACTICE_ENABLED` defaults `false` in production.
- Slice A ships with the flag `true` only in preview deployments.
- Anonymous users see zero change in behavior — the account chip shows "Sign in to sync" but sign-in is optional.
- Session tracker runs silently in the background even before My Practice UI exists; data accumulates so Reports (Slice D) has real history to show on day one.

---

## 3. Slice B — Manual Routines + Player

**Duration:** ~3 weeks (10–12 phases)
**Slice goal:** ship a working manual routine builder + full-screen practice mode + rest items. At slice end, users can build a routine, save it, run it, resume it, and see an end-of-routine summary. No AI, no reports, no songs, no methodology — just the core Do loop.

**Prerequisites:** Slice A shipped (auth, sync, session tracker all live).

### 3.1 Success criteria

- User can navigate `/my-practice` and see the Routines tab (default landing).
- User can click **+ Build routine**, name it, add items via a type picker, drag-reorder, save.
- Item types supported: drill, key-drill, scale-drill, metronome, leadsheet, rest, custom.
- Item types NOT supported yet: song (Slice C), ear-training (future module).
- User can launch a routine → enters full-screen practice mode → walks through items → sees end-of-routine summary.
- Drill items take over the drill's own screen with a "Routine: item 3 of 7" chip in the top-right.
- Space bar starts/stops the current item's play surface (same shortcut convention).
- Session tracker attributes routine execution to a `PracticeSession` with `routineExecutionId` set.
- Closing browser mid-routine and reopening surfaces a "Resume routine?" prompt.
- All routines sync via Slice-A sync engine.

### 3.2 Phase breakdown

| Phase | Deliverable | Est. |
|---|---|---|
| **B.1** | `useRoutinesLibrary` store + Routine + RoutineItem types + sync wiring | 2d |
| **B.2** | My Practice module shell: 5 tabs sidebar (Routines default; others stubbed) | 2d |
| **B.3** | Routines tab: routine cards + empty state + Build button | 2d |
| **B.4** | Routine builder: name + item list + save/discard/edit-mode | 2d |
| **B.5** | Item type picker + composer surface (per-type forms) — drill / key-drill / scale-drill | 3d |
| **B.6** | Item composer for metronome + leadsheet + custom + rest | 2d |
| **B.7** | Drag-reorder items (dnd-kit) | 1d |
| **B.8** | Live total-time estimate + category time breakdown per routine | 1d |
| **B.9** | Full-screen practice mode component + routine player logic | 3d |
| **B.10** | Take-over integration in each drilling module (routine-mode flag + chip) | 3d |
| **B.11** | Resume-mid-routine + end-of-routine summary + persistence | 2d |
| **B.12** | **End-of-routine category vibe-check UI** — single-tap per-category "How'd it go?" (Rough/Struggled/OK/Solid/Great) inside the summary modal; skippable; feeds `SessionCategoryFeedback` (v0.3) | 1d |
| **B.13** | **Methodology field in item composer** — dropdown filtered to `per-item` + `either` scoped methodologies (v0.5); smart default per category (Technique → Slow Practice, Repertoire → Chunking, etc.); "?" AI-suggest icon (v0.4) | 1d |
| **B.13.5** | **Routine-level methodology field** — dropdown in builder next to Name field, filtered to `per-routine` + `either` scoped methodologies (Interleaved, Pomodoro, Spaced Repetition, Deliberate Practice) (v0.5) | 0.5d |
| **B.14** | **Routine Overview screen** — pre-save/pre-run gate; header shows routine-level methodology (v0.5); item table (order · label · category · method · duration); category mix chip; methodology mix chip aggregating from BOTH routine + item scopes (v0.5); smart default routine name; [Edit items] / [Save without running] / [Save & Run] actions (v0.4) | 3d |
| **B.15** | Sound cues + auto-advance + keyboard shortcuts | 1d |
| **B.16** | Slice B polish + shortcuts-overlay registrations + tests + deploy | 1d |

### 3.3 New files

```
src/lib/practice/
  routine-types.ts       - Routine + RoutineItem + template types
  routines-library.ts    - Zustand store (synced)
  routine-executor.ts    - Player logic (item lifecycle, timers, completion)

src/lib/practice/items/
  drill-launcher.ts
  key-drill-launcher.ts
  scale-drill-launcher.ts
  metronome-launcher.ts
  leadsheet-launcher.ts
  custom-launcher.ts
  rest-launcher.ts

src/components/practice/
  routine-card.tsx
  routine-builder.tsx
  item-composer/
    drill-item-composer.tsx
    metronome-item-composer.tsx
    rest-item-composer.tsx
    custom-item-composer.tsx
    ... (one per type)
  item-chip.tsx
  full-screen-player.tsx
  routine-bar.tsx        - Fallback bar mode
  end-of-routine-summary.tsx

src/app/my-practice/
  page.tsx               - Routines tab (default)
  execute/[routineId]/
    page.tsx             - Full-screen practice mode entry point
```

### 3.4 Modified files

```
src/app/practice/session/page.tsx       - Support routineMode query param + chip
src/app/practice/keys/session/page.tsx  - Support routineMode
src/app/practice/scales/session/page.tsx - Support routineMode
src/app/metronome/page.tsx               - Support routineMode
src/app/sheets/[id]/page.tsx             - Support routineMode
src/components/shell/app-shortcuts-overlay.tsx - Add My Practice + player shortcuts
src/lib/modules/registry.ts              - My Practice becomes fully live (not stub)
```

### 3.5 Data model additions

```ts
// See ROUTINE-DESIGN.md §12 for the authoritative shape.
// Key additions in Slice B:
type Routine = { ... }
type RoutineExecution = { ... }
type RoutineItem = ... discriminated union with 7 types (drill, key-drill,
  scale-drill, metronome, leadsheet, rest, custom)
```

Cloud table added:

```sql
create table routines (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  items jsonb not null,
  source text not null default 'manual',
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz
);
create index on routines (user_id, last_run_at desc nulls last, updated_at desc);
alter table routines enable row level security;
create policy "own routines" on routines for all using (auth.uid() = user_id);
```

### 3.6 Risks + mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Full-screen mode breaks iOS Safari fullscreen quirks | Medium | Test on real iOS device early; use `document.body` overflow-hidden approach as fallback, not the Fullscreen API |
| Drill take-over breaks existing drill UX for non-routine users | High | The routineMode flag is opt-in via query param; existing drill flows have zero code path changes when the flag is absent |
| Drag-reorder is buggy on touch | Medium | Use dnd-kit (already vetted, good touch support); test on tablet |
| Auto-advance fires when user is mid-drill | High | Auto-advance only when drill signals completion OR user explicitly hits Skip; never on wall-clock timeout for drill items (they can run longer than estimated) |
| Routine execution state confuses "resume drill" (existing feature) | Medium | Precedence rule: if a routine execution is active AND a drill resume exists, the drill resume is IN the routine — resume by resuming the routine; drill resume alone is only for ad-hoc drills |

### 3.7 Rollout notes

- Slice B ships behind the same feature flag as Slice A.
- Slice B is the earliest point at which a user can meaningfully USE the module — internal dogfood begins here.
- If dogfood reveals big UX issues, iterate on Slice B before starting Slice C.

---

## 4. Slice C — Songs Library

**Duration:** ~2 weeks (6–8 phases)
**Slice goal:** ship the first-class Repertoire concept. At slice end, users can add songs they're learning, launch a song from a routine, and see per-song practice time.

**Prerequisites:** Slice B shipped.

### 4.1 Success criteria

- Songs tab in My Practice renders a song list.
- User can add songs (title required; artist, key, time sig, genre, status, notes, target date all optional).
- Users can import songs from existing lead sheets in one click.
- Song can be linked to an existing lead sheet (opens LSB when practiced).
- Song can be added as a routine item (`type: "song"`).
- Practicing a song (via routine or direct song click) accrues time to `song.totalPracticeSeconds`.
- Song status can be changed manually (learning / polishing / performance-ready / retired).
- All songs sync via Slice-A sync engine.

### 4.2 Phase breakdown

| Phase | Deliverable | Est. |
|---|---|---|
| **C.1** | `useSongsLibrary` store + Song type + sync wiring + Supabase table | 2d |
| **C.2** | Songs tab list view + filter + sort | 2d |
| **C.3** | Add / edit song form (compact modal) | 1d |
| **C.4** | Song → routine item type + composer + player-time full-screen card | 2d |
| **C.5** | Songs progress panel (last practiced, total time, days-since indicator) | 1d |
| **C.6** | Import from Lead Sheets bulk-add | 1d |
| **C.7** | Slice C polish + deploy | 1d |

### 4.3 New files

```
src/lib/practice/
  songs-library.ts       - Zustand store (synced)

src/components/practice/
  song-card.tsx
  song-form.tsx
  song-item-full-screen-card.tsx
  song-import-from-sheets.tsx
```

### 4.4 Modified files

```
src/app/my-practice/page.tsx           - Songs tab wired up
src/lib/practice/routine-types.ts      - Add SongRoutineItem to union
src/components/practice/item-composer/ - Add song-item-composer.tsx
src/lib/practice/items/                - Add song-launcher.ts
```

### 4.5 Data model additions

```sql
create table songs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text,
  song_key text,
  time_signature text,
  genre text,
  status text not null default 'learning',
  personal_notes text,
  target_performance_date date,
  lead_sheet_id uuid,                   -- refs sheets.id if linked
  total_practice_seconds integer not null default 0,
  last_practiced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on songs (user_id, last_practiced_at desc nulls last);
alter table songs enable row level security;
create policy "own songs" on songs for all using (auth.uid() = user_id);
```

### 4.6 Risks + mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Song ↔ lead sheet link becomes dangling when sheet deleted | Medium | Song keeps its own metadata; broken link just means the "Open sheet" button hides. No data loss |
| totalPracticeSeconds double-counts when song is in a routine | Medium | Session tracker attributes time once; song rollup queries SessionItems by songId, not by routine |
| Users with 50+ songs find the list unwieldy | Low | Filter + sort + search covers this. Songs library caps at ~500 before we add pagination |

---

## 5. Slice D — Reports + Tracking Dashboards

**Duration:** ~2 weeks (6–8 phases)
**Slice goal:** ship the Reports tab + header chip. At slice end, users see per-day / per-week / per-category / per-song breakdowns of their practice time.

**Prerequisites:** Slice A shipped (session tracker running for weeks by now = real data exists). Slice B + C recommended (routines + songs are the interesting units to report on) but not strictly required.

### 5.1 Success criteria

- Header chip on every page: "Today: 45m · 3-day streak" (or hidden if no practice today).
- Chip is clickable → jumps to Reports tab.
- Reports tab shows: today total, week total, streak, longest streak, category bar chart, calendar heatmap (12 weeks), daily trend line, songs progress list.
- User can switch time ranges (today / week / month / 30d / year / all-time).
- User can export current view as CSV.
- User can export current view as PDF (via `window.print` + print CSS).
- Streaks correctly handle time zones (user's local time).

### 5.2 Phase breakdown

| Phase | Deliverable | Est. |
|---|---|---|
| **D.1** | Query helpers: aggregate SessionItems by day / week / category / song | 2d |
| **D.2** | Reports tab layout: headline stats + range picker | 1d |
| **D.3** | Category bar chart (Recharts or similar lightweight library) | 1d |
| **D.4** | Calendar heatmap (custom SVG, ~200 LOC) | 2d |
| **D.5** | Daily trend line chart + 7-day rolling average overlay | 1d |
| **D.6** | Songs progress panel inside Reports (integrates with Slice C) | 1d |
| **D.7** | **Levels & progression panel** — per-category chip grid (current + target + delta), timeline of level events, recent vibe-check trend per category, [Reassess my levels] CTA (v0.3) | 2d |
| **D.8** | **Methodology mix chip** — small horizontal chip showing how the user's practice time distributed across methods over the selected range. Feeds AI insights ("You've been 90% Slow Practice this month; consider adding Interleaved for retention.") (v0.4) | 1d |
| **D.9** | Header chip + streak logic + time-zone handling | 2d |
| **D.10** | CSV + PDF export | 1d |
| **D.11** | Slice D polish + deploy | 1d |

### 5.3 New files

```
src/lib/practice/
  reports-queries.ts      - Aggregation functions over SessionItems
  streak.ts               - Streak computation with time-zone handling
  export-csv.ts
  export-pdf.ts

src/components/practice/
  reports/
    headline-stats.tsx
    category-bar-chart.tsx
    calendar-heatmap.tsx
    daily-trend-line.tsx
    songs-progress-panel.tsx
    range-picker.tsx

src/components/shell/
  practice-chip.tsx       - Header chip
```

### 5.4 Modified files

```
src/components/shell/site-header.tsx    - Add practice chip
src/app/my-practice/page.tsx            - Wire Reports tab
```

### 5.5 Risks + mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Aggregation is slow for users with 6+ months of history | Medium | Aggregate in a Web Worker for ranges > 30 days; cache results with a TTL |
| Streak breaks around midnight in the user's tz | Medium | Compute streaks in user's local tz using `toLocaleDateString('en-CA')` (YYYY-MM-DD form) |
| Heatmap looks broken on narrow viewports | Low | SVG scales with container; on very narrow screens, collapse to a horizontally-scrollable strip |
| CSV / PDF export contains PII | Low | Only exports the user's own data; no PII beyond what they entered |

---

## 6. Slice E — Methodology Library

**Duration:** ~2 weeks (5–7 phases)
**Slice goal:** ship the pedagogy layer. At slice end, users can read 6–8 methodology articles and one-click load a template routine that instantiates each method.

**Prerequisites:** Slice B shipped (need routine data model + routines-library store). Content authoring must be complete before implementation of E.4 (see §1 parallel track).

### 6.1 Success criteria

- Methodology tab renders a list of 6–8 methodology entries.
- Each entry has an article view (long-form markdown) + linked template buttons.
- User can click "Try this template" → the template loads as a fresh routine in the builder, ready to run or edit + save.
- Templates saved from a methodology carry `source: "template"` + `sourceRef: methodologyId`.
- Markdown renderer supports basic formatting: headers, lists, blockquotes, inline code, links, images (for later).
- Articles cite sources (bottom-of-article "Further reading" section).

### 6.2 Phase breakdown

| Phase | Deliverable | Est. |
|---|---|---|
| **E.1** | Methodology data model + content loading (from `src/content/methodology/`) | 1d |
| **E.2** | Methodology tab list view + entry cards | 1d |
| **E.3** | Article renderer (markdown → React with `react-markdown` + syntax highlighting) | 1d |
| **E.4** | Author 6–8 articles + review pass with user | 5d (content authoring, parallel to code) |
| **E.5** | Author 6–8 template routines + validate they run correctly | 3d |
| **E.6** | "Try this template" flow: load into builder, unsaved-state UI, save-as-my-routine | 1d |
| **E.7** | Slice E polish + deploy | 1d |

### 6.3 New files

```
src/lib/practice/
  methodology-library.ts   - Static data (loaded from src/content/methodology/)

src/content/methodology/   - Markdown files, one per methodology
  deliberate-practice.md
  interleaved-practice.md
  slow-practice.md
  pomodoro.md
  chunking.md
  spaced-repetition.md
  mental-practice.md
  slow-loop.md              - (optional 8th)

src/content/templates/     - Template routines as JSON
  deliberate-practice-45min.json
  ... (one or two per methodology)

src/components/practice/methodology/
  methodology-card.tsx
  article-view.tsx
  template-card.tsx
```

### 6.4 Data model

Methodology + templates are **static content**, not user data. They ship in the app bundle. No cloud tables.

### 6.5 Risks + mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Content authoring bottlenecks the code work | Medium | Content is a parallel track; started at prerequisites; E.4 phase is content-only |
| Articles feel dry / academic | Medium | Written in the app's confident-friendly voice; user reviews drafts before ship |
| Templates reference drills the user doesn't have | Medium | Templates only reference BUILT-IN drills (which every user has); if the user deletes a built-in drill, template load offers to restore it |
| Bundle size grows | Low | Markdown compresses well; 8 articles + 12 templates ≈ 60KB total |

---

## 7. Slice F — AI Coach

**Duration:** ~3 weeks (10–12 phases)
**Slice goal:** ship BYOK AI Coach with chat interface + Passive/Active modes.

**Prerequisites:** Slice B (routine data model, builder). Slice C (songs — the AI reads them). Slice D (reports — the AI reads session history). Slice E is not strictly required but the AI Coach's "propose a Deliberate Practice routine" answer is much better when the methodology library exists to reference.

### 7.1 Success criteria

- User can add an Anthropic or OpenAI API key in Profile tab.
- Key is stored encrypted in Supabase (server-side encryption).
- User picks a provider + model.
- User picks agency mode (Passive default, Active opt-in).
- AI Coach chat surface: shortcut buttons + free-text input + streaming responses.
- Passive mode: AI drafts routines using only existing items; suggests items the user could build if it wants something missing.
- Active mode: AI can create new drills/sheets/songs, edit routines mid-flight (with confirmation), propose profile updates (with confirmation).
- "Why this recommendation?" transparency panel on every AI-drafted routine.
- Conversation history persists per-user (last 100 conversations synced).
- AI never sends the user's data to a third party other than the chosen provider (transparent in Profile: "Your prompts + context are sent to Anthropic/OpenAI using YOUR key").

### 7.2 Phase breakdown

| Phase | Deliverable | Est. |
|---|---|---|
| **F.1** | AI key management: add / remove / test / encrypted storage | 2d |
| **F.2** | Provider integration: Anthropic SDK + OpenAI SDK wrappers | 2d |
| **F.3** | System prompt v1: Passive mode. Context assembly (profile + library + recent history + **per-category levels + targets + recent vibe-checks** for v0.3 level-aware drafting) | 3d |
| **F.4** | Chat UI: message list + streaming + shortcut buttons | 2d |
| **F.5** | Routine draft parser: extract structured Routine from AI response + show as editable draft (drafts include per-item methodology per v0.4 + routine-level methodology per v0.5) | 2d |
| **F.6** | "Why this?" transparency panel — includes level-gap explanation + recent vibe-check trend inputs (v0.3) | 1d |
| **F.7** | **AI-suggest methodology** — per-item [?] icon → server call that returns a single method for THIS item's context. Cheap (small prompt). Fills the field with the AI's pick (v0.4) | 2d |
| **F.8** | **Bulk "AI: assign methodologies to all items"** — builder button → one AI turn filling every blank methodology field on the current routine; user reviews on Overview screen (v0.4) | 1d |
| **F.9** | Conversation history persistence + resume | 1d |
| **F.10** | Active mode: tool use (create-item / edit-routine / update-profile tools) | 3d |
| **F.11** | Profile-update confirmation flow (AI proposes, user accepts/rejects) | 1d |
| **F.12** | Cost + usage indicator (per-conversation token counts, running monthly estimate) | 1d |
| **F.13** | Model picker + provider switcher UI | 1d |
| **F.14** | Slice F polish + safety review + deploy | 2d |

### 7.3 New files

```
src/lib/ai/
  keys.ts                 - Key add/remove/encrypt/decrypt
  anthropic-client.ts     - Anthropic API wrapper
  openai-client.ts        - OpenAI API wrapper
  provider.ts             - Provider-agnostic invoke() + streaming
  system-prompts.ts       - Passive vs Active system prompt templates
  context-assembly.ts     - Build context payload from profile + library + history
  routine-parser.ts       - Extract Routine from AI response (structured output)
  tools.ts                - Tool definitions for Active mode

src/components/practice/ai/
  chat-view.tsx
  message-bubble.tsx
  shortcut-buttons.tsx
  routine-draft-preview.tsx
  why-panel.tsx
  key-form.tsx
  usage-indicator.tsx

src/app/api/ai/
  proxy/route.ts          - Optional server-side proxy (see §7.4)
```

### 7.4 Server-side vs client-side calls (design detail)

Two paths considered:

- **Client-side direct-to-provider** — user's key never touches our server. Best privacy. Requires each provider to allow CORS from browser (both Anthropic and OpenAI do).
- **Server-side proxy** — key hits our server briefly; server calls provider on user's behalf. Slightly less private; enables features like server-side rate limiting + prompt validation.

**Decision (proposed):** Client-side by default. Server-side proxy behind a flag for users who want server-side rate limiting. Revisit at F.1.

### 7.5 Risks + mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AI hallucinates non-existent drills / references | High | Passive mode: AI is only shown the actual library JSON, can't invent references. Response parser validates all IDs before showing draft. Rejected drafts trigger a retry with error feedback |
| Active mode's tool calls fail or misbehave | High | Every tool call requires user confirmation before applying. Undo affordance for 5 minutes after any AI-triggered change |
| Users burn through their AI credits accidentally | Medium | Per-conversation token count visible; monthly estimate; warning at 80% of user-set budget |
| AI keys leaked via logs or errors | Very high | Keys never in URLs; masked in every UI field; server-side proxy scrubs from logs; RLS on Supabase table so keys are per-user-only |
| Provider outage breaks the module | Medium | AI is optional. Non-AI paths (manual + templates) keep working. Chip in AI Coach shows provider status |
| Tone of AI voice doesn't match app's confident-friendly voice | Medium | System prompt sets voice explicitly; test outputs during F.3 with real prompts |

### 7.6 Rollout notes

- AI features gated behind BOTH the feature flag AND the user having added a key.
- All AI-drafted routines have a "Made by AI" tag until the user saves them as their own.

---

## 8. Slice G — Onboarding + Polish

**Duration:** ~1–2 weeks (5–7 phases)
**Slice goal:** ship the 3-step onboarding wizard + accessibility + empty states + final polish across all tabs.

**Prerequisites:** Slices A–F shipped. Real content exists (routines, songs, methodology, sessions).

### 8.1 Success criteria

- First-time visitor to `/my-practice` sees the 3-step wizard (welcome → profile depth → try starter).
- Returning users skip the wizard.
- Profile depth choice is respected (Standard shows 5 fields; Deep shows 10+ with progressive-enrichment prompts).
- Every tab has a polished empty state + onboarding hint.
- Progressive-enrichment prompts fire once per week per unfilled Deep field.
- Accessibility pass: focus rings, aria-labels, keyboard-only navigation, screen-reader tested.
- Mobile responsive across all 5 tabs.
- Reduce-motion setting is respected in player animations.

### 8.2 Phase breakdown

| Phase | Deliverable | Est. |
|---|---|---|
| **G.1** | 3-step onboarding wizard (welcome / profile picker / starter routine) — includes optional **Step 2.5: rate current levels + set targets per category** (v0.3) | 2d |
| **G.2** | Progressive-enrichment prompt system (once per week per unfilled field) + **quarterly "reassess your levels" nudge** (v0.3) | 1d |
| **G.3** | Empty states + OnboardingCard for each of the 5 tabs | 1d |
| **G.4** | Accessibility pass across My Practice | 2d |
| **G.5** | Mobile responsive audit + fixes | 2d |
| **G.6** | Copy polish across every screen (voice consistency) | 1d |
| **G.7** | Slice G deploy + final integration testing | 1d |

### 8.3 Modified files

Touches almost every My Practice file for polish + a11y. New files:

```
src/components/practice/onboarding/
  wizard.tsx
  welcome-step.tsx
  profile-depth-step.tsx
  starter-routine-step.tsx
  progressive-enrichment-prompt.tsx
```

### 8.4 Risks + mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Wizard feels forced | Medium | Every step is skippable; wizard remembers dismiss state |
| Progressive prompts feel spammy | Medium | Max one per week; user can disable in Profile → Notifications |
| Mobile responsive breaks the full-screen player | High | Test on real iOS + Android early in G.5 |

---

## 9. Slice H — Ship

**Duration:** ~1 week (3–5 phases)
**Slice goal:** flip the feature flag to on in production; announce.

**Prerequisites:** Slices A–G shipped + dogfood period (2+ weeks of user + close friends testing).

### 9.1 Success criteria

- Feature flag `NEXT_PUBLIC_MY_PRACTICE_ENABLED` set to `true` in production.
- Module Switcher in the header shows My Practice as `bucket: "now"` / `status: "live"`.
- Announcement in "What's new" modal on first visit after launch.
- Roadmap page reflects My Practice as a live module.
- Tester feedback from dogfood period addressed OR filed as follow-ups.

### 9.2 Phase breakdown

| Phase | Deliverable | Est. |
|---|---|---|
| **H.1** | Dogfood punch-list from 2-week internal test → fix top 10 | 3d |
| **H.2** | Update PROJECT-DESIGN.md, IDEAS.md, module registry, README | 1d |
| **H.3** | "What's new" release-notes entry + module-switcher promotion | 1d |
| **H.4** | Feature flag flip: production ON | 1d |
| **H.5** | Post-launch monitoring: watch error rates, sign-in success, AI usage | ongoing |

### 9.3 Rollout notes

- Cut a `pre-my-practice` git tag before H.4 so we can point-in-time revert.
- Feature flag defaults to `true`; anyone reporting an issue can be told to add `?disable=my-practice` to bypass while we investigate.

---

## 10. Cross-Cutting Concerns

### 10.1 Testing strategy

- **Unit tests**: pure logic (routine-executor, streak calc, aggregation queries, AI response parser). Vitest.
- **Integration tests**: session tracker with a mocked module; routine player with a mocked drill launcher; sync engine with a mocked Supabase.
- **E2E tests**: Playwright — sign in, add drill, sign in on second browser, verify sync; build a routine, run it end-to-end. One E2E per slice's success criteria.
- **Manual QA**: dogfood by user + friends throughout Slices B onward.

### 10.2 Migration + data safety

- **Every sync operation is idempotent**. Retrying a failed sync doesn't duplicate data.
- **Local-first**: users can't lose data by going offline. Cloud is the backup.
- **Delete API**: user can delete their account + all data via Profile → Danger Zone → Delete account. Supabase handles cascade delete via `on delete cascade`.
- **Export API**: user can download a JSON bundle of all their data anytime (extends the existing Data Export feature).

### 10.3 Rollback strategy

- Every slice's deploy is behind a feature flag. Flipping the flag off returns the module to its previous state without a redeploy.
- Cloud tables added per slice are additive; rolling back a slice doesn't require dropping tables (they just go unused).
- Data migration for existing users (Slice A.4) is opt-in and non-destructive.

### 10.4 Observability

- Vercel Analytics for page views + Web Vitals.
- Simple event log in Supabase for high-signal events: sign-in success/fail, routine start/complete/skip, AI Coach invocation, feature-flag hits. Kept for 90 days.
- Error tracking via Vercel's built-in error reporting (or Sentry if we outgrow it).

### 10.5 Cost management

- Supabase free tier covers ~50k monthly active users + 500MB DB + 1GB bandwidth. Sufficient for the first 6+ months.
- Vercel free tier covers current traffic; upgrade if My Practice launch drives spikes.
- AI is BYOK; the app itself has no per-user AI cost.

---

## 11. Risk Register (Top 10 Across Slices)

| # | Risk | Slice | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Existing users lose local data on cloud migration | A | Very high | Opt-in preview + local copy retained |
| 2 | Supabase RLS misconfigured — cross-user data leak | A | Very high | Explicit policies + test suite |
| 3 | AI keys leaked via logs | F | Very high | Masked everywhere; server-side scrubs; RLS enforced |
| 4 | Drill take-over breaks existing drill UX | B | High | routineMode is opt-in flag; existing paths unchanged |
| 5 | AI hallucinates non-existent items | F | High | Response parser validates all IDs before showing |
| 6 | Content authoring bottlenecks Slice E | E | Medium | Parallel track from day 1 |
| 7 | Full-screen mode breaks iOS Safari | B | Medium | Real-device testing early |
| 8 | Streak calc breaks around midnight | D | Medium | User-local-tz computation |
| 9 | Sign-in flow breaks on installed iOS PWA | A | Medium | PWA-specific test before ship |
| 10 | Feature flag left off in prod after launch | H | Medium | Post-launch checklist includes flag verification |

---

## 12. Milestone Gates + Named Releases

| Milestone | Trigger | Named release |
|---|---|---|
| **α (alpha)** | Slice B shipped | Internal dogfood only; user + close friends |
| **β (beta)** | Slice F shipped | Public beta signup; invite-only; feature flag on for invitees |
| **GA** | Slice H shipped | Public launch; feature flag on for everyone |

Named releases are marketing beats. Each has a "What's new" modal entry + roadmap update.

---

## 13. Change Log

| Date | Change |
|---|---|
| 2026-07-22 | v1 — Initial build plan. 8 slices, ~4–6 months total. Companion to ROUTINE-DESIGN.md v0.2. |
| 2026-07-22 | v1.1 — Absorbed the v0.3 self-rated proficiency system (per user request 2026-07-22). Added phase A.14 (data model), B.12 (end-of-routine vibe-check UI), D.7 (levels & progression panel in Reports), F.3 + F.6 (level-aware AI Coach context), G.1 (wizard step 2.5) + G.2 (quarterly reassessment nudge). Total estimate extended by ~1–2 weeks (~5–6 months). Automated grading + adaptive progression + assessment routines + curricula formally deferred to v2 — see MY-PRACTICE-V2-BACKLOG.md §1. |
| 2026-07-22 | v1.3 — Absorbed the v0.5 methodology-scoping additions. Interleaved / Pomodoro / Spaced Repetition rotation are structural methodologies that belong at the routine level, not per-item. Data model gains `MethodologyEntry.scope` field (per-item / per-routine / either) and `Routine.methodologyId` field. New sub-phase B.13.5 (routine-level methodology field in builder). B.13 note updated to filter item composer dropdown by scope. B.14 (Routine Overview) header now shows routine-level methodology; methodology mix chip aggregates both scopes. F.5 (AI draft parser) reads both scopes. ~1 day extra. |
| 2026-07-22 | v1.2 — Absorbed the v0.4 methodology-per-item + Routine Overview additions. New phases: B.13 (methodology field in item composer w/ smart defaults + "?" AI-suggest), B.14 (Routine Overview screen — 3d, biggest single new phase), D.8 (methodology mix chip in Reports), F.7 (per-item AI-suggest methodology tool call), F.8 (bulk "AI: assign methodologies" builder button). F.n phases 8→14 renumbered by +2. Total estimate extended by ~1 week additional. Level identifiers changed from stage names to numeric (Level 1–5); descriptor is now a sub-label. RoutineItem gains optional `methodologyId` field. |
