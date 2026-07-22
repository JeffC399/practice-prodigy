# Chords — Design (v0.1)

> The platform's fourth drilling module. Guitar-first; piano lands in v2. Fills the harmonic-voicings gap alongside Arpeggios (chord outlines) and Scale Driller (single-line scales) so the technique-drilling trio is complete.

**Doc status:** v0.1 initial design — 2026-07-22
**Target ship:** After My Practice Slice B (routine-item plumbing lands there). Estimated ~4–6 weeks of build once Slice B is stable.
**Design source:** User interview 2026-07-22 (8 locked decisions).

**Companion docs:** `ROUTINE-DESIGN.md` v0.5 (My Practice integration surface) · `MY-PRACTICE-BUILD-PLAN.md` v1.3 (Slice B routine-item contract) · `MY-PRACTICE-V2-BACKLOG.md` v1.1 (audio playback + listening deferred).

---

## 1. Purpose & Positioning

The drilling modules already shipped or scoped:

- **Arpeggios** — chord outlines as single-note sequences (1-3-5-7 etc.).
- **Key Sequencer** — pool of keys × prompt words for cross-instrument practice.
- **Scale Driller** — pool of scale × key combos.

**Chords** completes this technique-drilling trio by adding **harmonic voicings** — the specific fretboard shapes guitarists have to internalize. Same pool + Now/Next + randomization pattern as the others, adapted to the fact that a chord isn't just a name — it's a physical shape in a specific position on the neck.

### 1.1 Strategic fit

- **Fills a real practice gap.** Guitarists spend enormous time drilling chord shapes and progressions. Serious hobbyists learning jazz repertoire, blues, or contemporary styles all need this.
- **Modest incremental scope over Arpeggios/Scales** because ~70% of the substrate (metronome engine, session tracker, category tagging, cloud sync, My Practice integration) is already shipped or scoped.
- **Feeds the platform's instrument-selector v2 story.** Chords is inherently instrument-specific — building it forces a clean separation between "instrument-agnostic modules" (Arpeggios/KS/Scales) and "instrument-specific modules" (Chords). Piano-Chords in v2 becomes a natural addition once that separation exists.

### 1.2 Primary user

Same as the platform: **serious adult hobbyist**. Guitarist who plays for love (jazz, blues, folk, rock — any style with fretboard chord work). Practices 30–90 min most days. Wants to internalize the CAGED system, build a jazz voicing vocabulary, or systematize their chord practice.

---

## 2. Core Concepts

### 2.1 Hybrid drill unit — patterns generate voicings

A **pattern** is a *system* for organizing chord voicings — CAGED, barre shapes, drop-2, open-position, etc. When a pattern is combined with keys + qualities, it *generates* a set of specific **voicings** (each voicing = a specific fretboard shape at a specific position for a specific chord).

**A drill can be at either level**:
- **Pattern-level drill**: "CAGED major triads, all 12 keys, positions 1-5" → generates 60 voicings, drilled in a defined or randomized order.
- **Voicing-level drill**: "these 8 specific hand-picked voicings" → drilled as a pool.

Both share the same execution surface (Now / Next cards + metronome). The pool-builder UI differs.

### 2.2 Instrument constraints (v1)

- **6-string guitar only** in v1. Piano is v2.
- **Standard tuning only** (E-A-D-G-B-E). Alternate tunings (drop D, DADGAD, open tunings) are v2.
- **No 7-string / bass / baritone support in v1.**

Explicitly guitar-only avoids the "one abstraction to rule them all" trap. When piano ships in v2, the module becomes a namespace with two implementations — not a single generalized one.

### 2.3 Reuse existing chord vocabulary

The app already ships:
- **20 chord qualities** (`CHORD_QUALITIES` in `src/lib/music/chord.ts`) — from major/minor triads through 7ths, 9ths, 13ths, sus/add, altered.
- **4 chord-notation styles** (jazz-minus / lowercase-m / plain-ASCII / long-form).
- **Chord rendering** (`src/lib/music/render-chord.ts`).
- **12 pitch classes** with enharmonic display preferences.

**The Chords module reuses all of this.** Every chord referenced in Chords carries the same `{ root: PitchClass, quality: ChordQuality }` shape used by Arpeggios and Lead Sheet Builder. Renaming a chord quality in Arpeggios automatically renames it in Chords. Shared vocabulary; shared rendering.

