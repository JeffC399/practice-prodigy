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
| 2026-06-28 | Distinct count-in click sound | Scoped → v1.1 | Currently count-in uses same click as metronome; differentiate audibly so user always knows whether they're in count-in or playing. |

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
