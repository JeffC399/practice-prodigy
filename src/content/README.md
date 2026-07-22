# Methodology Content

This directory holds the static content that ships with the My Practice module's Methodology library (see `ROUTINE-DESIGN.md` §7 and `MY-PRACTICE-BUILD-PLAN.md` Slice E).

Content is authored as markdown + JSON files that the app loads at build time. Users see them in the **Methodology** tab of My Practice.

## Structure

```
src/content/
  methodology/               - long-form articles
    deliberate-practice.md
    interleaved-practice.md
    slow-practice.md
    pomodoro.md
    chunking.md
    spaced-repetition.md
    mental-practice.md
    slow-loop.md
  templates/                 - routine templates (JSON) linked from articles
    deliberate-practice-45min.json
    interleaved-practice-60min.json
    slow-practice-30min.json
    pomodoro-25-5-cycles.json
    chunking-repertoire-45min.json
    spaced-repetition-warmup-30min.json
    mental-practice-20min.json
    slow-loop-15min.json
  starters/                  - starter routines shown in onboarding
    daily-warmup-20min.json
    jazz-prep-30min.json
    slow-and-steady-20min.json
```

## Voice conventions

- **Musician to musician**, not teacher to student. Assume the reader plays.
- **Confident, not academic**. Skip footnotes and jargon; cite sources once at the end.
- **Practical**. Every article ends with a "Try it now" template link.
- **Jazz-friendly but broadly applicable**. Examples span styles; nothing is jazz-only unless the method is genuinely genre-specific.
- **~600-1000 words per article**. Long enough to be useful; short enough to be read.
- **Section headers are standard** across every article for scannability:
  1. `## What it is`
  2. `## When to use it`
  3. `## What it looks like in practice`
  4. `## Common mistakes`
  5. `## Try it now`
  6. `## Further reading`

## Template conventions

Templates are JSON files that instantiate a methodology. Each template:

- Has a stable `id` (kebab-case, versioned if it changes shape).
- Names the methodology it belongs to via `methodologyId`.
- Has an `estimatedTotalSeconds` — sum of its items' `estimatedSeconds`.
- Uses `type: "custom"` for freeform items with an `instruction` field. When the user runs a custom item, the full-screen player shows the instruction text.
- Uses `type: "drill"` / `"key-drill"` / `"scale-drill"` / `"metronome"` / `"leadsheet"` / `"rest"` when referencing a specific module. Since templates ship BEFORE the user has any drills of their own, module references use **built-in slugs** (resolved at load time to the correct starter-drill ID). Templates that can't resolve a reference gracefully degrade to a custom item with equivalent instruction.

## Editing content

- Content is loaded at build time; changes require a rebuild + deploy.
- Markdown is rendered by `react-markdown` with syntax highlighting.
- Users cannot edit built-in methodology content; they can copy a template into their own routines and modify freely.

## Attribution

Every article's "Further reading" section cites the primary sources for that method. When quoting or closely paraphrasing, provide attribution inline as well.