---

## 3. v1 Pattern Library

Six pattern systems ship built-in. Users may add custom patterns on top (see §4).

### 3.1 The six systems

| # | Pattern | Configurable dimensions | Notes |
|---|---|---|---|
| 1 | **Open chords** | Which shapes | The fundamental first-position shapes: G, C, D, A, E, Am, Dm, Em, F (partial barre), plus common minor and 7 variants. |
| 2 | **CAGED major triads** | Keys + positions (1-5) | 5 CAGED positions across the neck. Quality locked to major triad. |
| 3 | **CAGED minor triads** | Keys + positions (1-5) | Same as #2 but minor. |
| 4 | **Barre shapes** | Keys + form (E / A) + quality (maj / min / dom7) | The everyday movable voicings. E-form + A-form × major, minor, dominant 7. |
| 5 | **Diatonic 7ths in a key** | Key (single) | The 7 diatonic 7th chords (Imaj7 → ii7 → iii7 → IVmaj7 → V7 → vi7 → viiø7) in one key. Jazz vocabulary workhorse. |
| 6 | **Drop-2 voicings** | Keys + qualities (maj7 / min7 / dom7 / m7♭5 / dim7) + positions (2-3 typical) | Root-position 7ths across the neck. Jazz core. |

### 3.2 Pattern definition

Each pattern is a config declaring:
- Its **available dimensions** (keys, qualities, positions, form, shape-list, single-key, etc.)
- **Voicings generator** — given selected pool values, produces the voicing list
- **Difficulty tag** (see §7)
- **Category default** (Technique for all v1 patterns)
- **Icon** for the pattern picker UI

### 3.3 Deferred to v2

- Drop-3 voicings (jazz)
- Extended jazz voicings (9ths, 11ths, 13ths, altered)
- Sus / add chords
- Power chords (rock)
- Two-note voicings / chord-melody voicings

Users can define custom patterns for anything from this list.

---

## 4. Custom Pattern Authoring

Users can author their own patterns beyond the 6 built-ins. **Two input methods** ship in v1:

### 4.1 Interactive fretboard editor

- User sees a fretboard (6 strings × configurable frets 0–15).
- Taps a fret position to add a dot; taps again to remove.
- Marks strings as muted (X) or open (O) by tapping above the nut.
- Optionally assigns fingering numbers (1, 2, 3, 4, T for thumb).
- Sets the chord's root note + quality (from existing vocabulary).
- Names the pattern.
- Saves to the user's Chords library.

**~1 week of build work.** The fretboard editor component is later reused for authoring voicings inside custom patterns AND for rendering during drills (§5).

### 4.2 Tab-text input

- User enters a chord in compact tab notation: `x32010` for open C major (mute low E, 3rd fret A, 2nd fret D, open G, 1st fret B, open high E).
- Extended syntax for fingering: `x32010 T1_23_4` (optional finger numbers).
- Fast for keyboard-oriented users; familiar to anyone who's used tab.
- Saved with the same `Chord + Quality` metadata.

**~2 days of build work.** The parser is small and predictable.

### 4.3 Custom patterns compose with the 6 built-ins

- A user's custom pattern behaves identically to a built-in in the pool builder (§6), My Practice integration (§10), and drill execution (§5).
- Custom patterns can define their own configurable dimensions (or none — a fixed set of voicings).

---

## 5. Drill Screen (Now / Next Display)

The drill screen mirrors the visual language of Scale Driller and Key Sequencer — Now / Next cards, PhaseBadge, BeatDots, sticky top bar with tempo cluster.

### 5.1 Now card content (Practice mode, default)

- **Header row** — big chord name (e.g. "Cmaj7") + secondary label (e.g. "Drop-2, Position 3" or "CAGED Position 4"). Uses existing chord-notation style prefs.
- **Fretboard diagram** — full-size render of the voicing (dots + X for muted + O for open + optional finger numbers + optional barre indicator + position marker on the neck).
- **Progression info** (small, bottom-right of card) — "Chord 3 of 5 in this pattern" or similar.

### 5.2 Next card content (Practice mode)

- Compact fretboard (~50% size) + chord name text.
- Same visual language as Now, scaled down.
- Only visible during play (hidden during count-in and prep windows — same pattern as Scale Driller).

### 5.3 Test mode (per-drill toggle)

