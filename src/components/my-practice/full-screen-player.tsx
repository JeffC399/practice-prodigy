"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coffee,
  Music,
  Pause,
  Pencil,
  Play,
  SkipForward,
  Timer,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CategoryChip } from "@/components/practice/category-chip";
import {
  elapsedSecondsOnCurrentItem,
  useRoutineExecutor,
} from "@/lib/practice/routine-executor";
import {
  ROUTINE_ITEM_TYPE_LABELS,
  type Routine,
  type RoutineItem,
} from "@/lib/practice/routine-types";

/**
 * FullScreenPlayer — Slice B.9 (Phase 109).
 *
 * Full-viewport UI for running a routine. Reads execution state
 * from useRoutineExecutor and renders:
 *
 *   - Top bar: Exit + routine name + "Item N of M" progress
 *   - Main area: current item card (per-type layout)
 *   - Bottom bar: Prev / Pause / Skip / Next
 *   - End-of-routine screen when execution.status === "complete"
 *
 * Keyboard shortcuts (documented on-screen in a bottom hint):
 *   ← / → : previous / next
 *   Space : pause / resume
 *   S     : skip current item
 *   Esc   : exit
 *
 * Phase 109 renders working item bodies for rest / custom / metronome
 * (they don't need module take-over). drill / key-drill / scale-drill
 * / leadsheet render a placeholder with a Skip affordance until B.10
 * wires the actual drill take-overs.
 */

export function FullScreenPlayer({
  routine,
  onExit,
}: {
  routine: Routine;
  onExit: () => void;
}) {
  const execution = useRoutineExecutor((s) => s.execution);
  const advance = useRoutineExecutor((s) => s.advance);
  const previous = useRoutineExecutor((s) => s.previous);
  const pause = useRoutineExecutor((s) => s.pause);
  const resume = useRoutineExecutor((s) => s.resume);

  // 1Hz clock tick so the elapsed / countdown numbers update live.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleAdvance = useCallback(
    () => advance({ outcome: "completed" }),
    [advance],
  );
  const handleSkip = useCallback(
    () => advance({ outcome: "skipped" }),
    [advance],
  );
  const handleTogglePause = useCallback(() => {
    const state = useRoutineExecutor.getState().execution;
    if (!state) return;
    if (state.status === "running") pause();
    else if (state.status === "paused") resume();
  }, [pause, resume]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input / textarea.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleAdvance();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        previous();
      } else if (e.key === " ") {
        e.preventDefault();
        handleTogglePause();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleSkip();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleAdvance, handleSkip, handleTogglePause, onExit, previous]);

  if (!execution) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Preparing routine…
        </p>
      </main>
    );
  }

  if (execution.status === "complete") {
    return <EndOfRoutineScreen routine={routine} onExit={onExit} />;
  }

  const currentItem = routine.items[execution.currentIndex];
  if (!currentItem) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          This routine is empty. Add an item to run it.
        </p>
        <button
          type="button"
          onClick={onExit}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Exit
        </button>
      </main>
    );
  }

  const elapsedSec = elapsedSecondsOnCurrentItem(execution);
  const isPaused = execution.status === "paused";
  const isFirst = execution.currentIndex === 0;
  const isLast = execution.currentIndex === routine.items.length - 1;

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Exit routine
        </button>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {routine.name}
          </span>
          <span className="text-muted-foreground/40">|</span>
          <span className="font-mono text-xs uppercase tracking-wider text-primary">
            Item {execution.currentIndex + 1} of {routine.items.length}
          </span>
        </div>
      </header>

      {/* Main area — current item body */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        <ItemBody item={currentItem} elapsedSec={elapsedSec} isPaused={isPaused} />
      </div>

      {/* Bottom bar — navigation */}
      <footer className="flex flex-col items-center gap-3 border-t border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={previous}
            disabled={isFirst}
            aria-label="Previous item"
            title="Previous (←)"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleTogglePause}
            aria-label={isPaused ? "Resume" : "Pause"}
            title={isPaused ? "Resume (Space)" : "Pause (Space)"}
            className="flex h-10 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" aria-hidden="true" />
                Pause
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            aria-label="Skip item"
            title="Skip (S)"
            className="flex h-10 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
            Skip
          </button>
          <button
            type="button"
            onClick={handleAdvance}
            aria-label={isLast ? "Finish routine" : "Next item"}
            title={isLast ? "Finish (→)" : "Next (→)"}
            className="flex h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {isLast ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Finish
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          ← Prev · → Next · Space Pause · S Skip · Esc Exit
        </p>
      </footer>
    </main>
  );
}

/**
 * Renders the current item's body — per-type layout. rest / custom /
 * metronome are functional; drill / key-drill / scale-drill /
 * leadsheet render placeholders pointing at B.10 take-over.
 */
