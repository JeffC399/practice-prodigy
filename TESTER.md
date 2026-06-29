# Practice Prodigy — Tester Onboarding

A short message + structured feedback prompt to send to your first round of friend-testers. Designed to seed the v1.1 backlog with real-user input rather than guesses.

---

## Suggested message to send

> Hey — I built a thing and I'd love your eyes on it. It's a **practice platform for musicians**, starting with a Bass Arpeggios trainer that drills chord progressions with a metronome.
>
> **Live link:** https://practice-prodigy.vercel.app/practice
>
> **5 minutes of "try this" stuff:**
>
> 1. **Open `/practice` and tap a built-in drill** like "ii-V-I in 12 keys" — that auto-starts a real session. Click Stop whenever.
> 2. **Try the Start-from picker** in the Pattern section — pick `3rd` and play through a measure. The arpeggio rotates so you're drilling the 1st inversion. `Random` re-rolls every measure (expert mode).
> 3. **Tap the dashed "+ New custom pattern" tile** in the Pattern section. Click some interval buttons (1, ♭3, 5, ♭7), click the duration badge on a chip to change it from `qtr` to `8th`, add a Rest. Hit Preview to audition. Save and watch it appear in your Custom row.
> 4. **Switch to the two-pane layout** in `/settings` → Appearance, then start a drill. Now and Next sit side-by-side. Random chord pools feel different in this layout.
> 5. **Toggle scale-degree mode** in `/settings` → Pattern display → "Scale degrees." Now during a drill you can watch the digits (1-3-5-7) light up in time with what you're supposed to be playing.
>
> The whole thing is dark-mode by default. You can install it as an app from your browser (Add to Home Screen on iOS, install icon on Chrome desktop).
>
> **Feedback's gold.** I've left a `feedback` link in the footer of every page — uses your email or GitHub. Or just text me. Both work.
>
> Thanks for taking a look.

---

## Specific things to ask about

When the tester is done playing, follow up with these questions. Each one targets a v1.1 decision I genuinely don't know the answer to.

### Onboarding

- **Did you know what to do the first time you opened it?** The welcome card surfaces once — was it useful or in the way?
- **Was the built-in drill library obvious as a starting point?**
- **Could you tell which drills were yours vs. built-in?**

### Drill loop

- **During a session, was the count-in obvious?** The chord dims and a ring pulses synchronized to the audio clicks. Did you notice?
- **The "Get Ready" prep window between chord changes** — useful, distracting, or unnoticed?
- **Two-pane vs single-pane** — which did you prefer? Why?
- **The lit-up scale degrees** — did you understand what they meant? Did you use them?

### Patterns

- **The 4 built-ins (7th Chords / Triads, ascending + descending)** — enough? Too much? Anything obviously missing?
- **The Start-from modifier** — clear what it did? Useful? Random mode too chaotic?
- **The custom-pattern editor** — could you build something you wanted to drill? What was confusing?
- **Did you try the rhythm features (note durations, rests)?**

### Chord pool / sequence

- **Was building a chord pool easy?** (Add buttons, the wizard, drag-to-reorder)
- **Did you use the 8 ordering strategies?** Which? Any you didn't understand?

### Misc

- **What's missing that you'd want?**
- **What feels half-baked?**
- **What surprised you?**
- **On a scale of 1-10, would you actually use this to practice?**

---

## What NOT to ask (defer to next round)

These are real but I want to ship them based on tester usage, not pre-emptive opinion:

- Cloud sync / accounts (v1.1 — scoped, not built)
- Other modules (Metronome, Scales, etc. — see `/roadmap`)
- Mobile-app wrappers (Capacitor / Tauri — post-v1 packaging)
- Pricing / business model

Stay focused on the Bass Arpeggios module as it stands today.

---

## Tracking feedback

When responses come in, append them to `IDEAS.md` with:
- Date received
- Tester (anonymized if needed)
- Their actual quote (verbatim — don't paraphrase)
- Whether it maps to an existing IDEAS entry or needs a new one

This becomes the v1.1 backlog. Pre-tester guesses get re-evaluated against it.
