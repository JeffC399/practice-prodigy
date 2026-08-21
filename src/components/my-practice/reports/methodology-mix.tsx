"use client";

import { useMemo } from "react";
import { getMethodology } from "@/lib/practice/methodologies";
import {
  NO_METHODOLOGY_KEY,
  secondsByMethodology,
} from "@/lib/practice/reports-queries";
import { useRoutinesLibrary } from "@/lib/practice/routines-library";
import type { PracticeSession } from "@/lib/practice/types";

/**
 * MethodologyMix — Slice D.8 (Phase 125).
 *
 * Small horizontal stacked bar showing how the range's practice time
 * split across methodologies (Slow Practice, Chunking, Interleaved,
 * etc.). Sessions get resolved to methodologies via their
 * `routineItemId` linkage into the routines library.
 *
 * ## Feeds AI Coach signals
 *
 * The whole point of this panel per ROUTINE-DESIGN.md is to make the
 * balance visible: "You've been 90% Slow Practice this month; consider
 * adding Interleaved for retention." v1 just shows the mix; Slice F's
 * AI Coach reads it and generates the suggestions.
 *
 * ## Unattributed time
 *
 * Practice that wasn't inside a routine (ad-hoc drill sessions,
 * bare metronome time, etc.) OR that was inside a routine item with
 * no methodology set → rendered as a neutral "Unattributed" slice.
 * Kept in the mix so the visible whole matches the range's true
 * total, not just the methodology-tagged subset.
 */
export function MethodologyMix({
  sessions,
}: {
  sessions: readonly PracticeSession[];
}) {
  const routines = useRoutinesLibrary((s) => s.routines);

  const slices = useMemo(() => {
    const raw = secondsByMethodology(sessions, routines);
    const total = Object.values(raw).reduce((s, n) => s + n, 0);
    if (total <= 0) return [];
    const arr = Object.entries(raw).map(([key, seconds]) => ({
      key,
      seconds,
      pct: seconds / total,
    }));
    arr.sort((a, b) => b.seconds - a.seconds);
    return arr;
  }, [sessions, routines]);

  if (slices.length === 0) {
    return null;
  }

  // If literally every second is unattributed there's no "mix" to
  // show — render a lean hint rather than a full-width single-color
  // bar that would look broken.
  if (
    slices.length === 1 &&
    slices[0].key === NO_METHODOLOGY_KEY
  ) {
    return (
      <section className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 px-4 py-3">
        <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Methodology mix
        </h3>
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          None of this range&rsquo;s practice was tagged with a
          methodology yet. Attach one to a routine item in the builder
          — the mix appears here after your next run.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/40 px-4 py-3">
      <header className="flex flex-col gap-0.5">
        <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Methodology mix
        </h3>
        <p className="text-[11px] text-muted-foreground/70">
          How your practice split across methods in the selected range.
          Feeds AI Coach balance suggestions.
        </p>
      </header>

      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-background/60"
        role="img"
        aria-label="Methodology mix"
      >
        {slices.map((slice) => (
          <div
            key={slice.key}
            style={{
              width: `${slice.pct * 100}%`,
              backgroundColor: colorFor(slice.key),
            }}
            title={`${labelFor(slice.key)}: ${formatMinutes(slice.seconds)} (${Math.round(
              slice.pct * 100,
            )}%)`}
          />
        ))}
      </div>

      <ul className="flex flex-col gap-1">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(slice.key) }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-foreground">
              {labelFor(slice.key)}
            </span>
            <span className="font-mono text-muted-foreground tabular-nums">
              {formatMinutes(slice.seconds)}
            </span>
            <span className="font-mono text-muted-foreground/60 tabular-nums w-10 text-right">
              {Math.round(slice.pct * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function labelFor(key: string): string {
  if (key === NO_METHODOLOGY_KEY) return "Unattributed";
  return getMethodology(key)?.name ?? key;
}

/**
 * Stable per-methodology color. Hand-picked so the palette reads as
 * "methodological categories" (cool tones for structural, warm for
 * per-item) without relying on any theme variables — a chip is a
 * mini-legend that should look the same on light + dark themes.
 */
function colorFor(key: string): string {
  switch (key) {
    // per-item methodologies
    case "slow-practice":
      return "#f59e0b"; // amber
    case "chunking":
      return "#fb923c"; // orange
    case "slow-loop":
      return "#eab308"; // yellow
    case "mental-practice":
      return "#a78bfa"; // violet
    case "deliberate-practice":
      return "#f472b6"; // pink
    // per-routine methodologies
    case "interleaved-practice":
      return "#38bdf8"; // sky
    case "pomodoro":
      return "#4ade80"; // green
    case "spaced-repetition":
      return "#22d3ee"; // cyan
    case NO_METHODOLOGY_KEY:
      return "#71717a"; // zinc — muted neutral
    default:
      return "#94a3b8"; // slate fallback
  }
}

function formatMinutes(sec: number): string {
  if (sec <= 0) return "0m";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
