"use client";

import {
  BUILTIN_CATEGORIES,
  isBuiltinCategoryId,
  resolveCategoryMeta,
} from "@/lib/practice/categories";
import type { CategoryTimeSlice } from "@/lib/practice/routines-library";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * CategoryTimeBar — Slice B.8 (Phase 108).
 *
 * Horizontal stacked bar showing how a routine's total estimated
 * time is distributed across categories. Compact variant (no legend)
 * fits on a routine card; full variant (bar + legend below) fits in
 * the RoutineBuilder summary area.
 *
 * ## Behavior
 *
 *   - Slices with zero seconds are filtered out (they carry no
 *     visual signal; the aggregate still counts them for legend
 *     completeness if the caller wants).
 *   - Empty state: renders a muted "No time estimated yet" hint
 *     so an under-construction routine doesn't look broken.
 *   - Colors come from BUILTIN_CATEGORIES.color (or the user's
 *     custom category color for `custom:` ids); unknown / deleted
 *     custom category ids fall back to zinc-500.
 *
 * ## Not a chart library
 *
 * A stacked bar is trivially expressible with flexbox + percentages
 * — no chart lib needed. Reports (Slice D) will use a real chart
 * library when it wants a pie / line / stacked column view; the
 * routine builder's needs stay lightweight.
 */

type CategoryTimeBarProps = {
  slices: CategoryTimeSlice[];
  /** Show a per-slice legend beneath the bar. Defaults true. */
  showLegend?: boolean;
  /** Horizontal bar height in tailwind h-N units. Defaults 2 (0.5rem). */
  barHeight?: 2 | 3 | 4;
};

export function CategoryTimeBar({
  slices,
  showLegend = true,
  barHeight = 3,
}: CategoryTimeBarProps) {
  const customCategories = useUserPrefs((s) => s.customCategories);

  // Filter zero-time slices for the visual + legend — they carry no
  // proportional signal. The parent's aggregation still shows they
  // exist via routineCategories() chips.
  const rendered = slices.filter((s) => s.seconds > 0);

  if (rendered.length === 0) {
    return (
      <p className="text-[11px] italic text-muted-foreground/70">
        No time estimated yet — set minutes on each item to see the
        breakdown.
      </p>
    );
  }

  const heightClass =
    barHeight === 2 ? "h-2" : barHeight === 3 ? "h-3" : "h-4";

  return (
    <div className="flex flex-col gap-2">
      {/* Stacked bar */}
      <div
        className={`flex w-full overflow-hidden rounded-full bg-background/40 ${heightClass}`}
        role="img"
        aria-label="Category time breakdown"
      >
        {rendered.map((slice) => {
          const color = colorForCategoryId(slice.categoryId, customCategories);
          return (
            <div
              key={slice.categoryId}
              style={{
                width: `${slice.pct * 100}%`,
                backgroundColor: color,
              }}
              title={`${labelForCategoryId(
                slice.categoryId,
                customCategories,
              )}: ${formatDuration(slice.seconds)} (${Math.round(slice.pct * 100)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <ul className="flex flex-col gap-1">
          {rendered.map((slice) => {
            const color = colorForCategoryId(slice.categoryId, customCategories);
            const label = labelForCategoryId(slice.categoryId, customCategories);
            return (
              <li
                key={slice.categoryId}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate text-foreground">
                  {label}
                </span>
                <span className="font-mono text-muted-foreground tabular-nums">
                  {formatDuration(slice.seconds)}
                </span>
                <span className="font-mono text-muted-foreground/60 tabular-nums w-10 text-right">
                  {Math.round(slice.pct * 100)}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function colorForCategoryId(
  id: string,
  customCategories: ReturnType<typeof useUserPrefs.getState>["customCategories"],
): string {
  if (isBuiltinCategoryId(id)) return BUILTIN_CATEGORIES[id].color;
  const custom = customCategories.find((c) => c.id === id);
  if (custom) return custom.color;
  return "#71717a"; // zinc-500 fallback (matches useCategoryColor helper)
}

function labelForCategoryId(
  id: string,
  customCategories: ReturnType<typeof useUserPrefs.getState>["customCategories"],
): string {
  const meta = resolveCategoryMeta(id, customCategories);
  return meta?.label ?? "Uncategorized";
}

/** Match RoutineBuilder / RoutineCard's duration formatter exactly. */
function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins - hrs * 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}
