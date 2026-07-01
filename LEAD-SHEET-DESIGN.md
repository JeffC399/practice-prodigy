# Lead Sheet Builder — Design

> Module design doc for the **Lead Sheet Builder**. v1-scope module shipped after the v1 Bass Arpeggios polish closes out. Lives in PROJECT-DESIGN.md §9 vision as one of the 9 platform modules; promoted from "Later" to "Next" once this design is locked.

**Doc status:** v0.3 — live build in progress — last updated 2026-06-30
**Target ship:** v2 milestone (build opened ahead of schedule 2026-06-30; Basic Tier ~8-11 sessions remaining)
**Estimated build:** originally 8–12 weeks; actual pace running much faster (28 sub-phases shipped in the first sprint)

---

## 1. Purpose & Positioning

The Lead Sheet Builder is Practice Prodigy's **authoring** module — distinct from the practice modules, which are *consumption / drilling* tools. It lets musicians create, edit, print, and share **lead sheets** — the chord-and-melody charts that working jazz, pop, folk, and singer-songwriter musicians use every day.

Three strategic wins beyond the standalone module value:

1. **Validates the multi-module platform thesis.** Shipping a second meaningful module proves the substrate is real, not just a one-trick app.
2. **Cross-module substrate leverage.** Lead sheets share the `Chord` type with Bass Arpeggios. A future "Drill the chord pool from this lead sheet" button is one-click integration — exactly the kind of leverage the platform vision is supposed to deliver.
3. **Content authoring layer for the whole platform.** Once lead sheets exist, every future practice module can consume them: the future Theory module quizzes you on the lead sheet's harmony, the Ear Training module plays its melody, the Sight Reading module rolls reading exercises from your lead sheet library. Lead sheets are the substrate for content.

**Competing tools:** MuseScore (heavyweight, notation-engraving focus), Soundslice (advanced, web-based, paid), iReal Pro (chords-only, mobile-first). Differentiator: speed of input + simplicity + tight integration with the rest of the practice platform.

---

## 2. Tiered Scope

Shipping in **two tiers** to keep the first ship tractable.

### Basic Tier — `v2 milestone (Next)`

What's in:

- **Meta**: title, composer, arranger, lyricist, copyright/credits.
- **Tempo & style**: free-text style indicator ("Medium Swing", "Bossa Nova", "Ballad", "Funk", etc.) + optional explicit BPM.
- **Key indicator**: tonic + mode (major / minor).
- **Time signature**: single time signature for the whole piece.
- **Chord symbols**: structured `Chord` (matching the v1 model — 20 qualities × 12 roots) where possible, free-text fallback for unusual chords (`Cmaj7(♭13)`).
- **Slash chords**: optional bass override (`C/E`).
- **Single-staff melody**: treble clef default. Notes with full rhythm vocabulary (whole through 32nd, dotted, triplets) + rests + ties.
- **Lyrics**: one syllable per note, with hyphen handling for syllable breaks (`love-` `-ly`) and underscores for melismas (one syllable across multiple notes).
- **Pickup measure (anacrusis)**: optional partial first measure.
- **Form markings**: repeat signs (𝄆 𝄇), first/second ending brackets, D.C. al Fine, D.S. al Coda, Coda symbol, Segno, To Coda, Fine.
- **Section labels**: A / B / C, Intro / Verse / Chorus / Bridge / Outro, or custom.
- **Print**: native browser print → Save as PDF via `@media print` CSS. Letter / A4 toggle. 4 / 6 / 8 bars-per-line toggle.
- **Share**: URL with the sheet state encoded (base64-compressed JSON in `?d=` query). JSON file download as the offline-friendly alternative.

What's deferred to Advanced Tier (`Later` bucket):

- Mid-piece time / key signature changes.
- Multiple voices on a staff (soprano + alto on one line).
- Drum / percussion notation.
- Chord diagrams (guitar tablature, piano voicing diagrams).
- MusicXML import / export.
- Multi-page chart layout with manual page breaks.
- Custom per-element typography.
- Real-time collaborative editing.
- Audio playback of the lead sheet (would pair with the future Ear Training module).

