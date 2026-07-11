# Key Sequencer — Design

> Module design doc for the **Key Sequencer** — the second drilling module in Practice Prodigy, slotted alongside Bass Arpeggios and the standalone Metronome / Tuner. Composability-first: users compose their own prompt sets from user-defined key words rather than picking from a fixed set of drill types.

**Doc status:** v0.1 — locked 2026-07-11
**Target ship:** v1.1 (before Cloud Sync)
**Estimated build:** 5–8 shippable slices, ~1 week of focused work

---

## 1. Purpose & Positioning

The Key Sequencer is a **key-level, instrument-neutral drilling module**. Instead of picking specific chords like Bass Arpeggios does (Cm7 → F7 → Bbmaj7 as a fixed progression), the user picks a **pool of 12 keys** and layers **user-defined prompt rows** on top. Each measure surfaces one key + one word from each prompt row, driving whatever practice the user chose to author.

### 1.1 What this unlocks

- **Instrument-neutral.** A pianist, guitarist, vocalist, saxophonist, drummer practicing feel in different keys — all can use this module identically. Bass Arpeggios pigeonholes users; Key Sequencer doesn't.
- **Composability.** 12 keys × N prompt rows × M items per row generates thousands of unique drill combinations from a small text substrate. Ableton / Notion / Figma-tier extensibility.
- **Cognitive alignment.** The prompt structure ("key → quality → pattern → direction") mirrors how working musicians actually frame practice mentally.
- **Complements — doesn't compete with — Bass Arpeggios.** Bass Arpeggios drills specific chord progressions. Key Sequencer drills key-level flexibility. Users pick based on what they're practicing that day.

### 1.2 What it is NOT

- Not an audio playback engine. Only the metronome click plays. (Per locked scope choice 2026-07-11: silent + metronome only. Truly instrument-neutral. Doesn't compete with or duplicate Bass Arpeggios' audio engine.)
- Not chord-progression drilling. If the user wants specific chord progressions, Bass Arpeggios is the right tool.
- Not a notation engine. Prompts are text only. Users interpret and play on their own instrument.

---

## 2. Core Concept — Keys × Prompt Rows

A Key Sequencer **drill** consists of:

1. A **key pool** — 1–12 keys picked from the 12 pitch classes.
2. Zero or more **prompt rows** — each row is a labeled set of "key words" (short text strings).
3. An **ordering strategy** per pool + per row (sequenced / random with replacement / shuffle-once / shuffle-each-pass / cycle-of-5ths / chromatic ascending or descending — the same 8-strategy enum Bass Arpeggios already uses).
4. Optional **rest measures** between key changes.

Each **measure** surfaces:

- The current **key** (large, dominating the Now card)
- One text word from each prompt row (stacked below the key on the Now card)
- The Next card previews the next key + its word from each row

Everything else — tempo, count-in, look-ahead, meter, session length, layout — is inherited from the existing Bass Arpeggios substrate.

### 2.1 Prompt row semantics

