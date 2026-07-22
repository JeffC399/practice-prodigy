# My Practice — v2 Backlog

> Features and capabilities scoped BEYOND v1. Captured here so nothing is lost when we go past v1 GA. Each item has enough detail to pick up cold months later.

**Doc status:** v1 — 2026-07-22
**Depends on:** `ROUTINE-DESIGN.md` v0.3 (v1 design) + `MY-PRACTICE-BUILD-PLAN.md` (v1 build)
**When to consult:** planning v2 build, when a user requests a deferred feature, or when weighing whether a v1 change enables a v2 win

---

## 0. Rationale

The v1 flagship ships a huge scope already — ~5–6 months of work. Some capabilities that the user genuinely wants get deferred because:

- They add 2–6 more months to a plan that's already ambitious.
- They benefit hugely from having v1 usage data before we design them (so we build the right thing, not what we imagined).
- They depend on infrastructure that v1 lands (cloud sync, session tracker, AI Coach, level system).

This doc captures them so they're not lost. When a v1 user asks "do I get automated grading?" the answer is "not yet — v2 (see backlog)."

---

## 1. Automated Grading + Adaptive Progression

**The full "proficiency-tracked adaptive learning system"** from the 2026-07-22 interview. v1 shipped the *interface* (self-rated per-category levels feeding the AI); v2 ships the *engine* (automated grading + auto level-ups + assessment routines + curricula per level).

### 1.1 Scope

Full user-stated capabilities (a–g) from the 2026-07-22 interview:

- (a) Identify areas of interest + desired proficiency levels per area ✅ *shipped v1*
- (b) Check user's current proficiency in each area ⏳ *v1 = self-rated, v2 = automated*
- (c) Choose materials given proficiency + goals ⏳ *v1 = AI reads levels, v2 = per-level curriculum*
- (d) Grade user during routine on proficiency ⏳ *v2*
- (e) Update proficiency automatically ⏳ *v2*
- (f) Recommend level-up or celebrate reaching target ⏳ *v2*
- (g) Reports on proficiency progression ⏳ *v1 = level history + timeline, v2 = detailed grade-based trends*

### 1.2 What v2 adds

**Automated grading engine** — a per-category rubric mixing measurable + subjective signals:

| Category | Grading signals (v2) |
|---|---|
| Warmup | Session frequency, tempo range covered — soft signals |
| Technique | Drill completion + tempo achieved + streak of clean reps (Slow Loop counts) + user self-rating |
| Repertoire | Songs status transitions (learning → polishing → performance-ready) + total minutes per song + user self-rating |
| Ear Training | Accuracy score from the Ear Training module (once it ships as its own module) |
| Sight Reading | Accuracy + tempo from the Sight Reading module (once it ships) |
| Theory | Quiz scores from theory drills (Theory module — v3+) |
| Improvisation | Purely user self-rating (no automated signal exists for improv quality) |
| Transcription | Number of completed transcriptions + user self-rating |
| Recording / Listening | Hours logged + user self-rating |
| Cool-down | Consistency signal (do you do it after routines) |

**Assessment routines** — per-category diagnostic routines that suggest a baseline level. Example: "Ear Training assessment" runs a 10-minute set of interval + chord identification tests and suggests the user's level based on accuracy. User can accept the suggestion or override.

**Per-level curricula** — for each category × level combination, a curated set of drills / sheets / exercises the AI Coach can pick from. Example: "Technique @ Comfortable" includes 12 built-in drills at moderate tempos; "Technique @ Fluent" includes 20 built-in drills at faster tempos + more complex patterns. Curricula are static content authored by Jeff (with AI drafting help).

**Auto level-up recommendations** — when a user consistently rates 4–5 on vibe-checks at their current level for 2+ weeks AND their automated grade signals trend upward, the app suggests a level bump. User confirms (never auto-applied).

**Level-up celebrations** — subtle. "Nice — moving from Developing to Comfortable at Ear Training!" No confetti, no sound, no gamification-cringe. Just quiet acknowledgment that a milestone was reached.

**"How am I trending?" panel in Reports** — line chart per category showing computed grade over time, with level thresholds marked. Motivating without being competitive (never compared to other users).

### 1.3 Data model additions

