# Practice Prodigy — Ideas & Proposals

> Parking lot for every idea, feature request, improvement suggestion, or proposal that isn't currently committed to the active v1 build. Implemented ideas migrate to [PROJECT-DESIGN.md](./PROJECT-DESIGN.md). This file is the durable record so nothing gets lost in conversation history.

**Last updated:** 2026-06-28

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
