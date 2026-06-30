# My Practice (Routines) — Design

> Cross-module composition layer. The architectural feature that turns Practice Prodigy from "a collection of tools" into "a platform musicians actually use."

**Doc status:** v0.1 design pass — 2026-06-29
**Target ship:** v2 milestone, paired with the Metronome module (which is the second module to implement the RoutineItem interface)
**Estimated build:** ~4 weeks for v0.1 (interface + Metronome + My Practice surface together)

---

## 1. Purpose & Positioning

The other modules (Bass Arpeggios, Metronome, Tuner, Lead Sheets, Scales, Ear Training, …) are **tools** — things a musician uses. **My Practice** is the **workflow layer** that composes them into actual practice sessions: "build a 45-minute routine that opens with a metronome warmup, runs three arpeggio drills, includes a scale focus, and ends with sight-reading."

Three strategic wins:

1. **Validates the platform thesis.** A routine builder is the composition layer that makes the multi-module architecture real. Without it, the modules are a feature menu, not a product.
2. **Differentiator from competitors.** Tonal Energy, Soundbrenner, Yousician, Practice+ — all ship tools in silos. None has a unified cross-tool routine builder. This is genuinely platform-level capability.
3. **Substrate for teacher mode.** A "routine assigned by a teacher to a student" is the same data model as a personal routine, with metadata. Get routines right and the teacher-student module is mostly UI on top.

**Strategic decision: design the interface FIRST, then build modules to it.** Rationale below in §3.

---

## 2. Core Concepts

### Three nested abstractions

```
Routine                  — "My Tuesday warmup" (a named list of items)
  └─ RoutineItem[]       — each step in the routine
       └─ launches a Module-specific experience
                          (a drill, a metronome session, a tuner check, ...)

RoutineExecution         — one specific run of a routine
                           (when, what got completed, what got skipped)
```

- **Routine** = the template (durable, reusable)
- **RoutineItem** = one step in the template
- **RoutineExecution** = a specific instance of running through the template

This mirrors how a fitness app would model "workout template → exercises → workout session," or how a recipe app would model "recipe → steps → cooking session."

### Why discriminated, not polymorphic

Every RoutineItem has a `type` discriminator (`"drill"`, `"metronome"`, `"tuner"`, `"leadsheet"`, …) and a type-specific data payload. We deliberately avoid making modules implement a polymorphic `Item` interface in code. Reasons:

- **Type narrowing.** TypeScript can exhaustively check each type's handler.
- **Loose coupling.** Modules don't need to import a shared base class; they just contribute a type variant.
- **Forward-compat.** Adding a new module = adding a new `type` value + handler. No refactor of existing types.

---

## 3. Why Design The Interface First (Sequencing Rationale)

The natural temptation is to build the Metronome module first as a standalone, then design routines later. **Don't do that.** Here's why:

If we build three modules in isolation and then try to compose them, each module will have evolved its own idea of "an exercise," "duration," "completion," "progress," and "state." Retrofitting a routine interface onto modules that weren't designed to expose one is the kind of refactor that takes weeks and risks breaking each module's standalone behavior.

By designing the RoutineItem interface BEFORE any new module ships, every new module is built with the interface in mind from day one. The cost is a single ~1-hour design pass upfront. The savings is "no rewrites later."

**Build order:**

1. ✅ This doc — lock the interface.
2. **Metronome module** — built standalone AND implements the RoutineItem interface (`type: "metronome"`).
3. **My Practice v0.1** — ships with just the two modules that exist (Arpeggios + Metronome). Small but real proof of the platform thesis.
4. **Tuner / Lead Sheets / Scales / etc.** — each adds a new `type` to the union. My Practice grows automatically.
5. **Teacher mode** — separate later phase. Adds accounts, assignments, completion review.

---

## 4. Data Model

### RoutineItem

A discriminated union of per-module item types. v0.1 ships two; subsequent modules add to the union.

