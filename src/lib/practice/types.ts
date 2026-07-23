import type { CategoryId } from "./categories";

/**
 * Core practice-session types — Slice A.6 (Phase 86).
 *
 * Shared across the session tracker (A.6), module wire-ups (A.7–A.8),
 * category defaults (A.9), My Practice routine execution (Slice B),
 * and Reports (Slice D).
 *
 * See ROUTINE-DESIGN.md §5 for the auto-detection rules.
 */

/**
 * Which drilling / practicing surface produced the activity. Kept as
 * a closed union — every new module that participates in tracking
 * gets added here. Tuner is intentionally excluded (per plan §11
 * risk: "Session tracker fires on Tuner use").
 */
export type PracticeModule =
  | "arpeggios"
  | "key-sequencer"
  | "scale-driller"
  | "metronome"
  | "lsb-playback"
  | "my-practice";

/** Human-readable labels for modules (used in reports + session logs). */
export const PRACTICE_MODULE_LABELS: Record<PracticeModule, string> = {
  arpeggios: "Bass Arpeggios",
  "key-sequencer": "Key Sequencer",
  "scale-driller": "Scale Driller",
  metronome: "Metronome",
  "lsb-playback": "Lead Sheet playback",
  "my-practice": "My Practice",
};

/**
 * One row in a PracticeSession — a single tool/module the user
 * touched during the session. If the user practices Arpeggios drill
 * "Maj7 flow" for 8 min, then switches to Metronome for 4 min, the
 * session has TWO items. Switching back to Arpeggios "Maj7 flow"
 * within 5 min extends the SAME item (identified by
 * `${module}:${itemId ?? "adhoc"}`).
 */
export type SessionItem = {
  /** Composite key: `${module}:${itemId ?? "adhoc"}`. Stable across resumes. */
  id: string;
  module: PracticeModule;
  /**
   * Specific tool id when the user launched a saved drill / sheet /
   * routine item. `undefined` for ad-hoc use (e.g. bare Metronome).
   */
  itemId?: string;
  /**
   * Category attributed to this item. Comes from category-defaults
   * (module → default) unless the tool has its own override (Slice A.9+).
   */
  category: CategoryId;
  /** First activity report timestamp for this item, ms epoch. */
  startedAt: number;
  /** Most recent activity report timestamp for this item, ms epoch. */
  lastActivityAt: number;
  /**
   * Accumulated active time in seconds. Grows monotonically as long
   * as activity keeps flowing within the 5-min window. Read on
   * session-end for reports.
   */
  durationSec: number;
  /**
   * Routine-execution reference when this item came from a My Practice
   * routine run (Slice B). Absent for ad-hoc practice.
   */
  routineItemId?: string;
};

/**
 * A single continuous practice session. Starts on first activity;
 * ends after 5 min of inactivity (auto) or explicit user end.
 *
 * One session can contain many items across multiple modules. Reports
 * (Slice D) roll these up in various ways.
 */
export type PracticeSession = {
  /** Client-generated text id (`session_${base36}_${suffix}`). */
  id: string;
  /** Session-start = the FIRST activity report anywhere. ms epoch. */
  startedAt: number;
  /**
   * Session-end. `null` while the session is live; stamped when the
   * inactivity timer fires or the user explicitly ends the session.
   */
  endedAt: number | null;
  /** Ordered by first-touch time. */
  items: SessionItem[];
  /**
   * Routine execution reference when the whole session was launched
   * from My Practice (Slice B). Ad-hoc sessions leave this unset.
   */
  routineExecutionId?: string;
};

/**
 * Fresh session id generator. Uses the same `${prefix}_${base36}_${suffix}`
 * shape as every other collection store (see docs/SUPABASE-SCHEMA.md §1).
 */
export function newSessionId(): string {
  return `session_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Composite item id used to look up existing items when a module
 * reports repeated activity for the same tool.
 */
export function sessionItemKey(
  module: PracticeModule,
  itemId: string | undefined,
): string {
  return `${module}:${itemId ?? "adhoc"}`;
}
