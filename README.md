# Practice Prodigy

A pro-quality, modern practice platform for musicians. Launching with a focused **Bass Arpeggios** trainer — drill arpeggio patterns over user-defined chord sequences against a precision metronome, with controllable look-ahead, count-in, and tempo. Built to expand into a comprehensive multi-instrument practice ecosystem.

**Status:** v1 build in progress · web + PWA shipping on every push to `main`.

→ **Try it:** [practice-prodigy.vercel.app](https://practice-prodigy.vercel.app)
→ **Long-term map:** [practice-prodigy.vercel.app/roadmap](https://practice-prodigy.vercel.app/roadmap)
→ **For testers:** [TESTING.md](./TESTING.md)

---

## What ships today (v1, Bass Arpeggios module)

- **Multi-chord sequence drilling**: build a chord pool, pick an arpeggio pattern, drill the pool measure by measure with a precision metronome.
- **20 chord qualities × 12 roots** — major, minor, dom7, maj7, m7♭5 (ø), dim7 (°), sus2, sus4, 7sus4, m9, maj9, 9, 13, 7♭9, 7♯9, 7alt, 7♭5, 7♯5, augmented, and triads. All four notation styles user-configurable (jazz-minus / lowercase-m / plain ASCII / long form).
- **4 arpeggio patterns**: Scale Tones (8 notes asc), Arpeggiated 7ths (1-3-5-7), Triads with Leading Tones (1-3-5-LT — looks ahead to the next chord), and Descending 8-7-5-3. Audible Preview button auditions each pattern over the first chord in your pool before you commit.
- **8 ordering strategies** for the chord pool: Custom (drag-to-reorder), Chromatic asc/desc, Cycle of 5ths (jazz canonical), Cycle of 4ths, Random with replacement, Random shuffle (once per session), Random shuffle (each rep). Mix any of these with any pattern.
- **10 built-in drills** shipped with every install — 7 jazz, 1 blues (12-bar in F), 1 pop (Axis I-V-vi-IV in C), 1 rock (I-IV-V in C). One-click launch from Quick Start.
- **Saveable drills library** — name, notes, last-used auto-sort, edit-in-place, duplicate-as-new, delete with two-click confirm.
- **Mid-drill controls** — rewind one chord, restart current chord, skip to next chord, live tempo nudge (±5 / ÷2 / ×2) without stopping.
- **Resume session recovery** — close the tab mid-drill, come back within 10 minutes, get a "Resume where you left off" banner that lands you on the exact same chord at the exact same beat.
- **Configurable count-in** (off / 1 measure / 2 measures) with a distinct stick-click timbre vs the tonal playing click — aurally unmistakable when prep ends and drilling begins.
- **Inter-chord prep window** — optional GET-READY beats inserted between chord changes so beginners get time to find the new root before the next chord starts.
- **Two practice layouts** — single-pane (big chord centered) or two-pane (equally-weighted Now / Next side by side) — selected from your user preferences.
- **Setup preview** ("Up first") showing the first 4 chords you'll hear before pressing Start, with a sample roll caption for random strategies.
- **Installable PWA** on iOS / Android / desktop — Add to Home Screen launches Practice Prodigy full-screen with no browser chrome.

## Architectural pillars

The product is built on five non-negotiable principles (full design in [PROJECT-DESIGN.md](./PROJECT-DESIGN.md)):

1. **Progressive disclosure** — every surface presents only the simplest essential controls by default; advanced options live behind disclosures.
2. **Cascading defaults** — System → User → Per-module → Per-session. Settings flow through four layers, each overriding the one above.
3. **Pluggable subsystems** — layouts, audio engines, storage backends, and ordering strategies are all swappable modules. Adding a fifth layout or a sixth ordering strategy is additive, not a rewrite.
4. **Web-first PWA → native wrappers** — one codebase (Next.js + React) deploys to web; Capacitor (iOS/Android) and Tauri (macOS/Windows/Linux) wrappers ship the same bundle to app stores. Never separate codebases.
5. **Accessibility from day one** — keyboard navigation, screen-reader-announced chord changes, `prefers-reduced-motion` respected, WCAG AA color contrast.

## The 9-module platform vision

Practice Prodigy is shipping one module at a time. The **/roadmap** page is the public, always-current view:

| Bucket | Modules |
|---|---|
| **Now** | Bass Arpeggios (you're using it) |
| **Next** | Metronome (standalone), Tuner, Scale Driller, Lead Sheet Builder (Basic tier — see [LEAD-SHEET-DESIGN.md](./LEAD-SHEET-DESIGN.md)) |
| **Later** | Theory Course, Ear Training, Sight Reading, Teacher / Student portal, Advanced Lead Sheet Builder |

Each module is documented separately as it lands.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Framer Motion, Lucide icons |
| State | Zustand (versioned `persist` middleware) |
| Local storage | localStorage today; Dexie (IndexedDB) and Supabase Postgres in v1.1+ |
| Audio engine | Tone.js (Web Audio API) |
| Music theory | tonal.js |
| Typography | Geist Sans + Geist Mono |
| Hosting | Vercel (push-to-deploy from `main`) |
| PWA | Native Next.js manifest + `ImageResponse`-generated icons + minimal service worker |

## Running locally

Requires Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
# open http://localhost:3000
```

Build for production:

```bash
pnpm build
pnpm start
```

Typecheck + lint:

```bash
pnpm typecheck   # or: npx tsc --noEmit
pnpm lint
```

## Project layout

```
src/
  app/                          Next.js App Router pages
    layout.tsx                  Persistent SiteHeader + SiteFooter + SW register
    page.tsx                    Marketing landing
    practice/page.tsx           Bass Arpeggios setup (drill builder)
    practice/session/page.tsx   Active drill screen
    roadmap/page.tsx            Public 9-module roadmap
    manifest.ts                 PWA manifest
    icon.tsx / apple-icon.tsx   PWA icons generated at build time
  components/
    shell/                      SiteHeader, SiteFooter, ModuleSwitcher, FeedbackTrigger, ServiceWorkerRegister
  lib/
    audio/                      Metronome engine (Tone.js) + arpeggio preview player
    music/                      Chord model, intervals, render-chord, sequence generator, arpeggio engine
    state/                      Zustand stores: practice-config, drills-library, resume-session, user-prefs
    modules/registry.ts         9-module platform vision (source of truth for header switcher + roadmap)
    data/shipped-drills.ts      10 built-in drills (jazz/blues/pop/rock)
    build-info.ts               Vercel git SHA + version label
public/
  sw.js                         Minimal service worker (Chrome PWA install criteria)
```

## Living documents

- **[PROJECT-DESIGN.md](./PROJECT-DESIGN.md)** — the spec. Vision, principles, v1 feature scope, tech stack, roadmap. Updated with every significant change; the change log at the bottom is the history.
- **[IDEAS.md](./IDEAS.md)** — every idea, feature request, polish item we've considered. Status-tagged (New / Under Consideration / Scoped / Implemented / Rejected). Implemented ideas migrate to the design doc.
- **[LEAD-SHEET-DESIGN.md](./LEAD-SHEET-DESIGN.md)** — full design doc for the second-module Lead Sheet Builder. Locked Basic-tier scope, data model, tech choices, build slices.
- **[TESTING.md](./TESTING.md)** — one-page primer for friends and early testers. What to look at, how to report.
- **[CLAUDE.md](./CLAUDE.md)** — collaboration instructions for the Claude Code assistant working on this repo.

## Feedback

There's a **feedback** link in the footer of every page → modal with three paths:

- **Email** (mailto with the build SHA + current URL + user-agent pre-filled)
- **GitHub bug report** (issue template applied)
- **GitHub idea / feature request** (issue template applied)

Use whichever fits. Email is great for casual feedback; GitHub captures structured bug reports.

## License

MIT — see [LICENSE](./LICENSE). Use the code freely.

## A note on origin

Practice Prodigy is being built incrementally by [Jeff Campbell](https://github.com/JeffC399) in collaboration with [Claude Code](https://claude.com/claude-code) (Anthropic's CLI for Claude). Every significant change is committed to `main` with a descriptive message; the commit history is the development log.