---

## 3. User Surfaces

### `/sheets` — Library

- Grid of the user's saved lead sheets.
- Each card: title + composer + key + last-modified + a small live-rendered 2-bar thumbnail.
- "Create new" CTA → routes to a fresh `/sheets/[id]`.
- Search / filter by title or composer.
- Sort by recently-edited (default) / alphabetical / created-at.
- Cards link to the editor on click.

### `/sheets/[id]` — Editor

Three-pane layout, matching the progressive-disclosure rule:

| Pane | Content |
|---|---|
| **Left** (collapsible) | Inspector: title, composer, lyricist, copyright, key signature, time signature, tempo + style, sections list (reorder, label, delete). |
| **Center** | Live-rendered lead sheet via VexFlow. Click anywhere → cursor + inline edit affordances. Toolbar above the canvas: undo / redo, save, print, share. |
| **Right** (collapsible) | Palette: chord input (root + quality + bass), melody input, lyrics input, form markings, section management. Keyboard-shortcut hints surfaced at the bottom of the palette. |

On mobile / narrow viewports, the panes collapse into a tab strip (Inspect / Edit / Palette) — touch-first variant.

### `/sheets/[id]/print` — Print preview

- Static route with `@media print` styles applied.
- Shell header / footer hidden in print.
- VexFlow re-renders at print dimensions.
- User triggers browser print → Save as PDF (Cmd/Ctrl+P).

### Share modal (overlay on editor)

- "Copy link" button — URL with `?d=<encoded>`.
- "Download .json" — file save dialog.
- "Open print preview" — opens `/print`.

---

## 4. Data Model

```ts
type LeadSheet = {
  id: string;
  meta: {
    title: string;
    composer?: string;
    arranger?: string;
    lyricist?: string;     // distinct from composer
    copyright?: string;
  };
  key: { tonic: PitchClass; mode: "major" | "minor" };
  timeSignature: TimeSignature;     // reuse from practice-config
  tempo?: { bpm?: number; style?: string };
  pickup?: { beats: number };       // anacrusis (e.g. 2 = half-measure pickup)
  sections: Section[];              // ordered
  formJumps?: FormMarking[];        // D.C., D.S., Coda jumps
  createdAt: number;
  updatedAt: number;
};

type Section = {
  id: string;
  label?: string;                   // "A", "Intro", "Verse 1", ...
  measures: Measure[];
  repeat?: {
    startBracket: boolean;          // 𝄆 at start
    endBracket: boolean;            // 𝄇 at end
    endings?: number[];             // [1, 2] for first / second ending brackets
  };
};

type Measure = {
  id: string;
  chords: ChordBeat[];              // chords + beat positions within measure
  notes: NoteSlot[];                // melody notes, rhythm + optional lyric
};

type ChordBeat = {
  beat: number;                     // 1-indexed beat within the measure
  chord: Chord | { freeText: string };   // structured or fallback
  bass?: PitchClass;                // slash chord (C/E)
};

type NoteSlot = {
  pitch: { pc: PitchClass; octave: number } | "rest";
  duration: NoteDuration;
  tied?: boolean;                   // tie INTO the next note
  lyric?: LyricSyllable;
};

type NoteDuration =
  | "1" | "2" | "4" | "8" | "16" | "32"
  | "1d" | "2d" | "4d" | "8d" | "16d"     // dotted
  | "4t" | "8t" | "16t";                  // triplets

type LyricSyllable = {
  text: string;
  continuation: "none" | "hyphen" | "underscore";  // "love-" or "love_"
};

type FormMarking = {
  type: "dc-al-fine" | "ds-al-coda" | "fine" | "coda" | "segno" | "to-coda";
  measureId: string;                // anchor measure
};
```

Key reuse from the v1 codebase:

- **`Chord`** from `src/lib/music/chord.ts` — same root + quality model. Cross-module integration is now a one-line type import.
- **`TimeSignature`** from `src/lib/state/practice-config.ts` — same shape.
- **`PitchClass`** from `src/lib/music/chord.ts`.