```ts
type GradeSample = {
  categoryId: CategoryId;
  timestamp: number;
  /** Computed composite score, 0-100. Meaning is per-category. */
  computedScore: number;
  /** Which signals fed the composite. */
  signals: Array<{
    kind: "drill-tempo" | "song-transition" | "assessment-score" | "vibe-check" | ...;
    value: number;
  }>;
  suggestedLevel?: ProficiencyLevel;
};

type AssessmentRoutine = {
  id: string;
  categoryId: CategoryId;
  name: string;
  description: string;
  items: RoutineItem[];  // the assessment items
  scoringFn: (results: AssessmentResults) => ProficiencyLevel;
};

type CurriculumEntry = {
  categoryId: CategoryId;
  level: ProficiencyLevel;
  items: Array<{
    kind: "drill" | "sheet" | "scale" | "custom";
    id: string;
    difficulty: "at-level" | "stretch" | "review";
  }>;
};
```

### 1.4 Estimated v2 build

**~6–8 weeks as a dedicated v2 slice**, best done after v1 GA + 2–3 months of real usage data. Uses v1 signals (self-ratings, vibe-checks, level history) to inform the automated grader's calibration.

### 1.5 Open questions to resolve before building

1. **Assessment routine authorship** — Jeff / AI-drafted / community-contributed?
2. **Curriculum size** — how many items per category × level? Enough to feel curated; small enough to author.
3. **Grading transparency** — does the user see the grading formula, or is it a black box? Recommend transparent.
4. **Override mechanism** — user disagrees with a suggested level. How does the app respond?
5. **What if signals conflict?** Automated grade says "you're ready to level up" but user vibe-checks say "I'm still struggling." Which wins?

---

## 2. Sharing Routines Via URL / Code

Encode a routine as a URL or short code that another user can paste to instantly load. Same pattern as the appearance-code sharing already shipped.

### Scope

- Encode routine (items + metadata) as base64url + compression.
- Short URL: `https://practice-prodigy.vercel.app/r/AbCdEfGh...`
- User pastes URL / code → app decodes → loads as a fresh unsaved routine ready to save.
- Attribution: "Shared by user X" (if the sharer opted in via profile setting).

### Estimated build

~1 week. Standalone; no dependencies on other v2 items.

---

## 3. Community Routines Library

Users can browse routines other users have shared publicly. Filter by category, methodology, duration, or user rating.

### Scope

- New "Community" tab (or sub-view of Templates) listing public routines.
- Users opt-in to publish their routines with a title + description.
- Ratings + comments (light social layer).
- Moderation queue (spam, inappropriate content).

### Estimated build

~3–4 weeks. Depends on cloud sync (v1 ✅) + share-via-URL (item 2 above).

### Risks

- Content moderation burden.
- Attribution + copyright (routines might reference lead sheets that use copyrighted material).

---

## 4. Teacher Mode

The multi-user layer. A teacher can assign routines to students, review completed sessions, comment on student progress.

### Scope

- Account type: teacher vs student vs both.
- Teacher can invite students via email; students accept.
- Teacher can assign a routine (or a series) to one or many students, with an optional due date.
- Students see assigned routines in their Routines tab with a "Assigned by [Teacher]" tag.
- After completion, teacher gets a notification + can review the session (time spent, per-item completion, vibe-check ratings, optional student reflection).
- Teacher can comment on submitted sessions ("Try slower on the Autumn Leaves bridge next time").

### Estimated build

~6–8 weeks. Requires:
- Multi-user relationships (teacher-student links)
- Notifications infrastructure
- Assignment data model (extends Routine + RoutineExecution with `authorId` + `assigneeIds` + `dueAt` — already in v1 data model as forward-compat fields).
- Comment layer on RoutineExecution.

Data model forward-compat already in v1 (nullable authorId, assigneeIds, dueAt fields) so teacher mode is additive, not destructive.

### Risks

- Onboarding a teacher is very different from onboarding a solo user — needs its own wizard.
- Privacy: what does a teacher see vs not see about their student's other practice?
- Pricing: teacher accounts likely become a paid tier (Practice Prodigy Studio).

---

## 5. Ear Training Module

A dedicated Ear Training module (currently listed in `MODULES` registry as `status: "sketch"`, `bucket: "later"`).

### Scope

- Interval identification (asc / desc / harmonic).
- Chord quality identification.
- Melodic dictation (play 4-8 note phrases, user reproduces).
- Rhythmic dictation.
- Cadence identification.
- Scale degree identification (in a key context).
- Progression identification (I-V-vi-IV, ii-V-I, blues 12-bar, etc.).

### v1 vs v2 integration

