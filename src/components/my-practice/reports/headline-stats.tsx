"use client";

import { Calendar, Clock, Flame, Trophy } from "lucide-react";
import {
  REPORTS_RANGE_LABELS,
  distinctPracticeDays,
  totalSecondsInSessions,
  type ReportsRange,
} from "@/lib/practice/reports-queries";
import type { PracticeSession } from "@/lib/practice/types";

/**
 * HeadlineStats — Slice D.2 (Phase 119).
 *
 * Four stat cards across the top of the Reports tab: total time,
 * distinct practice days, current streak, longest streak. The two
 * streak numbers are always over ALL history (they're the
 * "achievement" stats — filtering them by range wouldn't make sense).
 * Total-time + distinct-days respect the selected range.
 */
export function HeadlineStats({
  sessionsInRange,
  currentStreak,
  longestStreak,
  range,
}: {
  sessionsInRange: readonly PracticeSession[];
  currentStreak: number;
  longestStreak: number;
  range: ReportsRange;
}) {
  const totalSec = totalSecondsInSessions(sessionsInRange);
  const daysWithPractice = distinctPracticeDays(sessionsInRange);
  const rangeLabel = REPORTS_RANGE_LABELS[range];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        icon={<Clock className="h-4 w-4" aria-hidden="true" />}
        label={`Total time — ${rangeLabel.toLowerCase()}`}
        value={formatDurationLong(totalSec)}
        hint={totalSec === 0 ? "No practice logged yet." : undefined}
      />
      <StatCard
        icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
        label={`Days practiced — ${rangeLabel.toLowerCase()}`}
        value={String(daysWithPractice)}
        hint={
          daysWithPractice === 1 ? "day" : daysWithPractice === 0 ? undefined : "days"
        }
      />
      <StatCard
        icon={<Flame className="h-4 w-4" aria-hidden="true" />}
        label="Current streak"
        value={String(currentStreak)}
        hint={currentStreak === 1 ? "day in a row" : "days in a row"}
        accent={currentStreak > 0}
      />
      <StatCard
        icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
        label="Longest streak"
        value={String(longestStreak)}
        hint={longestStreak === 1 ? "day" : "days"}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  /** When true, uses the primary accent for the value — draws the eye. */
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-background/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <span
        className={`text-2xl font-semibold tabular-nums ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
      {hint && (
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {hint}
        </span>
      )}
    </div>
  );
}

/**
 * Human-friendly duration: "45m", "1h 12m", "3h", or "0m" when zero.
 * Reports care about minute-granularity readability, not seconds.
 */
function formatDurationLong(sec: number): string {
  if (sec <= 0) return "0m";
  const totalMin = Math.round(sec / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