```ts
type RoutineItemBase = {
  /** Stable id within the routine. */
  id: string;
  /** Display label — shown in the routine list + during execution. */
  label: string;
  /**
   * Estimated duration in seconds. Used for routine total-time
   * estimates + execution progress display. Not a hard limit —
   * users can spend more or less time on any item.
   */
  estimatedSeconds: number;
  /** Optional per-item user note ("focus on left-hand independence"). */
  notes?: string;
};

type DrillRoutineItem = RoutineItemBase & {
  type: "drill";
  /** References a saved drill in the user's drills-library. */
  drillId: string;
  /**
   * If the referenced drill has been deleted, the routine player
   * surfaces a clear "missing drill" state and lets the user
   * skip or re-target.
   */
};

type MetronomeRoutineItem = RoutineItemBase & {
  type: "metronome";
  bpm: number;
  beatsPerMeasure: number;
  beatUnit: number;
  /** Subdivision accents — left to the Metronome module's data model. */
  accentPattern?: number[];
};

// Future additions (v2+):
type TunerRoutineItem = RoutineItemBase & {
  type: "tuner";
  /** Specific notes to check, or null for free chromatic. */
  targetNotes?: string[];
};

type LeadSheetRoutineItem = RoutineItemBase & {
  type: "leadsheet";
  leadSheetId: string;
  repetitions?: number;
};

type ScaleRoutineItem = RoutineItemBase & {
  type: "scale";
  scaleId: string;
  rootCycle: "single" | "all-keys" | "circle-of-fifths";
};

type CustomRoutineItem = RoutineItemBase & {
  type: "custom";
  /** Free-form instruction shown during execution. */
  instruction: string;
};

export type RoutineItem =
  | DrillRoutineItem
  | MetronomeRoutineItem
  // | TunerRoutineItem    // future
  // | LeadSheetRoutineItem
  // | ScaleRoutineItem
  // | CustomRoutineItem
  ;
```

### Routine

```ts
type Routine = {
  id: string;
  name: string;
  notes?: string;
  items: RoutineItem[];
  createdAt: number;
  updatedAt: number;
  /** Last time the user launched this routine. Drives Quick-Start sort. */
  lastRunAt?: number;
  /**
   * Optional total-duration cap. If set, the routine player ends after
   * this many seconds even mid-item. v0.2; reserved field for v0.1.
   */
  hardCapSeconds?: number;
};
```

### RoutineExecution

v0.1 keeps this minimal — just enough to support "resume mid-routine" + an end-of-routine summary. Future versions add history, stats, teacher-mode submissions.

```ts
type RoutineExecution = {
  routineId: string;
  startedAt: number;
  endedAt?: number;
  itemStates: Array<{
    itemId: string;
    status: "pending" | "active" | "completed" | "skipped";
    /** Set when status transitions to completed/skipped. */
    finishedAt?: number;
    /** Actual seconds spent on this item (if tracked). */
    actualSeconds?: number;
  }>;
};
```

For v0.1, we persist **at most one active execution at a time** (similar to the existing resume-session model for drills). Completed executions get discarded — no history yet. History is a v0.2 layer.

---

## 5. Module-Side Implementation

Each module that contributes a RoutineItem type must:

### 5.1 Define the type variant

Add the type to the union in `src/lib/routines/item-types.ts`. The new type's fields live alongside, owned by the module's data model.

### 5.2 Implement a Launcher

The routine player needs to know how to "launch" each item type. Each module exports a launcher:

```ts
// src/lib/audio/metronome-routine.ts
export const metronomeRoutineLauncher: RoutineItemLauncher<MetronomeRoutineItem> = {
  type: "metronome",
  launch: (item, ctx) => {
    // Navigate to the metronome screen with the item's BPM / meter
    // pre-loaded, and a "routine mode" flag that tells the metronome
    // to return to the routine on Stop.
    ctx.router.push(`/metronome?routineMode=1`);
    ctx.store.setRoutineContext({ /* ... */ });
  },
  /**
   * Called by the routine player to ask whether this item's
   * launch surface considers itself "done." Either the module
   * signals completion explicitly (drill played all the way
   * through, user hit "Done"), or the player times out per the
   * item's estimatedSeconds.
   */
  isComplete: (item, moduleState) => /* ... */,
};
```

The launchers are registered in a central `LAUNCHERS` map keyed by `type`. The routine player consults the map by item type.

### 5.3 Implement a Composer (for the routine builder UI)

When the user is building a routine and wants to add an item, the routine builder needs to know what fields each module needs:

```ts
// src/lib/audio/metronome-routine.ts
export const metronomeRoutineComposer: RoutineItemComposer<MetronomeRoutineItem> = {
  type: "metronome",
  displayName: "Metronome session",
  icon: Timer,
  /**
   * Render the form fields the user fills in to compose this item.
   * Returns the assembled RoutineItem on submit.
   */
  renderForm: ({ initial, onSubmit }) => <MetronomeRoutineForm ... />,
  /**
   * Default values for "+ Add metronome item" before the user
   * customizes anything.
   */
  defaults: (): MetronomeRoutineItem => ({ /* ... */ }),
};
```

