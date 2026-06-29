# Practice Prodigy — Ideas & Proposals

> Parking lot for every idea, feature request, improvement suggestion, or proposal that isn't currently committed to the active v1 build. Implemented ideas migrate to [PROJECT-DESIGN.md](./PROJECT-DESIGN.md). This file is the durable record so nothing gets lost in conversation history.

**Last updated:** 2026-06-29

## Status Legend

| Status | Meaning |
|---|---|
| **New** | Just captured; no commitment yet |
| **Under Consideration** | Being weighed for inclusion in an upcoming milestone |
| **Scoped** | Committed to a named milestone (see Notes for which) |
| **Implemented** | Shipped — moved to PROJECT-DESIGN.md |
| **Rejected** | Considered and declined; reason captured |

---

## Active Ideas — v1.1 milestone candidates (Polish + Cloud)

| Date | Title | Status | Notes |
|---|---|---|---|
| 2026-06-28 | Cloud sync via Supabase | Scoped → v1.1 | Auth (email / Google / Apple) + Postgres pattern store. Includes one-screen local-to-cloud migration on first sign-in. |
| 2026-06-28 | Audible per-change alert | Scoped → v1.1 | Different click sound on last beat of each chord so ears get heads-up before the change. Configurable on/off. |
| 2026-06-28 | Tempo ramping | Scoped → v1.1 | "Increase BPM by N each pass through the sequence" — classic technique-building drill. Settings: start BPM, ramp amount, max BPM. |
| 2026-06-28 | Half/double-speed buttons | Scoped → v1.1 | One-tap to halve or double current tempo. Useful for woodshedding. |
| 2026-06-28 | BPM presets | Scoped → v1.1 | "Slow / Medium / Fast" pills that snap to user-configurable BPM values. |
| 2026-06-28 | Two-pane practice layout | Scoped → v1.1 | Equal-weight current + next chord panels with slide animation on change. Plugs into the layout-strategy slot already designed. |
| 2026-06-28 | Scrolling Timeline practice layout | Scoped → v1.1 | Guitar Hero-style horizontal scroll of upcoming chords toward a "now" marker. Most engaging; most animation work. |
| 2026-06-28 | Full-Sequence Chart practice layout | Scoped → v1.1 | Leadsheet-style view of the entire sequence with current chord highlighted. Best for memorizing fixed progressions; weak for randomized modes (chart shuffles each cycle). |
| 2026-06-28 | Two-octave Scale Tones | Scoped → v1.1 | Currently locked at one octave; expand the Scale Tones range option to include 2-octave ascending/descending. |
| 2026-06-28 | Bass profile setting | Scoped → v1.1 | String count (4/5/6), tuning (standard / drop / BEAD / custom), range preference (low / mid / high). Drives 8-7-5-3 register and lays groundwork for future fretboard rendering. |
| 2026-06-28 | Pattern bundle export | Scoped → v1.1 | Multi-pattern .json export (currently v1 is one-pattern-per-file). Makes sharing curated practice sets with a teacher trivial. |
| 2026-06-28 | "Doesn't fit cleanly" rhythm warning | Scoped → v1.1 | Non-blocking yellow note when chord-duration ÷ pattern-note-count yields ugly rhythm (e.g., 7-note Scale Tones over 2 beats). |
| 2026-06-28 | Visual beat-1 pulse | Scoped → v1.1 | Soft screen pulse (or colored ring around current chord) on beat 1 of every measure. Reinforces meter visually without adding clicks. |
| 2026-06-28 | Haptic on chord change (mobile) | Scoped → v1.1 | Single light tap on device exactly when chord changes. Pro-instrument-app polish detail. |
| 2026-06-28 | Setup preview | Scoped → v1.1 | Before pressing Start, show the first 2 chord changes visually + optionally audibly. Catches "I set this wrong" before drilling 16 measures. |
| 2026-06-28 | Skip / restart-current-chord / rewind-1-chord controls | Scoped → v1.1 | For when user flubs a chord and wants to drill it again without restarting the whole sequence. |
| 2026-06-28 | "Resume session" recovery | Scoped → v1.1 | Browser crash or screen lock → on reopen, offer "resume from where metronome stopped." |
| 2026-06-28 | Per-chord-instance scale override | Under Consideration | "This specific Cmaj7 in this sequence uses Phrygian" — currently overrides are per-quality only. Adds data-model complexity; defer until real demand emerges. |
| 2026-06-28 | Scale-degree / Roman-numeral chord display | Under Consideration → v1.1 or v2 | Show chords by their **functional role** (i, ii−, IV, V7, etc.) instead of letter names (A, B, C). Pedagogically excellent — teaches functional harmony, which is what jazz/popular musicians actually use day-to-day. Subtle design problem: requires a **key context**. Drills WITH a declared key (ii-V-I in Bb, blues in F) are trivial. Drills WITHOUT a single key (cycle-of-5ths through dominant 7s, random chords from all 12 keys) need a design call — declare the key globally? compute per-chord implied key on the fly? disable Roman numerals in keyless modes? Convention: lowercase = minor (`i`, `ii`, `iii`), uppercase = major (`I`, `IV`, `V`), with quality decorations appended (`V7`, `iiø7`). Optional alternate: Nashville Number System (`1`, `2`, `♭3`, `4`, `5`, `6`, `♭7`) used by country / session players. Sits in the same `ChordRenderer` plugin slot as the notation-form work above. |
| 2026-06-28 | Click sound library + customization | Scoped → v1.1 | Let user pick from a set of preset metronome sounds (wood block, cowbell, electronic click, side-stick, etc.) and optionally customize per-sound pitch / volume / decay. Currently a single hardcoded high/low click pair is used. Promotes the "click sound choice" already noted in PROJECT-DESIGN.md §4.8 to a first-class Advanced setting in the cascade. |
| 2026-06-28 | Click sequence-preview chip to focus its pool row | New | Make each chord chip in the top Sequence card a navigation affordance: clicking the chord scrolls the chord-pool list to that row and focuses its root dropdown for quick edit. Especially valuable once the pool list is scroll-confined (large wizard-generated pools). |
| 2026-06-28 | Duplicate-row action on each pool row | New | Small "copy" icon next to delete on each chord row; inserts a copy directly below. Faster than tweaking after the Add-chord default (which already copies the last chord, but only at the END of the pool). |
| 2026-06-28 | Earlier / louder POOL_MAX warning in wizard | New | The wizard's count line currently mentions "capped at 144" inline alongside the produced-chord count. Make it visually distinct (warning color, possibly soft-block Replace) so users see the cap before committing rather than during. |
| 2026-06-28 | Keyboard shortcuts on setup + drill | New | Cmd/Ctrl+Enter on setup → Start practice (works from anywhere on the form). Spacebar on drill → Start/Stop (overlap with the v1.1 spacebar item — could pull forward together). Tab order audited through all form fields. |
| 2026-06-28 | "Edit drill" icon on drill screen | New | Small pencil icon in the drill-screen header. Click → navigates back to `/practice` with current config still loaded so the user can tweak and re-launch without losing their place. |
| 2026-06-28 | Recently used drills auto-tracked | New | Quick Start surface includes a "Recently used" row in addition to (or alongside) the explicitly-saved drills row. Auto-pinned by `lastLoadedAt` timestamp. Cap at 5 entries; older ones drop off. |
| 2026-06-28 | Duplicate-drill action | New | Each drill card gets a "duplicate" action — clones the drill with a name like "Morning warm-up (copy)". Lets users derive variants (e.g., morning vs evening tempo) from a base drill without rebuilding. |
| 2026-06-28 | Current drill name in drill-screen header | New | When a drill was loaded from a saved Quick Start entry, surface its name in the drill-screen header (e.g., "Morning warm-up · Arp 7ths · ♩=80 · 4/4"). Anchoring context that you're drilling a *named* thing, not an ad-hoc setup. |
| 2026-06-28 | "Save" vs "Save as new" semantics for loaded drills | New | If the current config was loaded from a saved drill, the Save button updates that drill (overwrite). "Save as new…" creates a separate entry. Currently every save creates a new entry (no overwrite); fix as the library grows. |
| 2026-06-28 | Naming decision (locked 2026-06-28) | Decided | The user-saved configuration unit is called a **"Drill"** (Quick Start shows "Your drills," save button says "Save as drill"). The arpeggio-pattern concept (1-3-5-7 etc.) keeps the name **"Pattern"**. This unblocks Custom-Pattern-library work (PROJECT-DESIGN.md §4.6) — terminology now reads as "library of Drills, each composed of a chord pool + Pattern + tempo + meter + ...". |
| 2026-06-28 | Drill description / notes field | New | Small text field (≤300 chars) per saved Drill — surfaces as a third line on the Quick Start card. Example: "Slow at 60. Focus on left-hand timing." Personal memory aid that survives across sessions. |
| 2026-06-28 | Drill folders / tags | New | Once the library grows past ~15 drills, flat-list browsing gets clunky. Simple tag chips ("warm-up", "etude", "key of G", "challenging") let users filter and group. Tags multi-select; one drill can carry several. |
| 2026-06-28 | Discard-changes affordance when editing a Drill | New | When the user is in editing mode and makes uncommitted changes (current config differs from saved drill.config), surface a small "Discard changes" link next to the Done-editing button. Resets the live config to the drill's saved state, no save needed. |
| 2026-06-28 | Sort / reorder Quick Start cards | New | Drag-to-reorder for explicit ordering. Plus a small sort menu (Name / Last used / Created) so users can scan a long library efficiently. Pairs with `lastUsedAt` tracking already noted for recently-used auto-tracking. |
| 2026-06-28 | Empty-state example drill | New | When the user has no saved drills, the Quick Start empty state currently just says "save your first drill below." Could include a single "Try a sample drill →" link that loads a sensible default ("All m7 in 12 keys" or similar) so first-time users see what a saved drill looks like in action without having to build one. |
| 2026-06-28 | Collapse-with-summary on all main sections | Scoped → v1 (this slice) | Chord pool / Pattern / Tempo & meter / Session sections become collapsible like Quick Build is. Each collapsed header carries a one-line summary of the section's current state (e.g. "Tempo & meter · ♩=100 · 4/4") so the user always sees the truth without expanding. Collapsed by default; click to edit. Apple Settings / Notion docs pattern. |
| 2026-06-28 | Drill-screen tempo nudge (±5 BPM) | Scoped → v1 (this slice) | Replace the static BPM readout in the drill-screen header with a `−5 / ♩=N / +5` triplet. Updates both `transport.bpm.value` (live) and the store's bpm field (persisted) so the change survives a Stop+Start. Removes the Pause-→-Setup-→-tweak-→-resume cycle for the most common mid-drill adjustment. |
| 2026-06-28 | Scales module (separate page, shared substrate) | Scoped → v2 | New route `/practice/scales` for drilling scales (major, minor pentatonic, mixolydian, whole tone, etc.) — separate from `/practice/arpeggios` (the current page would migrate to that route). Sibling page reuses metronome engine, ChordRenderer plumbing, randomization, quick-build wizard pattern, NEXT preview, and drill-screen shell (~70% reusable). New code is the scale data model, scale-pattern generation (ascending in 3rds, broken thirds, etc.), and a scale-flavored setup form. Pre-scaffolds the multi-instrument expansion: future routes like `/practice/piano/arpeggios`, `/practice/voice/intervals` etc. |
| 2026-06-28 | Persistent header module switcher | ✅ Implemented (v1 Phase 5) | Shipped as part of Phase 5 — see Implemented section. |
| 2026-06-28 | Persistent footer with credits + roadmap link | ✅ Implemented (v1 Phase 5) | Shipped as part of Phase 5 — see Implemented section. |
| 2026-06-28 | `/roadmap` page surfacing the 9-item vision | ✅ Implemented (v1 Phase 5) | Shipped as part of Phase 5 — see Implemented section. GitHub-issue cards-per-module is a future polish. |
| 2026-06-28 | Drill genre tag (informational, then filter substrate) | New → v1.1 | Genre tag (`jazz` / `blues` / `pop` / `rock` / `general` / …) on every drill. Already added to `ShippedDrill` for the built-in library; promote to a top-level `Drill` field so user drills can carry it too. v1.1: tiny genre chip on each Quick Start card. v1.2: filter row above Quick Start ("All · Jazz · Blues · …") so a 30-drill library stays scannable. |
| 2026-06-28 | Drill difficulty tag | New → v1.1 | Beginner / Intermediate / Advanced label on every drill. Especially valuable for the shipped library — first-time users can pick "what's right for me" without needing music-theory background to read the chord list. Optional on user drills. Same substrate as the genre filter — adds a second filter axis once the library grows. |

