"use client";

import {
  REPORTS_RANGE_LABELS,
  REPORTS_RANGE_ORDER,
  type ReportsRange,
} from "@/lib/practice/reports-queries";

/**
 * ReportsRangePicker — Slice D.2 (Phase 119).
 *
 * Segmented control for the six report ranges. On narrow viewports
 * it wraps to two rows via `flex-wrap` — no separate mobile
 * dropdown, since 6 short labels wrap gracefully.
 */
export function ReportsRangePicker({
  value,
  onChange,
}: {
  value: ReportsRange;
  onChange: (next: ReportsRange) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Report time range"
      className="flex flex-wrap gap-1 rounded-md border border-border/60 bg-background/40 p-1"
    >
      {REPORTS_RANGE_ORDER.map((r) => {
        const active = value === r;
        return (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(r)}
            className={`rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              active
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {REPORTS_RANGE_LABELS[r]}
          </button>
        );
      })}
    </div>
  );
}
