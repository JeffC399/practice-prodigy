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

**Symbol convention:** jazz-style (e.g., `A-7`, `Cmaj7`, `Cø7`, `C°7`, `C+`, `C7alt`).

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
- Supabase Auth + Postgres sync (local-to-cloud migration).
- Audible per-change alert (different click on last beat of each chord).
- Tempo ramping, half/double-speed buttons, BPM presets.
- Additional practice layouts (Two-pane, Scrolling Timeline, Full-Sequence Chart).
- Bass profile (string count, tuning, range preference) → affects 8-7-5-3 register and lays groundwork for fretboard rendering.
- Pattern bundle export (multi-pattern .json).
- "Doesn't fit cleanly" rhythm warning.
- Visual beat-1 pulse + haptic on chord change (mobile).
- Setup preview ("here's what the first 2 chord changes will look like").
- Skip / restart-current-chord / rewind-1-chord controls.
- "Resume session" recovery (browser crash, screen lock).

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