---

## Active Ideas — v1.2 milestone (Native Wrappers)

| Date | Title | Status | Notes |
|---|---|---|---|
| 2026-06-28 | Capacitor iOS + Android packaging | Scoped → v1.2 | Wrap the web app as native app-store-distributable apps. Same codebase, same audio engine. ~1 week each platform. Requires Apple Developer + Google Play accounts. |
| 2026-06-28 | Tauri desktop packaging | Scoped → v1.2 | macOS / Windows / Linux native desktop wrappers. ~1 week. Lighter than Electron. |

---

## Active Ideas — v1.5 milestone candidates (Teacher / Student)

> ⚠️ This milestone needs its own dedicated design interview before any of these are committed.

| Date | Title | Status | Notes |
|---|---|---|---|
| 2026-06-28 | Teacher-student relationship model | Under Consideration | Account roles (teacher / student); teacher invites student; student joins teacher's "studio." |
| 2026-06-28 | Pattern assigning | Under Consideration | Teacher pushes a pattern (or pattern bundle) into student's library with optional notes. |
| 2026-06-28 | In-app pattern comments | Under Consideration | Threaded comments on a pattern, e.g., teacher annotating "slow this to 60 BPM first." |
| 2026-06-28 | Audio/video submission + review | Under Consideration | Student records themselves practicing → submits to teacher → teacher reviews and comments. Needs Supabase Storage. |
| 2026-06-28 | Progress visibility | Under Consideration | Teacher dashboard showing student's practice frequency, patterns drilled, tempos achieved. |
| 2026-06-28 | Share-via-URL pattern links | Under Consideration | Click "Share" on a pattern → get a URL that auto-imports for the recipient. Needs tiny backend (Supabase blob store + short ID). |
| 2026-06-28 | Live teacher-student session | Under Consideration | Synchronized practice screens with chat / video / annotated playback. Supabase Realtime. |