- Each prompt row is **independent**. Row 1 might ordering-cycle while Row 2 randomizes.
- Each measure picks **one word per row** according to that row's ordering strategy.
- Rows have optional **row labels** shown above the setup UI to make the drill authorable at a glance ("Quality," "Pattern," "Direction").
- Up to **3 rows** in v1 (per user's original spec). Extending to N rows in v1.x is a small data-model change.
- Users can **type any text** into a row — the app doesn't validate against music theory. "Play upside down," "Backwards," or "Left hand only" are all legal words. This is intentionally open — the user decides what to prompt.

### 2.2 Example drills (illustrative)

**A. Simplest — bare-bones key cycle**
- Pool: 12 keys, cycle of 5ths order, no rest measures
- Zero prompt rows
- Result: the user sees just the current key + next key. Ideal for tonic-recognition warmups.

**B. Standard three-row workout**
- Pool: 12 keys, random shuffle each pass
- Row 1 (Quality): Maj7, Min7, Dim7, Dom7 — random with replacement
- Row 2 (Pattern): Scale Tones, Arpeggiated 7th, Triad with Leading Tone — cycle
- Row 3 (Direction): Ascending, Descending — cycle
- Result: 384 unique combinations without repeating from just 22 pieces of text.

**C. Modes practice**
- Pool: F, Bb, Eb, Ab, Db (flat keys)
- Row 1 (Mode): Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian — cycle
- Row 2 (Direction): Ascending, Descending
- Result: methodical modal practice across half the keyboard.

**D. Voice / ear-training**
- Pool: All 12 keys, random with replacement
- Row 1 (What to sing): "sing tonic," "sing 3rd," "sing 5th," "sing 7th" — random
- Rest: 2 measures between keys (time to prep)
- Result: eyes-off pitch training.

---

## 3. Data Model

```ts
type PitchClass =
  | "C" | "C#" | "D" | "D#" | "E" | "F"
  | "F#" | "G" | "G#" | "A" | "A#" | "B";

/** One row of user-authored prompts. */
type PromptRow = {
  id: string;                    // stable id for drag-reorder / animation
  label?: string;                // optional — "Quality", "Pattern", etc.
  words: string[];               // free text — user-typed
  ordering: OrderingStrategy;    // reuse the 8-strategy enum from Bass Arpeggios
};

type KeySequencerConfig = {
  keyPool: PitchClass[];         // 1..12
  keyOrdering: OrderingStrategy;
  promptRows: PromptRow[];       // 0..3 in v1
  restMeasuresBetweenKeys: number; // 0..4; default 0

  // Inherited from Bass Arpeggios substrate — same shape:
  bpm: number;
  timeSignature: { beatsPerMeasure: number; beatUnit: number };
  measuresPerKey: number;        // how long one key surfaces before advancing
  repetitions: number;           // total passes through the sequence
  repeatIndefinitely: boolean;   // loop mode
  countInMeasures: number;
  lookAhead: "always" | "late-reveal";
  lateRevealBeats: number;

  // For future extension — enharmonic display preference.
  enharmonicPreference?: "sharps" | "flats" | "auto";

  /**
   * Voice announcement (TTS). When enabled, the browser's built-in
   * `speechSynthesis` API reads the upcoming key + prompt-row words
   * aloud a few beats before each measure change. Great for eyes-off
   * practice — the user can look at their instrument instead of the
   * screen. Silent by default (off).
   */
  voiceAnnounce?: {
    enabled: boolean;
    /** How many beats before the next measure to fire the utterance. Default 2. */
    leadBeats: number;
    /** Voice rate multiplier (0.5–2.0). Default 1.0. */
    rate: number;
    /** Utterance format template — read left to right, joined with pauses. */
    template: "key-then-rows" | "key-only";
  };
};

/** Saved drill in the user's Key Sequencer library. Parallels Drill. */
type KeyDrill = {
  id: string;
  name: string;
  notes?: string;
  config: KeySequencerConfig;
  createdAt: number;
  updatedAt: number;
  lastLoadedAt?: number;
};
```

### 3.1 Reused substrate

- `OrderingStrategy` — the existing 8-strategy enum in `src/lib/music/sequence.ts`.
- `PitchClass` — the existing type in `src/lib/music/chord.ts`.
- `TimeSignature` — the existing type in `src/lib/state/practice-config.ts`.
- Metronome click engine (`src/lib/audio/metronome.ts`) — same instance, no changes.
- Beat display / count-in visuals — reused from Bass Arpeggios.

### 3.2 Store

New Zustand store `useKeyDrillsLibrary` parallels `useDrillsLibrary`. New store `useKeySequencerConfig` parallels `usePracticeConfig`. Separate stores per module keep the concerns cleanly divided.

---

## 4. User Surfaces

### 4.1 `/practice/keys` — Setup

Standard collapsible-section layout matching `/practice`:

1. **Your key drills** — grid of saved KeyDrill cards. Same DrillCard visual pattern (thumbnail-less, since keys don't have engraving) with launch / edit / duplicate / delete.
2. **Quick key pool** — 12 pitch-class chips (C, C#, D, …), multi-select. "All keys" and "Cycle of 5ths (jazz standards order)" quick-fill buttons.
3. **Key ordering** — dropdown with the 8 strategies (same names as Bass Arpeggios).
4. **Prompt rows** — up to 3 rows, each with:
   - Row label input (optional)
   - Chip list of words + add-word input + remove-word ×
   - Ordering dropdown for this row
   - Drag-reorder handle for row order
   - Delete-row button
   - "+ Add prompt row" button when < 3 rows
5. **Rest measures** — number input 0–4.
6. **Tempo & meter** — reuse from Bass Arpeggios setup.
7. **Session length** — measures per key + repetitions or loop, reuse.
8. **Display** — layout picker (single-pane / two-pane), reuse.
9. **Voice announcement** (optional, opt-in) — toggle + rate slider + lead-beats picker + template picker. When enabled, browser TTS reads the upcoming key + row words a couple beats before each measure change. Great for eyes-off practice on any instrument.
10. **Preview** — mini-render of the first 4 measures worth of Now/Next cards. Live-updates as the user edits.
11. **Save / launch** — save-as-drill + launch button.

### 4.2 `/practice/keys/session` — Drill screen

Identical shell to `/practice/session`:

- Header: back to setup, drill name, tempo, meter
- Center: Now/Next cards
  - **Now card** shows: current KEY (huge, dominant), then each prompt-row word stacked below in smaller text
  - **Next card** shows: same layout, upcoming key + words
- Beat display + count-in ring + progress bar — reused
- Two-pane variant — reused
- Space to start/stop, arrow-keys ±5 BPM, ×2/÷2 buttons — reused
- **Voice announcement** (when enabled on the drill): a tick on every measure schedules an `SpeechSynthesisUtterance` `voiceAnnounce.leadBeats` beats before the next measure. Utterance text follows the template (`"key-then-rows"` = "A-flat. Minor seventh. Ascending." / `"key-only"` = "A-flat."). Enharmonic pronunciation respects the display preference. Cancels on Stop / pause / page unmount so no orphaned utterances.

---

## 5. Ordering Strategies

Same 8 strategies as Bass Arpeggios:

1. **Custom** — user-defined order
2. **Chromatic Ascending** — semitone-up
3. **Chromatic Descending** — semitone-down
4. **Cycle of 5ths** — jazz standards order (C, F, Bb, Eb, Ab, Db, Gb, B, E, A, D, G)
5. **Cycle of 4ths** — same in reverse
6. **Random With Replacement** — every measure independently random; consecutive dupes possible
7. **Random Shuffle (once)** — shuffled at session start, then plays in that order for every pass
8. **Random Shuffle (each pass)** — reshuffles per pass

Prompt rows use the same enum but drop cycle-of-5ths / chromatic since they don't apply to free text. Available for prompt rows: **Custom** / **Random With Replacement** / **Shuffle Once** / **Shuffle Each Pass**.

---

## 6. Starter Templates

Ship a curated library of 6–8 KeyDrills that seed on first install. Each demonstrates a different combinatorial pattern so users grasp the potential before authoring their own.

Proposed starter set:

1. **Bare-bones warmup** — 12 keys, cycle of 5ths, no rows. Tonic recognition.
2. **Chord-quality mixer** — All 12 keys random, Row 1 = Maj7/Min7/Dim7/Dom7 cycle. Intermediate jazz.
3. **Modes practice** — Flat keys, Row 1 = the 7 modes cycle, Row 2 = Ascending/Descending. Classical.
4. **Scale-shape workout** — All 12 keys random, Row 1 = Major/Minor/Blues/Pentatonic random. Rock/blues.
5. **Voice-first ear training** — All 12 keys random shuffle, Row 1 = "sing tonic"/"sing 3rd"/"sing 5th", 2 rest measures. Singers.
6. **Three-row jazz workout** — All 12 keys, 3 full rows as in the design example above.
7. **Left-hand-only piano** — 5 keys cycle, Row 1 = "chord voicing" / "walking bass" / "shell voicing" — for pianists drilling LH independence.

Starter templates are just seeded `KeyDrill` entries — same data type as user drills. Users can duplicate + modify them freely.

---

## 7. Tech Choices

### 7.1 Reuse over rebuild

- Metronome engine — reuse
- Ordering-strategy enum — reuse
- Two-pane / single-pane layout — reuse
- Count-in visuals + prep signals — reuse
- BPM controls (tap tempo, ±5, ÷2/×2) — reuse
- Save-as-drill + drill-library pattern — reuse pattern, new store
- Header shell (back link, name, tempo, meter chips) — reuse pattern

### 7.2 New code (est. size)

- Store: `useKeyDrillsLibrary` (~80 lines)
- Store: `useKeySequencerConfig` (~150 lines)
- Setup page `/practice/keys/page.tsx` (~600 lines)
- Session page `/practice/keys/session/page.tsx` (~400 lines)
- KeyDrillCard component (~150 lines)
- PromptRowEditor component (~200 lines)
- Sequence-generation helper (`keySequencerAtStep(config, measureIdx)`) (~100 lines)
- Starter templates data (~150 lines)
- Voice-announcement helper (`speakUpcoming(text, rate)`) using `window.speechSynthesis` (~50 lines) — cancellable, guards against unsupported browsers (older mobile Safari) with a silent no-op fallback.

Total ~1,880 lines of new code. Comparable to Bass Arpeggios' scope but simpler because no audio-engine work is needed.

### 7.3 Module registration

Add to `src/lib/modules/registry.ts` as `{ id: "key-sequencer", status: "live", route: "/practice/keys" }`. Shows up in the module switcher dropdown alongside Bass Arpeggios.

---

## 8. Build Slices

Ordered so each slice is independently shippable:

| Slice | Scope | Estimate |
|---|---|---|
| **45.0** | Types + stores + module registry entry. Setup page scaffolding (key pool + ordering). No drill screen yet. | 1 session |
| **45.1** | Setup page prompt-row editor (up to 3 rows, add / remove words, per-row ordering). Live preview of first 4 measures. | 1 session |
| **45.2** | Session page — Now / Next cards, single-pane layout, metronome integration, count-in. Space to start/stop. | 1 session |
| **45.3** | Two-pane layout variant (reuse the existing pref) + session controls (±5 BPM nudge, halve/double, restart-current, skip). | 0.5 session |
| **45.4** | Save-as-drill + drill library on setup page (KeyDrillCard + list). Duplicate / rename / delete. | 0.5 session |
| **45.5** | Starter template seeding on first install. | 0.25 session |
| **45.6** | Polish — rest measures between keys, enharmonic preference, empty-state, keyboard shortcuts, a11y pass. | 0.5 session |
| **45.7** | Voice announcement (browser TTS via `speechSynthesis`). Setup toggles + rate slider + lead-beats + template. Cancellable, browser-support-guarded. | 0.5 session |

Total: **~5.5 sessions** (rough; comparable to LSB Basic Tier pacing).

---

## 9. Cross-Module Integration Hooks

Data-model-ready hooks for future integration (not built in v1):

- **Extract key pool from a Lead Sheet's chord list.** "Drill the keys of *All the Things You Are*" → one-click extracts unique roots from the sheet's chord array, pre-populates the Key Sequencer setup.
- **Pull prompt words from a Lead Sheet's chord qualities.** "Match the qualities of *Autumn Leaves*" → row 1 auto-fills with the unique qualities appearing in the sheet.
- **Cross-module drill launcher.** From the LSB view page: "Key-drill this sheet" button opens Key Sequencer preloaded with that sheet's keys + qualities.

Each hook is a small button in the Lead Sheet view/edit page. The Key Sequencer itself doesn't know about the Lead Sheet — LSB reaches in to consume its data.

---

## 10. Naming

**Locked as "Key Sequencer" for v1** (per user 2026-07-11). Descriptive, honest, search-friendly. If tester feedback pushes back on the dryness, "Cue Loop" / "Prompt Mixer" / "Key & Cue" stay as future rename options.

---

## 11. Open Questions

Small design calls that can be resolved during the build without doc revision:

- Enharmonic display when user picks "sharps" or "flats" preference: does F# and Gb count as different pool selections, or unified? Recommend: unified (11 pitch classes internally, display flipped by preference).
- Empty prompt-row state: should a row with 0 words be legal (no-op)? Recommend: no — auto-delete empty rows on save.
- Prompt-row word max length: cap at 24 chars to keep the Now card legible.
- Rest-measure display: dashed border on the Now card + "rest" text? Or fade the Now card? Recommend: fade + small "rest" label above.
- Enharmonic auto behavior: for the "auto" preference, cycle-of-5ths mode uses flats (jazz convention), chromatic ascending uses sharps.

---

## 12. Status & Roadmap Position

- **2026-07-11:** design pass complete. Module promoted from `bucket: "later"` / `status: "sketch"` to `bucket: "next"` / `status: "designed"` in the module registry when the build opens. Live status will be reflected in `src/lib/modules/registry.ts`.
- **v1.1 milestone:** Key Sequencer ships before Cloud Sync — it's a smaller, self-contained project that adds real value without needing external services.
- **v2 hook:** cross-module integration with Lead Sheet Builder (see §9).
