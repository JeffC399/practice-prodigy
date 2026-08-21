import type { PracticeSession } from "./types";
import { localDayKey } from "./reports-queries";

/**
 * streak — Slice D.1 (Phase 118).
 *
 * Streak computation over `PracticeSession[]`. Everything runs in
 * the USER'S LOCAL TIME ZONE — a session that ended at 11:58pm and
 * one that started at 12:03am are two separate days for streak
 * purposes, matching what users intuitively count. All day keys are
 * `YYYY-MM-DD` strings via `toLocaleDateString("en-CA")`.
 *
 * ## What counts as a "practice day"?
 *
 * Any day where AT LEAST ONE SessionItem accumulated non-zero
 * `durationSec`. Zero-length items (e.g. user opened a drill but
 * never actually played) don't count. Prevents a stray click from
 * being credited as a full practice day.
 *
 * ## Current streak vs longest streak
 *
 *   - Current: consecutive practice days ending today OR yesterday
 *     (grace day for "haven't practiced yet today"). Once "today"
 *     is missed AND yesterday was missed → streak = 0.
 *   - Longest: max run of consecutive practice days anywhere in
 *     history.
 */

/**
 * Return the set of local YYYY-MM-DD strings where the user had
 * meaningful practice. Includes the live `current` session too when
 * provided — otherwise "today" wouldn't count until the session ended.
 */
export function practiceDaysSet(
  sessions: readonly PracticeSession[],
): Set<string> {
  const set = new Set<string>();
  for (const s of sessions) {
    let hasRealTime = false;
    for (const item of s.items) {
      if (item.durationSec > 0) {
        hasRealTime = true;
        break;
      }
    }
    if (hasRealTime) set.add(localDayKey(s.startedAt));
  }
  return set;
}

/** Local day key for the given moment. */
function todayKey(now: number = Date.now()): string {
  return localDayKey(now);
}

/** Local day key for one day before the given moment. */
function yesterdayKey(now: number = Date.now()): string {
  return localDayKey(now - 24 * 60 * 60 * 1000);
}

/**
 * Current streak = consecutive practice days ending at today or,
 * grace-day, yesterday. Returns 0 when the last practice day was
 * >= 2 days ago.
 *
 * @param daysSet output of `practiceDaysSet` (or an equivalent set)
 * @param now epoch ms for "now" — overridable for tests
 */
export function computeCurrentStreak(
  daysSet: ReadonlySet<string>,
  now: number = Date.now(),
): number {
  const today = todayKey(now);
  const yesterday = yesterdayKey(now);

  let cursor: string;
  if (daysSet.has(today)) {
    cursor = today;
  } else if (daysSet.has(yesterday)) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  let cursorMs = new Date(cursor).getTime();
  // Walk backwards one day at a time while the day is in the set.
  while (daysSet.has(localDayKey(cursorMs))) {
    streak += 1;
    cursorMs -= 24 * 60 * 60 * 1000;
  }
  return streak;
}

/**
 * Longest historical streak — max run of consecutive local days that
 * contain practice. Requires no "now" argument; purely a function of
 * the day set.
 */
export function computeLongestStreak(
  daysSet: ReadonlySet<string>,
): number {
  if (daysSet.size === 0) return 0;
  // Sort day keys chronologically. YYYY-MM-DD is lexicographically
  // sortable, so no Date parsing needed.
  const sorted = [...daysSet].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(sorted[i - 1]).getTime();
    const cur = new Date(sorted[i]).getTime();
    const diffDays = Math.round((cur - prev) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return longest;
}

/**
 * Convenience — return both streaks in one pass so the header chip
 * and Reports headline stats don't need two calls.
 */
export function computeStreaks(
  sessions: readonly PracticeSession[],
  now: number = Date.now(),
): { current: number; longest: number } {
  const days = practiceDaysSet(sessions);
  return {
    current: computeCurrentStreak(days, now),
    longest: computeLongestStreak(days),
  };
}
