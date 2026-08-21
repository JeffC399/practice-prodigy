"use client";

import { useMemo, useState } from "react";
import { CalendarHeatmap } from "./calendar-heatmap";
import { CategoryPanel } from "./category-panel";
import { DailyTrendLine } from "./daily-trend-line";
import { HeadlineStats } from "./headline-stats";
import { LevelsPanel } from "./levels-panel";
import { MethodologyMix } from "./methodology-mix";
import { ReportsRangePicker } from "./range-picker";
import {
  getSessionsInRange,
  type ReportsRange,
} from "@/lib/practice/reports-queries";
import { computeStreaks } from "@/lib/practice/streak";
import { useSessionTracker } from "@/lib/tracking/session-tracker";

/**
 * ReportsTab — Slice D.2 (Phase 119).
 *
 * The Reports pane inside /my-practice. Reads the live session
 * tracker's history + current session, filters by the selected time
 * range, and renders the analytics stack.
 *
 * Phase 119 (this file's initial ship) delivers:
 *   - Range picker (today / week / month / 30d / year / all-time)
 *   - Four headline stat cards (total time, days practiced, current
 *     streak, longest streak)
 *   - Friendly empty state when no session history exists
 *
 * Later phases layer in:
 *   - D.3 category bar chart
 *   - D.4 calendar heatmap
 *   - D.5 daily trend line
 *   - D.6 songs progress panel (once Slice C ships Songs)
 *   - D.7 levels & progression panel
 *   - D.8 methodology mix chip
 *   - D.10 CSV + PDF export
 */
export function ReportsTab() {
  const [range, setRange] = useState<ReportsRange>("week");

  const history = useSessionTracker((s) => s.history);
  const current = useSessionTracker((s) => s.current);

  // Include the live session too, so "today" and "this week" reflect
  // in-progress work. Ended sessions in `history` already have their
  // final durations frozen in.
  const allSessions = useMemo(
    () => (current ? [current, ...history] : history),
    [current, history],
  );

  const sessionsInRange = useMemo(
    () => getSessionsInRange(allSessions, range),
    [allSessions, range],
  );

  // Streaks are always over all-time — they're achievement stats,
  // not per-range filters.
  const streaks = useMemo(() => computeStreaks(allSessions), [allSessions]);

  const isEmpty = allSessions.length === 0;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Reports</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Where your practice time actually went. Filter by range; the
          streak stats always reflect all time.
        </p>
      </header>

      <ReportsRangePicker value={range} onChange={setRange} />

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <HeadlineStats
            sessionsInRange={sessionsInRange}
            currentStreak={streaks.current}
            longestStreak={streaks.longest}
            range={range}
          />
          <CategoryPanel sessions={sessionsInRange} />
          <MethodologyMix sessions={sessionsInRange} />
          <DailyTrendLine sessions={sessionsInRange} range={range} />
          {/* Heatmap uses its own last-12-weeks window (not the range
              picker). Deliberate — it's a momentum view, not a range
              slice. */}
          <CalendarHeatmap sessions={allSessions} />
          {/* Songs panel — layered in by D.6 once Slice C ships. */}
        </>
      )}

      {/* Levels panel renders regardless of session data — even a
          brand-new user should be able to set their proficiency, and
          this is currently the only place to do it (until Slice E/F's
          Profile tab ships a fuller manager). */}
      <LevelsPanel />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-background/20 px-6 py-10 text-center">
      <span className="text-sm text-foreground">No practice logged yet.</span>
      <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
        Sessions accumulate automatically as you use the drilling modules
        (Bass Arpeggios, Key Sequencer, Scale Driller, Metronome, and
        Lead Sheet playback). Come back here after your first session
        to see it appear.
      </p>
    </div>
  );
}
