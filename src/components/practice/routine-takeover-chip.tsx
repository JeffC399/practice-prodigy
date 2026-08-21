"use client";

import { ArrowRight, SkipForward, X } from "lucide-react";
import type { RoutineTakeoverState } from "@/lib/practice/routine-takeover";

/**
 * RoutineTakeoverChip — Slice B.10 (Phase 110).
 *
 * Header-strip chip that renders inside every drilling module's page
 * when a routine take-over is active. Communicates the current
 * position in the routine + provides Skip / Next / Exit navigation
 * without leaving the drill page.
 *
 * ## Design
 *
 * Compact horizontal strip that sits just below the module's own
 * header (or wherever the page wants it). Uses primary-tinted
 * background to signal "you're in a special mode" while staying
 * quiet enough to not fight the drill UI.
 *
 * ## Buttons
 *
 *   - **Skip**: mark this item as skipped (didn't finish) and go to
 *     the next item. Used when the user recognizes they need to
 *     move on but don't consider the item "done."
 *   - **Next**: mark this item as completed and advance. Used when
 *     the user is satisfied with what they got out of the item.
 *     Becomes "Finish routine" on the last item.
 *   - **Exit**: bail on the whole run. Confirms via a small inline
 *     two-click pattern to prevent accidental clicks.
 *
 * Consumers just render this and forget — all state comes from the
 * hook. No props beyond the hook's return value.
 */

export function RoutineTakeoverChip({
  state,
  isLast,
}: {
  state: RoutineTakeoverState;
  /**
   * When true, the "Next" button becomes "Finish" — visual cue that
   * hitting it completes the whole routine. Caller can pass
   * `state.currentIndex === state.totalItems` to compute this.
   */
  isLast?: boolean;
}) {
  if (!state.isActive) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/30 bg-primary/10 px-6 py-2">
      <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider">
        <span className="text-primary">Routine</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-foreground">
          {state.routineName}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-muted-foreground">
          Item {state.currentIndex} of {state.totalItems}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={state.exit}
          aria-label="Exit routine"
          title="Exit the whole routine"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Exit
        </button>
        <button
          type="button"
          onClick={() => state.advance("skipped")}
          aria-label="Skip item"
          title="Skip this item and go to the next"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
          Skip
        </button>
        <button
          type="button"
          onClick={() => state.advance("completed")}
          aria-label={isLast ? "Finish routine" : "Next item"}
          title={isLast ? "Finish the routine" : "Mark done and go to next item"}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {isLast ? "Finish" : "Next"}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
