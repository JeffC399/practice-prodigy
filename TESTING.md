# Testing Practice Prodigy

> A one-page primer for friends and early testers. Thanks for kicking the tires.

## What this is

Practice Prodigy is a pro-quality practice platform for musicians, currently shipping its first module: a **Bass Arpeggios trainer**. Build a chord pool, pick an arpeggio pattern, set tempo and meter, and drill — the app cycles through the pool measure by measure with a precision metronome.

The long-term vision is a 9-module platform — see [/roadmap](https://practice-prodigy.vercel.app/roadmap) on the live site for the full map.

## Where to start

1. Open the site (URL provided separately).
2. Land on `/practice`. The Quick Start surface lists 10 built-in drills (jazz / blues / pop / rock).
3. Click any drill card to launch into the session screen.
4. The metronome auto-starts after a 1-measure count-in.
5. Press **Stop** to end early, or let the drill finish naturally.

## Installing as an app (optional)

The site is a Progressive Web App — you can install it to your home screen / dock and launch it full-screen with no browser chrome:

- **Desktop Chrome / Edge:** click the install icon (⊕) at the right of the address bar.
- **Android Chrome:** three-dot menu → "Install app" or "Add to Home screen".
- **iOS Safari:** share icon → "Add to Home Screen".

Same audio engine, same code — just a more app-like presentation.

## What to look for

### Functional checks
- Does the metronome stay tight? Any timing drift, late beats, or stuck notes?
- Does the chord display update on every measure change?
- Do the mid-drill controls work? (rewind one chord, restart current chord, skip to next — small icons in the drill-screen header)
- Does the tempo nudge (±5 BPM or ÷2 / ×2) take effect immediately mid-drill?
- Does the "Resume last session" banner appear if you close the tab mid-drill and reopen `/practice` within 10 minutes?
- Try the **Two-pane** display variant (Setup → Display section) — does the side-by-side Now/Next layout feel useful, or distracting?

### Polish checks
- Anything that looks off — typography, spacing, color, alignment?
- Anything that feels slow, janky, or unresponsive?
- Anything confusing — terminology, button labels, where things live?

### Audio checks
- Does the count-in click sound distinctly different from the playing click? (Stick-tick vs tonal click.)
- If you enable inter-chord prep (Setup → Session → Prep between chords), do the prep beats use the stick-tick sound, and does the metronome wait until beat 1 of a new measure to start the next chord?

## How to report what you find

Three paths, pick whichever fits:

### 1. Quickest: **In-app Feedback button**
Footer of every page → **feedback** → modal with email + GitHub options. The email path opens your mail client with the build version, page URL, and browser pre-filled — just type what you noticed and hit send.

### 2. **Email** directly
`jtcampbell399@gmail.com` — include the build SHA (visible in the footer) and which page you were on if you can.

### 3. **GitHub Issues** (requires a GitHub account)
[github.com/JeffC399/practice-prodigy/issues](https://github.com/JeffC399/practice-prodigy/issues)
Issue templates pre-fill the structure for bugs and ideas.

## What's already known / on the roadmap

Before reporting, glance at the [/roadmap](https://practice-prodigy.vercel.app/roadmap) page — many things you might think are missing are already designed and on a near-term phase. Items in the "Next" and "Later" columns are intentional gaps, not bugs.

Open items in the polish queue (already tracked, no need to report unless you have a specific angle):

- Light / dark mode toggle (currently dark-only)
- Settings page for cross-module preferences
- Tap tempo + ÷2 / ×2 buttons on the drill screen (some shipped, more coming)
- Tempo ramping ("speed up by N each pass through the sequence")
- Additional practice layouts (Scrolling Timeline, Full-Sequence Chart)
- Cloud sync + accounts (currently local-only)
- Native iOS / Android wrappers via Capacitor

## Thanks

Your feedback shapes what ships next. If you've got 10 minutes to try a drill and shoot back even a one-line note, that's hugely useful.