### 5.4 Implement a Card Renderer (for the routine builder + player UI)

How does an item render as a chip / row in the routine list, and how does it render full-screen during execution?

```ts
export const metronomeRoutineRenderer: RoutineItemRenderer<MetronomeRoutineItem> = {
  type: "metronome",
  renderChip: (item) => <MetronomeChip item={item} />,    // compact, list-view
  renderActive: (item) => <MetronomeActiveCard item={item} />, // full-screen during execution
};
```

### 5.5 Summary: per-module surface area

```
Per module that opts in:
  ├─ Type variant         (data shape)
  ├─ Launcher             (how to start the experience)
  ├─ Composer             (how to build/edit an item)
  └─ Renderer             (how to show it in list + execution)

Total: ~4 small exports per module. Cleanly bounded.
```

---

## 6. The Routine Player

The component that orchestrates execution of a routine. v0.1 design:

### 6.1 Surface

When a routine is active, a thin **routine bar** sits at the top of the page (above the site header? or below it?) showing:

- Routine name
- Current item: "Item 3 of 7 — Daily warmup drill"
- Progress: estimated total time + elapsed
- Buttons: `Skip item · End routine`

The bar persists across navigation — if the current item launches `/practice/session`, the bar still shows above the drill screen.

### 6.2 Item lifecycle

```
                  ┌──────────────┐
   routine start ▶│ pending      │
                  └──────┬───────┘
                         ▼
                  ┌──────────────┐
                  │ active       │ — user is doing the item
                  └──┬────────┬──┘
       Skip pressed  │        │  Module signals completion
                     ▼        ▼
              ┌─────────┐  ┌──────────────┐
              │ skipped │  │ completed    │
              └─────────┘  └──────────────┘
                     │        │
                     ▼        ▼
              (advance to next pending item OR end routine)
```

### 6.3 Persistence

The active `RoutineExecution` lives in a Zustand store (`useActiveRoutine`) with localStorage persistence. Closing the browser mid-routine and reopening it surfaces a "Resume routine?" affordance, similar to the existing drill-resume substrate.

### 6.4 End-of-routine summary

Modal that displays:

- Routine name + total elapsed time
- Per-item status (completed / skipped) with actual seconds spent
- "Run again" / "Build new routine" / "Done" buttons

---

## 7. My Practice Surface (v0.1)

A new top-level module accessed via `/routines` (or `/my-practice` — naming TBD; see §11). Layout mirrors the structure that worked for Bass Arpeggios:

```
┌─────────────────────────────────────────┐
│ Your routines           [your library]  │
│  · tiles with name / item count / total │
│    time / play / edit                   │
├─────────────────────────────────────────┤
│ Starter routines [collapsed]            │
│  · 5-10 shipped routine templates       │
├─────────────────────────────────────────┤
│ Routine builder                          │
│  · Name field                            │
│  · Item list (drag to reorder)           │
│  · "+ Add item" → type picker            │
│       → per-type composer form           │
│  · Live total time                       │
│  · Save / Save as / Discard              │
└─────────────────────────────────────────┘
```

### Starter routines (ship at launch)

5-10 templates teach users what's possible:

1. **Daily warmup (15 min)** — Metronome 60 BPM (3 min) · Arp drill: Daily warmup (10 min) · Metronome 100 BPM (2 min)
2. **Jazz prep (30 min)** — Arp: ii-V-I in 12 keys (15 min) · Arp: All m7 random (10 min) · Custom: "improvise over a backing track" (5 min)
3. **Slow + steady (20 min)** — Metronome 50 BPM (5 min) · Arp: All maj7 in 12 keys, slow (15 min)
4. **Performance warmup (10 min)** — Tuner check (1 min) · Metronome (2 min) · Quick warmup drill (7 min)
5. **Endurance (45 min)** — Loop a moderately hard drill for 45 min, indefinite

### Empty state

When the user has no saved routines, show an inviting card pointing to either the starter routines or the builder.

---

## 8. Cross-Cutting Concerns

### 8.1 Audio engine ownership

Modules currently share a single Tone.Transport (the metronome engine + preview-player race for it). Routines amplify this: if the user runs "Metronome 60 BPM → Arp drill at 90 BPM," the transport needs to cleanly hand off. The routine player coordinates: it tears down the previous module's transport state before launching the next item.

### 8.2 Estimated vs actual time

