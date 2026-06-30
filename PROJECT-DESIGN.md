# Practice Prodigy — Project Design

> Living spec for the Practice Prodigy platform. Updated whenever a significant feature is added, changed, or removed.

**Doc status:** v0.1 (pre-scaffold)
**Last updated:** 2026-06-28
**Current milestone:** v1 — Bass Arpeggios Module (pre-build)

---

## 1. Vision & Positioning

**Practice Prodigy** is a comprehensive musician's practice platform. Long-term, it spans multiple instruments, multiple skill areas (rhythm, ear training, repertoire), and connects students with teachers. The product positioning is **pro-quality polish at consumer-app accessibility** — Ableton-class feel, Spotify-class usability.

The platform launches with one focused module: a **Bass Arpeggios trainer** for jazz/popular musicians. v1 is intentionally narrow so it can be deeply polished; the architecture is intentionally broad so subsequent instruments and modules slot in cleanly.

---

## 2. Target Users

- **v1 (Bass Arpeggios):** working bass players — particularly jazz/blues/popular — drilling arpeggio patterns to internalize harmonic vocabulary.
- **v1.x–v2:** expanding to any musician on any instrument (piano, guitar, voice, drums).
- **v1.5+:** teachers and students using the platform together (assigning, reviewing, communicating).

---

## 3. Core Architecture Principles

These apply to every feature we build. They are non-negotiable.

### 3.1 Progressive Disclosure
Every UI surface presents only the simplest, essential controls by default. Advanced options exist but live behind a disclosure (Advanced toggle, secondary menu, per-session override icon). Inspiration: Apple, Tesla, Linear, Ableton.

### 3.2 Cascading Defaults
Every setting flows through four layers, each overriding the one above:

1. **System defaults** — what ships in the app.
2. **User global preferences** — Settings panel.
3. **Custom Pattern preferences** — saved per-pattern.
4. **Per-session ad-hoc overrides** — "just for this run."

Adding a new setting to the cascade is a small, structured change — never a rewrite.

### 3.3 Pluggable Subsystems
Layouts, audio engines, storage backends, and ordering strategies are all implemented as swappable modules. Adding a 5th practice layout (or a new ordering mode, or swapping local storage for cloud) is an additive change, not a refactor.

### 3.4 Web-first PWA, Native Wrappers Post-v1
One codebase (Next.js + React) deploys to Vercel as a polished web app + installable PWA. Native iOS/Android via Capacitor and native desktop via Tauri are post-v1 packaging exercises — never separate codebases.

### 3.5 Accessibility from Day 1
Keyboard navigation, screen-reader-announced chord changes, `prefers-reduced-motion` respected, color contrast meets WCAG AA. Retrofitting accessibility costs vastly more than building it in.

### 3.6 Dark Mode by Default
Musicians practice in low light. The app respects system theme but defaults to dark on first install.

---

## 4. v1 Feature Scope — Bass Arpeggios Module

### 4.1 The Practice Loop

The screen during practice shows:

- **Current chord** — large, bold, dominating the screen.
- **Small "NEXT" preview** — adjacent (placement adapts to viewport).
- **Metronome state** — visual beat indicator + audible click.
- **Session controls** — pause, stop, current position within sequence.

**Visual look-ahead** has two modes (per-session toggle):
- **Always-Visible (default)** — next chord shown the entire time the current one plays.
- **Late-Reveal** — next chord hidden until N beats before the change (default N=2).

**Start-of-session count-in:** 1 measure default; configurable in Settings; "Off" available.

### 4.2 Musical Vocabulary

**Chord vocabulary — Tier D (Pro Jazz, 15+ qualities):**

- Major, Minor, Augmented (triads)
- Dominant 7, Minor 7, Major 7
- Half-Diminished (`ø7`), Diminished 7 (`°7`)
- Suspended 2, Suspended 4, 7sus4
- Major 9, Minor 9, Dominant 9, Dominant 13
- Dominant 7b9, Dominant 7#9, Dominant 7alt
- Dominant 7b5, Dominant 7#5

**Symbol convention — configurable.** Four notation styles ship in v1; user selects via the cascade (System default → User global → per-Custom-Pattern → per-session override):

1. **Jazz-minus** (default) — `A−7`, `Cmaj7`, `Bø7`, `C°7`, `C+`, `C7alt`. Unicode minus / half-dim / diminished / augmented symbols. Classic jazz lead-sheet convention.
2. **Lowercase-m jazz** — `Am7`, `Cmaj7`, `Bm7♭5`, `Cdim7`, `Caug`, `C7alt`. Berklee / contemporary-jazz convention.
3. **Plain ASCII** — `Am7`, `CM7`, `Bm7b5`, `Cdim7`, `Caug`, `C7alt`. No special characters — safe for copy-paste, plain-text export, and accessibility tools.
4. **Long form** — `A minor 7`, `C major 7`, `B half-diminished 7`, `C diminished 7`, `C augmented`, `C dominant 7 altered`. Verbose; valuable for beginners and theory-focused users.

Rendering is a single pluggable `ChordRenderer` module — adding additional styles (e.g., Roman numeral / Nashville Number System — see IDEAS.md) is an additive change, never a refactor.

**Chord-to-scale mapping:** sensible jazz-convention defaults baked in; per-quality override available in Advanced Settings (Maj7 → Lydian instead of Ionian, m7 → Aeolian instead of Dorian, etc.). Per-instance overrides deferred to post-v1.

### 4.3 Arpeggio Patterns

Four patterns ship in v1:

