"use client";

import { useMemo } from "react";
import {
  localDayKey,
  secondsByDay,
} from "@/lib/practice/reports-queries";
import type { PracticeSession } from "@/lib/practice/types";

/**
 * CalendarHeatmap — Slice D.4 (Phase 121).
 *
 * GitHub-style contribution grid. 12 weeks × 7 days = 84 cells,
 * each colored by minutes practiced that local day. Custom SVG —
 * no external chart library.
 *
 * ## Layout
 *
 * Columns are weeks (oldest → newest, left → right); rows are days
 * of the week (Mon top → Sun bottom, ISO week convention). The
 * rightmost column is the current week (partial if we haven't hit
 * Sunday). Cells outside the 12-week window aren't rendered.
 *
 * ## Colors
 *
 * 5 intensity buckets (0, 1–14min, 15–29, 30–59, 60+). Uses
 * primary-color CSS variables at increasing opacities so the
 * heatmap picks up the user's theme accent. Zero-practice days
 * render as a subtle background bg-muted so the grid stays visible.
 *
 * ## Range
 *
 * Independent of the parent's range picker — always shows the last
 * 12 weeks (~84 days). The picker filters everything else on the
 * Reports tab; the heatmap is a fixed-scope "recent momentum" view.
 */

const WEEKS_SHOWN = 12;
const CELL_SIZE = 12; // px including gap
const CELL_GAP = 2; // px
const CELL_INNER = CELL_SIZE - CELL_GAP;

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"] as const;

/**
 * Returns start-of-current-local-day epoch ms. Anchor for the
 * "12 weeks ending today" window.
 */
function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Return Monday-of-current-local-week epoch ms. Used to align the
 * grid so the rightmost column ends on today's day-of-week row.
 */
function startOfLocalMondayThisWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 Sun … 6 Sat
  const back = (dow + 6) % 7; // Mon → 0, Sun → 6
  d.setDate(d.getDate() - back);
  return d.getTime();
}

/** ms → intensity bucket (0..4) using minute thresholds. */
function bucket(seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0;
  const min = seconds / 60;
  if (min < 15) return 1;
  if (min < 30) return 2;
  if (min < 60) return 3;
  return 4;
}

/** Format a duration for the cell tooltip. */
function formatMinutes(sec: number): string {
  if (sec <= 0) return "no practice";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Nicely formatted date for the cell tooltip, e.g. "Aug 12". */
function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CalendarHeatmap({
  sessions,
  now = Date.now(),
}: {
  /**
   * All available sessions — the heatmap does its own last-12-weeks
   * filter so it doesn't need to share the parent's range picker.
   */
  sessions: readonly PracticeSession[];
  /** Injectable for tests / storybook. */
  now?: number;
}) {
  const cells = useMemo(() => buildCells(sessions, now), [sessions, now]);
  const totalWeekPx = WEEKS_SHOWN * CELL_SIZE;
  const totalHeightPx = 7 * CELL_SIZE;

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/40 px-4 py-3">
      <header className="flex flex-col gap-0.5">
        <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Last 12 weeks
        </h3>
        <p className="text-[11px] text-muted-foreground/70">
          Each square is a day. Deeper color = more practice time.
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto">
        {/* Day-of-week labels down the left */}
        <div
          className="flex flex-col justify-between font-mono text-[9px] text-muted-foreground/70"
          style={{ height: totalHeightPx }}
        >
          {DAY_LABELS.map((label, i) => (
            <span
              key={i}
              className="leading-none"
              style={{ height: CELL_INNER, lineHeight: `${CELL_INNER}px` }}
            >
              {label}
            </span>
          ))}
        </div>

        <svg
          width={totalWeekPx}
          height={totalHeightPx}
          viewBox={`0 0 ${totalWeekPx} ${totalHeightPx}`}
          role="img"
          aria-label="Practice heatmap for the last 12 weeks"
          className="shrink-0"
        >
          {cells.map((cell) => (
            <rect
              key={cell.dayKey}
              x={cell.col * CELL_SIZE}
              y={cell.row * CELL_SIZE}
              width={CELL_INNER}
              height={CELL_INNER}
              rx={2}
              ry={2}
              fill="currentColor"
              className={colorClassFor(cell.intensity, cell.isFuture)}
            >
              <title>
                {formatDateShort(cell.dayKey)} — {formatMinutes(cell.seconds)}
              </title>
            </rect>
          ))}
        </svg>
      </div>

      <Legend />
    </section>
  );
}

type Cell = {
  dayKey: string;
  col: number;
  row: number;
  seconds: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  /** Days in the future (rest of current partial week) — rendered subtly. */
  isFuture: boolean;
};

function buildCells(
  sessions: readonly PracticeSession[],
  now: number,
): Cell[] {
  const byDay = secondsByDay(sessions);
  const today = startOfLocalDay(now);

  // Anchor: Monday of the CURRENT week. Then walk back (WEEKS_SHOWN-1)
  // full weeks to get column 0's Monday.
  const currentWeekMonday = startOfLocalMondayThisWeek(now);
  const firstMonday =
    currentWeekMonday - (WEEKS_SHOWN - 1) * 7 * 24 * 60 * 60 * 1000;

  const cells: Cell[] = [];
  for (let col = 0; col < WEEKS_SHOWN; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const dayMs = firstMonday + (col * 7 + row) * 24 * 60 * 60 * 1000;
      const dayKey = localDayKey(dayMs);
      const seconds = byDay[dayKey] ?? 0;
      const isFuture = dayMs > today;
      cells.push({
        dayKey,
        col,
        row,
        seconds,
        intensity: bucket(seconds),
        isFuture,
      });
    }
  }
  return cells;
}

/**
 * Tailwind class per intensity bucket. Uses the `text-` scale so the
 * SVG rects (fill="currentColor") pick up whatever color the parent
 * text color is. Zero-days get muted-foreground/10; higher tiers ramp
 * primary opacity so the heatmap adapts to the user's accent.
 */
function colorClassFor(
  intensity: 0 | 1 | 2 | 3 | 4,
  isFuture: boolean,
): string {
  if (isFuture) return "text-muted/30";
  switch (intensity) {
    case 0:
      return "text-muted-foreground/15";
    case 1:
      return "text-primary/25";
    case 2:
      return "text-primary/45";
    case 3:
      return "text-primary/70";
    case 4:
      return "text-primary";
  }
}

function Legend() {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
      <span>Less</span>
      {([0, 1, 2, 3, 4] as const).map((i) => (
        <span
          key={i}
          className={`inline-block h-2.5 w-2.5 rounded-sm ${colorClassFor(i, false)}`}
          style={{ backgroundColor: "currentColor" }}
          aria-hidden="true"
        />
      ))}
      <span>More</span>
    </div>
  );
}
