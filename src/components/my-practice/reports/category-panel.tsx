"use client";

import { useMemo } from "react";
import { CategoryTimeBar } from "@/components/my-practice/category-time-bar";
import type { CategoryId } from "@/lib/practice/categories";
import { secondsByCategory } from "@/lib/practice/reports-queries";
import type { CategoryTimeSlice } from "@/lib/practice/routines-library";
import type { PracticeSession } from "@/lib/practice/types";

/**
 * CategoryPanel — Slice D.3 (Phase 120).
 *
 * "Where did the time go?" — a horizontal stacked bar (via the
 * existing `CategoryTimeBar`) showing how the range's practice time
 * split across categories, with a full legend beneath.
 *
 * ## Why reuse CategoryTimeBar instead of pulling in a chart lib?
 *
 * The plan mentioned Recharts as an option, but the routine builder
 * already ships a stacked-bar-plus-legend that renders the exact
 * shape we want here — categories × time × %. Reusing keeps the
 * bundle lean and the two surfaces visually consistent. Recharts /
 * D3 come in later if / when we need column, pie, or scatter.
 */
export function CategoryPanel({
  sessions,
}: {
  sessions: readonly PracticeSession[];
}) {
  const slices = useMemo<CategoryTimeSlice[]>(() => {
    const byCat = secondsByCategory(sessions);
    const total = Object.values(byCat).reduce((s, n) => s + n, 0);
    const arr: CategoryTimeSlice[] = Object.entries(byCat).map(
      ([catId, seconds]) => ({
        categoryId: catId as CategoryId,
        seconds,
        pct: total > 0 ? seconds / total : 0,
      }),
    );
    arr.sort((a, b) => b.seconds - a.seconds);
    return arr;
  }, [sessions]);

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/40 px-4 py-3">
      <header className="flex flex-col gap-0.5">
        <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Time by category
        </h3>
        <p className="text-[11px] text-muted-foreground/70">
          How your time split across activity categories in the selected
          range.
        </p>
      </header>
      <CategoryTimeBar slices={slices} showLegend={true} barHeight={3} />
    </section>
  );
}