1. **Scale Tones** — 8 notes ascending one octave (root through octave) by default. Direction picker: Asc / Desc / Asc-then-Desc. Range fixed at one octave in v1.
2. **Arpeggiated 7ths** — 4 notes: 1-3-5-7. For triads (no 7th in the chord), default = 1-3-5-8 (octave); Advanced toggle "Extend triads to 7ths" switches to 1-3-5-(scale's 7th).
3. **Triads with Leading Tones (1-3-5-LT)** — 4 notes. LT = a half-step below the next chord's root (jazz convention; looks ahead in the sequence). For the very last chord of a non-looping sequence, falls back to 1-3-5-8.
4. **Descending (8-7-5-3)** — 4 notes descending: octave above root, scale's 7th degree, chord's 5th, chord's 3rd. Octave/register auto-selected per chord to keep notes in the comfortable middle bass range. (Bass profile setting deferred to v1.1.)

**Rhythm-fitting model — Auto-fit:** the app divides chord duration by the pattern's note count and assigns each note equal rhythmic value. E.g., 4 notes over 4 beats = quarter notes; 8 notes over 4 beats = eighth notes. Patterns that don't divide cleanly trigger a non-blocking "uneven rhythm" warning (post-v1.1).

### 4.4 Sequence Building

**Unified builder + preset library.** One setup screen handles all use cases.

**Starting points:**
- **Shipped presets** (e.g., "All m7 in 12 keys", "ii-V-I in all keys", "Cycle of 5ths through dominant 7s") — non-deletable; duplicable.
- **Your saved Custom Patterns** — first-class citizens alongside shipped presets in the same library.
- **Blank** — start from scratch.

**Chord pool building:**
- Add chords individually (root + quality picker).
- "Add all 12 keys of [quality]" bulk helper.
- Drag to reorder.

**Ordering strategies** (8 total):

*Deterministic:*
1. **Custom Order** — exact order user arranged the chords.
2. **Chromatic Ascending** — re-sorted by root chromatically up.
3. **Chromatic Descending** — re-sorted by root chromatically down.
4. **Cycle of 5ths (descending)** — C → F → Bb → Eb → ... (classic jazz drill).
5. **Cycle of 4ths (ascending)** — C → G → D → A → ...

*Random:*
6. **Random With Replacement** — independent draws; chords can repeat.
7. **Random Without Replacement, single shuffle** — shuffled once at session start.
8. **Random Without Replacement, re-shuffle each pass** — fresh shuffle every full pass.

### 4.5 Tempo & Meter

**Time signatures (10 total):** 2/4, 3/4, 4/4, 6/8, 9/8, 12/8, 5/4, 5/8, 7/4, 7/8.

**Tempo:** 30–300 BPM. System default = 90.

**Tempo input methods (v1):** numeric input, slider, **tap-tempo button** (tap 4× to derive BPM).

**Deferred to v1.1:** tempo ramping, half/double-speed buttons, BPM presets.

### 4.6 Custom Patterns

**What's captured per pattern:**
- Name, optional description, favorite flag, created/modified timestamps.
- Chord pool, ordering strategy, arpeggio pattern type.
- Time signature, tempo, chord duration, total session length.
- Any per-pattern overrides (count-in length, look-ahead mode, direction, scale mapping, triad-extend toggle, etc.).

**Library UI:**
- Flat list with sortable columns (Name / Last Used / Created).
- Text search across name + description.
- Favorite-star (one click pins to top).
- Per-pattern actions: Edit, Duplicate, Delete.
- Shipped presets visually marked; non-deletable; duplicable.

**Persistence:**
- Local-only in v1 (Dexie / IndexedDB).
- Cloud sync via Supabase added in v1.1 with one-screen local-to-cloud migration on first sign-in.

**Sharing:**
- **JSON export/import** via file picker — single pattern per file in v1.
- Pattern bundle export (multi-pattern .json) and URL-share deferred to v1.1+.

### 4.7 Audio Engine

**Hybrid strategy:**
- **Metronome click** during practice — sample-accurate timing via Tone.js / Web Audio API. **Count-in beats** use a dry stick-click timbre (filtered noise) so the transition from preparation into playing is unmistakable; **playing beats** use a tonal sine click with a higher-pitched downbeat. Beat-1 emphasis is preserved within count-in too so the meter still reads.
- **"Preview this pattern over this chord"** button on the setup screen — plays the arpeggio with a bass-like timbre so you can hear what you're about to drill.
- **No play-along** during practice itself — drilling demands silence so you can hear yourself.

The audio engine in v1 also lays the foundation for v3+ pitch-detection features (same audio plumbing).

### 4.8 Settings Architecture

Settings panel is organized as **cascading defaults**. Every setting shows:

- The current effective value.
- Where it's coming from (System / User Settings / Custom Pattern / Per-session override).
- An "Advanced" disclosure for deep configuration (chord-to-scale overrides, click sound choice, accessibility tweaks, etc.).

---

## 5. Tech Stack

### 5.1 Core
| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| UI library | React |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui |
| Animation | Framer Motion |
| State | Zustand |
| Local storage | Dexie (IndexedDB) |
| Audio engine | Tone.js (Web Audio API) |
| Music theory | tonal.js |
| Icons | Lucide React |
| Typography | Geist Sans + Geist Mono |

### 5.2 DX & Quality
- **Package manager:** pnpm
- **Testing:** Vitest (unit + integration); Playwright (E2E, post-v1)
- **Linting/formatting:** ESLint + Prettier
- **CI/CD:** GitHub → Vercel auto-deploy from `main`

### 5.3 Backend (post-v1)
- **v1.1+:** Supabase Auth, Supabase Postgres
- **v1.5+:** Supabase Storage (audio/video submissions), Supabase Realtime (live teacher/student sessions)

---

## 6. Design System

### 6.1 Visual Mood
Modern-minimal with warm accents. Not "music nerd kitsch"; not "sterile tech." Reference points: Linear, Vercel, Ableton.

### 6.2 Color
- **Default theme:** dark mode (musicians practice in low light).
- **Light theme:** available with one click; respects system preference for first-time visitors.
- **Primary accent:** amber / warm-orange — warmth, energy, instrumental feel without literal wood imagery.
- **Greys:** Tailwind's neutral palette (Zinc) for a slightly warm-cool neutral that pairs with amber.

### 6.3 Typography
- **UI:** Geist Sans.
- **Numerals + chord symbols + BPM:** Geist Mono — monospaced tightening keeps musical notation visually clean.

### 6.4 Voice & Tone
Confident-friendly. The app addresses musicians like a professional tool addresses professionals.

- ❌ "Awesome! Let's drill some arpeggios!"
- ✅ "Ready. Tap to begin."
- ✅ "8 chords drilled. 92 BPM, 4/4."

No condescension. No unnecessary exclamation marks. No emojis in UI copy. Errors and warnings are direct and specific.

### 6.5 Iconography
Lucide React throughout. Consistent stroke width. Icon meaning never depends on color alone.

### 6.6 Motion
- Framer Motion for chord transitions, count-in pulse, look-ahead reveal.
- All motion respects `prefers-reduced-motion`.
- Default motion duration: 150–250ms (perceptible but never sluggish).

---

## 7. Cross-Platform Strategy

### 7.1 v1 — Web + PWA
- Deployed on Vercel.
- Installable to home screen (PWA service worker, manifest, icons).
- Works offline once loaded.
- Mobile-responsive (mobile-first design).

### 7.2 v1.x — Native Wrappers
- **Capacitor** packages the same web app for iOS + Android app stores (~1 week each).
- **Tauri** packages the same web app for macOS / Windows / Linux desktop (~1 week).
- All wrappers use the same codebase, same audio engine, same music theory.

---

## 8. Persistence & Auth Strategy

| Stage | Storage | Auth |
|---|---|---|
| v1 | Local (Dexie/IndexedDB) per device. JSON export/import for cross-device. | None. |
| v1.1 | Local + Supabase Postgres sync when signed in. | Supabase Auth (email, Google, Apple). |
| v1.5+ | Add Supabase Storage (audio/video), Supabase Realtime (live sessions). | Same. |

Local-to-cloud migration on first sign-in: one screen confirms upload of existing local patterns.

---

## 9. Roadmap

### v1 — Bass Arpeggios MVP (current)
Everything in Section 4 above. Web + PWA, deployed on Vercel.

### v1.1 — Polish + Cloud
- **Settings page** — `/settings` surface with Appearance (light/dark theme + accent palette + density), Notation default, Practice defaults, Audio, Accessibility, Data export/import, Account (placeholder until Supabase Auth). The home for the cascading-defaults **User global** layer (§4.8). Once it exists, per-module setup screens get simpler — they show overrides of the global defaults, not full config from scratch.
- **Light / dark mode** with persisted preference (defaults to system). Ships as part of Settings/Appearance.
- **Keyboard shortcuts overlay** (`?` opens a cheat sheet) — pro-tool table-stakes.
- **Onboarding tour** for first-time visitors with no drills + no resume blob.
- **"What's new" changelog modal** — surfaces last 1-2 user-visible changes after a deploy.
- Supabase Auth + Postgres sync (local-to-cloud migration). Settings page hosts the sign-in flow.
- Audible per-change alert (different click on last beat of each chord).
- Tempo ramping, half/double-speed buttons, BPM presets.
- Additional practice layouts (Two-pane, Scrolling Timeline, Full-Sequence Chart).
- Bass profile (string count, tuning, range preference) → affects 8-7-5-3 register and lays groundwork for fretboard rendering.
- Pattern bundle export (multi-pattern .json).
- "Doesn't fit cleanly" rhythm warning.
- Visual beat-1 pulse + haptic on chord change (mobile).

### v1.2 — Native Wrappers
- Capacitor → iOS + Android app stores.
- Tauri → macOS + Windows + Linux desktop.

### v1.5 — Teacher / Student (needs dedicated design pass)
- In-app pattern assigning, comments, progress visibility.
- Audio/video submission + review (Supabase Storage).
- Share-via-URL pattern links.

### v2 — Multi-Instrument Platform Expansion
- Modules: Piano, Guitar, Voice, Drums.
- Fretboard / keyboard rendering with instructive overlays.
- Full standalone Metronome and Tuner modules.
- **Rename v1 "Bass Arpeggios" → "Arpeggios"** with an inline instrument selector on the setup screen. Substrate prep: data model adds `instrument` field to Drill; routes evolve to `/practice/bass/arpeggios`, `/practice/guitar/arpeggios`, etc. so individual setups can be bookmarked. Built-in drills get instrument-specific variants. Architecture is already ready (§3.3 + §4.3 are instrument-agnostic save for the bass-like preview timbre). Switcher placement is a setup-screen picker, NOT a persistent header tab strip — instrument is a per-drill decision.
- **Lead Sheet Builder — Basic Tier** ship (see LEAD-SHEET-DESIGN.md). ~8-12 week build across 8 slices. Pairs with the Theory / Ear Training / Sight Reading modules as their content substrate.

### v3+ — Audio Analysis
- Pitch detection (start with monophonic — bass and voice).
- Timing accuracy feedback during practice.
- Real-time corrective overlay.

---

## 10. Status Legend

| Symbol | Meaning |
|---|---|
| Implemented | Shipped and live in the current build |
| In Progress | Actively being built |
| Planned | Committed to a named milestone |
| Idea | Tracked in IDEAS.md; not yet committed |
| Rejected | Considered and declined; reason captured in IDEAS.md |

---

## 11. Change Log

| Date | Change |
|---|---|
| 2026-06-28 | Initial design doc created from design-interview session. Locked v1 scope. |
| 2026-06-28 | Metronome engine + first-slice `/practice` route shipped (hardcoded A−7, 90 BPM, 4/4, 1-measure count-in, 8 measures). Distinct count-in click (filtered-noise stick tick) pulled forward into v1 from v1.1 after hands-on test. |
| 2026-06-28 | v1 chord-vocabulary scope expanded: notation form is now **user-configurable** across four shipped styles (jazz-minus / lowercase-m / plain ASCII / long form) selected via the standard cascade. Replaces the previous single locked "jazz-style" convention. |
| 2026-06-28 | Setup → drill flow shipped. `/practice` is now the setup screen (configure chord root + quality, tempo, time signature, count-in, session length); `/practice/session` is the drill. Configuration persists across reloads via Zustand + localStorage. ChordRenderer module scaffolded with jazz-minus only; lowercase-m / plain-ASCII / long-form route through jazz-minus for now and will be implemented in the next slice. All 20 chord qualities and all 10 time signatures wired through the UI. |
| 2026-06-28 | Metronome end-of-session bug fixed: engine was playing 1–2 extra beats past the configured length because the stop was deferred via setTimeout after the final beat, giving the audio lookahead enough time to schedule additional clicks. Now the end-of-session boundary is checked BEFORE playing each tick. |
| 2026-06-28 | All four notation styles implemented (jazz-minus, lowercase-m, plain-ASCII, long-form). Setup screen now has a notation-style picker under the live chord preview; selection persists per-user via the cascade. Long-form display uses smaller text on both setup and drill screens so verbose strings like "C dominant 7 altered" still fit cleanly. |
| 2026-06-28 | Music theory layer shipped: chord-interval + scale-interval tables + jazz-convention chord→scale defaults (PROJECT-DESIGN.md §4.2 mapping). All four arpeggio patterns (§4.3) implemented: Scale Tones, Arpeggiated 7ths, Triads with Leading Tones (single-chord fallback to 1-3-5-8), Descending 8-7-5-3. Setup screen has a Pattern picker and a "Preview" button that auditions the arpeggio over the chord through a synthesized bass voice (Tone.MonoSynth + low-pass filter), one note per beat at the user's BPM. |
| 2026-06-28 | Multi-chord sequence drilling shipped (§4.4 v1 headline feature). Setup screen now builds a **chord pool** (add/remove chords, all 20 qualities × 12 roots per slot, up to 32 chords); drill cycles through the pool one chord per measure. **NEXT chord preview** rendered above the current chord (Always-Visible mode, §4.1). Store migrated v1→v2: single `chord` field replaced with `chordPool` array; old configs auto-migrate to a single-element pool. Custom Order shipped as the first of 8 ordering strategies (§4.4); the other 7 are stubbed to defer to Custom Order so the rest of the app already calls the stable `chordAtMeasure(pool, strategy, measure)` API. |
| 2026-06-28 | Drill-screen header now shows the **active arpeggio pattern** (Arp 7ths / Scale Tones / Triads + LT / Descending) in foreground color — previously the user had no in-drill reminder of which pattern they were supposed to play. |
| 2026-06-28 | **Randomization + repetitions shipped.** The session model becomes `drillMeasures × repetitions = totalMeasures`. New "Randomize chord order" toggle in the chord-pool section samples a fresh subset without replacement from the pool every repetition (the user's chosen "max variety" semantic). Pool > drill length → sample a subset; pool < drill length → shuffle and loop. Store migrated v2→v3 (`sessionMeasures` → `drillMeasures`; new `repetitions` and `randomizeChords` fields default to 1 and false so existing setups behave identically). New `generateSequence(config)` function returns the full per-measure chord assignment array; drill screen regenerates on every Start so randomized drills get a new sample each session. Quality and pattern randomization are still to come; this slice ships chord randomization end-to-end. |
| 2026-06-28 | Setup polish pass: numeric inputs (BPM / drill measures / repetitions) now hold transient drafts while focused so users can edit them down without the value snapping to the min on every keystroke; sequence preview restyled as bordered chips with text size adapting to pool size (no more crowding at 20+ chords); BPM gets a row of quick-pick preset buttons (40, 60, 80, 100, 120, 140, 160, 200) above the slider. |
| 2026-06-28 | **Quick-build chord-pool wizard shipped.** Inline collapsible panel at the top of the Chord pool section: two columns of checkboxes (12 roots × 20 qualities) with `All / Naturals / None` and `All / Common 7ths / Triads / None` preset buttons. Live count shows "Will produce N chords (R roots × Q qualities)." Two commit actions: **Replace pool** (canonical workflow for ad-hoc drill setup) and **Add to pool** (enrich existing pool). Pool cap raised 32 → 144 to fit the wizard's largest reasonable cross-products (e.g. 12 roots × 12 qualities). Pairs naturally with the randomization toggle: tick 12 roots × `Common 7ths`, drill length 4, randomize on, and each Start serves up a fresh 4-chord cut from a 48-chord vocabulary. |
| 2026-06-28 | Setup polish: dropped `(ø7)` / `(°7)` symbol parens from the Half-Diminished / Diminished 7 quality labels (symbols are already rendered wherever a chord is displayed). Each sequence-preview chip gets an inline ✕ button for quick removal from the pool without scrolling to the row. "Clear pool" button next to "Add chord" resets to a single default chord. |
| 2026-06-28 | **"Loop until stopped" shipped.** New `repeatIndefinitely` toggle in the Session section disables the Repetitions input and instructs the metronome to play with no `totalPlayingBeats`. Sequence generator pre-allocates a generous 4096-measure buffer (functionally infinite for any normal session — minutes-to-hours at realistic tempos). Drill-screen header shows a "Loop ∞" badge in primary color; phase badge drops the "of N" suffix and just reads "Measure N." Store migrated v3→v4 with the new field defaulting to false. |
| 2026-06-28 | **Saved Drills + Quick Start shipped.** A "Drill" is the user's saved configuration (chord pool + pattern + tempo + meter + count-in + reps + randomize + indefinite). New `useDrillsLibrary` Zustand store persists the library separately from active practice config. **Quick Start** section sits at the top of `/practice`: each saved drill renders as a clickable card showing name + summary (pool size · pattern · tempo · meter · length · flags). One-click card launch loads the drill into practice-config, navigates to `/practice/session?autostart=1`, and the drill screen auto-starts the metronome on mount (audio context unlocked in the click handler so this works on a fresh tab). "Save current setup as drill" inline form at the bottom of setup captures a name and writes to the library. Each card gets a delete X. Naming lock: arpeggio "Pattern" stays Pattern; user-saved configuration is now consistently called a "Drill" — see IDEAS.md naming decision. |
| 2026-06-28 | Drills edit-round-trip + safety nets: Pencil "Edit" button on each Quick Start card loads the drill and stays on `/practice` (vs the whole-card-click which still launches into the session). New `loadedDrillId` in practice-config (migrated v4→v5) tracks the actively-edited drill. Editing badge surfaces at top of the form with a "Done editing" exit. Save area swaps between "Save current setup as drill" (no edit context), "Save changes to \"X\"" + "Save as new drill" (editing), and the inline name input. Two-click confirm-cancel on the delete X. Sequence preview gains a small "Clear pool" chip in its header (visible when pool > 1). |
| 2026-06-28 | **Collapse-with-summary on all main setup sections.** Chord pool / Pattern / Tempo & meter / Session collapse to their header by default; each header carries a one-line summary of the section's current state (e.g. "Tempo & meter · ♩=100 · 4/4"). User sees the truth without expanding; clicks chevron to edit. Quick Start, Editing badge, and Sequence preview stay always-open at the top of the page as the action-and-truth surfaces. Apple Settings / Notion docs pattern. |
| 2026-06-28 | **Drill-screen tempo nudge.** Replaced the static "100 BPM" readout in the drill-screen header with a `[−] ♩=N [+]` triplet. Each click bumps BPM ±5, clamped to [30, 300]. Updates `transport.bpm.value` (live — change takes effect at the next tick, even mid-drill) and the store's bpm field (persists across Stop+Start). New `metronomeEngine.setBpm()` method wraps the transport update. Removes the Pause-→-Setup-→-tweak-→-resume cycle for the most common mid-drill adjustment. |
| 2026-06-28 | **Phase 1 daily-loop polish.** Five UX upgrades: (1) **Drill notes** — optional free-text (≤300 chars) per saved Drill, surfaced as italic third line on cards and editable via save dialog or new Edit-details inline form. (2) **Current Drill name in drill-screen header** — when launched from Quick Start, shows "Setup | Morning warm-up" so you're anchored. (3) **Recently-used auto-sort** — Drills carry a `lastLoadedAt` timestamp; Quick Start sorts most-recently-launched to the top. (4) **Discard-changes affordance** — when editing a Drill and the live config diverges from the saved config, a "Discard changes" button surfaces next to "Done editing" and "Edit details" in the editing badge. JSON-equality detects the dirty state. (5) **Click sequence chip → focus pool row** — chord chips in the Sequence preview become navigation: clicking one opens the Chord pool section (CollapsibleSection now supports controlled-open mode), scrolls the row into view, and focuses its root dropdown. Drill type gains `notes?` and `lastLoadedAt?`; library gains `updateDrillMeta` and `markDrillLoaded` actions. |
| 2026-06-28 | Editing UX cleanup: launching a drill no longer enters edit mode (decoupled); editing badge collapsed to always-editable inline name + notes inputs (save on blur, fewer clicks); Save changes button surfaces in the badge alongside Discard / Done. Helper text under the inputs explains that edits in the form sections below also apply to the drill. Save changes button at the bottom now properly disables when not dirty and shows a brief "Saved" confirmation for 1.5s after a successful save. |
| 2026-06-28 | **Inter-chord prep window shipped.** New `transitionUnit` ("measures" or "beats") + `transitionCount` (0–16) fields let the user insert "GET READY" prep time between chord changes — gives beginners a beat or two to find the new root before the next chord's play measure begins. Sequence module refactored to beat-level (`SequenceBeat[]` with `kind: "play" \| "transition"`); generation only inserts transitions on actual chord changes (skips when same chord repeats). Drill screen displays the upcoming chord in primary color with a "GET READY → Next chord" label during transitions, and dims the BeatDots so the metronome ticking reads as prep. Store migrated v5→v6 with fields defaulting to 0 / "measures" so existing drills behave identically. |
| 2026-06-28 | Prep-window polish: prep beats audibly use the count-in stick-click synth (not the tonal playing click) so the user can tell aurally whether they're supposed to be playing; metronome engine accepts a per-beat `beatStyles` array; play-side measure tracking pauses during prep so chord changes always land on beat 1; upcoming chord takes the big display the instant prep starts (no color/dim change). |
| 2026-06-28 | **Phase 2 — §4.4 sequence story closed.** Drag-to-reorder shipped: chord pool rows have a grip-icon column on the left (built on `@dnd-kit/sortable` with PointerSensor + KeyboardSensor — Space + Arrow keys reorder for accessibility). Drag is enabled only when ordering is Custom; for other strategies the grip is muted (manual reordering is meaningless when the strategy derives play order). All **8 ordering strategies** now implemented: Custom, Chromatic Asc/Desc, Cycle of 5ths (descending — canonical jazz), Cycle of 4ths (ascending direction), Random with Replacement, Random Shuffle (once at session start), Random Shuffle (each rep — the existing semantic). Setup form's old "Randomize chord order" checkbox replaced with a single "Order" dropdown listing all 8 strategies with per-strategy explanatory text. Store schema migrated v6→v7: dropped the `randomizeChords` boolean in favor of the full `orderingStrategy` enum; if migration sees `randomizeChords: true`, it sets `orderingStrategy: "randomShuffleEachPass"` (exact same semantic). Drill-screen "Random" badge now derives from a `RANDOM_ORDERING_STRATEGIES` set, surfacing for any of the three random strategies. |
| 2026-06-28 | **Phase 3 — Shipped Drills library.** Ten built-in drills now ship in code (not localStorage) so every install lands on `/practice` with a populated Quick Start surface — no "empty room" first run. **Jazz (7):** ii-V-I in 12 keys (36-chord cycle of 5ths), All maj7 / m7 / dom7 in 12 keys (Random shuffle each rep), Cycle of 5ths (dom7), Diatonic 7ths in C, Daily warm-up (48 common 7ths × loop ∞). **Blues:** 12-bar Blues in F (jazz-blues changes). **Pop:** Axis I-V-vi-IV in C (Loop ∞). **Rock:** I-IV-V in C (Loop ∞). Each shipped drill has a stable `shipped:<slug>` id and carries an informational `genre` tag (jazz / blues / pop / rock / general) — substrate for the v1.1 genre-filter idea. Quick Start now merges user drills (sorted by last-launched) + shipped drills (in seed order); shipped tiles get a small "Built-in" lock chip and hide the delete affordance. Edit pencil opens shipped drills for tweaking but the Save changes path is locked — only **Save as new drill** is offered, so user customizations always land as their own copy. New `src/lib/data/shipped-drills.ts` data module + `isShippedDrill()` helper; `chordPoolIds` pre-baked at shipped-drill construction so the loaded drill never trips the store's regenerate path. |
| 2026-06-28 | **Quick Start split into two sections.** "Your drills" sits on top as the primary always-open surface (with a friendly empty state when none exist that nudges the user to either save their first drill or expand the built-in library below). "Built-in drills" becomes a collapsible section, collapsed by default — header summary reads "10 ready to launch · jazz · blues · pop · rock" so the user sees the breadth without expanding. Tradeoff: optimizes for the repeat-user surface (your own work always visible, library out of the way) at slight cost to first-run discovery (one click to see the built-ins). The per-card "Built-in" lock chip is no longer needed once the section header carries that label — removed in the same change. Hidden delete affordance + locked Save changes in the editing flow still anchor the immutability semantics. |
| 2026-06-29 | **Phase 5 — Persistent navigation shell + /roadmap page.** The app now wears a proper platform-grade chrome on every screen, lifting it from "single-page app" to "platform with vision visible from day one." Persistent **SiteHeader** (sticky top bar, ~44px, brand mark + Module Switcher dropdown listing all 9 platform modules with status pills — Live / Designed / Sketch). Live modules link; non-live show muted with the status chip so the user senses scope without expecting it to work. Persistent **SiteFooter** (slim band, version label + roadmap + GitHub links). New **/roadmap** public surface with three columns (**Now / Next / Later**) mirroring the §9 platform vision: Bass Arpeggios is "Now"; Metronome, Tuner, Scale Driller are "Next"; Theory, Ear Training, Lead Sheet Builder, Sight Reading, Teacher/Student are "Later." All driven from a single `src/lib/modules/registry.ts` source of truth (header switcher + roadmap stay in lockstep — adding a future module = one entry). Removed redundant brand link from the `/practice` sub-header (shell carries it). Homepage's brand mark removed for the same reason; homepage gains a secondary "See the 9-module roadmap" CTA below the primary Setup CTA. Closes the user's earlier open design question about top menu + sidebar navigation. |
| 2026-06-29 | **Phase 7 — PWA install.** Practice Prodigy is now a proper installable Progressive Web App. Adds `app/manifest.ts` (the Web App Manifest at `/manifest.webmanifest` — display: standalone, dark theme, app metadata, categories), `app/icon.tsx` (192×192), `app/icon0.tsx` (512×512, marked any+maskable for Android adaptive), `app/apple-icon.tsx` (180×180 for iOS Home Screen). Icons are generated via Next.js's `ImageResponse` convention — no external image tooling, builds the PNGs at request time from inline JSX/SVG so the brand mark stays in lockstep with the SiteHeader's design. Minimal service worker at `public/sw.js` satisfies Chrome's PWA install criteria (registered + has fetch handler) without aggressive caching — caching is deferred to a later polish phase to avoid stale-content bugs after deploys. SW registration via a client component, production-only. `appleWebApp` metadata field makes iOS Safari treat the app as installable with standalone window chrome. Users can now Add to Home Screen on iOS / Android / desktop and the app launches full-screen with no browser chrome — important groundwork for the v1.2 Capacitor / Tauri native wrappers, which leverage the same manifest. |
| 2026-06-29 | **Lead Sheet Builder — Basic Tier design pass.** First module design doc beyond the v1 Bass Arpeggios module. Lives at root: [LEAD-SHEET-DESIGN.md](./LEAD-SHEET-DESIGN.md). Tier scope: title / composer / arranger / lyricist / copyright + key + time + tempo + style + chords (structured `Chord` + free-text fallback) + single-staff melody + lyrics + form markings (𝄆 𝄇 first/second endings D.C. D.S. Coda Segno Fine) + section labels + pickup measure + print via `@media print` to PDF + share via URL-encoded JSON. Tech: VexFlow (SVG, ~200KB, industry standard, our data model → VexFlow primitives, not via MusicXML). Same `Chord` type as v1 Bass Arpeggios — cross-module substrate reuse. ~8–12 week build, 8 slices. Advanced tier (mid-piece key/time changes, multi-voice, MusicXML import/export, multi-page, real-time collab, audio playback) deferred to Later until Basic is shipped. Registry promoted to `bucket: "next"` / `status: "designed"` — `/roadmap` now shows Lead Sheets in the Next column. |
| 2026-06-29 | **Phase 13 — Custom pattern authoring shipped.** Users can now write their own arpeggio patterns alongside the four built-ins. Each custom pattern is a named list of `PatternNote` semitone offsets from the chord root (absolute, not scale-degree — the engine plays exactly the intervals the user picks, regardless of chord quality, which is the model the user explicitly chose). New `CustomPatternEditor` modal: name field, removable chip list of the current note sequence, a 13-button picker grid covering the full chromatic vocabulary (1, ♭2, 2, ♭3, 3, 4, ♭5, 5, ♭6, 6, ♭7, 7, 8(oct) — jazz idiom labels with sharp enharmonics shown as sub-labels), in-editor preview button that auditions the draft over a C major chord. Custom patterns appear in the Pattern section alongside the built-ins; each tile shows its degree string (e.g. "1-♭3-5-♭7") inline. Edit pencil opens the editor; delete lives inside the editor with a confirm. **Engine refactor:** `ArpeggioPattern` widened from a closed 4-string union to plain `string` so built-ins and custom IDs (prefix `custom_`) share the same type. Old record-style lookups (`ARPEGGIO_PATTERN_DISPLAY_NAMES[p]`) replaced by resolver functions (`getPatternDisplayName(id)`, `getPatternShortName(id)`, `getPatternDegrees(id)`, `getPatternNoteCount(id)`, `parsePatternDegrees(id)`) that dispatch built-in vs custom. `generateArpeggio` gains a custom-path that resolves the pattern via `useCustomPatternsLibrary.getState().getById()` and emits MIDI notes via `semitoneToMidi`. Drill-screen lit-up degrees animation works for customs too — segments come from `parsePatternDegrees` which splits on the notes array (not string-split, so multi-char glyphs like `♭3` highlight correctly). New `useCustomPatternsLibrary` Zustand store persists to its own localStorage key. Up to 16 notes per pattern; v1 range constrained to one octave (semitones 0–12). |
| 2026-06-29 | **Phase 14 — Pattern system overhaul: built-ins reduced + rhythm in customs.** Major refactor of how patterns are modeled. **Built-in set collapsed from 4 to 2**, both chord-adaptive: **7th Chords** (1-3-5-7 of whatever chord is up — major-7 over maj7, minor-7 over m7, dim-7 over dim7, etc.; falls back to 1-3-5-octave on triads; even quarters in 4/4) and **Triads** (1-3-5 of current chord, 8th + 8th + quarter — half a measure per triad, plays twice through a 4/4 bar). Reasoning: Scale Tones belongs in the future Scales module (cross-module separation); Triads-with-LT and Descending become user-creatable custom patterns now that the editor supports rhythm. **PatternNote gains discriminated `kind` (`note` \| `rest`) + explicit `duration` (16th / 8th / dotted-8th / quarter / dotted-quarter / half / dotted-half / whole).** CustomPattern gains `lengthInMeasures` (v1 locked to 1; 2/4 follows in v1.1). **Engine unified via `resolvePatternForChord(pattern, chord)`** returning a `ResolvedNote[]` that both the audio path (`generateArpeggio` filters to pitched notes) and the visual subtitle (`parsePatternDegrees` returns label + durationBeats per note) consume — single representation, no divergence. Built-ins internally use a `BuiltInPatternDef` with the same shape as custom patterns (chord-tone references resolved at play time via `CHORD_INTERVALS`), so the codepath is symmetric. **CustomPatternEditor** extended with per-chip duration cycling (click the duration badge on any chip to step through values), a Rest button in the picker grid, and a live measure-fit readout (total beats with color: under / perfect / over the bar budget). **Lit-up subtitle scheduler** rewritten to be rhythm-aware: computes cumulative start beats per note, finds the active note at each metronome tick, and `setTimeout`-schedules sub-beat highlights for notes that land between beats (so the 8-8-qtr triad pattern lights up "1" on beat 1, "3" on the 1-and, "5" on beat 2, etc.). **Equal-height tiles** (`min-h-[5.5rem]`) across built-ins, customs, and the "+ New" tile so the grid reads as one consistent surface. **Migrations:** practice-config v10→v11 remaps legacy pattern IDs (`arp-7ths`/`triads-with-lt`/`scale-tones`/`descending`) to the new built-in set; custom-patterns-library v1→v2 backfills `kind: "note"` + `duration: "quarter"` + `lengthInMeasures: 1` on existing customs. Shipped drills' `arpeggioPattern` field bumped from `arp-7ths` to `7th-chords`. |
| 2026-06-29 | **Phase 15 — Descending built-ins + Start-from modifier (inversions).** Two new chord-adaptive built-ins added: **7th Chords descending** (8-7-5-3 of current chord, even quarters; mirror of the ascending 7th Chords) and **Triads descending** (5-3-1, 8-8-qtr × 2). Built-in count is now 4 (ascending + descending of each shape) so the picker covers all four primary practice directions. **New global "Start from" modifier** below the pattern grid: pill buttons for `Root · 3rd · 5th · 7th · Random`. Rotates which chord tone lands on beat 1 of any chord-tone built-in pattern, with the engine adding octave shifts to wrapped notes so the rotation stays in the patterns direction. Lets the user drill inversions from the same picker — `Start from 3rd` on 7th Chords ascending plays 3-5-7-8 (1st inversion); `Random` re-rolls the start tone per measure (expert-mode drill, forces internalization of all four positions). Triads do not have a 7th — `Start from 7th` over a Triads-in-pool wraps back to root (via modulo on `rotationCount`). Custom patterns ignore the modifier (no chord-tone semantics over absolute semitones); the picker dims and shows a "custom-only pool" badge when no chord-tone built-in is in the pool. **Subtitle labels rotate to match** — when `Start from 3rd` is engaged on 7th Chords, the lit-up drill subtitle reads "3-5-7-8" not "1-3-5-7" so what the user sees matches what they play. **Visual chip on every chord-tone tile** when modifier ≠ root so the modifier is always visible. The **Pattern section summary** also gains a `· from 3rd` suffix when engaged. **Engine architecture:** `BuiltInPatternDef` gains `direction: "asc" \| "desc"` + `rotationCount: 3 \| 4` + per-note `octaveShift`. `rotateBuiltInPattern(def, startFromChordTone)` walks the notes array, finds the slot for the requested chord tone, and rotates with direction-aware octave wrapping. `resolvePatternForChord(pattern, chord, startFromIdx)` and `parsePatternDegrees(pattern, startFromIdx)` accept the modifier so both audio and visual paths render the rotated form. `buildStartFromForSession(startFrom, totalMeasures)` pre-rolls one chord-tone per measure at Start (random mode rolls fresh values; non-random returns the same value every measure). Drill screen builds parallel `activeStartFroms` array alongside `activePatterns`. **Migration:** practice-config v11→v12 backfills `patternStartFrom: "root"` on existing drills so behavior is unchanged. |
| 2026-06-29 | **Phase 16 — polish bundle: dead-ref cleanup, rhythm-accurate preview, lock-first-measure-to-root.** Three quality improvements bundled. **(1) Dead pattern reference cleanup.** When a user deleted a custom pattern that was sitting in their `patternPool`, the orphan ID stayed in the config, surfacing as a misleading "Deleted pattern" entry in the Preview-pattern dropdown. New idempotent `cleanDeadPatternRefs(validCustomIds)` action on the practice-config store filters dead pool entries, falls back to the first surviving entry for `arpeggioPattern`, and resets the pool to the default (`7th-chords`) if everything was dead. Wired into the setup page via a `useEffect` that subscribes to the custom-patterns library and runs the sweep whenever it changes. **(2) Rhythm-accurate preview audio.** The Custom Pattern Editors Preview button previously played the pitched notes one-per-beat regardless of the durations the user had set — so the audition didnt actually reflect the rhythm being authored. New `previewPlayer.playRhythm(events, bpm)` method takes an array of `{midi, startBeat, durationBeats}` events and schedules each at its proper transport position with full sustain duration. Rests advance the clock without scheduling audio. Editor builds the event list by walking the drafts PatternNotes with a cumulative beat cursor. Result: what you hear in the editor matches what plays in the drill. **(3) Lock-first-measure-to-root sub-option for Random Start-from.** New `lockFirstMeasureToRoot: boolean` field on PracticeConfig with v12→v13 migration (defaults false). Surfaces as a small checkbox under the Start-from row when "Random" is the active value: "Lock first measure to root — gives you a footing at the start before subsequent measures randomize." `buildStartFromForSession` accepts an `options.lockFirstMeasureToRoot` flag and forces measure 0 to "root" when both are true. Scoped to drill-start (not per-chord-run) because the current sequence model is 1 chord per measure; per-chord-run locking lands when `measuresPerChord > 1` becomes a real feature. |
| 2026-06-29 | **Phase 17 — pre-tester polish + TESTER.md.** Tighter pass before the first round of real-user testing. **(1) Pattern grid sections.** The 4 built-ins + custom tiles are now grouped under three labeled section headers (Ascending / Descending / Custom). Pulled the built-in tile rendering into an inline `renderBuiltInTile` helper so the two built-in sections stay in lockstep. Custom section count is shown next to its header (“Custom · 3” when the user has 3 customs). Reads as one organized surface instead of a single long grid. **(2) Pedagogy copy on built-ins.** Replaced engine-descriptions on every built-in tile with one-sentence pedagogy lines that lead with WHAT each pattern drills (“The foundational jazz arpeggio. Master this first.” / “Builds fluency for descending lines — the direction most bassists are weakest in.”). Sets the app apart from a metronome with chord changes. **(3) First-visit onboarding card on /practice.** Dismissible welcome card at the top of the setup page that surfaces only until the user clicks Got it. Three-bullet starter guide: tap a built-in drill / hit + New custom pattern / try Start-from: Random. New `hasSeenOnboarding: boolean` field on user-prefs + `dismissOnboarding()` action; default false so first-time visitors see it, persisted to localStorage so it never comes back. **(4) `TESTER.md` checked into root.** Full tester-onboarding message (with the live link, 5 try-this items, and a closing nudge), plus a structured feedback-prompt list of v1.1-decision questions the tester can answer at end of session, plus an explicit “what NOT to ask” list (cloud sync / module #2 / pricing) so feedback stays focused on the current Bass Arpeggios module. Sets up the post-tester `IDEAS.md` update workflow so real-user input — not pre-emptive guesses — drives the v1.1 backlog. |
| 2026-06-29 | **Phase 18 — symmetric libraries: promoted custom patterns to top-level section.** Structural cleanup of the dual role the Pattern section was playing. Before: Pattern section did BOTH configuration (which patterns the current drill uses) AND library management (create / edit / delete custom patterns). After: those are separate surfaces with symmetric mental models. **New "Your patterns" section** sits at the top of `/practice` directly parallel to "Your drills" — same visual treatment (FormSection wrapper, tile grid, friendly empty state). Each tile shows name + degree-string + note-count + edit pencil; a "+ New custom pattern" tile sits at the end of the grid for authoring. When the library is empty, the section renders an inviting empty-state card with a single "+ New custom pattern" CTA. Same data store (useCustomPatternsLibrary) — purely a UI restructure. **Pattern section’s Custom sub-row simplified to pure config**: only checkboxes for the existing customs, no edit pencils, no "+ New" tile. A small "Manage patterns ↑" link in the sub-row header scroll-jumps to the Your patterns section (uses native `#your-patterns` anchor + `scroll-mt-20` to clear the sticky header). When no customs exist yet, the sub-row shows inline copy directing the user to Your patterns to create one. **Editor modal gains a one-line note** under the title when in edit mode: "Edits apply globally — every drill that uses this pattern gets the new version." Pre-empts the natural tester question "does editing this break my other drills?" Mental model now matches data model: two libraries (drills + patterns), two top-level surfaces, parallel UX. Pattern section returns to its proper job: choosing which patterns the current drill uses. Zero new navigation, no /patterns sub-route, no modal-in-modal complexity — everything stays on the setup page for the beginner-friendly single-page flow. |
| 2026-06-29 | **Phase 19 — disambiguate Pattern vs Your patterns + reorder libraries.** Three small but high-leverage clarity fixes after the Phase-18 restructure. **(1) Renamed the config section** "Pattern" → **"Drill patterns."** Removes the literal word-collision with "Your patterns" and makes the scope explicit (these settings only affect the current drill). **(2) Added a descriptive subtitle on every library section.** New optional `subtitle` prop on the `FormSection` component renders a one-line muted lead-in under the title. Subtitles shipped: Your drills → "Your saved sessions — click a card to launch, pencil to edit." Your patterns → "Your toolkit. Author custom arpeggio shapes here — they become available as checkboxes in any drill’s pattern setup below." Drill patterns gets an inline lead-in paragraph above the grid: "Pick which patterns this drill uses, in what order, and which inversion. Edits here only affect the current drill — to author or rename a custom pattern, head up to Your patterns." The cross-reference to Your patterns is an anchor link to `#your-patterns` so it scroll-jumps. **(3) Reordered the top-of-page library sections.** Was: Your drills → Built-in drills → Your patterns. Now: Your drills → Your patterns → Built-in drills. The "my stuff" libraries sit adjacent so a returning user scans them as one block; the shipped library tucks one step lower and stays collapsed by default. No new sections — just a JSX reorder. Updated the Your drills empty-state copy to reflect the new placement of Built-in drills. |
| 2026-06-29 | **Phase 20 — My Practice (Routines) design pass.** Locked the cross-module composition layer that turns Practice Prodigy from "a collection of tools" into "a platform musicians actually use." Lives at root: [ROUTINE-DESIGN.md](./ROUTINE-DESIGN.md). **The strategic move:** instead of building Metronome → Tuner → Lead Sheets in isolation and retrofitting a routine layer later, the **RoutineItem interface is designed FIRST** and every new module implements it from day one. Cost: one ~1-hour design pass upfront. Savings: no rewrites when the routine layer gets built. **Data model:** three nested abstractions — `Routine` (the template), `RoutineItem` (discriminated-union step, one variant per module), `RoutineExecution` (one specific run with per-item status tracking). Discriminated over polymorphic for type narrowing, loose coupling, and forward-compat. Each module that opts in owes ~4 small exports: a Type variant + Launcher + Composer + Renderer. **v0.1 scope:** drill + metronome RoutineItem types, routine CRUD, drag-to-reorder builder, 5 starter routines auto-seeded on first install, top-of-page routine player bar that persists across navigation, resume mid-routine via localStorage, end-of-routine summary modal. Deferred to v0.2+: per-item duration override, Pomodoro rest items, URL sharing, history/stats. **Teacher mode** explicitly deferred to a separate later phase (requires cloud sync + accounts) but the data model includes nullable forward-compat fields (`authorId`, `assigneeIds`, `dueAt`, execution `reflection`) so the teacher-mode build is additive, not destructive. **Build sequencing locked:** (1) this design doc ✅ (2) Metronome module standalone + RoutineItem-compatible (3) My Practice v0.1 surfacing routines for the two existing modules (Arpeggios + Metronome) (4) Tuner / Lead Sheets / Scales / etc. each add a new RoutineItem `type` to the union. Registry promoted: `my-practice` module added as `bucket: "next"` / `status: "designed"`, sitting at the top of the Next column alongside Metronome — they ship as a pair. |
| 2026-06-29 | **Phase 21 — Metronome module shipped (premium tier).** Second live module on the platform. New `/metronome` route. The standalone metronome lives alongside the existing drill metronome — separate audio engine (`src/lib/audio/standalone-metronome.ts`) because the drill engine is coupled to count-in/play/transition semantics and sharing would have required a refactor we don’t want to take on now. Duplication was cheaper. **Capabilities shipped:** BPM 30-300 with tap tempo, presets (40/60/80/100/120/140/160/200), �1 / �5 nudge, �2 / �2; all 10 time signatures; subdivisions per beat (quarter / 8th / triplet / 16th); per-beat accent state (normal / accent / mute — click any beat tile to cycle); 4 sound presets (tonal click / wood block / electronic / stick — each its own synth flavor); volume slider with mute toggle; 3 visual indicator styles (beat dots / pulsing circle / pendulum). **Premium-tier features:** polyrhythm (secondary pulse at user-chosen hits-per-measure with its own sound), tempo ramping (gradually rise from startBpm to endBpm over N measures then loop), silent measures (every Nth measure goes silent for ear-training). **Keyboard shortcuts:** Space = play/stop, arrows = BPM �5, T = tap tempo. **Beat-accurate visual sync:** subscribes to engine state via custom listener; `Tone.getDraw()` schedules visual updates to land on the audible beat. **Persistence:** new `useMetronomePrefs` Zustand store (own localStorage key) holds the user’s last config + visual style. **RoutineItem interface:** new `src/lib/routines/types.ts` defines the cross-module discriminated union (Phase 20 design doc made flesh). v0.1 ships two variants — `DrillRoutineItem` and `MetronomeRoutineItem` — plus the `Routine`, `RoutineExecution`, and forward-compat teacher-mode fields. Registry promoted: metronome status `designed` → `live`, bucket `next` → `now`. The platform now has two live modules. **Next:** Phase 22 — My Practice v0.1 (routine builder + player that composes Arpeggios + Metronome). |
| 2026-06-30 | **Phase 23 — Tuner module shipped.** Third live module. New `/tuner` route. Chromatic tuner via microphone input. **Audio pipeline:** Web Audio API (getUserMedia + AudioContext + AnalyserNode), 4096-sample FFT window (~85ms @ 48kHz — long enough for low bass notes), autocorrelation pitch detection with parabolic interpolation for sub-sample period refinement. Skipped the `pitchy` npm dependency (local npm install was throwing errors) in favor of inline autocorrelation — well-understood algorithm, works for any monophonic instrument (bass / guitar / voice). **Engine surface:** `tunerEngine` singleton with `start()` / `stop()` / `subscribe()` / `setReferenceA4()`. Subscribers get a `TunerReading` per requestAnimationFrame: detected frequency in Hz, nearest equal-tempered note name + octave, cents offset (-50 to +50), and RMS input level. **UI:** big note display (e.g. "A4" with smaller octave subscript), animated cents needle with �5 / �15 / off color zones (primary / amber / destructive), Hz readout, input-level meter, A4 reference picker (415-466 Hz range with presets: baroque 415, new-age 432, standard 440, modern orchestra 442, sharp 444). Cents smoothing window of 6 frames stabilizes the needle against transient noise. Sticky-note display keeps the last detected note visible during brief drops in input level so the screen doesn’t blink during a string-pluck decay. **Permission UX:** clean "Start" CTA → browser mic prompt; explicit "Microphone access denied" state with recovery instructions if blocked. **RoutineItem interface:** added `TunerRoutineItem` type to `src/lib/routines/types.ts` (per the Phase 20 cross-module contract). Variant carries optional `referenceA4` so a routine can specify "tune to A=442" as a routine step. **Registry:** tuner promoted `designed → live`, bucket `next → now`, route `/tuner`. **The platform now has THREE live modules.** Per the user-defined sequence: Metronome ✅ + Tuner ✅ + Lead Sheet Builder (next) = ready for tester. |
| 2026-06-30 | **Phase 24a — Lead Sheet Builder MVP (chord chart slice) shipped.** Fourth live module. The platform now has FOUR live modules (Bass Arpeggios, Metronome, Tuner, Lead Sheets). **MVP scope is intentionally chord-chart only** — no VexFlow / melody / lyrics / form markings yet (those land in Phase 24b–24d per LEAD-SHEET-DESIGN.md). Routes: `/sheets` (library), `/sheets/[id]` (read-only view + print), `/sheets/[id]/edit` (editor). **Data model:** `Sheet` with meta (title, composer, style, optional BPM, key tonic + mode, time signature) + ordered `SheetMeasure[]` (each measure carries 1–2 `Chord`s, reusing the existing chord vocabulary so notation styles, chord rendering, and the 20 chord qualities all work for free). `src/lib/sheets/types.ts` + `src/lib/state/sheets-library.ts` Zustand store (own localStorage key, CRUD + `markSheetOpened` for last-opened sort). **Library page:** card grid sorted most-recently-opened first, friendly empty state, +New CTA, two-click delete confirm, edit-pencil affordance. **Editor:** inline title input (auto-saves on blur via store updates), meta fields (composer, style, BPM, key, time sig), measure grid (4-up responsive), per-measure chord chips with click-to-edit popover (root + quality dropdowns, live chord-render preview, save/cancel/remove), 1–2 chords per measure with a half-bar split treatment, add-measure / delete-measure controls. **Display + print:** clean centered title block, measure grid with proper barlines, `window.print()` + `@media print` CSS hides the chrome and renders just the chart, browser’s native "Save as PDF" handles the export. **Cross-module integration:** `SheetRoutineItem` variant added to the routines union with optional `repetitions` field. **Registry:** lead-sheets promoted `designed → live`, bucket `next → now`, route `/sheets`. **Honest scope note:** the basic-tier design doc (LEAD-SHEET-DESIGN.md) sets 8–12 weeks for full Basic Tier (melody, lyrics, form markings, etc.). This Phase 24a slice is the smallest useful starting point — a usable chord-chart authoring tool today, with the architecture in place to layer melody (VexFlow) and lyrics on top in subsequent phases. |
| 2026-06-30 | **Phase 24b — Lead Sheet Builder: melody via VexFlow.** Second slice of LSB. **Diagnosis of the npm bug first:** the project is pnpm-managed (pnpm-lock.yaml + node_modules/.pnpm/ present), but I had been calling `npm install` — which mangled the pnpm-style symlink tree and triggered npm's arborist "Cannot read properties of null (reading 'matches')" crash. The fix was one word: `pnpm install vexflow`. Documented here so future module additions know which package manager to use. **Melody data model:** new `MelodyNote` discriminated union (`note` or `rest`) carrying VexFlow-style pitch string (e.g. c/4, f#/5) + duration (w / h / q / 8 / 16) + optional dotted flag. `SheetMeasure` gains optional `melody: MelodyNote[]`. **Renderer:** new `MelodyStaff` client component (`src/components/sheets/melody-staff.tsx`) takes a measure's melody + time signature and draws a treble-clef staff via VexFlow's SVG backend. `showClef` / `showTimeSignature` props let the caller render the clef + time-sig only on the first measure of a line. Empty melody renders just the staff. **Editor UX:** measure grid changed from 4-up to 2-up so each measure has breathing room for the staff. Each measure card now shows: measure number + chord chips (existing) + rendered melody staff + Add/Edit melody button. A new `MelodyEditorModal` (pitch letter + accidental + octave + duration + dotted-toggle pickers) lets users compose the melody note-by-note with a live VexFlow preview that re-renders on every change. Add note / add rest / remove existing note all supported. **View + print:** view page measure grid also 2-up; melody staff renders when present, hidden when empty. Print CSS unchanged. **Persistence:** sheets-library v1→v2 migration backfills empty `melody: []` arrays on existing measures so the renderer never gets undefined. **Deferred to Phase 24b.2:** ties (cross-measure), triplets, slurs / phrasing, multi-voice. Phase 24c (lyrics) and 24d (form markings) still queued. |
| 2026-06-30 | **Phase 24b.2 — Lead Sheet melody: triplets + intra-measure ties.** Two of the four design-doc items for 24b.2 shipped; slurs + cross-measure ties + multi-voice still deferred to 24b.3 (multi-measure render coordination + substantial editor rework). **Data model:** MelodyNote gains optional `tieToNext: boolean` and `tupletGroup: string`. Both are additive optional fields; sheets-library v2→v3 migration is a no-op version bump. **Renderer:** MelodyStaff walks the melody array to detect consecutive same-group tuplet runs and wraps them in a VexFlow Tuplet (auto-computes notesOccupied as the next-power-of-2 below the run length, so 3 → 2 / 5 → 4 / 6 → 4 / 7 → 4 — standard music-theory convention). For each note with `tieToNext` set, a StaveTie connects it to the next note — but ONLY when the next note is pitched AND at the same pitch (the musically meaningful case). Tuplet brackets + numbers and tie arcs both draw with `setContext(context).draw()` after the voice renders. **Editor UX:** new "Triplet (last 3)" action button next to Add note / Add rest — wraps the last 3 entries into a fresh tuplet group (disabled when there are fewer than 3 notes or when the last 3 already have a group). Each chip in the sequence list now shows visual state: `⌣` marks a tied note, `³` + an amber border marks a tuplet member. Per-chip controls: `tie` toggle (note chips only, hidden on the last chip), `ungroup` (visible on tuplet members — un-triplets the whole group), `×` remove. Footer help text explains the symbols. **Scope honesty:** cross-measure ties intentionally not shipped — would require the MelodyStaff component to render across measure boundaries with knowledge of the previous measure's last note. Slurs same issue plus phrase-rendering complexity. Multi-voice would require a parallel melody track in the data model + editor UI for switching between voices. All three queued for Phase 24b.3. |
| 2026-06-30 | **Phase 24b.3 — Lead Sheet Builder: professional engraving rework.** Replaces the previous one-measure-per-card grid with a continuous multi-measure paper surface, addressing the user's observation that the LSB didn't look like professional engraving software (Dorico / MuseScore / Sibelius). **New component:** `src/components/sheets/sheet-surface.tsx` — a single VexFlow renderer that takes a `Sheet` and draws the whole piece on a light "paper" surface with traditional engraving conventions: continuous staves with measures connected through barlines, treble clef + key signature at the start of EVERY line (not just measure 1), time signature only on the first line (per piece), end-barline (double bar) at the very end, single barlines between measures, chord symbols positioned directly above each measure in a bold serif, measure-number label above the first measure of each line, auto-beamed eighth/sixteenth notes via `Beam.generateBeams` (tuplet notes excluded so the Tuplet bracket + numeral stays visible), key signature spelling chosen per standard convention (e.g. D♯ major rendered as E♭ enharmonic, A♯ minor as B♭ minor — VexFlow accepts those key specs natively). **Title block:** serif typography (Georgia / Times) — title centered, style top-left, composer top-right, tempo + key sub-line. **View page:** card grid replaced entirely with `<SheetSurface>`, max-width bumped 3xl → 5xl. Print CSS keeps the paper edge-to-edge with no shadow. **Editor page:** preserves the existing dark card grid (used for actual editing — chord chips + per-measure mini-staff + chord/melody editor modals) but adds a live `<SheetSurface>` preview at the top so the user sees the polished output as they author. **What did NOT change:** the data model (Sheet / SheetMeasure / MelodyNote — unchanged), the chord/melody editor modals, the per-measure `MelodyStaff` component (still used for the in-modal live preview where a single-measure render is what's being edited). **Still deferred:** cross-measure ties + slurs (still needs a multi-line render coordinator that knows about the previous line's last note — Phase 24b.4), Phase 24c lyrics, Phase 24d form markings (repeats / D.C. / D.S. / Coda / Segno), Phase 24e share-via-URL. |
| 2026-06-30 | **Phase 24c — Lead Sheet Builder: inline Sibelius-style lyrics.** Lyrics ship as the most ambitious option on the table: a true click-on-staff + type-syllables flow, not a modal-based shim. The result is closer to Dorico / Sibelius / Finale than to a music app's typical "fill in this dialog" UX. **Data model.** `MelodyNote` (note variant) gains optional `lyric?: { text: string; continuation: "none" \| "hyphen" \| "underscore" }`. Rests + tied-follower notes never carry syllables (they're skipped by the cursor walk). Sheets-library bumped v3 → v4 — additive optional field, no-op migration. **Renderer (SheetSurface).** Adds a 22px lyric band below every staff line. Each pitched note with a lyric draws its syllable in serif (Georgia / Times, 11pt) horizontally centered on the note's X. Trailing dash auto-appended for `hyphen` continuation. For `underscore` continuation a horizontal melisma line draws from the syllable's right edge to the right edge of the last melisma note within the measure (boundary = next note with its own lyric, or end of measure; cross-measure melismas deferred to a polish slice). **Position-tracking exposed via `onLayout` callback** — every render emits per-note pixel positions (in the paper div's coordinate space) so the editor can overlay click regions + a floating input. **Single-measure preview (MelodyStaff)** got the same lyric pass so the in-modal melody preview matches the final engraving (height bumped 90 → 120px to fit the band). **New helper module:** `src/lib/sheets/lyric-cursor.ts` — pure functions for lyric-eligible position walking (`firstLyricPosition` / `nextLyricPosition` / `prevLyricPosition` / `isLyricEligible`), the `parseLyricInput` trailing-marker parser (`love-` → `{ text: "love", continuation: "hyphen" }` ; `ah_` → `{ text: "ah", continuation: "underscore" }`), and the pure `setLyricAt` measures-array transform. **New overlay component:** `src/components/sheets/lyric-overlay.tsx` — positioned absolutely over the SheetSurface paper. Renders a circular click region for each lyric-eligible note (hover-amber, active-amber-ring), a floating `<input>` anchored below the cursor note. Auto-focuses the input on mount and on every cursor move; caret jumps to end so backspace behaves naturally. **Editor wiring (`/sheets/[id]/edit`).** "Edit lyrics" toggle button next to the Preview header. When on, the SheetSurface emits layout, the overlay renders, and a help banner surfaces the keybindings (space = advance, `-` = hyphen continuation, `_` = melisma, esc = exit, backspace-on-empty = retreat). **Lyric mode lifecycle:** entering lands the cursor on the first eligible position and loads its existing syllable into the draft; advancing commits the parsed draft (if changed), then jumps to the next eligible position; backspace-on-empty retreats; escape commits + exits; clicking a different note commits + jumps. Commit uses freshest store state via `useSheetsLibrary.getState()` so back-to-back commits never lose work to stale React closures. **What's intentionally deferred to 24c.x polish:** mobile / touch authoring (current flow is desktop-first with a real keyboard), multi-verse lyrics (2nd / 3rd verse stacked beneath the first), cross-measure melismas, lyrics on tied-chain follower notes (waits on Phase 24b.4 cross-measure ties for the underlying tie semantics). |
| 2026-06-30 | **Phase 24c.1 — LSB engraving polish.** Five visible bugs surfaced from the first Phase 24c production deploy. Chord band shrunk 22 → 18 + chord baseline tightened (staveY-6 → staveY-3) so the chord row sits tight against the staff. **Ledger-line-aware chord push-up** — per-line pre-pass walks every pitched note, finds the highest pitch above F5 (the top treble-clef staff line), and pushes the entire line's chord row up by `staffSteps × 5px + 6px headroom`. Per-line (not per-measure) keeps chord symbols visually aligned across the line — standard engraving convention. **Two-chord-per-measure layout** — first chord on the downbeat (noteStartX), second past the half-bar at 55% of the measure width instead of the naive 50% split, so `Dmaj7` and `A-7` no longer touch. **End-barline clipping fix** — SVG canvas widened by `CANVAS_RIGHT_PADDING = 16px` so the END barline's outer line glyph isn't cut off at the canvas edge. **Lyric baseline offset bumped** 16 → 26 (SheetSurface) and 26 → 36 (MelodyStaff modal) so syllables clear stems extending below the staff and ledger-line notes. **Line height now variable per-line** to accommodate the chord push-up — `linePushUps[]` + `lineYs[]` precomputed before the render loop instead of `lineIdx × LINE_HEIGHT`. **LEAD-SHEET-DESIGN.md** grows a §8.5 phased roadmap (Phase 24c.1 → 35) capturing the full Basic-Tier closeout plan with hard prerequisites enforced, sub-slice splits for the bigger phases (e.g. 25.0 / 25.1 / 25.2), and rough cost estimates so the user has visibility into the path to a Dorico-class LSB. |
| 2026-06-30 | **Phase 24c.1.1 — lyric offset bump.** Quick follow-up. A residual ~6px collision between low-pitch eighth notes' stem flags and the top of lyric letters survived the first 24c.1 bump. `LYRIC_BASELINE_OFFSET` 26 → 34 + `LYRIC_BAND_HEIGHT` 34 → 42 (SheetSurface); `LYRIC_OFFSET_BELOW_STAFF` 36 → 44 + default height 130 → 138 (MelodyStaff modal). |
| 2026-06-30 | **Phase 25.0 — Click-on-staff melody entry (MVP).** First slice of the Dorico-style click-entry rework. The modal flow stays as a fallback. **New "Click entry" mode toggle** next to "Edit lyrics" in the Preview header; the two modes are mutually exclusive (editor refactored from `lyricMode: boolean` to `editorMode: "none" | "lyrics" | "click-entry"`). When on, an inline side panel surfaces rhythm value (Whole / Half / Quarter / Eighth / Sixteenth), Dotted toggle, and Rest toggle, all sky-blue themed so it's visually distinct from amber lyric mode. **SheetSurface gains a measure-rects emission** — per-render, alongside the existing per-note positions, it now reports `SheetMeasureRect[]` with each measure's `noteStartX`, `noteEndX`, `staveTopY`, `topLineY`, and `bottomLineY` (translated to paper-div coord space). The top/bottom line Ys come from VexFlow's `getYForLine(0)` / `getYForLine(4)` so the click-Y-to-pitch math stays accurate even if the stave's vertical layout shifts in future. **New helper module** `src/lib/sheets/melody-entry.ts` — pure functions: `measureAtX(rects, x)` finds which measure was clicked, `pitchAtClickY(rect, y)` snaps the click Y to the nearest staff step (5px = one line/space, treble clef) and returns the VexFlow pitch string (`f/5`, `c/4`, etc.), `appendMelodyNote(sheet, measureIdx, note)` is the pure measures-array transform, plus `buildPitchedNote` / `buildRestNote` constructors that the editor uses to package the side-panel state into a `MelodyNote`. **New overlay component** `src/components/sheets/melody-entry-overlay.tsx` — absolute-positioned over the SheetSurface paper with `cursor: crosshair`; click handler computes paper-relative coords via `getBoundingClientRect()`, rejects clicks too far above/below the staff (±36px buffer for above/below-staff notes), and fires `onPlaceNote(measureIdx, pitch)` for valid clicks. **Editor wiring** — `onPlaceNoteAtClick` either builds a pitched note (from rhythm + dotted + pitch) or a rest (when the Rest toggle is on), then calls `appendMelodyNote` and writes through the store via `updateSheet`. Window-level Escape handler exits the mode. **Pitch math** (treble clef): step 0 = F5 (top line), each step down 5px → letter goes E, D, C, B, A, G, F (7-letter cycle); octave drops by 1 at the C→B boundary via `5 - floor((step + 3) / 7)`. Negative steps handled symmetrically for above-staff pitches up through ~C6 / D6 / E6 (3rd ledger line above). **Honest scope:** v0 appends notes to the clicked measure (click X picks the measure but doesn't target a specific beat) and has no visual caret, no keyboard pitch entry, no accidental input. Those land in **Phase 25.1** (A-G keys + arrows + accidentals) and **Phase 25.2** (beat-targeting clicks + visual caret + replacement). Modal entry stays untouched as a fallback. |