Items declare `estimatedSeconds` for planning, but actual time can vary. The routine player tracks actual elapsed time per item. End-of-routine summary surfaces the gap (planned 30 min, actual 38 min).

### 8.3 Resume vs start-fresh

If the user starts a routine, gets to item 3, closes the browser, and returns the next day — the resume affordance offers "Resume from item 3" or "Start over." Matches the existing drill resume pattern.

### 8.4 Dirty editing

Same edit semantics as drills: if a routine is loaded for editing and the user makes changes, the dirty state surfaces with Save changes / Discard. Saved routines are non-destructively versioned (`updatedAt` bumps).

### 8.5 Missing reference handling

A routine might reference a drillId that no longer exists (user deleted the drill). When the routine player encounters a missing reference, it surfaces a clear "this drill was deleted — skip or replace?" prompt. The Phase-16 dead-ref cleanup pattern from custom patterns applies here too.

---

## 9. v0.1 Scope Lock

What ships in the first slice:

| Capability | In v0.1? | Notes |
|---|---|---|
| RoutineItem types | drill + metronome | Two type variants only |
| Routine CRUD | Yes | Same shape as drills-library |
| Routine builder UI | Yes | List + per-type composer + drag-reorder |
| Item drag-reorder | Yes | dnd-kit, same substrate as chord pool |
| Estimated total time | Yes | Sum of estimatedSeconds |
| Starter routines (5) | Yes | Auto-seeded on first install |
| Routine player bar | Yes | Top-of-page during execution |
| Resume mid-routine | Yes | localStorage persistence |
| End-of-routine summary | Yes | Modal with per-item status |
| Skip / End early | Yes | |
| Per-item duration override | No | v0.2 |
| Per-item user notes display | Yes during execution | |
| Pomodoro-style rest items | No | v0.2 if requested |
| Sharing routines via URL | No | v0.2 |
| Routine history / stats | No | v0.3 |
| Teacher mode | No | Separate phase, requires cloud sync |

---

## 10. Forward-Compat Hooks for Teacher Mode

Even though teacher mode isn't built in v0.1, the data model includes optional fields that make the future build smooth:

```ts
type Routine = {
  // ... existing fields ...
  /**
   * Optional: who created this routine. For teacher mode, this is
   * the teacher's user id; for personal routines, the user's own id
   * (or omitted in the local-only v0.1).
   */
  authorId?: string;
  /**
   * Optional: who this routine is assigned to. Personal routines
   * leave this empty; teacher-assigned routines name the student(s).
   */
  assigneeIds?: string[];
  /**
   * Optional: due date for assigned routines.
   */
  dueAt?: number;
};

type RoutineExecution = {
  // ... existing fields ...
  /**
   * Optional: free-text note the executor can leave after the
   * routine (e.g. for teacher submissions: "the bridge of #3 was hard").
   */
  reflection?: string;
};
```

These are nullable / optional in the v0.1 schema; teacher mode lights them up later.

---

## 11. Open Questions (to lock before v0.1 implementation)

1. **Naming.** "My Practice" / "Routines" / "Practice Plans" / "Sessions"? My pick: surface the route as `/routines` (technical), label it "My Practice" in the UI (user-facing), call the data model entity a `Routine`. Internal code uses `Routine`; UI says "Practice Routine" or just "Routine."

2. **Routine bar placement.** Above or below the site header? Above probably reads as more important (it's the active context); below tucks it under the chrome. Lean above.

3. **Should "Resume drill" and "Resume routine" coexist?** What if the user has both an active drill resume AND an active routine resume? Routine probably wins (the drill resume was a step within a routine the user was running). Need to clarify the precedence rule.

4. **Should items have a "minimum time"?** Some exercises don't make sense for 30 seconds. Per-item-type minimum estimatedSeconds? Probably a soft warning, not a hard constraint.

5. **How do routines interact with the existing "Built-in drills" library?** Can a routine reference a shipped drill by its `shipped:` id? Yes — same lookup path as the user's drills, just won't ever break (built-ins can't be deleted).

These are answered as the v0.1 build progresses.

---

## 12. What This Doc Is NOT

- Not the build plan. The build plan lives in PROJECT-DESIGN.md change log + IDEAS.md.
- Not the UX mockup. Visual treatment will iterate during implementation.
- Not the full API. Code-level types may differ in details (rename fields, etc.) — the goal here is conceptual alignment.

What this doc IS: **the cross-module contract** that future modules will implement. When the Tuner module is built, this doc tells the implementer "you owe a Type variant + Launcher + Composer + Renderer."