- v1 supports `type: "custom"` ear-training routine items (user runs their own external ear-training tool, logs time as Ear Training category).
- v2 adds a real Ear Training module + `type: "ear-training"` routine items with a Launcher / Composer / Renderer (per §5.1–5.4 of ROUTINE-DESIGN.md v0.1's cross-module contract).
- Powers automated grading for Ear Training (item 1 above).

### Estimated build

~4–6 weeks for the module + integration.

---

## 6. Sight Reading Module

Adaptive sight-reading module currently in registry as `status: "sketch"`.

### Scope

- App generates short notation snippets calibrated to user's level.
- User plays; app times + evaluates.
- Difficulty progresses as user reads cleanly.
- Starts with bass + guitar (single-line clef-aware notation).
- Later: piano (dual staff), voice (with solfège hints).

### Estimated build

~6–8 weeks. Requires VexFlow (already shipped in LSB), a level curriculum for reading difficulty (rhythm complexity + key + note range), and an evaluation mechanism (audio pitch detection from Tuner module works for monophonic).

---

## 7. Theory Module

Curriculum-driven theory lessons + drills. Currently `status: "sketch"`.

### Scope

- Curated curriculum: intervals → triads → 7th chords → extensions → modes → progressions → voice leading → substitution → basic counterpoint.
- Each unit: read material (article) + drill (quiz-style) + practice item (routine integration).
- Progress tracking (units completed).

### Estimated build

~8–12 weeks. Big content-authoring effort (curriculum design).

---

## 8. Community + Marketplace for Drills / Songs / Templates

Users can publish their own drills / lead sheets / templates / routines to a community library. Others can install with one click.

### Estimated build

~4–6 weeks after teacher mode + community routines (items 2 + 3 + 4).

---

## 9. Audio Analysis / Real-Time Feedback

Mic input during practice → real-time evaluation.

### v3+ scope (deferred beyond v2)

- Monophonic pitch detection (bass, voice, wind instruments) — could ship earlier since the Tuner already does this.
- Timing accuracy vs metronome.
- Real-time corrective overlay ("you're rushing," "wrong note," "good").
- Polyphonic pitch detection (piano, guitar) — hardest; wait until monophonic is battle-tested.

### Estimated build

~8+ weeks per module (bass first, then voice, then guitar).

---

## 10. Instrument Selector (Multi-Instrument Support)

Rename "Bass Arpeggios" → "Arpeggios" with an inline instrument picker on setup screens. Every drill carries an `instrument` field; per-instrument built-in drills; instrument-specific voicings and metronome preview timbres.

### v2 scope

- Instrument field on Drill / Sheet / Song entities.
- Per-instrument built-in libraries.
- Instrument switcher on setup screens (per-drill choice, not per-session).
- Later: instrument-specific audio synthesis for previews (bass line for bass, piano for piano, etc.).

### Estimated build

~3–4 weeks.

---

## 11. Backing Track Generation

App generates a simple drum + piano backing under any drill (chord changes, tempo, style).

### Estimated build

~3 weeks (uses Tone.js). Non-trivial UX for "what style of backing?"

---

## 12. Notifications + Reminders

- Practice reminders (daily / streak-preserving / scheduled routine).
- Level-up nudges ("You haven't touched Ear Training in a week — your streak of daily practice is at 12 days").
- Missed-day gentle nudge (not manipulative).

Delivery: browser push notifications, email digests, optional SMS.

### Estimated build

~2–3 weeks. Requires notifications infrastructure (Vercel + Supabase Edge Functions + web push).

---

## 13. Progress Photos / Video Diary

Users can attach short video snippets to sessions (played through their webcam). Track progress visually. Compare "me playing Autumn Leaves in July" vs "me playing it in October."

### Estimated build

~4 weeks. Storage cost (video is expensive) needs a bounded retention policy.

---

## 14. Practice Buddies / Accountability Partners

Pair with another user (opt-in). See each other's streak + weekly totals. Encouragement messages.

### Estimated build

~3 weeks after teacher-mode infrastructure.

---

## 15. Retention Policy

Deferred detail from `ROUTINE-DESIGN.md` §5.3. Currently "forever, user can delete." v2 might add:

- Auto-archive sessions older than N years (Pro tier retains longer).
- Bulk delete by date range.
- Data-portability export improvements (better formats, more granular).

---

## 16. Free vs Pro Tier Structure

Deferred from `ROUTINE-DESIGN.md` §17 open items. Once cloud sync + AI + storage costs are real, evaluate:

- Free tier limits (max routines? max session history retention? AI request cap?)
- Pro tier features (unlimited, teacher mode, priority AI, higher storage, video)
- Studio tier (teacher + multi-student features)
- Pricing decisions

---

## 17. Change Log

| Date | Change |
|---|---|
| 2026-07-22 | v1 — Initial backlog. Captures the 17 major v2+ items deferred from the v1 flagship scope. Anchored on user's 2026-07-22 request that "nothing be lost when we go beyond v1." |