---

## Active Ideas — v2 milestone candidates (Multi-Instrument Platform)

| Date | Title | Status | Notes |
|---|---|---|---|
| 2026-06-28 | Piano module | Under Consideration | Piano-specific arpeggio patterns, keyboard rendering, two-handed considerations. |
| 2026-06-28 | Guitar module | Under Consideration | Fretboard rendering, fingering-aware patterns, capo/tuning support. Polyphonic. |
| 2026-06-28 | Voice module | Under Consideration | Solfege-aware drills, interval training, key-customization for vocal range. |
| 2026-06-28 | Drum module | Under Consideration | Rhythm-focused drills (rudiments, time-feel patterns, polyrhythms). Very different from arpeggios but fits the broader "practice platform" vision. |
| 2026-06-28 | Standalone Metronome module | Under Consideration | Full-featured metronome (subdivisions, accents, polymetric, programmable sequences) usable independently of arpeggio drills. |
| 2026-06-28 | Standalone Tuner module | Under Consideration | Chromatic tuner using microphone input. Pairs with bass profile and later instrument modules. |
| 2026-06-28 | Fretboard / keyboard visualization | Under Consideration | Show notes / chords / scales visually on the instrument layout — for instruction and reference. Applies across multiple modules. |

---

## Active Ideas — Future modules (Practice Prodigy as a music-education platform)

