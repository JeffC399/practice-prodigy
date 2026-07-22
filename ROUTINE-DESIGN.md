# My Practice — Design (v0.4 Flagship)

> The flagship module. Turns Practice Prodigy from a collection of drilling tools into the app a serious musician uses every day. Composes every other module into structured practice sessions; tracks all practice time; provides AI coaching and pedagogical guidance.

**Doc status:** v0.4 flagship design — 2026-07-22
**Target ship:** v1 milestone (not v2 — promoted to flagship per 2026-07-14 interview)
**Estimated build:** ~5–6 months across sequenced slices (see §16 build plan reference; extended by ~1–2 weeks in v0.3 for self-rated proficiency and ~1 week in v0.4 for methodology-per-item + Routine Overview)

**Supersedes:** v0.3 (also 2026-07-22) which added the self-rated proficiency system. v0.4 adds two changes from user feedback: (1) proficiency levels are now numeric (Level 1–5) with descriptors as sub-labels; (2) methodology becomes an optional per-item property (a single routine can weave multiple methods) with a new Routine Overview screen as the pre-save gate.

---

## 1. Purpose & Positioning

The drilling modules (Arpeggios, Metronome, Tuner, Lead Sheets, Key Sequencer, Scale Driller, future Ear Training) are **tools**. **My Practice** is the **workflow + tracking + coaching layer** that:

