import type { CategoryId } from "./categories";
import type { Routine, MethodologyId } from "./routine-types";
import type {
  PracticeModule,
  PracticeSession,
  SessionItem,
} from "./types";

/**
 * reports-queries — Slice D.1 (Phase 118).
 *
 * Pure aggregation helpers over `PracticeSession[]`. No hooks, no
 * store subscriptions — takes the sessions array in, returns
 * summaries out. Callers (D.2+ Reports UI, the header chip, exports)
 * pull the live session history via `useSessionTracker(s => s.history)`
 * + optionally include the live `current` session for "today so far."
 *
 * ## Time zones
 *
 * All "day bucket" grouping uses the user's LOCAL time zone via
 * `toLocaleDateString("en-CA")`, which formats as `YYYY-MM-DD`. This
 * matches the streak helpers so the same day key is used everywhere.
 *
 * ## Empty result semantics
 *
 * Aggregators always return a defined map/array — an empty session
 * list yields `{}` / `[]`, never null. Callers can render "no data
 * yet" states without null-guards.
 */

/**
 * Supported time-range filters shown in the Reports range picker.
 *   - today:    just the current local day
 *   - week:     current local ISO week (Mon–Sun)
 *   - month:    current calendar month
 *   - 30d:      rolling 30 days back from now
 *   - year:     rolling 365 days back from now
 *   - all-time: no filter — every session in history
 */
export type ReportsRange =
  | "today"
  | "week"
  | "month"
  | "30d"
  | "year"
  | "all-time";

export const REPORTS_RANGE_LABELS: Record<ReportsRange, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  "30d": "Last 30 days",
  year: "Last year",
  "all-time": "All time",
};

/** Order shown in the range picker — most granular → coarsest. */
export const REPORTS_RANGE_ORDER: readonly ReportsRange[] = [
  "today",
  "week",
  "month",
  "30d",
  "year",
  "all-time",
] as const;

/**
 * Local YYYY-MM-DD for the given epoch ms. "en-CA" is used because it
 * formats as ISO YYYY-MM-DD in every locale — no user-visible
 * consequence since these are never rendered raw.
 */
export function localDayKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA");
}

/** Start-of-local-day epoch ms for the given moment. */
function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Start-of-local-ISO-week (Monday) epoch ms for the given moment.
 * getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 */
function startOfLocalWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const daysBackToMonday = (dow + 6) % 7; // Sun→6, Mon→0, Tue→1, ...
  d.setDate(d.getDate() - daysBackToMonday);
  return d.getTime();
}

