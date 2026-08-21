"use client";

import { useMemo } from "react";
import { CategoryChip } from "@/components/practice/category-chip";
import {
  resolveCategoryMeta,
  type CategoryId,
} from "@/lib/practice/categories";
import { useRoutineExecutor } from "@/lib/practice/routine-executor";
import type { Routine } from "@/lib/practice/routine-types";
import {
  VIBE_CHECK_RATINGS,
  type SessionCategoryFeedbackRating,
} from "@/lib/practice/types";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * VibeCheck — Slice B.12 (Phase 112).
 *
 * Post-routine "How'd it go?" rating: one row per category the
 * routine touched, five buttons per row (Rough / Struggled / OK /
 * Solid / Great). Fully skippable via the "Skip all" button in the
 * end-of-routine screen's footer.
 *
 * ## Storage
 *
 * Ratings live on the current execution's `categoryFeedback` array
 * via useRoutineExecutor.setCategoryFeedback. Persisted with the
 * rest of the execution to localStorage. Not yet synced to cloud
 * — that lands when the session-tracker adapter (already shipped in
 * Slice A.12) starts recording routine executions as PracticeSession
 * rows with the feedback attached. Reports (Slice D) will pull them
 * back in.
 *
 * ## Design
 *
 * Rated categories get a subtle checkmark border on the chosen
 * button so users see their prior tap without having to re-read
 * every row. Tapping a different rating just replaces.
 *
 * Categories are pulled from the routine's items directly (deduped),
 * which means the vibe-check shows exactly what the routine touched,
 * not a generic list of all 10 built-ins.
 */

export function VibeCheck({ routine }: { routine: Routine }) {
  const execution = useRoutineExecutor((s) => s.execution);
  const setCategoryFeedback = useRoutineExecutor(
    (s) => s.setCategoryFeedback,
  );
  const customCategories = useUserPrefs((s) => s.customCategories);

  // Dedupe categories touched by this routine, preserving the order
  // items were added.
  const touchedCategories = useMemo(() => {
    const seen = new Set<CategoryId>();
    const out: CategoryId[] = [];
    for (const item of routine.items) {
      if (!seen.has(item.category)) {
        seen.add(item.category);
        out.push(item.category);
      }
    }
    return out;
  }, [routine.items]);

  const feedbackMap = useMemo(() => {
    const map = new Map<CategoryId, SessionCategoryFeedbackRating>();
    for (const f of execution?.categoryFeedback ?? []) {
      map.set(f.categoryId, f.rating);
    }
    return map;
  }, [execution?.categoryFeedback]);

  if (touchedCategories.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-3 rounded-md border border-border bg-background/40 px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          How&rsquo;d it go?
        </span>
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          One tap per category. Feeds AI Coach suggestions. Fully
          optional — hit &ldquo;Skip all&rdquo; if you&rsquo;d rather move on.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {touchedCategories.map((catId) => {
          const meta = resolveCategoryMeta(catId, customCategories);
          const chosen = feedbackMap.get(catId);
          return (
            <li
              key={catId}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-background/60 px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <CategoryChip categoryId={catId} size="sm" />
                <span className="truncate text-xs text-muted-foreground">
                  {meta?.label ?? catId}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {VIBE_CHECK_RATINGS.map((r) => {
                  const isChosen = chosen === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setCategoryFeedback(catId, r.value)}
                      title={r.hint}
                      aria-label={`${meta?.label ?? catId} · ${r.label}`}
                      aria-pressed={isChosen}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        isChosen
                          ? "border-primary bg-primary/25 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