---

## 5. Tech Choices

### Notation rendering: **VexFlow**

Three candidates were considered:

| Library | Pros | Cons |
|---|---|---|
| **VexFlow** | Mature, ~200KB gzipped, low-level control, SVG output (crisp print), industry standard. | More wiring for a high-level "render this sheet" call — you compose primitives. |
| OpenSheetMusicDisplay | Higher-level (renders MusicXML directly), built on VexFlow. | ~500KB. MusicXML-first means we'd serialize via MusicXML, which is heavier than our native data model. |
| AlphaTab | Excellent for tablature. | Tab/guitar-focused; lead sheets are not its sweet spot. |

**Decision: VexFlow**, on the grounds of bundle size, control, and the fact that we render *from our own data model*, not from MusicXML.

### State: separate Zustand store `useLeadSheets`

- Parallels `useDrillsLibrary`.
- Persists to localStorage under its own key (`practice-prodigy:lead-sheets:v1`).
- Tracks: `sheets: LeadSheet[]`, `currentSheetId: string | null`, `currentCursor: CursorPosition | null` for the editor.

### URL share encoding

- `LeadSheet` → JSON → gzip (via `pako` or browser's `CompressionStream`) → base64url → `?d=<encoded>`.
- Length budget: ~2KB encoded fits comfortably in any URL bar / message field. Sheets that exceed the limit (very-long lyrics, very-many sections) fall back to the JSON-download share modality, with a clear "Copy link too long — use file share instead" banner.

### Print path

- `/sheets/[id]/print` route with `@media print` CSS hiding shell + footer + non-essential controls.
- VexFlow re-renders at print dimensions on this route.
- Browser native Print dialog → Save as PDF.
- jsPDF as an upgrade path if we ever need pixel-perfect / programmatic PDF (deferred).

### Storage strategy

- v2 (Basic Tier ship): local-only (localStorage via Zustand persist).
- v2.x: cloud sync alongside drill library cloud sync, with one-screen migration on first sign-in.

---

## 6. Editor UX (Authoring)

### Chord input

- Right palette has a 12-button root grid + 20-button quality grid + bass dropdown.
- Click root + quality → applies at the cursor's beat.
- Free-text override: small "type custom" input that bypasses the structured model (saved as `{ freeText: "Cmaj7(♭13)" }`).
- Keyboard shortcut: with cursor positioned, type letter (root) then number-shorthand for quality (`M7`, `m7`, `7`, `dim7`, etc.) — a Sibelius-style speedy entry.

### Melody input

- Click on the staff at a horizontal cursor + pitch → places note at the cursor's beat with the current selected rhythm.
- **Number keys 1–7** = scale degrees in the current key (auto-pitches by key sig).
- **R** = rest.
- **Arrow keys** = move cursor; **Shift+arrow** = adjust pitch up/down.
- **Numpad / number row**: 1 = whole, 2 = half, 4 = quarter, 8 = eighth, 16 = sixteenth, 32 = thirty-second.
- **D** = toggle dot. **T** = toggle triplet.
- **Tab** / **Shift+Tab** = advance / retreat cursor by current rhythm value.

### Lyrics input

- Click below a note → inline text input appears.
- Type word → applies to current note.
- Space → moves cursor to next note (next syllable).
- Hyphen at end of typed string (`love-`) → marks continuation; the *next* note's lyric is the *next* syllable.
- Underscore (`_`) → melisma; one syllable extends across multiple notes.

### Form markings

- Click a bar line → context menu: "Start repeat", "End repeat", "First ending", "Second ending", "D.C. al Fine", "D.S. al Coda", "Coda", "Segno", "Fine".
- Section labels: click section header → dropdown of common labels (A/B/C/Intro/Verse/Chorus/Bridge/Outro) or "Custom label…" text input.

---

## 7. Print Layout

- 4 bars per line by default. Toggle to 6 or 8.
- **Title block** at top: title centered, composer top-right, lyricist top-left, copyright bottom-right.
- Key + time signature on first staff line.
- Style + tempo above the first measure: `Medium Swing ♩=120`.
- Standard music engraving conventions: chord symbols above the staff, lyrics below.
- Section labels appear above the bar where the section starts.
- Repeat signs / endings / D.C. / D.S. / Coda render in standard notation.

---

## 8. Build Slices — Original (pre-build) plan

| Slice | Scope | Estimate |
|---|---|---|
| 1 | Data model + Zustand store + `/sheets` library page (titles only, no editor yet). "Hello world" of the route shape. | 1–2 weeks |
| 2 | VexFlow integration + `/sheets/[id]` editor scaffolding. Render an empty staff with key sig + time sig. Add chord-input palette + render chord symbols above bars. | 1–2 weeks |
| 3 | Melody-note input + render notes with full rhythm vocabulary. Cursor model + keyboard shortcuts. | 1–2 weeks |
| 4 | Lyrics input + render syllables under notes (with hyphen / underscore handling). | 1 week |
| 5 | Form markings: repeats, endings, D.C. / D.S. / Coda / Fine. Section labels. | 1 week |
| 6 | `/sheets/[id]/print` route + `@media print` CSS. Letter / A4 + bars-per-line toggles. | 1 week |
| 7 | Share path: URL encoding (base64+gzip) + JSON download + share modal. | 1 week |
| 8 | Polish: library search / filter, thumbnail rendering, mobile tab-strip layout, accessibility pass. | 1 week |

> **Note (2026-06-30):** the original slice plan has been superseded by the live phased roadmap in §8.5 below. The slice numbers here are kept for historical context; the actual build is now tracked by Phase numbers.

---

## 8.5 Phased Roadmap — live (2026-06-30)

This roadmap is the source of truth for what ships next. Each phase is independently shippable; later phases assume earlier phases are in.

**Shipped:**

| Phase | Date | Scope |
|---|---|---|
| 24a | 2026-06-30 | Chord-chart MVP (library + editor + view + print). |
| 24b | 2026-06-30 | Melody via VexFlow (notes + rests, full duration vocab, dotted modifier). |
| 24b.2 | 2026-06-30 | Triplets + intra-measure ties. |
| 24b.3 | 2026-06-30 | Professional engraving rework (continuous multi-measure paper surface, chord symbols, key sig on every line, end barline, serif title block, auto-beamed eighths/sixteenths). |
| 24c | 2026-06-30 | Lyrics via inline Sibelius-style click-on-staff typing (syllables + hyphen continuation + melisma line). |
| 24c.1 | 2026-06-30 | Engraving polish: chord band height, collision fix, end-barline clipping, lyric baseline offset, ledger-line-aware chord Y. |
| 24c.1.1 | 2026-06-30 | Additional lyric offset bump to clear stem flags. |
| 24c.1.2 | 2026-06-30 | Two-pass lyric collision detection (adjacent syllables no longer run together). |
| 24c.1.3 | 2026-06-30 | Lyric gap bumped to visible breathing room; `MIN_LYRIC_GAP` 3 → 8. |
| 24c.2 | 2026-06-30 | WYSIWYG US Letter paper (816×1056 @ 96 DPI, 0.75" margins) + measureText-accurate lyric widths. |
| 25.0 | 2026-06-30 | Click-on-staff melody entry MVP (click Y → pitch, side panel rhythm/rest/dotted). |
| 25.0.2 | 2026-06-30 | Standard / Handwritten font style toggle (Georgia serif vs. Patrick Hand). |
| 25.0.3 | 2026-06-30 | Handwritten typography polish (drop italics, tighter sizing). |
| 25.1 | 2026-06-30 | Visible caret + keyboard entry (A–G pitch, R rest, arrows nudge/move, number keys rhythm, `.` dotted). |
| 25.2 | 2026-06-30 | Click-on-staff **chord** entry — per-beat hit regions, autocomplete, parser handling all 20 qualities + slash chords. `Chord[]` → `ChordBeat[]` refactor (v4 → v5). |
| 25.2.1 | 2026-06-30 | Click-outside closes chord autocomplete. |
| 26 | 2026-06-30 | Undo / redo at sheet level — bounded 100-action stacks, Cmd/Ctrl+Z / Shift+Z / Ctrl+Y. |
| 26.1 | 2026-06-30 | Chord collision avoidance on dense bars (two-pass shift, `MIN_CHORD_GAP` 6px). |
| 26.1.1 | 2026-06-30 | Chord font auto-shrink when collision-shifted chords would overflow measure (9pt floor). |
| 27 | 2026-06-30 | Live audio playback — chord comping (PolySynth) + melody (MonoSynth) via Tone.js, ties respected, auto-stop with tail. |
| 27.1a | 2026-06-30 | Instrument picker + mixer — 6 chord voices + 6 melody voices via `smplr`, per-voice volume (dB) + mute. |
| 27.1b | 2026-06-30 | Per-sheet count-in + session tempo slider (50–150%) + loop region (start/end measures). |
| 27.1.1 | 2026-06-30 | Synth fallback when `smplr` fails to load (defaults flipped to synth so playback works out of the box). |
| 27.1.2 | 2026-06-30 | Lyricist field + smart credit display ("Music and Lyrics by X" / "Music by X / Words by Y" / etc.). |
| 27.1.3 | 2026-06-30 | Arranger ("arr. by") + copyright (bottom-right) + source ("from Kind of Blue" italic subtitle) fields. |
| 27.2 | 2026-06-30 | Audio quality overhaul: `smplr` → `Tone.Sampler` + curated CDNs (Salamander piano, nbrosowsky guitar/sax/flute/cello/vibes). One consistent routing, no more silent-fail voices. |
| 27.2.1 | 2026-06-30 | Instrument quality polish bundle: string-ensemble pad, FM Rhodes, guitar lowpass tame, vibes +10 dB, choir-pad voice, refreshed synth presets, timing bump for slow-attack samplers. |
| 28.0 | 2026-06-30 | Form markings **visual** — repeat barlines, volta brackets (1./2. endings), Coda/Segno glyphs, D.C./D.S./To Coda/Fine text, section labels. Editor per-measure panel. Audio still plays linearly (28.1 will fix). |
| 28.1 | 2026-06-30 | Form markings **audio** — new `expandFormPlayOrder(measures)` pure helper walks the form graph and emits a `PlayStep[]` of source-measure indices. Playback engine schedules chord + melody events against the expanded sequence, so repeats, 1st/2nd endings, D.C. al Fine, D.S. al Coda, To Coda, Fine, Coda, and Segno all play correctly. Loop-region playback intentionally stays linear. |

**In flight / queued:**

| Phase | Scope | Est. | Why here |
|---|---|---|---|
| 29 | **Cross-measure ties + slurs.** Multi-line render coordinator that knows about the previous line's last note. | 1-2 sessions | Engraving completeness. Was originally Phase 24b.4. |
| 30 | **MIDI input** for melody entry via the Web MIDI API. Plug in keyboard → notes appear at the caret. | 1-2 sessions | Power-user differentiator — makes serious musicians take the tool seriously. |
| 31 | **Selection model** — drag-select multiple notes, then delete / transpose / copy / paste. | 1-2 sessions | Indispensable for revising. Currently no multi-note operations exist. |
| 32 | **Pickup measure (anacrusis)** + **bars-per-line toggle** (4 / 6 / 8). Both in §2 / §7 of this design doc, both unshipped. | 1 session | Real songs start with anacruses; serious chart authoring wants bars-per-line control. |
| 33 | **Share via URL** — base64+gzip-encoded JSON in `?d=` query + JSON file download fallback. | 1 session | Was originally Phase 24e. |
| 34 | **Print polish** — page numbers, copyright footer line, page-break controls for multi-page sheets. | 0.5 session | Final professional touches before pro engraving is fully done. |
| 35 | **Library polish** — search / filter, live-rendered thumbnails on cards, mobile / touch tab-strip layout, accessibility pass. | 1 session | Was originally Slice 8. |

Total remaining: ~7-10 sessions to complete the LSB Basic Tier as a Dorico-class authoring tool. Phases may re-prioritize based on tester feedback once the build is in user hands.

The Advanced Tier (mid-piece key/time changes, multi-voice, MusicXML import/export, multi-page layout with manual page breaks, real-time collab, audio playback of full chart with comping) stays in `bucket: "later"` until the Basic Tier is shipped and in production use.

---

## 9. Cross-Module Integration Hooks

These hooks aren't built as part of the Basic Tier but the data model already supports them, so the module ships substrate-ready for:

- **"Drill the chord pool from this lead sheet"** — one-click extract `chords` from the sheet, deduplicate, navigate to `/practice` with the live config preloaded. Trivial because `Chord` is shared.
- **"Play this lead sheet's melody"** — future Ear Training module loads the `notes` and plays them back for melodic dictation drills.
- **"Read this lead sheet"** — future Sight Reading module renders the staff and tracks the user's pitch detection against the notation.
- **"Quiz me on this lead sheet's harmony"** — future Theory module pulls the `chords` array as the substrate for chord-quality / Roman-numeral / functional-harmony quizzes.

Each hook is a small button in the lead sheet editor toolbar, surfacing in whichever module is "Live" at the time. The lead sheet itself doesn't know about the practice modules — they reach IN to consume the lead sheet's data.

---

## 10. Open Questions (Resolve at Build Time)

- **Free-text chord rendering** — what does a free-text chord look like in VexFlow? Probably literal-text-above-staff with chord-symbol typography, but worth a small spike.
- **Mobile editing UX** — the three-pane desktop layout doesn't fit on phone. Touch-optimized chord palette + bar-by-bar editor for mobile. Builds on the responsive principles already in v1.
- **Screen-reader accessibility around a notation engine** — significant unsolved problem industry-wide. v2 ship aims for navigation-via-keyboard parity; full screen-reader semantic rendering is a stretch goal.
- **Reorderable sections** — drag-handle to reorder sections within the inspector. Probably basic-tier; flag for confirm during build.
- **Undo / redo depth** — need an undo stack. Probably bounded at 100 actions. Implementation: action-log pattern.
- **Multi-line section labels** — sometimes a section is "A1 — first time through." Free-text labels handle this already; just want to confirm the inspector supports linebreaks.

---

## 11. Status & Roadmap Position

- **2026-06-29**: design pass complete (this doc). Module promoted from `bucket: "later"` / `status: "sketch"` to `bucket: "next"` / `status: "designed"` in `src/lib/modules/registry.ts`.
- **2026-06-30**: build window opened ahead of schedule and moved fast. **28 sub-phases shipped in the first sprint** covering: chord-chart MVP + view/print (24a) → melody via VexFlow (24b–24b.3) → lyrics via inline click-on-staff typing (24c) with engraving polish (24c.1.x) → WYSIWYG Letter paper (24c.2) → click-on-staff **melody** entry with visible caret + keyboard shortcuts (25.0–25.1) → click-on-staff **chord** entry with autocomplete parser (25.2–25.2.1) → Standard / Handwritten font style (25.0.2–25.0.3) → **undo / redo** (26–26.1.1) → **live audio playback** with instrument picker + mixer + count-in + tempo slider + loop region (27–27.2.1) → author-credit metadata (lyricist / arranger / copyright / source, 27.1.2–27.1.3) → **form markings visual** (28.0). Registry status flipped `designed → live`.
- **Remaining Basic Tier work** (see §8.5 for the phase table): 29 (cross-measure ties + slurs), 30 (MIDI input), 31 (selection model), 32 (pickup + bars-per-line), 33 (share via URL), 34 (print polish), 35 (library polish). ~7-10 sessions.
- **Advanced Tier**: stays in `bucket: "later"` / `status: "sketch"` until basic ships and is in production use.
