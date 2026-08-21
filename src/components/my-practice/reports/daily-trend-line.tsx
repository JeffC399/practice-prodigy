"use client";

import { useMemo } from "react";
import {
  localDayKey,
  secondsByDay,
  type ReportsRange,
} from "@/lib/practice/reports-queries";
import type { PracticeSession } from "@/lib/practice/types";

/**
 * DailyTrendLine — Slice D.5 (Phase 122).
 *
 * Bars-per-day for granularity + a smooth 7-day rolling-average
 * overlay for the "am I trending up" signal. Custom SVG so we
 * inherit the theme accent naturally and stay chart-lib-free.
 *
 * ## Range coupling
 *
 * Unlike the heatmap (which uses a fixed 12-week window), the trend
 * chart respects the parent's range picker. Ranges shorter than
 * ~7 days hide the rolling average since it wouldn't have enough
 * points to smooth anything.
 *
 * ## Layout
 *
 * - Fixed viewBox height (100 units) — SVG scales to container width.
 * - Bars sit along the x-axis; height in [0, chartMax].
 * - Rolling average is a polyline in a stronger primary color.
 * - Y-axis label (max minute value) sits above the chart.
 * - X-axis: only start-of-week ticks to avoid label crowding.
 */

const CHART_HEIGHT = 100; // SVG units
const CHART_TOP_PAD = 8; // room for the value label above the tallest bar
const CHART_BOTTOM_PAD = 14; // room for x-axis tick labels
const CHART_INNER_HEIGHT = CHART_HEIGHT - CHART_TOP_PAD - CHART_BOTTOM_PAD;

/** Compute how many days the chart covers for the given range. */
function daysForRange(range: ReportsRange, now: number): number {
  switch (range) {
    case "today":
      return 1;
    case "week":
      // ISO week: days since Monday + 1
      return dayIndexInLocalWeek(now) + 1;
    case "month":
      return new Date(now).getDate();
    case "30d":
      return 30;
    case "year":
      return 365;
    case "all-time":
      return 365; // Cap chart at a year; longer histories still show as one bar per day back a year.
  }
}

function dayIndexInLocalWeek(ms: number): number {
  const d = new Date(ms);
  const dow = d.getDay();
  return (dow + 6) % 7; // Mon 0 … Sun 6
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** For x-axis ticks: is the given local date a Monday? */
function isLocalMonday(ms: number): boolean {
  return new Date(ms).getDay() === 1;
}

function formatDateShort(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatMinutes(sec: number): string {
  if (sec <= 0) return "no practice";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

export function DailyTrendLine({
  sessions,
  range,
  now = Date.now(),
}: {
  sessions: readonly PracticeSession[];
  range: ReportsRange;
  now?: number;
}) {
  const chart = useMemo(
    () => buildChartData(sessions, range, now),
    [sessions, range, now],
  );

  if (chart.days.length === 0) {
    return null;
  }

  // A single "today" bar isn't a trend — collapse to a lean summary
  // line rather than rendering a wonky one-bar chart.
  if (chart.days.length === 1) {
    const only = chart.days[0];
    return (
      <section className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 px-4 py-3">
        <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Daily trend
        </h3>
        <p className="text-xs text-muted-foreground">
          Only one day in this range. Pick a longer window to see the
          trend. Today: <span className="text-foreground">{formatMinutes(only.seconds)}</span>.
        </p>
      </section>
    );
  }

  const totalWidth = 100; // in SVG units — bars width comes from days.length
  const barSlot = totalWidth / chart.days.length;
  const barW = Math.max(0.4, barSlot * 0.7);
  const barOffset = (barSlot - barW) / 2;

  const showRolling = chart.days.length >= 7;

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/40 px-4 py-3">
      <header className="flex flex-col gap-0.5">
        <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Daily trend
        </h3>
        <p className="text-[11px] text-muted-foreground/70">
          Bars are per-day totals; line is a 7-day rolling average when
          the range is long enough. Max: {formatMinutes(chart.maxSeconds)}.
        </p>
      </header>

      <svg
        viewBox={`0 0 ${totalWidth} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        width="100%"
        height={140}
        role="img"
        aria-label="Daily practice trend"
        className="text-primary"
      >
        {/* Baseline */}
        <line
          x1={0}
          y1={CHART_HEIGHT - CHART_BOTTOM_PAD}
          x2={totalWidth}
          y2={CHART_HEIGHT - CHART_BOTTOM_PAD}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={0.4}
          vectorEffect="non-scaling-stroke"
        />

        {chart.days.map((d, i) => {
          const heightFrac = chart.maxSeconds > 0 ? d.seconds / chart.maxSeconds : 0;
          const h = heightFrac * CHART_INNER_HEIGHT;
          const y = CHART_HEIGHT - CHART_BOTTOM_PAD - h;
          return (
            <rect
              key={d.dayKey}
              x={i * barSlot + barOffset}
              y={y}
              width={barW}
              height={h}
              rx={0.5}
              ry={0.5}
              fill="currentColor"
              className="text-primary/60"
            >
              <title>
                {formatDateShort(d.dayMs)} — {formatMinutes(d.seconds)}
              </title>
            </rect>
          );
        })}

        {/* Rolling-average polyline */}
        {showRolling && chart.rollingPoints.length > 1 && (
          <polyline
            points={chart.rollingPoints
              .map(
                (p) =>
                  `${p.i * barSlot + barSlot / 2},${
                    CHART_HEIGHT -
                    CHART_BOTTOM_PAD -
                    (chart.maxSeconds > 0
                      ? (p.value / chart.maxSeconds) * CHART_INNER_HEIGHT
                      : 0)
                  }`,
              )
              .join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="text-primary"
          />
        )}

        {/* X-axis tick labels — only start-of-week to avoid crowding */}
        {chart.days.map((d, i) => {
          if (!isLocalMonday(d.dayMs)) return null;
          return (
            <text
              key={`tick-${d.dayKey}`}
              x={i * barSlot + barSlot / 2}
              y={CHART_HEIGHT - 4}
              textAnchor="middle"
              fontSize={4}
              fill="currentColor"
              className="fill-muted-foreground/70"
            >
              {formatDateShort(d.dayMs)}
            </text>
          );
        })}
      </svg>
    </section>
  );
}

type ChartDay = {
  dayKey: string;
  dayMs: number;
  seconds: number;
};

function buildChartData(
  sessions: readonly PracticeSession[],
  range: ReportsRange,
  now: number,
): {
  days: ChartDay[];
  maxSeconds: number;
  rollingPoints: { i: number; value: number }[];
} {
  const byDay = secondsByDay(sessions);
  const days: ChartDay[] = [];
  const totalDays = daysForRange(range, now);
  const today = startOfLocalDay(now);
  for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
    const dayMs = today - offset * 24 * 60 * 60 * 1000;
    const dayKey = localDayKey(dayMs);
    days.push({
      dayKey,
      dayMs,
      seconds: byDay[dayKey] ?? 0,
    });
  }

  const maxSeconds = days.reduce((m, d) => (d.seconds > m ? d.seconds : m), 0);

  // 7-day trailing rolling average. First 6 points are undefined
  // (not enough history to smooth); skip those in the polyline.
  const window = 7;
  const rollingPoints: { i: number; value: number }[] = [];
  for (let i = window - 1; i < days.length; i += 1) {
    let sum = 0;
    for (let j = 0; j < window; j += 1) sum += days[i - j].seconds;
    rollingPoints.push({ i, value: sum / window });
  }

  return { days, maxSeconds, rollingPoints };
}