> The 9-item long-term vision (locked 2026-06-28): Practice Prodigy as a unified music-education super-app rather than just an arpeggio drill tool. Several items are already scoped elsewhere — captured here as cross-references plus genuinely new modules below. Implementation tier sketched, not committed.

| Date | Title | Status | Notes |
|---|---|---|---|
| 2026-06-28 | Standalone Metronome module | Scoped → v2 (already in §4) | Full-featured metronome (subdivisions, accents, polymetric, programmable sequences) usable independently of arpeggio drills. Already captured under v2 multi-instrument section. |
| 2026-06-28 | Standalone Tuner module | Scoped → v2 (already in §4) | Chromatic tuner using microphone input. Already captured under v2 multi-instrument section. |
| 2026-06-28 | Chord progression drill — other instruments (piano, guitar, voice, drums, future) | Scoped → v2 (already in §4) | Extend the current bass arpeggios drilling to additional instruments via shared substrate (per the scales-module sketch). Each instrument gets its own route under `/practice/<instrument>/...`. |
| 2026-06-28 | Scale driller | Scoped → v2 (already noted) | Separate `/practice/scales` route with shared substrate. Already captured under scales-module idea above. |
| 2026-06-28 | Theory course / drills | Under Consideration → v3+ educational | Curriculum-driven theory module: intervals, chord construction, scale relationships, modes, voice leading, basic counterpoint. Mix of *lesson content* (read/watch) and *drill content* (recognize this interval, name this chord quality, etc.). Different skillset from engineering — needs curriculum design. Could ship in small slices ("Intervals 101" → "Triads 101" → "7th chords") rather than a monolithic course. |
| 2026-06-28 | Ear training course / drills | Under Consideration → v3+ educational | Audio-played-back-recognize-and-respond: intervals, chord qualities, scale degrees, chord progressions, melodic dictation, rhythmic dictation. Pairs naturally with the existing audio engine; needs a UI for response capture (note picker, interval picker, chord picker). Ear training is the highest-leverage musical skill — strong educational fit. |
| 2026-06-28 | Lead sheet builder (simple + advanced) | Under Consideration → v2/v3 educational | Two tiers: **simple** = chords-only lead sheet (drag chords from a palette onto a 4-bars-per-line canvas, set time signature, add bar lines, save/print/share); **advanced** = chords + melody (basic notation) + lyrics. Print-ready PDF export. Share via URL or .json import. Distinct from a *lead sheet view* of an active drill (that's a display feature) — this is an authoring tool. Competes with MuseScore / Soundslice; needs differentiation around speed of input and simplicity. |
| 2026-06-28 | Sight-reading course | Under Consideration → v3+ educational | Intelligent progression: app generates short notation snippets at the user's level, presents them, listens (via mic or just timing), advances difficulty when the user reads cleanly. Start with bass and guitar (single-line clef-aware notation) since those leverage the existing audio engine. Notation rendering is non-trivial (VexFlow or similar). Adaptive difficulty engine is a serious ML/heuristic project. |
| 2026-06-28 | Teacher / student portal | Scoped → v1.5 (already in §9) | Already a named milestone — see PROJECT-DESIGN.md §9. The 9-item vision item maps directly to this. v1.5 is the dedicated design pass. |
| 2026-06-28 | Honest scope flag for the 9-item vision | Decided | Each of the educational modules (theory, ear training, sight-reading, lead sheet builder) is its own 6–12 month project. The realistic v1 → v3 arc is: v1 ships current (bass arpeggios), v1.x adds polish + clouds + native wrappers, v1.5 adds teacher/student, v2 adds multi-instrument arpeggios + scales + standalone metronome/tuner, v3 adds audio analysis (already scoped), v4+ adds the educational modules (theory/ear/sight-reading) one at a time, lead sheet builder slotted somewhere in v2/v3 as an authoring tool. Curriculum content for the educational modules is the long pole — needs subject-matter design, not just engineering. |

---

## Active Ideas — v3+ milestone candidates (Audio Analysis)

| Date | Title | Status | Notes |
|---|---|---|---|
| 2026-06-28 | Monophonic pitch detection | Under Consideration | Mic input → detect what note user is playing in real time. Start with bass and voice (monophonic) — much more tractable than polyphonic. |
| 2026-06-28 | Timing accuracy feedback | Under Consideration | Compare user's note onsets against metronome beats; show drift/precision metrics. |
| 2026-06-28 | Real-time corrective overlay | Under Consideration | Visual indicator during practice — "you're rushing," "wrong note," "good." Subtle, not punitive. |
| 2026-06-28 | Polyphonic pitch detection | Under Consideration | Detect chords being played (piano/guitar). Much harder. Wait until monophonic is solid. |

---

## Active Ideas — Uncategorized / Future-Future

| Date | Title | Status | Notes |
|---|---|---|---|
| 2026-06-28 | Community pattern library | Under Consideration | Public browsable library of user-submitted patterns. Needs moderation, search, ratings. v2+. |
| 2026-06-28 | MIDI input support | Under Consideration | Connect a MIDI keyboard/bass → automatic pitch detection without microphone. Cleaner signal. |
| 2026-06-28 | Practice streaks + gamification | Under Consideration | Daily streak, badges. Risk: feels gimmicky; could undermine the pro-tool positioning. Wait until usage data shows whether motivational nudges would help. |
| 2026-06-28 | Sheet music export | Under Consideration | Export a practiced sequence as a PDF leadsheet. Pairs with future notation rendering. |
| 2026-06-28 | Backing track generation | Under Consideration | Generate a simple drum + piano comp under your bass arpeggio drill. Adds musical context. |
| 2026-06-28 | Apple Watch / wearable controls | Under Consideration | Quick tempo / start / stop from wrist. Niche but pro-feeling. |

---

## Implemented

*(Ideas migrate here once shipped, then to the relevant section of PROJECT-DESIGN.md.)*

| Date | Title | Implemented In | Notes |
|---|---|---|---|
| 2026-06-28 | Distinct count-in click sound | v1 (pulled forward from v1.1) | Count-in beats now use a dry, high-pass-filtered noise tick (stick-click character); playing beats keep the existing tonal sine click with higher-pitched downbeat. Pulled into v1 after user hands-on test on the first-slice deploy — visual cue alone made the count-in → playing transition unclear aurally. See `src/lib/audio/metronome.ts` and PROJECT-DESIGN.md §4.7. |
| 2026-06-28 | Configurable chord notation form | v1 | All four styles (jazz-minus, lowercase-m, plain-ASCII, long-form) shipped as a pluggable `ChordRenderer` module. Notation-style picker on the setup screen with live chord preview; selection persists per-user via the cascade. Long-form display uses smaller text on setup + drill screens so verbose strings still fit cleanly. See `src/lib/music/render-chord.ts` and PROJECT-DESIGN.md §4.2. |
| 2026-06-28 | Shipped drills library (10 seed drills) | v1 (Phase 3) | Ten built-in drills ship in code (not localStorage) so every install lands with one-click practice on day one. **Jazz (7):** ii-V-I in 12 keys, All maj7 / m7 / dom7 in 12 keys, Cycle of 5ths (dom7), Diatonic 7ths in C, Daily warm-up (48 chords looped). **Blues:** 12-bar Blues in F. **Pop:** Axis I-V-vi-IV in C. **Rock:** I-IV-V in C. Built-in drills get a "Built-in" lock chip in Quick Start, can't be deleted, and route through a separate edit flow that disables Save changes — only Save as new drill is offered, so user tweaks always land as their own customized copy. Each shipped drill carries an informational `genre` tag (substrate for future filtering). See `src/lib/data/shipped-drills.ts` and the Phase 3 entry in PROJECT-DESIGN.md §11. |
| 2026-06-28 | Setup preview (pre-flight chord-change check) | v1 (Phase 4.1, pulled forward from v1.1) | Inline "Up first" panel sits just above the Start button on `/practice`, showing the first 4 chords the user will actually hear with the current ordering applied. Chord chips with arrow connectors plus a trailing ellipsis when more chords follow. For deterministic strategies (custom / chromatic / cycle) the preview is exact; for random strategies it's a freshly-rolled sample (re-rolls on every config change) with a caption noting that actual order will vary on Start. New `previewPlayChords(config, n)` helper exported from `src/lib/music/sequence.ts`. Catches "I configured this wrong" before drilling 16 measures. |
| 2026-06-28 | Mid-drill jump controls (rewind / restart / skip chord) | v1 (Phase 4.2, pulled forward from v1.1) | Three small icon buttons in the drill-screen header (alongside the tempo nudge): **Rewind one chord** (jumps to the start of the chord before the current one), **Restart current chord** (jumps to the start of the just-played chord — works during prep beats too, restarts the previously-played chord), **Skip to next chord** (jumps forward past the rest of the current chord + any prep window). Lets the user redo a flubbed chord or jump ahead without restarting the whole drill from the count-in. New `metronomeEngine.jumpToBeat(targetIdx)` method updates the transport counters in lockstep with the play-beat counter, then immediately advances UI state for instant feedback. New helper exports from `src/lib/music/sequence.ts`: `currentChordStartIndex`, `nextChordStartIndex`, `prevChordStartIndex`. Buttons auto-disable at boundaries (rewind disabled on first chord; skip disabled on last chord; restart disabled at the very first beat). |
| 2026-06-29 | Resume session recovery | v1 (Phase 4.3, pulled forward from v1.1) | When a drill is interrupted (browser crash, accidental tab close, OS sleep), the user can pick up exactly where they were instead of restarting from the count-in. New separate Zustand store `useResumeSession` persists the full PracticeConfig snapshot + the pre-rolled SequenceBeat[] + beat index on every play-measure boundary (so random strategies don't re-shuffle to a new chord on resume — the user lands on the exact same chord at the exact same beat). Cleared on Stop button press and on natural drill completion; preserved through tab close. Snapshots older than 10 minutes are treated as stale and suppressed. A primary-colored Resume banner appears at the top of `/practice` when a recent snapshot exists, showing the drill name + measure position; one click loads the right config and navigates to the session with `?resume=1`. The session page detects the flag and starts the metronome with `initialBeatIndex` (new MetronomeConfig field) so the engine begins at the exact resume beat with no count-in (resume = continue, not restart). Sequences capped at 2048 beats to bound localStorage write cost on indefinite-loop sessions. Also fixed a Phase 4.2 bug: `jumpToBeat` was double-setting `beatCounter` which silently dropped the audio click for the jumped-to beat (visual was right, audio resumed one beat late). |
| 2026-06-29 | Persistent navigation shell + /roadmap page | v1 (Phase 5) | The app now wears a proper platform-grade chrome on every screen. **SiteHeader** (sticky, ~44px): brand mark + Module Switcher dropdown listing all 9 platform modules with status pills (Live / Designed / Sketch). Live modules link; non-live show muted with status chip so the user senses scope without expecting them to work. **SiteFooter** (slim band): version label + roadmap + GitHub links. New **/roadmap** page with three columns (Now / Next / Later) mirroring the §9 vision: Bass Arpeggios is "Now"; Metronome / Tuner / Scale Driller are "Next"; Theory / Ear Training / Lead Sheets / Sight Reading / Teacher-Student are "Later." All driven from `src/lib/modules/registry.ts` so adding a future module = one entry (header switcher + roadmap stay in lockstep). Closes the user's earlier open question about top menu + sidebar navigation. Redundant brand links removed from `/practice` sub-header and homepage; homepage gains a secondary "See the 9-module roadmap" CTA. |

---

## Rejected / Not Pursuing

*(Decisions explicitly declined, with reason.)*

| Date | Title | Reason |
|---|---|---|
| 2026-06-28 | Full play-along audio during practice | Drilling demands silence so user can hear themselves; reference audio competes with their playing. Kept the "Preview pattern" button instead. |
| 2026-06-28 | Required accounts in v1 | Heaviest onboarding friction for an app the user is primary user of in v1. Local-only chosen instead; accounts arrive in v1.1. |
| 2026-06-28 | Disable Arp 7ths pattern for triads | Too restrictive. Default to 1-3-5-8 (octave) instead; "Extend triads to 7ths" available as advanced toggle. |
| 2026-06-28 | Electron for desktop | Heavier than Tauri (ships own Chrome copy per app). Tauri chosen for v1.2 desktop wrappers. |
| 2026-06-28 | Expo / React Native universal stack | Web side less mature for audio-heavy apps; Tone.js integration messier on RN. Web-first + Capacitor/Tauri wrappers chosen instead. |
| 2026-06-28 | Hand-rolled music theory engine | tonal.js is battle-tested and handles all 15+ chord qualities + scales + intervals out of the box. Reinventing would be weeks of bug-prone work. |
