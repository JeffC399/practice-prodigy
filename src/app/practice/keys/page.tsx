"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KeySequencerLivePreview } from "@/components/key-sequencer/live-preview";
import { PromptRowEditor } from "@/components/key-sequencer/prompt-row-editor";
import {
  ORDERING_STRATEGIES,
  ORDERING_STRATEGY_DISPLAY_NAMES,
} from "@/lib/state/practice-config";
import { useKeySequencerConfig } from "@/lib/key-sequencer/config-store";
import type { KeyPitchClass } from "@/lib/key-sequencer/types";

/**
 * Key Sequencer setup page — Phase 45.0 scaffolding.
 *
 * MVP scope for this slice: key-pool selection + ordering strategy
 * dropdown + placeholder for prompt rows (built in 45.1). This gets
 * the route live under the module registry entry so the module
 * switcher can navigate to it and the setup skeleton renders.
 *
 * Full setup (rows editor, live preview, tempo/meter, session length,
 * layout, save-as-drill) lands in subsequent slices.
 */

const KEY_LABELS: Record<KeyPitchClass, { sharp: string; flat: string }> = {
  C: { sharp: "C", flat: "C" },
  "C#": { sharp: "C♯", flat: "D♭" },
  D: { sharp: "D", flat: "D" },
  "D#": { sharp: "D♯", flat: "E♭" },
  E: { sharp: "E", flat: "E" },
  F: { sharp: "F", flat: "F" },
  "F#": { sharp: "F♯", flat: "G♭" },
  G: { sharp: "G", flat: "G" },
  "G#": { sharp: "G♯", flat: "A♭" },
  A: { sharp: "A", flat: "A" },
  "A#": { sharp: "A♯", flat: "B♭" },
  B: { sharp: "B", flat: "B" },
};

const ALL_KEYS: KeyPitchClass[] = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];

/** Cycle of 5ths starting from C — used by "Cycle of 5ths" quickfill. */
const CYCLE_OF_5THS: KeyPitchClass[] = [
  "C", "F", "A#", "D#", "G#", "C#",
  "F#", "B", "E", "A", "D", "G",
];

function keyDisplay(k: KeyPitchClass, pref: "auto" | "sharps" | "flats") {
  if (pref === "sharps") return KEY_LABELS[k].sharp;
  if (pref === "flats") return KEY_LABELS[k].flat;
  // "auto": prefer flats for jazz idiom keys.
  return KEY_LABELS[k].flat;
}

export default function KeySequencerSetupPage() {
  const keyPool = useKeySequencerConfig((s) => s.keyPool);
  const setKeyPool = useKeySequencerConfig((s) => s.setKeyPool);
  const keyOrdering = useKeySequencerConfig((s) => s.keyOrdering);
  const setKeyOrdering = useKeySequencerConfig((s) => s.setKeyOrdering);
  const promptRows = useKeySequencerConfig((s) => s.promptRows);
  const setPromptRows = useKeySequencerConfig((s) => s.setPromptRows);
  const enharmonicPreference =
    useKeySequencerConfig((s) => s.enharmonicPreference) ?? "auto";
  const setEnharmonicPreference = useKeySequencerConfig(
    (s) => s.setEnharmonicPreference,
  );
  const wholeConfig = useKeySequencerConfig();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const toggleKey = (k: KeyPitchClass) => {
    if (keyPool.includes(k)) {
      setKeyPool(keyPool.filter((x) => x !== k));
    } else {
      setKeyPool([...keyPool, k]);
    }
  };

  const selectAll = () => setKeyPool(ALL_KEYS);
  const selectCycleOf5ths = () => {
    setKeyPool(CYCLE_OF_5THS);
    setKeyOrdering("cycleOf5ths");
  };
  const clearAll = () => setKeyPool([]);

  if (!mounted) {
    return (
      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center px-6 py-12"
      >
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Loading Key Sequencer…
        </div>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center px-3 py-4 sm:px-6 sm:py-8"
    >
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Key Sequencer
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Compose a key drill
          </h1>
          <p className="text-sm text-muted-foreground leading-6">
            Pick a pool of keys + layer your own prompt rows on top (in the
            next slice). Instrument-neutral: silent + metronome only. You
            play on whatever instrument you like, guided by the key + your
            prompt words on the Now / Next cards.
          </p>
        </header>

        {/* Key pool */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Key pool
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pick which keys the drill will cycle through. Tap "All 12" for
              a full-chromatic drill or "Cycle of 5ths" for jazz-standard
              order.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              All 12
            </button>
            <button
              type="button"
              onClick={selectCycleOf5ths}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              Cycle of 5ths (jazz order)
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
            {ALL_KEYS.map((k) => {
              const selected = keyPool.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleKey(k)}
                  aria-pressed={selected}
                  className={`flex h-12 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                    selected
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {keyDisplay(k, enharmonicPreference)}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            {keyPool.length} of 12 keys selected
          </div>
        </section>

        {/* Ordering + enharmonic */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-wider text-muted-foreground">
              Key ordering
            </span>
            <select
              value={keyOrdering}
              onChange={(e) =>
                setKeyOrdering(
                  e.target.value as (typeof ORDERING_STRATEGIES)[number],
                )
              }
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {ORDERING_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {ORDERING_STRATEGY_DISPLAY_NAMES[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-wider text-muted-foreground">
              Enharmonic display
            </span>
            <select
              value={enharmonicPreference}
              onChange={(e) =>
                setEnharmonicPreference(
                  e.target.value as "auto" | "sharps" | "flats",
                )
              }
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="auto">Auto (context-aware)</option>
              <option value="sharps">Sharps (C♯, D♯, F♯…)</option>
              <option value="flats">Flats (D♭, E♭, G♭…)</option>
            </select>
          </label>
        </section>

        {/* Prompt rows — the composability heart of Key Sequencer.
            Users type free-text words in up to 3 rows; each measure
            surfaces one word per row combined with the key. */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Prompt rows
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Layer up to 3 rows of key words on top of the key
              selection. Each measure will show the current key plus
              one word from each row (per that row's ordering).
            </p>
          </div>
          <PromptRowEditor rows={promptRows} onChange={setPromptRows} />
        </section>

        {/* Live preview of the first 4 measures. Reruns on every
            config change. Stable seed so previews don't flicker on
            each keystroke. */}
        <section className="flex flex-col gap-3">
          <KeySequencerLivePreview config={wholeConfig} />
        </section>

        {/* Launch placeholder — session page ships in Slice 45.2 */}
        <section className="flex items-center justify-between rounded-md border border-border bg-card/40 p-5">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              Drill screen
            </span>
            <span className="text-xs text-muted-foreground leading-relaxed">
              Session page ships in Slice 45.2 — Now / Next cards, metronome,
              count-in, ±5 BPM controls.
            </span>
          </div>
          <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            In build
          </span>
        </section>

        {/* Foothold link back home */}
        <div className="flex justify-center">
          <Link
            href="/"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