function ItemBody({
  item,
  elapsedSec,
  isPaused,
}: {
  item: RoutineItem;
  elapsedSec: number;
  isPaused: boolean;
}) {
  // Common header
  const header = (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {ROUTINE_ITEM_TYPE_LABELS[item.type]}
      </span>
      <h2 className="text-3xl font-semibold text-foreground">
        {item.label || "Untitled"}
      </h2>
      <div className="flex items-center gap-3">
        <CategoryChip categoryId={item.category} />
        {item.estimatedSeconds > 0 && (
          <span className="font-mono text-xs text-muted-foreground">
            Target: {formatDuration(item.estimatedSeconds)}
          </span>
        )}
      </div>
    </div>
  );

  // Elapsed / countdown chip (shared)
  const timeChip = (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-6xl font-semibold text-foreground tabular-nums">
        {formatTimer(elapsedSec)}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {isPaused ? "Paused" : "Elapsed"}
      </span>
    </div>
  );

  switch (item.type) {
    case "rest": {
      const targetSec = item.estimatedSeconds;
      const remainingSec = Math.max(0, targetSec - elapsedSec);
      return (
        <div className="flex max-w-2xl flex-col items-center gap-8">
          {header}
          <div className="flex flex-col items-center gap-2">
            <Coffee
              className="h-10 w-10 text-muted-foreground/60"
              aria-hidden="true"
            />
            {item.guidanceText && (
              <p className="max-w-xl text-center text-lg text-foreground/90 leading-relaxed">
                {item.guidanceText}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-7xl font-semibold text-foreground tabular-nums">
              {formatTimer(targetSec > 0 ? remainingSec : elapsedSec)}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {targetSec > 0 ? "Remaining" : "Elapsed"}
            </span>
          </div>
        </div>
      );
    }

    case "custom": {
      return (
        <div className="flex max-w-2xl flex-col items-center gap-8">
          {header}
          <div className="flex flex-col items-center gap-3">
            <Pencil
              className="h-8 w-8 text-primary/70"
              aria-hidden="true"
            />
            <p className="max-w-xl text-center text-lg text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {item.instruction}
            </p>
          </div>
          {timeChip}
        </div>
      );
    }

    case "metronome": {
      // v1: display the target BPM + TS + elapsed. The actual click
      // sound will be wired in B.10 by launching the standalone
      // metronome engine (it already exists at /metronome).
      return (
        <div className="flex max-w-2xl flex-col items-center gap-8">
          {header}
          <div className="flex flex-col items-center gap-2">
            <Timer className="h-10 w-10 text-primary" aria-hidden="true" />
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-6xl font-semibold text-foreground tabular-nums">
                {item.bpm}
              </span>
              <span className="font-mono text-lg text-muted-foreground">
                bpm
              </span>
              <span className="font-mono text-lg text-muted-foreground">
                · {item.beatsPerMeasure}/{item.beatUnit}
              </span>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground/70">
              Audio click engine wires in Slice B.10. Use the standalone{" "}
              <a
                href="/metronome"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Metronome page
              </a>{" "}
              in another tab for now.
            </p>
          </div>
          {timeChip}
        </div>
      );
    }

    // Drill types — placeholder for now; B.10 wires the module take-over.
    case "drill":
    case "key-drill":
    case "scale-drill":
    case "leadsheet": {
      return (
        <div className="flex max-w-2xl flex-col items-center gap-8">
          {header}
          <div className="flex max-w-lg flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-background/30 px-6 py-8 text-center">
            <Music
              className="h-8 w-8 text-muted-foreground/60"
              aria-hidden="true"
            />
            <p className="text-sm text-foreground">
              In-routine drill take-over ships in Slice B.10.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              For now, use <span className="font-medium">Skip</span> or{" "}
              <span className="font-medium">Next</span> to move to the
              next item. B.10 will make this item launch the drill
              directly and auto-advance when it finishes.
            </p>
          </div>
          {timeChip}
        </div>
      );
    }

    // Future item types — song / ear-training will land with their
    // module. Render a generic placeholder for now.
    default: {
      return (
        <div className="flex max-w-2xl flex-col items-center gap-8">
          {header}
          <p className="text-sm text-muted-foreground italic">
            This item type isn&rsquo;t runnable yet.
          </p>
          {timeChip}
        </div>
      );
    }
  }
}

/**
 * End-of-routine celebration screen. Phase 111 (B.11) will layer the
 * per-category vibe-check on top of this; Phase 109 ships the basic
 * summary + primary "Done" button.
 */
function EndOfRoutineScreen({
  routine,
  onExit,
}: {
  routine: Routine;
  onExit: () => void;
}) {
  const execution = useRoutineExecutor((s) => s.execution);
  const totalSec =
    execution?.completedItems.reduce((s, r) => s + r.secondsSpent, 0) ?? 0;
  const completedCount =
    execution?.completedItems.filter((r) => r.outcome !== "revisited").length ??
    0;

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Check className="h-8 w-8" aria-hidden="true" />
      </div>
      <div className="flex max-w-xl flex-col gap-2">
        <h2 className="text-2xl font-semibold text-foreground">
          Routine complete
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Nice work. You practiced{" "}
          <span className="font-medium text-foreground">
            {completedCount} {completedCount === 1 ? "item" : "items"}
          </span>{" "}
          from &ldquo;{routine.name}&rdquo; for{" "}
          <span className="font-medium text-foreground">
            {formatDuration(totalSec)}
          </span>
          .
        </p>
        <p className="text-xs text-muted-foreground/70 italic">
          Per-category vibe-check + detailed summary land in Slice B.11.
        </p>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Done
      </button>
    </main>
  );
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins - hrs * 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}