A per-drill setting switches the Now / Next cards to a **name-only view**:
- Big chord name + secondary label
- **Fretboard is hidden**
- User recalls the shape from memory + plays it
- Next card also shows name only

The toggle is a segmented control at the top of the drill screen: `[Practice] [Test]`. Persists per-drill (saved on the drill's config).

Users can practice a routine in Practice mode until they feel solid, then flip to Test to check memory. Best-in-class pedagogy.

### 5.4 Guidance overlay (when methodology is set)

Same pattern as My Practice §7.4 — if the drill's routine item has a methodology tag (e.g. Slow Practice from §10), the drill screen shows a small guidance chip:

> **Slow Practice** · Play at your clean tempo. Nudge up when 5 clean in a row.

Guidance is display-only in v1 (per My Practice §7.4 scope-check). Runtime enforcement is a v2 slice.

---

## 6. Pool Builder

The pool builder is **pattern-aware** — the controls it renders depend on which pattern is selected. Same universal pool-builder component reads the pattern's `dimensions` config and shows the appropriate controls.

### 6.1 Universal shell

Every pool builder shows (regardless of pattern):
- Selected pattern (dropdown at top; changing swaps the controls below)
- Preset chips row (per Scale Driller convention) — e.g. "All / Common / None"
- Selected-count summary (e.g. "24 voicings selected")
- Preview chip strip showing the resulting voicings

### 6.2 Per-pattern controls (examples)

| Pattern | Controls rendered |
|---|---|
| Open chords | Shape checkbox grid (G, C, D, A, E, Am, Dm, Em, F, C7, D7, G7, ...) |
| CAGED major triads | Keys checkbox row (12) × positions checkbox row (1-5) |
| CAGED minor triads | Same as CAGED major |
| Barre shapes | Keys × form (E / A) × quality (maj / min / dom7) checkboxes |
| Diatonic 7ths in a key | Key selector (single-choice dropdown) |
| Drop-2 voicings | Keys × qualities (maj7 / min7 / dom7 / m7♭5 / dim7) × positions (2-3) |

Voicing preview updates as the user checks/unchecks controls. Layout convention: keys as columns, other dimensions as rows.

### 6.3 Custom-combo picker (deferred consideration for v1.1)

Scale Driller's "+ Add specific combo" affordance for hand-picking outside the cross-product may be added to Chords once the pool builder is stable. Not required for v1.

---

## 7. Difficulty Tags + Proficiency Integration

Each pattern carries a **difficulty tag**:

| Tag | Meaning |
|---|---|
| **open** | Open-position chords, minimal barre effort. Beginner-appropriate. |
| **barre** | Barre chords (E-form, A-form). Intermediate. |
| **advanced** | Jazz voicings (drop-2, etc.), complex fingerings. |

### 7.1 Where tags surface

- **Pattern picker** — shows difficulty as a small chip on each pattern card.
- **My Practice AI Coach** — reads user's Level for Technique (per My Practice §4.3) and filters recommendations. A Level 2 (Developing) user gets Open patterns proposed first; the Coach explains ("since you're at Level 2 with Technique, I've started with open shapes").
- **Reports** — practice time by difficulty tag rolls up as a small secondary chart.

### 7.2 Difficulty is per-pattern, not per-voicing

Simplifies both the data model and the UI. Custom patterns can be tagged by the user at creation time.

---

## 8. Fretboard Renderer

A single canonical fretboard component that both this module and future features can reuse.

### 8.1 Requirements

- Render a 6-string guitar fretboard, configurable frets 0–24 (default 0–15 for a Chords display; can be zoomed).
- **Dots** at fingered frets (colored per convention).
- **X** above muted strings; **O** above open strings.
- **Barre indicator** — horizontal bar across frets where a finger presses multiple strings.
- **Position label** — small text next to the fret ("Position 3" or "5fr" showing the starting fret).
- **Fingering numbers** (optional, per user setting) — 1/2/3/4/T rendered on each dot.
- **Multiple sizes** — full-size (Now card), compact (Next preview + preview chips), thumbnail (My Practice item card).
- **Two color modes** — light + dark (respects the app's theme).
- **Accessible** — includes an aria-label with a text description of the voicing.

### 8.2 Implementation approach

**Custom SVG** (recommended). Full control over sizing + theming + accessibility. ~300–500 LOC. No new library dependencies. Testable in isolation.

Rejected alternatives:
- VexFlow — great for staff notation, but its guitar-tab rendering is oriented toward passage tabs, not standalone chord diagrams. Overkill.
- Third-party libraries (react-chord-svg etc.) — surveyed briefly; none match our theming + accessibility needs. Would end up custom-rendering anyway.

### 8.3 Cross-module reuse

Once built, the fretboard renderer plugs into:
- Lead Sheet Builder — optional chord diagrams above chord symbols (v2 polish).
- Future guitar-flavored Arpeggios variant (v2 instrument-selector work).
- Chord dictionary features (future).

---

## 9. Session Settings

Inherited from Scale Driller's shape. Every drill config carries:

- BPM (30–300, per app-wide `BPM_MIN` / `BPM_MAX`)
- Time signature (standard 10 options)
- **Beats per chord change** (typical: 2, 4, 8; user-configurable)
- Prep beats before each change (optional; default 0)
- Count-in measures (0 / 1 / 2)
- Repetitions or loop indefinitely
- Randomize order (on/off; controls whether the pool is randomized or cycled sequentially)
- Enharmonic preference (auto / sharps / flats — shared with app)
- Notation style (per user's global default)

### 9.1 Drill-mode toggle

Segmented control on the drill screen: `[Practice] [Test]` (§5.3). Persists per-drill.

### 9.2 Fingering-numbers toggle

Global setting in Settings → Practice: "Show fingering numbers on chord diagrams" (default off). Per-drill override available.

---

## 10. My Practice Integration

**Landing simultaneously with Slice B of the My Practice build** — the routine-item plumbing exists, so Chords drops in cleanly.

### 10.1 RoutineItem type

New variant added to the discriminated union in `src/lib/practice/routine-types.ts` (Slice B):

```ts
type ChordDrillRoutineItem = RoutineItemBase & {
  type: "chord-drill";
  chordDrillId: string;       // reference to a saved Chords drill
};
```

### 10.2 Defaults per §4.3 + §7.3 of ROUTINE-DESIGN

- **Category default**: `Technique` (per My Practice §5.2 module → category map).
- **Methodology default (per-item)**: `Slow Practice` (per My Practice §7.3 category → methodology map).
- **Scope**: methodology at item-level; users can override.

### 10.3 Launcher / Composer / Renderer

Per Slice B's cross-module contract:

- **Launcher** — opens `/practice/chords/session?routineMode=1&chordDrillId=<id>`. Same routineMode pattern as other drilling modules — chip in top-right, take-over of viewport.
- **Composer** — small form for selecting a saved chord drill from the user's library (dropdown) + optional overrides.
- **Renderer (chip)** — compact card in the routine builder showing chord drill name + estimated duration.
- **Renderer (full-screen)** — the drill's own screen takes over during routine execution.

### 10.4 Session tracker

Chord drills report their practice time to the central `useSessionTracker` (Slice A.6). Category defaults to Technique unless the saved drill has an override.

---

## 11. Data Model

Full TypeScript-shape reference. Field names may adjust during implementation.

```ts
// The unit a user actually drills
type Voicing = {
  id: string;                    // stable id
  chord: { root: PitchClass; quality: ChordQuality };  // reuses existing vocabulary
  /** Fret per string, low E → high E. -1 = muted, 0 = open, 1+ = fret. */
  frets: [number, number, number, number, number, number];
  /** Fingering per string (optional). 0 = no finger, 1-4 = fingers, T = thumb. */
  fingering?: [number | "T", number | "T", number | "T", number | "T", number | "T", number | "T"];
  /** Barre indicator: which fret + which strings. Optional. */
  barre?: { fret: number; fromString: number; toString: number };
  /** Position label ("Position 3" / "5fr" / "Open"). Optional. */
  positionLabel?: string;
  /** Difficulty inherited from pattern, or set by user for custom voicings. */
  difficulty: "open" | "barre" | "advanced";
};

// A pattern — either built-in or user-authored
type ChordPattern = {
  id: ChordPatternId;
  slug: string;                  // stable url-safe id
  name: string;
  description: string;
  /** Which pool-builder dimensions this pattern exposes. */
  dimensions: PatternDimension[];
  /** Generator: (pool selection) → concrete voicings list. Pure function. */
  generate: (selection: PatternSelection) => Voicing[];
  difficulty: "open" | "barre" | "advanced";
  isBuiltIn: boolean;
  ownerId?: string;              // set for custom patterns; undefined for built-ins
};

type PatternDimension =
  | { kind: "keys"; label: string }              // 12-key checkboxes
  | { kind: "positions"; label: string; range: [number, number] }  // CAGED 1-5, drop-2 2-3, etc.
  | { kind: "qualities"; label: string; options: ChordQuality[] }  // maj7, min7, etc.
  | { kind: "shape-list"; label: string; options: string[] }       // specific shape names (open chords)
  | { kind: "single-key"; label: string }        // dropdown; only one key
  | { kind: "form"; label: string; options: string[] };            // E-form, A-form, etc.

// A saved user drill
type ChordDrill = {
  id: string;
  name: string;
  notes?: string;
  patternId: ChordPatternId;
  poolSelection: PatternSelection;
  sessionSettings: ChordDrillSessionSettings;  // BPM, time sig, beats-per-chord, etc.
  drillMode: "practice" | "test";
  createdAt: number;
  updatedAt: number;
  lastLoadedAt?: number;
  isStarter?: boolean;           // built-in drills flagged for the setup page
  category?: CategoryId;         // optional override; defaults to Technique
};

type ChordDrillSessionSettings = {
  bpm: number;
  timeSignature: TimeSignature;
  beatsPerChord: number;         // 2 / 4 / 8
  prepBeats: number;             // default 0
  countInMeasures: number;
  repetitions: number;
  repeatIndefinitely: boolean;
  randomize: boolean;
  enharmonicPreference?: EnharmonicPreference;
  showFingering: boolean;        // per-drill override of global setting
};
```

---

## 12. Module Surface

- **Route**: `/practice/chords`
- **Label**: "Chords"
- **Icon**: `Guitar` (from lucide-react)
- **Module registry entry**: added in the build phase; status `designed` until Chords ships, then `live`.

### 12.1 Setup page shape

Follows the Scale Driller / Key Sequencer setup page pattern:
- Header with title + description
- Onboarding card (first-visit)
- Your custom drills section (collapsible; starts with any saved user drills)
- Built-in drills section (collapsible; ships with ~6-8 starter drills across the 6 patterns)
- Pattern picker + pool builder (§6)
- Session settings section
- Save-as-drill inline form
- Start button

### 12.2 Session page shape

Follows the Scale Driller session page pattern:
- Sticky header (back to setup + status chips + tempo cluster + drill length)
- Practice/Test mode toggle (§5.3)
- PhaseBadge
- Now / Next cards (§5.1–5.2)
- BeatDots
- Start/Stop button + space keyboard shortcut

---

## 13. Cross-Module Integration

### 13.1 Reused existing infrastructure

- **Chord vocabulary + rendering** — `src/lib/music/chord.ts`, `render-chord.ts`
- **Metronome engine** — `src/lib/audio/metronome.ts`, `use-metronome.ts`
- **Layout components** — CollapsibleSection, ClampedNumberInput, PresetChip, OnboardingCard, shared shell
- **Session tracker** — Slice A.6 (My Practice foundation)
- **Cloud sync** — Slice A.3–A.5 (per-store sync)
- **Category system** — Slice A.9 (Technique default)

### 13.2 New infrastructure landed by Chords

- **Fretboard renderer** — canonical component in `src/components/shared/fretboard.tsx` (or similar). Reusable across future features.
- **Voicing type + parser** — the tab-text notation parser (§4.2). Small utility that other features can call.

### 13.3 My Practice integration (§10)

- New `RoutineItem.type: "chord-drill"` variant.
- Launcher + Composer + Renderer per Slice B contract.
- Session tracker wire-up.

---

## 14. v1 Build Sequencing (High-Level Reference)

Detailed phase breakdown belongs in a separate `CHORDS-BUILD-PLAN.md` written at implementation start. High-level shape:

- **Phase 1 — Types + stores + shared fretboard component (~1 wk)**. Data model, Zustand stores, canonical fretboard SVG.
- **Phase 2 — Six built-in patterns + pool builder (~1.5 wk)**. Pattern configs, voicing generators, pattern-aware pool builder shell.
- **Phase 3 — Setup page (~1 wk)**. Full setup screen with drill library, onboarding, session settings.
- **Phase 4 — Session/drill page (~1 wk)**. Now/Next cards, Practice/Test toggle, PhaseBadge, BeatDots, metronome wiring.
- **Phase 5 — Custom pattern authoring (~1.5 wk)**. Interactive fretboard editor + tab-text input + save-to-library.
- **Phase 6 — My Practice integration + starter drills + docs (~0.5 wk)**. Slice B RoutineItem type, starter drill seeding, PROJECT-DESIGN + IDEAS updates.

**Total: ~6 weeks** after My Practice Slice B ships. Fits the estimate given in the interview.

---

## 15. Open Items (defaults proposed, revisit at implementation)

| # | Item | Proposed default |
|---|---|---|
| 1 | Fret range default in fretboard renderer | 0–15 frets; auto-fits to the highest fretted note + 2 |
| 2 | Fingering shown when a pattern doesn't specify | Off; falls back to no numbers |
| 3 | Barre indicator style | Thin horizontal bar; primary color |
| 4 | Muted string glyph | X above nut; muted color |
| 5 | Position marker style | Text label near the neck ("5fr") + optional highlight of the fret |
| 6 | Voicing preview count in pool builder | 24 chips before "+N more" (mirrors Scale Driller) |
| 7 | Randomize order default | Off (sequential); user opts in |
| 8 | Test mode default | Off (Practice mode as default) |
| 9 | Custom-combo picker (§6.3) | Deferred to v1.1 unless users request |
| 10 | Progression drilling (ii-V-I sequences) | Deferred to v2; overlaps with Lead Sheet Builder territory |

---

## 16. Deferred to v2

- **Audio playback** — chord synth strum + tap-to-hear + auto-audio drill (§2 of this doc, §7 in original interview).
- **Listening mode** — rhythm-only, monophonic, or polyphonic pitch detection. Ships as part of `MY-PRACTICE-V2-BACKLOG.md` §9 (Audio Analysis / Real-Time Feedback) — a platform-wide slice, not a Chords-specific feature. Chords integrates with it day-1 when it ships.
- **Piano support** — separate route or instrument-selector layer (per v2 backlog §10).
- **Alternate tunings** — drop D, DADGAD, open tunings.
- **7-string / bass / baritone guitar support.**
- **Additional pattern systems** — drop-3, extended jazz voicings (9ths, 11ths, 13ths), sus/add, power chords, chord-melody voicings.
- **Chord progression drilling** — ii-V-I sequences, blues 12-bar. Overlaps with Lead Sheet Builder; may become a joint feature.
- **Methodology runtime enforcement** — Slow Practice mode enforcing tempo caps + 5-clean-restart-on-flub inside the Chords drill. Per `MY-PRACTICE-V2-BACKLOG.md` §1.5.
- **Automated grading** — per `MY-PRACTICE-V2-BACKLOG.md` §1.

---

## 17. What This Doc Is / Isn't

**Is**:
- The design target for Chords v1.
- The cross-module contract (RoutineItem type, category defaults, methodology defaults).
- The source-of-truth for scope decisions during implementation.

**Isn't**:
- The build plan. That's `CHORDS-BUILD-PLAN.md` (written at implementation start).
- The UX mockups. Visual treatment iterates during implementation.
- The final API. Field names may adjust; conceptual shape holds.

---

## 18. Change Log

| Date | Change |
|---|---|
| 2026-07-22 | v0.1 — Initial design pass. 8 locked decisions from user interview: (1) design now + build after My Practice Slice B; (2) hybrid drill unit (patterns generate voicings; drills can be at either level); (3) 6 built-in pattern systems (Open chords + CAGED major triads + CAGED minor triads + Barre shapes + Diatonic 7ths + Drop-2 voicings); (4) custom pattern authoring via BOTH interactive fretboard editor AND tab-text input; (5) big fretboard + prominent chord name display + per-drill Practice/Test toggle; (6) route /practice/chords, label "Chords", guitar-only in v1; (7) audio playback deferred to v2; (8) listening mode deferred to v2 audio-analysis slice. Additional locked constraints: 6-string standard tuning only, reuse existing 20-quality chord vocabulary, difficulty tags per pattern (open/barre/advanced) feeding proficiency system, fingering-suggestions optional rendering, session settings inherit Scale Driller shape, day-1 My Practice integration with `chord-drill` RoutineItem type. Estimated build: ~6 weeks after Slice B ships. |