/** Start-of-local-month epoch ms for the given moment. */
function startOfLocalMonth(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

/**
 * Return the earliest activity timestamp for a session. Used to bucket
 * sessions by day rather than by `startedAt`, so a session that spans
 * midnight is credited to the day it started (matches user intuition
 * for "when did I practice today").
 */
function sessionStartMs(session: PracticeSession): number {
  return session.startedAt;
}

/**
 * Determine whether the session falls inside the given range window
 * relative to `now` (defaults to Date.now()).
 */
export function sessionInRange(
  session: PracticeSession,
  range: ReportsRange,
  now: number = Date.now(),
): boolean {
  const startMs = sessionStartMs(session);
  switch (range) {
    case "today":
      return startMs >= startOfLocalDay(now);
    case "week":
      return startMs >= startOfLocalWeek(now);
    case "month":
      return startMs >= startOfLocalMonth(now);
    case "30d":
      return startMs >= now - 30 * 24 * 60 * 60 * 1000;
    case "year":
      return startMs >= now - 365 * 24 * 60 * 60 * 1000;
    case "all-time":
      return true;
  }
}

/**
 * Filter the given sessions to those inside `range`. Callers usually
 * pass `[...history, ...(current ? [current] : [])]` so the live
 * session contributes to "today" bucketing.
 */
export function getSessionsInRange(
  sessions: readonly PracticeSession[],
  range: ReportsRange,
  now: number = Date.now(),
): PracticeSession[] {
  return sessions.filter((s) => sessionInRange(s, range, now));
}

/** Sum durationSec across every SessionItem in the sessions. */
export function totalSecondsInSessions(
  sessions: readonly PracticeSession[],
): number {
  let sum = 0;
  for (const s of sessions) {
    for (const item of s.items) sum += item.durationSec;
  }
  return sum;
}

/**
 * Group total practice seconds by local YYYY-MM-DD. Days with zero
 * practice are OMITTED — the daily-trend chart's caller fills gaps
 * with a full date range so the axis stays continuous.
 */
export function secondsByDay(
  sessions: readonly PracticeSession[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) {
    const key = localDayKey(sessionStartMs(s));
    let secs = 0;
    for (const item of s.items) secs += item.durationSec;
    out[key] = (out[key] ?? 0) + secs;
  }
  return out;
}

/** Group total practice seconds by category across the given sessions. */
export function secondsByCategory(
  sessions: readonly PracticeSession[],
): Record<CategoryId, number> {
  const out = {} as Record<CategoryId, number>;
  for (const s of sessions) {
    for (const item of s.items) {
      out[item.category] = (out[item.category] ?? 0) + item.durationSec;
    }
  }
  return out;
}

/** Group total practice seconds by module (Bass / Metronome / etc.). */
export function secondsByModule(
  sessions: readonly PracticeSession[],
): Record<PracticeModule, number> {
  const out = {} as Record<PracticeModule, number>;
  for (const s of sessions) {
    for (const item of s.items) {
      out[item.module] = (out[item.module] ?? 0) + item.durationSec;
    }
  }
  return out;
}

/**
 * Return every unique SessionItem entry (deduplicated across sessions)
 * for a given module + optional itemId filter. Useful for "how many
 * total minutes on drill X" style queries.
 */
export function itemsForModule(
  sessions: readonly PracticeSession[],
  module: PracticeModule,
): SessionItem[] {
  const out: SessionItem[] = [];
  for (const s of sessions) {
    for (const item of s.items) {
      if (item.module === module) out.push(item);
    }
  }
  return out;
}

/**
 * Aggregate seconds spent per saved-tool id within a module (ad-hoc
 * items collapse under the "adhoc" key). Feeds the Songs progress
 * panel + module-specific "top drills" lists.
 */
export function secondsByItemId(
  sessions: readonly PracticeSession[],
  module: PracticeModule,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) {
    for (const item of s.items) {
      if (item.module !== module) continue;
      const key = item.itemId ?? "adhoc";
      out[key] = (out[key] ?? 0) + item.durationSec;
    }
  }
  return out;
}

/**
 * How many practice days landed inside the range? Uses local day
 * bucketing so a session that starts at 11:55pm counts for that day.
 */
export function distinctPracticeDays(
  sessions: readonly PracticeSession[],
): number {
  const set = new Set<string>();
  for (const s of sessions) set.add(localDayKey(sessionStartMs(s)));
  return set.size;
}

/**
 * Sentinel key for practice time that can't be attributed to any
 * methodology — either ad-hoc use (no routine reference) or a
 * routine item that had no methodology set. Kept as a distinct
 * bucket rather than dropped so the chip's total matches the
 * range's real total time.
 */
export const NO_METHODOLOGY_KEY = "__none__" as const;

/**
 * Aggregate practice seconds by methodology across the given sessions.
 * Session items are resolved via their `routineItemId` — we walk the
 * provided routines to find each item, then read its `methodologyId`.
 * Items without a routine link (ad-hoc use) OR whose linked routine
 * item has no methodology set fall into `NO_METHODOLOGY_KEY`.
 *
 * Deleted routines: if a session references a routine item that no
 * longer exists, its time also falls into `NO_METHODOLOGY_KEY` (we
 * can't recover the methodology after deletion). Reasonable — the
 * user made a conscious deletion, so orphaned attribution goes to
 * the unattributed bucket.
 */
export function secondsByMethodology(
  sessions: readonly PracticeSession[],
  routines: readonly Routine[],
): Record<string, number> {
  // Build a lookup: routineItemId → methodologyId | undefined. One
  // pass over all routine items; O(items) total, cached across many
  // session lookups.
  const itemMethodMap = new Map<string, MethodologyId | undefined>();
  for (const r of routines) {
    for (const item of r.items) {
      itemMethodMap.set(item.id, item.methodologyId);
    }
  }

  const out: Record<string, number> = {};
  for (const s of sessions) {
    for (const item of s.items) {
      let key: string = NO_METHODOLOGY_KEY;
      if (item.routineItemId) {
        const m = itemMethodMap.get(item.routineItemId);
        if (m) key = m;
      }
      out[key] = (out[key] ?? 0) + item.durationSec;
    }
  }
  return out;
}