- **Composes tools into routines** — "build a 45-minute session that opens with a metronome warmup, runs three arpeggio drills, includes an ear-training block, and ends with sight-reading."
- **Tracks all practice time** — every module reports its practice time to the central tracker. Reports aggregate by category, day, week, month, all-time.
- **Coaches** — an AI Coach (BYOK, user's own key) drafts personalized routines based on the user's profile, goals, and recent practice history.
- **Teaches** — a methodology library with articles + linked templates for well-regarded practice frameworks (Deliberate Practice, Interleaved Practice, Slow Practice, Pomodoro, Chunking, Spaced Repetition, Mental Practice).
- **Manages repertoire** — a first-class Songs library where each piece the user is learning has status, notes, and tracked practice time.

### Strategic wins

1. **Validates the platform thesis.** Practice Prodigy is not "a bunch of tools" — it's a platform where tools compose. My Practice is the composition layer.
2. **Serious hobbyist retention.** A drill tool without tracking is disposable; a tracker with drills is a habit.
3. **Differentiator.** Tonal Energy, Soundbrenner, Yousician, Practice+, MuseScore — none of them combines drilling tools + AI coach + methodology library + cross-tool routine builder + time tracking. This is genuinely category-defining.
4. **Substrate for future features.** Teacher mode = routine assignment + review. Community = shared routines. Both build on top of the routine data model without redesign.

---

## 2. Primary User

**Serious adult hobbyist.** Plays for love, not livelihood. Works a day job. Practices 30–90 min most days. Values structure and progress. Comfortable with technology but doesn't want to fight it. Appreciates good pedagogy but doesn't need hand-holding.

This matches the Bass Arpeggios voicing already shipped: jazz-friendly but broadly applicable, pro-tool positioning at consumer-app accessibility, understated polish, respect for the user's musical intelligence.

Secondary personas (music students, working pros, teachers) MUST NOT drive design; they may benefit from the flagship shape as a byproduct.

---

## 3. Core Concepts

### 3.1 Nested abstractions

```
PracticeProfile          — who the user is + what they're working toward
  └─ (optional) shapes AI Coach recommendations

Routine                  — a named list of practice items ("Tuesday warmup")
  └─ RoutineItem[]       — each step (an activity + optional tool reference)
       └─ launches the appropriate module experience

Song                     — a piece the user is learning (repertoire library)
  └─ optional Lead Sheet — for pieces the user has authored a chart for

PracticeSession          — one continuous stretch of practice
  └─ SessionItem[]       — each thing practiced during that session
                            (either a RoutineItem played, or an
                            ad-hoc module use)

MethodologyEntry         — an article + one or more linked templates
                          teaching a well-regarded practice method
```

### 3.2 Item = activity + tool

Every RoutineItem carries BOTH:

- **Activity / category** — one of the 10 built-in categories (or a user-defined extra). This is what the user thinks in ("today I want to work on repertoire").
- **Tool reference** — optionally points to a specific drill / sheet / scale-drill / metronome preset / song. May be `null` for free-form activities ("practice repertoire for 15 min with no specific tool").

Both fields are first-class. Reports aggregate by category. AI Coach thinks in activities. Player launches tools.

### 3.3 Sessions are auto-tracked

A **PracticeSession** starts whenever the user uses any drilling / practicing surface (Arpeggios drill, Metronome, Scale Driller, Key Sequencer, sheet playback, or a My Practice routine) and ends after 5 minutes of inactivity. All practice time counts — routines AND ad-hoc.

Each SessionItem records:
- Which module + which specific tool (drill id, sheet id, etc.)
- Which category (from module default or per-item override)
- Actual seconds spent
- Whether it was part of a routine (routineItemId reference) or ad-hoc

Reports aggregate SessionItems across time ranges + categories.

### 3.4 Three creation paths for a routine

Every user-facing routine builder supports:

1. **Manual authoring** — user builds from scratch, orders items, saves + names, reuses.
2. **AI Coach** — AI drafts personalized routines based on the user's profile + recent history + a chat prompt (with quick-shortcut buttons for common asks).
3. **Templates** — user picks a methodology-based template, optionally tweaks, saves as their own.

All three save into the same "Your Routines" library and behave identically thereafter.

---

## 4. Category Taxonomy

### 4.1 The ten built-in categories

Ship these ten. Users may add custom categories on top.

| # | Category | Meaning |
|---|---|---|
| 1 | **Warmup** | Physical / mental prep, low-intensity technique |
| 2 | **Technique** | Scales, arpeggios, exercises, drills |
| 3 | **Repertoire** | Learning + polishing specific pieces |
| 4 | **Ear Training** | Intervals, chords, melodic / rhythmic dictation |
| 5 | **Sight Reading** | Reading unfamiliar material |
| 6 | **Theory** | Study, analysis, chart-building |
| 7 | **Improvisation** | Jamming, soloing over changes |
| 8 | **Transcription** | Learning music by ear |
| 9 | **Recording / Listening** | Self-recording, active listening study |
| 10 | **Cool-down** | Stretch, wind-down, reflection |

Each category gets an icon + accent color for use in reports, item chips, and category filters. Colors: distinct enough for pie charts, harmonious enough for the app aesthetic.

### 4.2 User-defined extras

Users can add their own categories via **Profile → Categories → + Add category**. Custom categories:
- Have a user-picked color from a curated palette (~12 options).
- Appear in the category picker alongside the 10 built-ins.
- Show up in reports as regular categories.
- Can be renamed or deleted (deleting a category demotes tagged items to a "Custom" bucket, doesn't lose data).

### 4.3 Proficiency Levels (v1: Self-Rated)

Each category gets a **current level** and an **optional target level** per user. Users self-rate; the app never grades automatically in v1. The AI Coach uses the current-vs-target gap to shape routines, and Reports show level history over time.

**Full automated grading + adaptive progression is deferred to v2** — see [`MY-PRACTICE-V2-BACKLOG.md`](./MY-PRACTICE-V2-BACKLOG.md) for the deferred scope. This v1 slice ships the *interface* for level tracking without the grading engine, so the data model + UI are ready for v2 to plug into.

#### The five levels + "Not applicable"

Levels use a **numeric primary identifier** (Level 1–5) with a stage-based descriptor as a sub-label. The number is the anchor; the descriptor adds qualitative color. Numbers scale past v1 (v2's automated grading can add Level 6+ for Mastery / Concert-Ready without a naming crisis), are language-independent, and make deltas unambiguous ("Level 2 → Level 3" reads cleaner than "Developing → Comfortable").

UI treatment: numbers rendered prominently; descriptor shown as a secondary label (`Level 3 · Comfortable`). "N/A" has no number — it's a distinct opt-out.

| # | Descriptor | Meaning |
|---|---|---|
| **Level 1** | Exploring | Just starting; still learning what this category even is |
| **Level 2** | Developing | Working on the basics; can do some things but with effort |
| **Level 3** | Comfortable | Basics are fluent; can handle standard-level challenges |
| **Level 4** | Fluent | Solid intermediate → advanced; can handle most challenges you meet |
| **Level 5** | Teaching | Advanced; could clearly explain / teach this to another musician |
| **N/A** | *(not applicable)* | Not applicable to me right now — hides from AI + prompts |

Users can bump levels up or down whenever they want in Profile → Levels. Changes are logged (with timestamp) so Reports can show progression narratives ("Ear Training: Level 2 → Level 3 · Sep 12").

#### Target levels

Each category can also have a target — the user's own aspiration. "I'm at Level 3 with Ear Training and want to reach Level 4." Targets are pure aspiration; the app never enforces them. The AI Coach uses them to weight routines toward gaps ("you're at Level 2 on Ear Training but want to reach Level 4 — I've weighted 30% of this routine there").

#### Optional per-routine feedback

At the end of every routine, the player offers a **single-tap category vibe-check** for each category the routine touched:

> **How did Ear Training go today?**
> Rough · Struggled · OK · Solid · Great

Fully skippable (Skip All button). Ratings are stored per session-item and become a "recent feel" signal the AI Coach can read ("your last three Ear Training sessions were rated Rough — want a gentler routine today?"). Ratings never auto-change the user's level; only the user changes their level.

#### N/A is first-class

If a user marks a category as N/A, the app:
- Hides it from AI Coach considerations
- Hides it from the vibe-check prompts after routines
- Still shows time spent (if they happen to practice it) in Reports
- Never nags them to set a level for it

This respects the reality that not every musician cares about every category. A jazz bassist marking Sight Reading N/A is a legitimate choice.

#### Reassessment nudge

Every 3 months, a subtle Profile prompt: "It's been a while since you rated your levels — want to update?" No pressure; just a check-in. Some users will bump themselves up (progress); some will bump themselves down (humility from real growth); most will leave levels alone. All fine.

---

## 5. Session Tracking

### 5.1 Auto-detection rules

- **Session start** — first practice activity in any module (Arpeggios drill playing, Metronome running, sheet playback, routine started).
- **Session end** — 5 minutes of practice inactivity (no ticks, no drill playing, no sheet playback, no navigation between practice surfaces).
- **Session pause** — leaving a practice screen mid-drill counts as active for 60 seconds, then pauses. Returning resumes the same session if within the 5-minute window.

### 5.2 Category assignment

Each module carries a **default category** for ad-hoc use:

| Module | Default category | Notes |
|---|---|---|
| Arpeggios | Technique | Individual drills can override |
| Key Sequencer | Technique | Individual drills can override |
| Scale Driller | Technique | Individual drills can override |
| Metronome | Warmup | Ad-hoc metronome sessions default to warmup |
| Lead Sheet Builder (playback) | Repertoire | Songs override with their own category |
| Tuner | *(not tracked)* | Tuner use doesn't count as practice time |
| My Practice (routine execution) | Per-item category | Every routine item has its own category |

**Override rule**: if a specific saved item (a drill, a song, a metronome preset) has a category set, that overrides the module default. This gives users precise control over reports.

### 5.3 Retention + privacy

- Practice history is retained forever by default. User can delete individual sessions or all history at any time.
- User can export all session data as JSON via the existing Data Export bundle.
- User can fully delete their account + all cloud-synced data at any time (GDPR + CCPA compliance from day one).

---

## 6. AI Coach

### 6.1 Bring-your-own-key (BYOK)

Users paste their own **Anthropic (Claude)** or **OpenAI (GPT)** API key into Profile → AI Coach → API Keys. Keys are stored securely (encrypted at rest in cloud sync; never logged; visible to user via masked field with reveal toggle).

**Implication**: manual routines + templates + reports + methodology library MUST be fully usable without an API key. AI Coach is a bonus feature for BYOK users, not a gate on the module's value.

### 6.2 Provider + model choice

Users pick a provider (Anthropic or OpenAI) + specific model:

**Anthropic options (recommended):**
- `claude-sonnet-4-6` — balanced performance/cost (default)
- `claude-opus-4-7` — highest quality, most expensive
- `claude-haiku-4-5-20251001` — fastest, cheapest

**OpenAI options:**
- `gpt-5` — high quality
- `gpt-5-mini` — balanced
- `gpt-4o` — legacy fallback

Model selection lives in Profile → AI Coach → Model. Simple dropdown. Users can experiment.

### 6.3 Two agency modes

User picks in Profile → AI Coach → Agency:

**Passive mode (default for new users)** — the AI can:
- Draft routines by composing items from your library (drills, sheets, songs) + the built-in library (starter drills, methodology templates).
- Suggest an item exists in the built-in library that you might not have discovered yet.
- Read your profile + recent session history to inform recommendations.
- NOT create new items in your library. NOT edit your profile without asking. NOT adjust running routines.

**Active mode (opt-in for power users)** — everything Passive can do, plus:
- Create new drills / sheets / songs on the fly when your library doesn't have what the routine needs. New items are flagged with a "Made by AI" tag; you can review, delete, or edit them.
- Propose profile updates ("I notice you've been asking for jazz standards a lot — want me to update your genre focus?"). Always confirms before applying.
- Adjust in-progress routines ("This is running long, want me to trim the last two items?"). Requires user confirmation.

**Default: Passive.** New users see the AI compose from what they already have; this is a wow moment. When they trust the coach, they turn on Active.

### 6.4 Practice profile

User picks profile depth in the onboarding wizard (see §11). Can upgrade Standard → Deep at any time.

**Standard profile (~5 fields):**
- Instrument (dropdown: Bass, Guitar, Piano, Voice, Drums, Saxophone, other free-text)
- Overall skill level (Beginner / Intermediate / Advanced / Pro) — a coarse global signal; per-category proficiency is finer-grained (see §4.3 and next bullet)
- Primary goals (free-text list, 1–5 items, examples: "build my ii-V vocabulary", "learn 20 jazz standards", "improve time feel")
- Focus areas (multi-select from the 10 categories: which matter most to me right now)
- Typical session length (dropdown: 15 / 30 / 45 / 60 / 90 / 120 min)

**Deep + Evolving profile** — Standard fields plus:
- Practice frequency (target: daily / most days / weekly / when I can)
- Genre / style influences (multi-select: Jazz, Classical, Rock, Blues, Country, Folk, Latin, R&B, Metal, Electronic, other)
- Specific weaknesses (free-text list, e.g. "left-hand independence", "fast tempos", "reading in flat keys")
- Repertoire priorities (link to Songs library)
- Preferred practice methods (multi-select from methodology library)

**Per-category proficiency levels** (see §4.3) — every profile carries a current + target level per category. Standard profile users can leave these unset (defaults to Level 3 · Comfortable / no target) and set them later. Deep profile users are prompted for them during setup.

**Progressive enrichment** — instead of dumping all Deep fields at once, the app drips one new field per week when relevant ("Quick question — what genres do you mostly play?"). Reduces onboarding friction; same total data collection.

### 6.5 Chat + shortcut UI

The AI Coach surface is a chat interface with quick-shortcut buttons at the top:

```
┌─────────────────────────────────────────────────┐
│ AI Coach                    [History] [Settings]│
├─────────────────────────────────────────────────┤
│ Quick shortcuts:                                │
│ [45 min balanced] [60 min repertoire focus]     │
│ [20 min warmup only] [30 min technique focus]   │
├─────────────────────────────────────────────────┤
│ ... conversation history ...                    │
│                                                 │
│ [Type a message or click a shortcut...]  [Send] │
└─────────────────────────────────────────────────┘
```

Conversation history persists per-user (last 100 conversations synced via cloud). Users can re-open past conversations. Streaming responses (SSE) so the AI's output types out in real time.

### 6.6 "Why this recommendation?" transparency

Every AI-drafted routine has a small **[Why this?]** link that expands to show which profile fields + recent history + levels influenced the AI's choices:

> Focus areas: **Improvisation**, **Ear Training**
> Levels: **Ear Training** — Level 2 · Developing → target Level 4 · Fluent (gap: 2 steps)
> Recent 2 weeks: 40% Technique, 5% Ear Training
> Recent Ear Training vibe-checks: Rough, Struggled, OK
> Session length: 45 min
> → This routine emphasizes Ear Training (18 min) to close a target gap AND rebalance recent bias. Started gentle because recent vibe-checks were Rough.

Builds trust in the AI; teaches the user how to shape their profile.

---

## 7. Methodology Library

Ship 6–8 methodology entries at v1 launch. Each entry has:

- **Article** — 500–1500 words explaining the method, its origins, when to use it, what it looks like in practice. Written in the app's confident-friendly voice.
- **Linked templates** — 1–2 ready-to-run routine templates that instantiate the method. One-click "Try this template" loads a routine and lets the user save it as their own.

### 7.1 Methodologies to ship (v1)

1. **Deliberate Practice** (Anders Ericsson) — focused, effortful work on specific weaknesses with immediate feedback. Not repetition; targeted improvement.
2. **Interleaved Practice** — mixing multiple skills within a session rather than blocking one. Slower to feel productive; better long-term retention.
3. **Slow Practice** — deliberate under-tempo work to solidify accuracy before speed. Universally applicable to technique.
4. **Pomodoro Practice** — 25-minute focus blocks with 5-minute rests. Applies the general productivity method to music practice.
5. **Chunking** (for repertoire) — breaking pieces into small, learnable units; mastering each before assembling.
6. **Spaced Repetition** — revisiting material at increasing intervals to lock in long-term memory. Applied to warmups, repertoire review, ear-training sets.
7. **Mental Practice** — practice away from the instrument (visualization, score study, aural rehearsal). Complements physical practice.
8. **The Slow Loop** (jazz-specific, optional 8th) — pick one bar of a hard passage, loop it at slow tempo for a fixed count, gradually speed up.

Content authorship: Jeff-authored with AI drafting help. Each article cites sources (Ericsson, Klickstein, Harnum, Sutton, etc.). Reviewed by Jeff before ship.

### 7.2 Templates that ship (initial)

Each methodology gets a signature template. Templates carry:
- Name (e.g. "Deliberate Practice — 45 min technique focus")
- Description (short — what this method does + when to use it)
- Duration estimate
- Item list (with categories, tool references where relevant, rest items, per-item methodology references — see §7.3)
- Attribution: "Based on the [Deliberate Practice](/my-practice/methodology/deliberate-practice) method"

### 7.3 Methodology as a per-item property (v0.4)

Every RoutineItem carries an optional **methodology** field. Users (or the AI) can pick the method that applies to each item individually. A single routine can weave multiple methods — Slow Practice on the technique drill, Chunking on the repertoire section, Interleaved rotation between them.

This upgrades methodology from "which template did the user pick?" to "which method is this specific activity using?" It matches how teachers actually assign practice and unlocks richer AI-Coach reasoning.

**Optional per item.** Methodology is a first-class optional field, not required. Rest breaks, warmup long-tones, freeform improvisation — many items don't map to any of the 8 built-in methods. Blank is legal and appears in the Overview simply as "—" (no method).

**Smart defaults per category.** When a user or the AI adds an item, the methodology dropdown pre-fills based on the item's category:

| Category | Default methodology |
|---|---|
| Warmup | — (no method) |
| Technique | Slow Practice |
| Repertoire | Chunking |
| Ear Training | Spaced Repetition |
| Sight Reading | — (deferred; Sight Reading module ships in v2) |
| Theory | — (no method) |
| Improvisation | — (no method — subjective) |
| Transcription | Chunking |
| Recording / Listening | Mental Practice |
| Cool-down | — (no method) |

User can change any default freely. Defaults just save clicks for common pairings.

**AI-suggested methodology (per-item).** Every methodology dropdown has a small **[?]** icon. Click → AI Coach suggests a method for THIS specific item given the user's profile, the item's context (category, tool ref, notes), and recent history. Cheaper than a full routine-drafting turn; a great "help me here" moment.

**Bulk AI assignment.** In the routine builder, a **[AI: assign methodologies to all items]** button fills in every blank methodology field at once. User reviews and tweaks individual choices before the Overview screen.

**Methodology in Reports.** Reports gain a "methodology mix" chip in the level panel showing how the user's practice time distributed across methods over the selected range. Balance signal — if a user is 90% Slow Practice month after month, the AI insights might nudge toward Interleaved for retention.

### 7.4 What v1 methodology DOES vs DOES NOT do

Explicit scope-check to avoid a common misconception. When a user picks a methodology for an item in v1:

**v1 methodology DOES:**
- Show the method name + core principles as **guidance text** on the item's full-screen player card during execution. The user reads the guidance and applies the method by choice.
- Feed the AI Coach for reasoning about routine composition + suggestions.
- Show up in Reports (methodology mix chip, per-method time accounting).
- **Fully shape execution for `custom` and `rest` items** — these items ARE authored around the methodology's structure (see the methodology templates in `src/content/templates/*.json` for how Deliberate Practice, Chunking, Pomodoro etc. encode their method as an item sequence).

**v1 methodology DOES NOT (v2 will):**
- Automatically change how the drilling modules (Arpeggios, Key Sequencer, Scale Driller, Metronome, Lead Sheet playback) behave at runtime. Picking "Slow Practice" for an Arpeggios drill does NOT automatically cap the drill's tempo, require 5-clean-in-a-row confirmations, or block tempo bumps past a plateau. The Arpeggios drill plays exactly as it's configured. The methodology is a label + guidance overlay, not a runtime override.
- Enforce mid-drill "Was that clean?" prompts, forced loops, or any per-module × per-methodology behavior. That's called **methodology runtime enforcement** and it's a v2 slice (see [`MY-PRACTICE-V2-BACKLOG.md`](./MY-PRACTICE-V2-BACKLOG.md) §1.5).

**Why this split**: full runtime enforcement requires each of the 6 drilling modules to know about each of the 8 methodologies as a runtime concept — ~48 combinations to design + build (many won't apply meaningfully). That's ~2-3 months of work on top of an already-ambitious v1 plan. Better to ship v1's label + guidance layer, watch which combinations users actually pick, then build runtime for the top ones first.

**UI transparency**: in v2, the methodology dropdown will visually distinguish supported combinations (🔒 Enforced) from label-only ones (💡 Guidance) so users know what to expect. For v1, methodology is uniformly "guidance."

**What this means practically for a v1 user**: picking Slow Practice for your Arpeggios drill will show you the Slow Practice principles at exactly the right moment. You still have to follow them yourself. Your Reports will honestly reflect "you tagged 60% of your practice as Slow Practice" — whether that time was actually slow is on you.

---

## 8. Songs Library (Repertoire)

First-class library of pieces the user is learning. Lives in the **Songs** tab of My Practice.

### 8.1 Song entity

```ts
type Song = {
  id: string;
  title: string;
  artist?: string;                // "The Real Book" / "Miles Davis" / etc.
  key?: string;                   // "Eb" / "Bb minor" / etc.
  timeSignature?: string;         // "4/4" / "3/4" / "6/8" — free text
  genre?: string;                 // "Jazz standard" / "Pop" / etc.
  status: "learning" | "polishing" | "performance-ready" | "retired";
  personalNotes?: string;         // "Focus on the bridge — chord changes are tricky"
  targetPerformanceDate?: number; // Optional deadline
  /** Optional link to a Lead Sheet in the LSB module. */
  leadSheetId?: string;
  createdAt: number;
  updatedAt: number;
  /** Session tracker maintains this from SessionItems referencing this song. */
  totalPracticeSeconds: number;
  lastPracticedAt?: number;
};
```

### 8.2 Song list UI (Songs tab)

- Grid or list view (user-toggleable) of all songs.
- Filter by status (learning / polishing / performance-ready / retired).
- Sort by lastPracticedAt (default), createdAt, title, alphabetical, most-practiced.
- Each song card shows: title, artist, status chip, total practice time, "last practiced 3 days ago", link to lead sheet (if exists), edit/delete actions.
- **+ Add song** button opens a compact form (title required; everything else optional).
- **Import from Lead Sheets** — bulk-adds song entries for every lead sheet the user has authored.

### 8.3 Song as routine item

A `SongRoutineItem` references a song by id. During execution:
- If the song has a linked lead sheet, tapping the item opens the sheet in LSB.
- Otherwise, the item shows in the player as a full-screen card with the song's title, artist, personal notes, and a big timer. User practices freely; app tracks time.
- On item completion, the SessionItem records the actual seconds, which roll up into the song's `totalPracticeSeconds`.

### 8.4 AI Coach + Songs

The AI Coach reads the Songs library and can:
- Suggest repertoire priorities ("You haven't touched All the Things You Are in 3 weeks; want to include it?").
- Balance repertoire practice across your library ("Rotating: this week Autumn Leaves, next week Body and Soul...").
- Recommend status transitions ("You've practiced Autumn Leaves 8 hours over 3 months and it's still 'learning' — ready to mark it 'polishing'?").

---

## 9. Routine Player

### 9.1 Full-screen practice mode (default)

When a routine starts, the app enters **practice mode**:
- Site header + footer hidden.
- Current item fills the viewport with big type, big controls.
- **Elements shown** for a typical item:
  - Category chip (top-left) — e.g. "Technique"
  - Item number + total ("Item 3 of 7") — top-center
  - Big item name — center
  - Optional item notes / instructions — below name
  - Big countdown timer — center (mm:ss)
  - Next-up preview strip — bottom (small): "Next: Ear Training — 10 min"
  - Controls (bottom-right): Pause · Skip · End routine
  - **[Show app chrome]** link (top-right) — collapses to bar-on-top mode for navigation

### 9.2 Take-over for drill items

When a routine reaches a drill item that has its own drill screen (Arpeggios / KS / Scales):
- The drill screen takes over the viewport.
- A minimal "**Routine: item 3 of 7**" chip persists in the top-right of the drill's header.
- When the drill signals completion (finished all measures) OR the user hits Stop, the routine advances.
- If the drill loops indefinitely, the item advances when its `estimatedSeconds` runs out (with a "Continue drilling / Advance now" prompt at the timer expiry).

### 9.3 Rest items (first-class item type)

A Rest item shows:
- "Rest" heading
- Big countdown timer
- Optional guidance text ("Stretch your hands. Hydrate. Reflect on what you just practiced.")
- Skip button
- **NO sound** (or user-configurable gentle chime at end — see §9.5)

Rests can be added manually by the user or auto-inserted by AI-drafted routines every 20–25 min unless the user's profile specifies otherwise.

### 9.4 Auto-advance vs manual advance

Default: **manual advance with soft timer.**
- The item's timer runs down to 0.
- At 0, a gentle chime plays + a large **[Ready →]** button appears center-screen.
- User taps to move to the next item.
- If no user input for 10 seconds after the chime, auto-advance (user can turn this off in settings).

Rationale: hard timers create anxiety; soft timers with an explicit ready-check respect the user's flow while still keeping routines on schedule.

### 9.5 Sound cues (user-configurable)

Settings → Practice → Sound cues:

- **Chime on item end** — off / gentle bell / soft chord (default: gentle bell)
- **Voice announce next item** — off / on (default: off — feels heavy for most users; on is great for hands-free)
- **Rest start / end** — separate optional chimes

### 9.6 Persistence + resume

The active session lives in a Zustand store with cloud sync + localStorage backup. Closing the browser mid-routine and reopening surfaces:

> **Resume routine?**
> Daily Warmup — you were on item 3 of 7 (Scale Driller: Major scales in 12 keys)
> [Resume] [Restart] [End without saving]

### 9.7 End-of-routine summary

Modal after completion:
- Routine name + total elapsed
- Per-item status table (completed / skipped) with actual seconds
- Category time breakdown for this routine
- Streak update ("This is your 4th day in a row!")
- CTAs: [Run again] · [Build new routine] · [Go to Reports] · [Done]

---

## 10. Reports

Dedicated **Reports** tab inside My Practice, plus a subtle header chip on every page.

### 10.1 Global header chip

```
[♪ Today: 45m · 3-day streak →]
```

Clickable → jumps to Reports. Live-updates as practice time accrues. User can hide via Settings → Appearance if they find it distracting.

### 10.2 Reports tab layout

Landing shows a dashboard with:

**Row 1: Headline stats**
- Today total (big) + goal progress if goal set
- This week total + comparison to prior week
- Current streak (consecutive practice days)
- Longest streak (all-time)

**Row 2: Time by category (this week)**
- Horizontal bar chart, one bar per category, color-coded per category.
- Toggle: This week / This month / Last 30 days / This year / All-time
- Filter chips: hide specific categories

**Row 3: Calendar heatmap (12 weeks)**
- GitHub-contributions-style grid. Color intensity = practice minutes that day.
- Click a day to see that day's session breakdown.
- Toggle: last 12 weeks / this year / last year

**Row 4: Trends**
- Line chart: daily practice minutes over selected range.
- Overlay: rolling 7-day average.
- Toggle range: 30 days / 90 days / this year / all-time.

**Row 5: Levels & progression**
- Per-category chip grid: category name · current level · target level (if set) · small delta indicator if level changed in the selected range.
- Timeline strip below: significant level events across the app's lifetime ("Ear Training: Level 2 → Level 3 · Sep 12", "Repertoire: target set to Level 4 · Oct 3"). Motivating without being gamified.
- Recent vibe-check trend per category (last 5 ratings shown as tiny bars). Helps user see whether recent sessions felt rough or great — signal for what to work on next.
- **[Reassess my levels]** button opens Profile → Levels.

**Row 6: Songs progress**
- List of songs currently marked "learning" or "polishing" with practice time this month per song.
- Sort by time this month; alerts for "haven't practiced in N days" songs.

**Row 7: AI insights (BYOK users only)**
- AI-generated weekly summary: "You practiced 6h 30m this week (+40% vs last week). Big shift toward Repertoire. You haven't touched Ear Training in 12 days — want a routine focused there? Also: your recent Ear Training vibe-checks are trending up — you might be ready to bump your level from 2 to 3."
- Runs on-demand or weekly (user configurable).

### 10.3 Reports export

Export all report data as CSV or PDF for the selected range. Useful for teachers reviewing student progress or users wanting a paper trail.

---

## 11. Onboarding

First-time visitor to `/my-practice`:

### Step 1 — Welcome (skippable)

Full-screen card:

> **Welcome to My Practice**
> The place where all your practice happens.
>
> Build routines. Get personal coaching. Track your progress. All in about 2 minutes to set up.
>
> [Get started →] [Skip and explore]

### Step 2 — Pick profile depth

> **How much would you like to tell us?**
>
> **Standard (recommended)** — 5 fields, ~3 min. Enough for the AI Coach to be genuinely helpful.
>
> **Deep + Evolving** — 10+ fields, ~10 min. Maximum personalization. Fields drip in over time; no need to fill all at once.
>
> **Skip for now** — Use defaults. You can always come back.

### Step 2.5 — Rate your current levels (optional)

Shown only when the user picked Standard or Deep in Step 2. Fully skippable.

> **Where are you right now?**
>
> Rate your current comfort with each category. This shapes what the AI Coach suggests. You can change any of these anytime.
>
> **Warmup** — [1 · Exploring] [2 · Developing] [**3 · Comfortable**] [4 · Fluent] [5 · Teaching] [N/A]
> *(...one row per category — 10 in total. Each defaults to Level 3 · Comfortable; user can bump. Users can also skip and set later.)*
>
> **Set a target?** Optional per-category dropdown for aspirational level.

### Step 3 — Try a starter routine

> **Ready to try it out?**
>
> Load this warmup routine to see how it works:
>
> **Daily 20-minute warmup** (Metronome 3m → Arp drill 12m → Cool-down 5m)
>
> [Load routine] [Skip — I'll build my own]

After step 3, lands on the Routines tab with the starter routine loaded (if picked) or an empty routines list with a friendly builder CTA.

---

## 12. Data Model

Full TypeScript-shape reference. Field names may adjust during implementation; conceptual shape holds.

### 12.1 Profile

```ts
type PracticeProfile = {
  userId: string;                        // cloud-sync user id
  depth: "standard" | "deep";            // user's chosen profile depth
  // Standard fields
  instrument?: string;                   // "bass" | "guitar" | ... | custom
  skillLevel?: "beginner" | "intermediate" | "advanced" | "pro";
  primaryGoals: string[];                // free-text, 1–5 items
  focusAreas: CategoryId[];              // multi-select
  typicalSessionMinutes?: number;        // 15 / 30 / 45 / 60 / 90 / 120
  // Deep fields (undefined if depth === "standard")
  practiceFrequency?: "daily" | "most-days" | "weekly" | "when-i-can";
  genres?: string[];                     // multi-select from library
  weaknesses?: string[];                 // free-text list
  repertoirePriorities?: string[];       // Song ids
  preferredMethods?: MethodologyId[];    // multi-select from library
  // AI Coach settings
  aiProvider?: "anthropic" | "openai";
  aiModel?: string;                      // per-provider model id
  aiAgency: "passive" | "active";        // default passive
  aiConversationHistory: AIMessage[];    // last 100 conversations
  // Categories
  customCategories: CustomCategory[];    // user-defined extras
  // Per-category proficiency (§4.3)
  levels: CategoryLevel[];               // one entry per category (built-in + custom)
  createdAt: number;
  updatedAt: number;
};

type CustomCategory = {
  id: string;
  name: string;
  color: string;                         // hex, from curated palette
};

/**
 * Numeric level, 1–5. Higher = more advanced. See §4.3 for
 * descriptors. Storing as a number keeps the type open to v2's
 * automated-grading extension (Level 6+ can be added without a
 * schema change). "N/A" is a distinct opt-out.
 */
type ProficiencyLevel = 1 | 2 | 3 | 4 | 5 | "n/a";

/** Human-readable descriptor per level (§4.3). */
const LEVEL_DESCRIPTORS: Record<Exclude<ProficiencyLevel, "n/a">, string> = {
  1: "Exploring",
  2: "Developing",
  3: "Comfortable",
  4: "Fluent",
  5: "Teaching",
};

type CategoryLevel = {
  categoryId: CategoryId;
  current: ProficiencyLevel;             // defaults to "comfortable"
  target?: ProficiencyLevel;             // optional aspiration
  updatedAt: number;
  history: Array<{ level: ProficiencyLevel; changedAt: number }>;
};
```

### 12.2 Categories

```ts
type CategoryId =
  | "warmup" | "technique" | "repertoire"
  | "ear-training" | "sight-reading" | "theory"
  | "improvisation" | "transcription"
  | "recording-listening" | "cool-down"
  | string;  // user-defined extras use their custom id

type CategoryDef = {
  id: CategoryId;
  name: string;
  color: string;
  icon: string;  // Lucide icon name
  isBuiltIn: boolean;
};
```

### 12.3 Routine + Items

```ts
type Routine = {
  id: string;
  name: string;
  notes?: string;
  items: RoutineItem[];
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  // Provenance: how was this routine created?
  source: "manual" | "ai-coach" | "template";
  sourceRef?: string;  // if template: methodology entry id; if ai-coach: conversation id
  authorId?: string;   // future teacher mode
  assigneeIds?: string[];  // future teacher mode
};

// Every item type extends this base:
type RoutineItemBase = {
  id: string;
  label: string;
  category: CategoryId;              // the activity category (required)
  estimatedSeconds: number;
  notes?: string;
  /**
   * v0.4 — Optional methodology reference. When set, this item is
   * being practiced using that method (Slow Practice, Chunking, etc.).
   * Undefined = no specific method. See §7.3 for smart defaults per
   * category and AI-suggestion affordances.
   */
  methodologyId?: MethodologyId;
};

// Discriminated union of type variants (one per drilling module + rest + custom):
type RoutineItem =
  | (RoutineItemBase & { type: "drill"; drillId: string })
  | (RoutineItemBase & { type: "key-drill"; keyDrillId: string })
  | (RoutineItemBase & { type: "scale-drill"; scaleDrillId: string })
  | (RoutineItemBase & { type: "metronome"; bpm: number; beatsPerMeasure: number; beatUnit: number; accentPattern?: number[] })
  | (RoutineItemBase & { type: "leadsheet"; leadSheetId: string })
  | (RoutineItemBase & { type: "song"; songId: string })
  | (RoutineItemBase & { type: "rest"; guidanceText?: string })
  | (RoutineItemBase & { type: "custom"; instruction: string })
  // Future — one per new module:
  | (RoutineItemBase & { type: "ear-training"; setId: string });
```

### 12.4 Song

See §8.1 above.

### 12.5 Session tracking

```ts
type PracticeSession = {
  id: string;
  startedAt: number;
  endedAt?: number;                  // set when session ends (5-min inactivity)
  routineExecutionId?: string;       // if this session was a routine execution
  items: SessionItem[];
  /** Per-category vibe-checks captured at end of routine (§4.3). Optional. */
  categoryFeedback?: SessionCategoryFeedback[];
};

type SessionItem = {
  id: string;
  moduleId: ModuleId;                // "arpeggios" | "metronome" | ...
  toolRef?: { kind: "drill" | "sheet" | "song" | "metronome-preset"; id: string };
  category: CategoryId;              // effective category (module default OR override)
  routineItemId?: string;            // link back to the RoutineItem if applicable
  startedAt: number;
  endedAt: number;
  actualSeconds: number;             // seconds actively practicing (not paused)
};

type SessionCategoryFeedback = {
  categoryId: CategoryId;
  /** 1 = Rough, 2 = Struggled, 3 = OK, 4 = Solid, 5 = Great */
  rating: 1 | 2 | 3 | 4 | 5;
};
```

### 12.6 Methodology entry

```ts
type MethodologyEntry = {
  id: MethodologyId;
  slug: string;
  name: string;
  summary: string;                   // 1-line
  articleBody: string;               // markdown, 500–1500 words
  sources: Array<{ label: string; url?: string }>;
  templates: RoutineTemplate[];      // 1–2 per entry
  categories: CategoryId[];          // which categories the method most targets
};

type RoutineTemplate = {
  id: string;
  name: string;
  description: string;
  items: RoutineItem[];              // pre-defined items
  estimatedTotalSeconds: number;
};
```

---

## 13. Cloud Sync (Supabase)

v1 ships with full cloud sync. Every entity above is synced.

### 13.1 What syncs

- Profile (including AI keys — encrypted at rest)
- Routines (all)
- Songs (all)
- Sessions (history — the tracking data)
- Custom categories
- All existing drilling module data: Arpeggios drills, Key Sequencer drills, Scale Driller drills, Lead Sheets, custom patterns, custom drills, custom scales, custom sheets
- Settings: appearance, theme, notation defaults, all user prefs
- Onboarding state (hasSeenX flags for each module)

### 13.2 Auth

Supabase Auth. Sign in with email + magic link OR Google OR Apple. No password (magic-link only for email).

### 13.3 Local-first with cloud backup

- All writes go to local storage first (Zustand persist middleware, unchanged).
- Background sync pushes to Supabase Postgres.
- On sign-in on a new device, sync pulls the full state down to local.
- Conflict resolution: last-write-wins per entity (timestamp-based). Custom conflict resolvers per entity type if needed later.
- Offline: full read + write locally; sync when online again.

### 13.4 Migration path for existing users

Users who already have local-only data (drills, sheets, prefs) get a **one-time migration prompt** on first sign-in:

> **Migrate your local data to your account?**
> We found 8 drills, 3 lead sheets, and your preferences on this device.
> Do you want to sync them to your account so you can access them on other devices?
>
> [Migrate + sign in] [Sign in without migrating] [Keep local-only]

Migration is idempotent; safe to run multiple times.

### 13.5 Anonymous / logged-out use

Users who don't sign in get **local-only** experience — everything works, just doesn't sync. Clear "Sign in to sync" chip in header. My Practice module still functional (routines, tracking, reports) but only for that device.

---

## 14. Module Surface

### 14.1 Route + label

- URL: **`/my-practice`**
- Header label: **"My Practice"**
- Data model entity: **`Routine`** (internal), "practice routine" (UI copy)

### 14.2 Five tabs

Sidebar navigation matching the Settings-page pattern:

| Tab | Contents |
|---|---|
| **Routines** *(default)* | List of your routines · [Build new] · [AI Coach] · [Browse templates] |
| **Songs** | Repertoire library — songs you're learning |
| **Methodology** | Article library + linked templates |
| **Reports** | Time tracking dashboards |
| **Profile** | AI Coach settings + practice profile + custom categories |

Sidebar sticky on desktop; select dropdown on mobile (same pattern as Settings).

### 14.3 Header integration

- Persistent chip in the site header (see §10.1): "♪ Today: 45m · 3-day streak"
- Module switcher shows "My Practice" as a live entry.
- When a routine is executing in full-screen practice mode, the header + footer are hidden (see §9.1).

### 14.4 Routine Overview (pre-save / pre-run gate) — v0.4

Every routine — whether hand-built, AI-drafted, or template-loaded — passes through a **Routine Overview** screen before it's saved or run. The Overview is the "review before commit" surface that consolidates naming, methodology mix, category balance, and duration into one confirming view.

#### When it shows

- **Manual build path**: User builds items in the routine builder → clicks **[Review →]** → lands on the Overview.
- **AI Coach path**: AI drafts a routine in the chat → clicks **[Preview routine →]** → lands on the Overview.
- **Template path**: User picks a template from Methodology tab → clicks **[Try this template →]** → lands on the Overview with the template loaded.

All three paths converge on the same screen. One save flow to design + one place to build muscle memory.

#### What it shows

```
┌───────────────────────────────────────────────────────────────┐
│ Routine Overview                                              │
├───────────────────────────────────────────────────────────────┤
│ Name: [Slow Practice · Technique · 25 min          ] (edit)   │
│ Estimated total: 25 min                                       │
├───────────────────────────────────────────────────────────────┤
│ ORDER  ITEM                     CATEGORY    METHOD       TIME │
│  1     Warmup (long tones)      Warmup      —            5:00 │
│  2     Major scales @ 60 BPM    Technique   Slow Practice 8:00│
│  3     Rest                     Cool-down   —            2:00 │
│  4     Arp drill: 7ths @ 80     Technique   Slow Loop    8:00 │
│  5     Cool-down: play freely   Cool-down   —            2:00 │
├───────────────────────────────────────────────────────────────┤
│ Category mix:                                                 │
│  ■ Warmup 20%  ■■■ Technique 64%  ■ Cool-down 16%             │
│                                                               │
│ Methodology mix:                                              │
│  ■■ Slow Practice 32%  ■■ Slow Loop 32%  □ No method 36%      │
├───────────────────────────────────────────────────────────────┤
│ [← Edit items]  [Save without running]  [Save & Run →]        │
└───────────────────────────────────────────────────────────────┘
```

**Fields at a glance**:
- **Name** — pre-filled with a smart default (see below). Editable inline.
- **Estimated total** — sum of item durations.
- **Item table** — order + label + category + methodology + duration per row. Click any row to jump back to that item's composer.
- **Category mix chip row** — visual balance of the 10 categories.
- **Methodology mix chip row** — visual distribution across methods (including "No method").
- **Warning banners** — subtle nudges when balance is unusual (e.g. 90%+ single-method, 0% rest breaks in a 60+ min routine).

#### Smart default names

Pre-filled based on content:
- Methodology-template load → template's name ("Deliberate Practice — 45 min technique focus")
- AI Coach draft → AI-suggested name from the conversation ("Ear Training focus, 45 min")
- Manual build → algorithmic name: dominant category + methodology + duration, e.g. "Technique · Slow Practice · 25 min"
- Fallback → "Untitled routine · YYYY-MM-DD HH:MM"

User can overwrite freely. Empty name at save-time → auto-generated.

#### Actions

- **[← Edit items]** — back to the builder without losing state.
- **[Save without running]** — persist to Your Routines; return to Routines tab.
- **[Save & Run →]** — persist AND immediately launch full-screen practice mode.
- **[Discard]** (secondary, in a small menu) — throws away the routine without saving.

#### Overview is where the AI-methodology-assign flow completes

If the user in the builder clicked **[AI: assign methodologies to all items]**, the Overview screen shows the AI's picks for every item. User can accept, or click a row to edit individually before saving. This preserves the "AI does the tedious part; user has final say" ethos.

---

## 15. Cross-Module Integration

Every drilling module needs the following changes to support the flagship My Practice:

### 15.1 Session reporting

Each module must report its practice time to a central `useSessionTracker` store. API:

```ts
sessionTracker.startActivity({
  moduleId: "arpeggios",
  toolRef: { kind: "drill", id: drillId },
  category: CategoryId,  // effective category
  routineItemId?: string,  // if launched from a routine
});

// Called on Stop / navigation away / drill natural end:
sessionTracker.endActivity();
```

The tracker manages session start/end + item boundaries + inactivity detection.

### 15.2 Per-item category override

Each module's saved-item type (Drill, KeyDrill, ScaleDrill, Sheet, etc.) gains an optional `category?: CategoryId` field. When set, overrides the module default for tracking purposes. Editing UI: small category picker in the save-drill form + edit-drill form.

### 15.3 Routine mode

Each module must support being launched in "routine mode": a URL query param (`?routineMode=1`) or store flag telling the module:
- "You're inside a routine — don't do your normal auto-start behavior."
- "When Stop / natural end fires, signal completion to the routine player + return to `/my-practice/execute`."
- Persist minimal state so return-from-drill is smooth.

### 15.4 Time contribution during ad-hoc use

Even outside a routine, modules that are practice surfaces (Arpeggios / KS / Scales / Metronome / LSB playback) call `sessionTracker.startActivity(...)` on play + `endActivity()` on stop. No routine context; category derives from module default + item override.

Tuner is explicitly excluded — checking your instrument's tuning isn't practice.

---

## 16. v1 Build Sequencing (Reference)

Full flagship is ~4–6 months of work sequenced into named slices. **The detailed build plan lives in a separate `MY-PRACTICE-BUILD-PLAN.md` document** (to be written at implementation start). High-level shape:

**Slice A — Foundation (~3 weeks)**
- Cloud sync infrastructure (Supabase auth + Postgres + local-first sync)
- Migration path for existing local-only users
- Session tracker (central store; module contributions)
- Data model + stores for Routine / Song / Session / Profile / Categories

**Slice B — Manual routines + player (~3 weeks)**
- Routine CRUD (Routines tab, list + builder + editor)
- Discriminated-union item types + composers + renderers for existing modules
- Rest items as a first-class type
- Full-screen practice mode + bar fallback
- Take-over integration for drill items in each existing module
- Sound cues + auto-advance
- Resume mid-routine

**Slice C — Songs library (~2 weeks)**
- Songs tab CRUD
- Song item type + player integration
- Optional lead-sheet link + import-from-sheets
- Songs progress panel in Reports

**Slice D — Reports + tracking (~2 weeks)**
- Reports tab: dashboard + heatmap + trends + song progress
- Header chip (today + streak)
- Export CSV / PDF
- AI Insights (weekly summary) — optional if BYOK set up

**Slice E — Methodology library (~2 weeks)**
- Methodology tab
- 6–8 articles authored + reviewed
- 6–8 templates authored + tested
- Article renderer (markdown)
- "Try this template" flow

**Slice F — AI Coach (~3 weeks)**
- BYOK key management (secure storage)
- Provider integrations (Anthropic + OpenAI, using AI SDK)
- Chat UI + streaming responses + shortcut buttons
- Prompt engineering for Passive + Active modes
- Tool use for Active mode (create-item / edit-profile / adjust-routine tools)
- "Why this?" transparency panel

**Slice G — Onboarding + polish (~1–2 weeks)**
- 3-step wizard
- Progressive profile enrichment prompts
- Empty states + polish everywhere
- Accessibility pass

**Slice H — Ship**
- Public deploy behind feature flag → dogfood → open to all users.

---

## 17. Open Items (defaults proposed, revisit at implementation)

| # | Item | Proposed default | Revisit trigger |
|---|---|---|---|
| 1 | Free vs Pro tier | v1 fully free; revisit after real usage reveals cost / value | Once cloud-sync + AI Coach usage volume is known |
| 2 | Session inactivity threshold | 5 min | User feedback on session boundaries |
| 3 | Practice history retention | Forever, user can delete individual sessions | Storage cost signals |
| 4 | Header chip default visibility | On | User complaints of distraction |
| 5 | AI Agency default | Passive | Once we see how users adopt Active |
| 6 | Auto-advance timeout on Ready button | 10 seconds after chime | User feedback |
| 7 | Voice announce next item | Off (opt-in) | User request patterns |
| 8 | Sound cues on rest start | Off (only end) | User feedback |
| 9 | Sharing routines (URL / code) | Deferred to v2 | Requests for teacher / community features |
| 10 | Teacher mode (assign / review) | Deferred to v2 | Design pass once auth + cloud sync validated |
| 11 | Community routines library | Deferred to v2 | User demand |
| 12 | Instrument-specific starter routines | v1 ships instrument-agnostic starters; per-instrument variants later | Once instrument selector ships on drilling modules |

---

## 18. What This Doc Is / Isn't

**Is:**
- The design target for My Practice v1 flagship.
- The cross-module contract every drilling module must implement (session reporting, per-item category, routine mode).
- The source of truth for scope decisions during implementation.

**Isn't:**
- The build plan. That's `MY-PRACTICE-BUILD-PLAN.md` (to be written at implementation start).
- The UX mockups. Visual treatment iterates during implementation.
- The final API. Field names may adjust; conceptual shape is authoritative.

---

## 19. Change Log

| Date | Change |
|---|---|
| 2026-06-29 | v0.1 — Initial design pass. Scoped as cross-module routine layer targeting v2 milestone. |
| 2026-07-14 | **v0.2 flagship rewrite.** Promoted from v2 to v1. Scope expanded significantly: added AI Coach (BYOK Anthropic + OpenAI, Passive / Active modes, chat + shortcuts UI, Standard / Deep+Evolving profile), first-class Songs library, methodology library (6–8 entries), category taxonomy (10 built-ins + user extras), auto-tracked practice sessions, dedicated Reports tab with heatmap / streak / header chip, cloud sync via Supabase, 5-tab module structure, 3-step onboarding wizard. 23 design decisions locked via user interview. Existing v0.1 concepts (RoutineItem discriminated union, Launcher / Composer / Renderer pattern, resume mid-routine) retained. |
| 2026-07-22 | **v0.3 self-rated proficiency levels.** Added a lightweight v1 proficiency system per user request: 5 stage-based levels per category (Exploring / Developing / Comfortable / Fluent / Teaching) + N/A + optional target level per category. Users self-rate; the app never grades automatically. AI Coach reads current-vs-target gap to weight routines. Reports gain a per-category level chip grid + timeline of significant level events + recent vibe-check trend. End-of-routine offers a single-tap per-category "How'd it go?" rating (1–5). Onboarding wizard gains an optional Step 2.5 for level self-assessment. Data model adds `ProficiencyLevel`, `CategoryLevel`, and `SessionCategoryFeedback` types. Estimated build extended by ~1–2 weeks (~4.5–6.5 months total). Full automated grading + adaptive progression + assessment routines + level curricula deferred to v2 (see [`MY-PRACTICE-V2-BACKLOG.md`](./MY-PRACTICE-V2-BACKLOG.md)). |
| 2026-07-22 | **v0.4 numeric levels + methodology-per-item + Routine Overview + v1/v2 scope-check.** Three user-requested improvements shipped as one revision. (1) **Level identifiers are now numeric** (Level 1–5) with the stage descriptors kept as sub-labels ("Level 3 · Comfortable"). Numbers scale past v1 without a naming crisis and make deltas unambiguous. `ProficiencyLevel` type changes from a union of stage names to `1 \| 2 \| 3 \| 4 \| 5 \| "n/a"`. (2) **Methodology becomes an optional per-item property** — every `RoutineItem` carries an optional `methodologyId` field, so a single routine can weave multiple methods together (Slow Practice on the arp drill, Chunking on the repertoire section, etc.). Smart defaults per category (Technique → Slow Practice, Repertoire → Chunking, etc.). "?" AI-suggestion affordance per item. Bulk "AI: assign methodologies to all items" button in the builder. Methodology mix chip added to Reports for balance signals. (3) **Routine Overview** — new pre-save/pre-run gate screen that consolidates naming, methodology mix, category balance, and duration into one confirming view. Manual builds, AI drafts, and template loads all converge on the same Overview screen. Smart default names generated per source. Actions: Edit items / Save without running / Save & Run. Extends estimate by ~1 week for the Overview UI + methodology picker + AI bulk-assign. (4) **New §7.4** explicitly documents what v1 methodology DOES (label + guidance + AI signal + fully shapes `custom` / `rest` items) vs DOES NOT (does not auto-change drilling-module behavior at runtime — that's v2). Prompted by user question "when User selects a methodology, the element to which that methodology applies will then be trained IN ACCORDANCE WITH THE PRINCIPLES OF THAT METHODOLOGY, correct?" Honest answer: partially in v1, fully in v2. Full runtime enforcement per (module × methodology) combo deferred to v2 (see V2-BACKLOG §1.5) — ~2-3 months of work best done after v1 GA + real usage data. |
