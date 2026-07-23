import type { CategoryId } from "./categories";

/**
 * Self-rated proficiency levels — Slice A.14 (Phase 95).
 *
 * User rates their own competence per category on a 1–5 scale (or
 * marks a category "N/A" to opt out entirely). Users can set an
 * optional target level per category as an aspiration.
 *
 * Full design in ROUTINE-DESIGN.md §4.3. v1 is entirely self-rated;
 * automated grading is deferred to v2 (see MY-PRACTICE-V2-BACKLOG.md).
 *
 * The five levels + N/A opt-out:
 *   Level 1 · Exploring   — Just starting; still learning what this
 *                            category even is.
 *   Level 2 · Developing  — Working on the basics; can do some things
 *                            but with effort.
 *   Level 3 · Comfortable — Basics are fluent; can handle standard
 *                            challenges.
 *   Level 4 · Fluent      — Solid intermediate → advanced; handles
 *                            most challenges you meet.
 *   Level 5 · Teaching    — Advanced; could clearly explain / teach
 *                            this to another musician.
 *   N/A                    — Not applicable to me. Hides from AI Coach
 *                            + prompts.
 *
 * Numeric identifier is the anchor per ROUTINE-DESIGN.md — deltas
 * read cleanly ("Level 2 → Level 3"), scales past v1 without a
 * naming crisis, and stays language-independent.
 */

/** Numeric level identifier (1–5) or explicit N/A opt-out. */
export type ProficiencyLevel = 1 | 2 | 3 | 4 | 5 | "n/a";

/** Ordered list of assignable levels for iteration in UI. */
export const PROFICIENCY_LEVELS: readonly ProficiencyLevel[] = [
  1,
  2,
  3,
  4,
  5,
  "n/a",
] as const;

/** Numeric-only subset (excludes N/A). Used where a delta is meaningful. */
export const NUMERIC_LEVELS: readonly (1 | 2 | 3 | 4 | 5)[] = [
  1, 2, 3, 4, 5,
] as const;

export const PROFICIENCY_LEVEL_DESCRIPTORS: Record<ProficiencyLevel, string> = {
  1: "Exploring",
  2: "Developing",
  3: "Comfortable",
  4: "Fluent",
  5: "Teaching",
  "n/a": "Not applicable",
};

export const PROFICIENCY_LEVEL_DESCRIPTIONS: Record<ProficiencyLevel, string> = {
  1: "Just starting; still learning what this category even is.",
  2: "Working on the basics; can do some things but with effort.",
  3: "Basics are fluent; can handle standard-level challenges.",
  4: "Solid intermediate to advanced; can handle most challenges you meet.",
  5: "Advanced; could clearly explain and teach this to another musician.",
  "n/a": "Not applicable to me right now. Hides from AI Coach and prompts.",
};

/** Per-category proficiency record — one entry per user-rated category. */
export type CategoryProficiency = {
  /** The category this rating applies to. */
  categoryId: CategoryId;
  /** User's current self-rating. */
  current: ProficiencyLevel;
  /**
   * Optional aspiration. Pure aspiration; app never enforces it.
   * AI Coach uses current-vs-target gap to weight routines toward
   * gaps. Not applicable when `current === "n/a"`.
   */
  target?: 1 | 2 | 3 | 4 | 5;
  /** Last time the user touched this rating (ms epoch). */
  updatedAt: number;
};

/**
 * A single change to a category's level, appended to a rolling log
 * so Reports can render progression narratives:
 *
 *   "Ear Training: Level 2 → Level 3 · Sep 12"
 *
 * Kept as an append-only list rather than an in-place field so we
 * can show trajectories over time without additional queries.
 */
export type LevelChangeLogEntry = {
  categoryId: CategoryId;
  from: ProficiencyLevel;
  to: ProficiencyLevel;
  at: number;
};

/**
 * Format a level for display: numeric identifier + descriptor
 * separated by a bullet. N/A skips the number.
 *
 *   formatLevel(3)      → "Level 3 · Comfortable"
 *   formatLevel("n/a")  → "Not applicable"
 */
export function formatLevel(level: ProficiencyLevel): string {
  if (level === "n/a") return "Not applicable";
  return `Level ${level} · ${PROFICIENCY_LEVEL_DESCRIPTORS[level]}`;
}

/**
 * Return the level delta as a signed integer, or null when either
 * side is N/A (delta undefined for opt-out state).
 */
export function levelDelta(
  from: ProficiencyLevel,
  to: ProficiencyLevel,
): number | null {
  if (from === "n/a" || to === "n/a") return null;
  return to - from;
}
