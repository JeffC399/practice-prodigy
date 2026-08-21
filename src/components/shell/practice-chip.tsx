"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSessionsInRange } from "@/lib/practice/reports-queries";
import { computeStreaks } from "@/lib/practice/streak";
import { useSessionTracker } from "@/lib/tracking/session-tracker";

/**
 * PracticeChip — Slice D.9 (Phase 123).
 *
 * Tiny status chip in the global site header showing today's total
 * practice time + current streak. Clicking jumps to the Reports tab
 * inside /my-practice.
 *
 * ## When it renders
 *
 * Hidden entirely when there's no signal to display — no practice
 * today AND no current streak. Once either exists, the chip appears.
 * This prevents an empty chip from adding visual noise for brand-new
 * users who haven't practiced yet.
 *
 * ## Live-ish updates
 *
 * The chip subscribes to session-tracker state (via useSessionTracker),
 * so its minute count updates whenever the store publishes — which
 * happens on every `reportActivity()` past the 5s rate limit. That's
 * good enough for a header chip (users don't need second-precision).
 *
 * ## Hydration
 *
 * Zustand persist hydration is asynchronous. Render null until mounted
 * to avoid a "chip pops in on hydration" flash, matching the pattern
 * used across the app.
 */
export function PracticeChip() {
  const history = useSessionTracker((s) => s.history);
  const current = useSessionTracker((s) => s.current);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return null;

  const allSessions = current ? [current, ...history] : history;
  const todaySessions = getSessionsInRange(allSessions, "today");
  const todaySec = totalSeconds(todaySessions);
  const { current: streak } = computeStreaks(allSessions);

  // No signal → hide.
  if (todaySec === 0 && streak === 0) return null;

  return (
    <Link
      href="/my-practice?tab=reports"
      title={buildTitle(todaySec, streak)}
      aria-label={buildAriaLabel(todaySec, streak)}
      className="hidden items-center gap-1.5 rounded-md border border-border/70 bg-background/40 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:inline-flex"
    >
      {todaySec > 0 && (
        <span className="text-foreground tabular-nums">
          Today {formatShort(todaySec)}
        </span>
      )}
      {todaySec > 0 && streak > 0 && (
        <span className="text-muted-foreground/50">·</span>
      )}
      {streak > 0 && (
        <span className="inline-flex items-center gap-1 text-primary">
          <Flame className="h-3 w-3" aria-hidden="true" />
          <span className="tabular-nums">{streak}d</span>
        </span>
      )}
    </Link>
  );
}

function totalSeconds(sessions: readonly { items: { durationSec: number }[] }[]): number {
  let sum = 0;
  for (const s of sessions) for (const item of s.items) sum += item.durationSec;
  return sum;
}

/** Compact minute formatter — "45m", "1h12m", "2h". */
function formatShort(sec: number): string {
  if (sec <= 0) return "0m";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function buildTitle(todaySec: number, streak: number): string {
  const parts: string[] = [];
  if (todaySec > 0) {
    const min = Math.round(todaySec / 60);
    parts.push(`Practiced ${min} min today`);
  }
  if (streak > 0) {
    parts.push(`${streak}-day streak`);
  }
  parts.push("Click for full reports");
  return parts.join(" · ");
}

function buildAriaLabel(todaySec: number, streak: number): string {
  return buildTitle(todaySec, streak);
}
