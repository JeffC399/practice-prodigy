import type { Chord } from "./chord";
import type { OrderingStrategy } from "@/lib/state/practice-config";

/**
 * Sequence playback — given a chord pool, an ordering strategy, and a
 * measure number, return the chord that should be active.
 *
 * v1 ships all 8 strategies (PROJECT-DESIGN.md §4.4); this slice
 * implements only "custom" (the user's exact pool order). The other 7
 * are stubbed to defer to custom so the rest of the app (drill screen,
 * preview, NEXT badge) can already call `chordAtMeasure` against the
 * stable API; only this file changes when they land.
 */

/**
 * Which chord plays during a given measure of the playing portion.
 * Measure numbers are 1-indexed, matching the metronome engine's
 * `measureInSession`.
 */
export function chordAtMeasure(
  pool: Chord[],
  strategy: OrderingStrategy,
  measure: number,
  measuresPerChord: number = 1,
): Chord {
  if (pool.length === 0) {
    throw new Error("chordAtMeasure: empty chord pool");
  }
  const chordIndex = Math.floor((measure - 1) / measuresPerChord);
  return resolveChord(pool, strategy, chordIndex);
}

/**
 * Resolve which chord (by pool index after strategy application) plays
 * at sequence position N (zero-indexed).
 */
function resolveChord(
  pool: Chord[],
  strategy: OrderingStrategy,
  sequenceIndex: number,
): Chord {
  const positionInLoop = ((sequenceIndex % pool.length) + pool.length) %
    pool.length;
  switch (strategy) {
    case "custom":
      return pool[positionInLoop];
    case "chromaticAsc":
    case "chromaticDesc":
    case "cycleOf5ths":
    case "cycleOf4ths":
    case "randomReplace":
    case "randomShuffleOnce":
    case "randomShuffleEachPass":
      // TODO(next slice): implement these orderings.
      return pool[positionInLoop];
  }
}
