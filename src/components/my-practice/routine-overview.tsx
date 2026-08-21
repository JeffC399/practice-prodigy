"use client";

import { ArrowLeft, Play } from "lucide-react";
import { useMemo } from "react";
import { CategoryTimeBar } from "@/components/my-practice/category-time-bar";
import { CategoryChip } from "@/components/practice/category-chip";
import { getMethodology } from "@/lib/practice/methodologies";
import {
  categoryTimeBreakdown,
  routineCategories,
} from "@/lib/practice/routines-library";
import {
  ROUTINE_ITEM_TYPE_LABELS,
  totalEstimatedSeconds,
  type Routine,
} from "@/lib/practice/routine-types";

/**
 * RoutineOverview — Slice B.14 (Phase 115).
 *
 * Pre-run gate shown before the executor takes over. Purpose:
 *
 *   1. Let the user confirm they picked the right routine — "yep,
 *      that's the 45-min repertoire block, not the 15-min warmup."
 *   2. Surface the plan (item list + total time + category mix +
 *      structural methodology) so they mentally commit to the arc
 *      before diving in.
 *   3. Provide a clean "Back to routines" exit for accidental clicks
 *      without polluting the executor's exit-confirm history.
 *
 * The Start button is a big primary CTA — this screen is a lightweight
 * ceremony, not a decision hurdle. Enter also starts the run for
 * keyboard-heavy users.
 *
 * ## Not shown when resuming
 *
 * The executor page decides: if there's already an active execution
 * for this routineId, it skips the overview entirely and drops the
 * user straight back into the current item. This screen is only for
 * fresh runs.
 */
export function RoutineOverview({
  routine,
  onStart,
  onCancel,
}: {
  routine: Routine;
  onStart: () => void;
  onCancel: () => void;
}) {
  const totalSec = totalEstimatedSeconds(routine);
  const categories = routineCategories(routine);
  const timeBreakdown = useMemo(
    () => categoryTimeBreakdown(routine),
    [routine],
  );
  const hasEstimatedTime = timeBreakdown.some((s) => s.seconds > 0);
  const methodology = getMethodology(routine.methodologyId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
      {/* Top bar — back link (safe cancel, no confirm) */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to routines
        </button>
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
          Ready to start
        </span>
      </div>

      {/* Header — name, notes, structural methodology chip */}
      <header className="flex flex-col gap-3 rounded-lg border-2 border-primary/40 bg-primary/5 px-5 py-5">
        <h1 className="text-2xl font-semibold text-foreground">
          {routine.name}
        </h1>
        {routine.notes && (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {routine.notes}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="font-mono text-xs text-muted-foreground">
            {routine.items.length}{" "}
            {routine.items.length === 1 ? "item" : "items"}
          </span>
          {totalSec > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono text-xs text-muted-foreground">
                ~{formatDuration(totalSec)}
              </span>
            </>
          )}
          {methodology && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span
                className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-primary"
                title={methodology.summary}
              >
                {methodology.name}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Category mix */}
      {(categories.length > 0 || hasEstimatedTime) && (
        <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 px-4 py-3">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Category mix
          </span>
          {hasEstimatedTime && <CategoryTimeBar slices={timeBreakdown} />}
          {categories.length > 0 && !hasEstimatedTime && (
            <div className="flex flex-wrap gap-1">
              {categories.map((catId) => (
                <CategoryChip key={catId} categoryId={catId} size="sm" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Item list */}
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          The plan
        </h2>
        {routine.items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-4 py-6 text-center text-sm text-muted-foreground">
            This routine has no items yet. Add some in the builder first.
          </div>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {routine.items.map((item, idx) => {
              const itemMethod = getMethodology(item.methodologyId);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2"
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground/70">
                    {idx + 1}.
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.label || ROUTINE_ITEM_TYPE_LABELS[item.type]}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {ROUTINE_ITEM_TYPE_LABELS[item.type]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryChip categoryId={item.category} size="sm" />
                      {itemMethod && (
                        <span
                          className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground"
                          title={itemMethod.summary}
                        >
                          {itemMethod.name}
                        </span>
                      )}
                      {item.estimatedSeconds > 0 && (
                        <span className="font-mono text-[10px] text-muted-foreground/70">
                          {formatDuration(item.estimatedSeconds)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Primary CTA */}
      <div className="flex flex-col-reverse items-stretch gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={onStart}
          disabled={routine.items.length === 0}
          autoFocus
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          Start routine
        </button>
      </div>
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}
