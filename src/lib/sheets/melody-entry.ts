import type { SheetMeasureRect } from "@/components/sheets/sheet-surface";
import type {
  MelodyDuration,
  MelodyNote,
  Sheet,
} from "@/lib/sheets/types";

/**
 * Phase 25 — click-on-staff melody entry helpers.
 *
 * Pure functions, no React. Maps click X / Y inside the SheetSurface
 * paper coord space to:
 *   - which measure was clicked
 *   - what pitch (VexFlow "letter/octave" string) the click Y maps to
 *
 * Plus a pure `appendMelodyNote` that returns a new measures array
 * with the new note tacked onto the end of the target measure.
 */

/** VexFlow letter cycle going DOWNWARD from F5 (the top staff line). */
const LETTER_CYCLE_DOWN_FROM_F5 = ["f", "e", "d", "c", "b", "a", "g"] as const;
const STAFF_STEP_PX = 5;

/**
 * Returns the measureIdx whose horizontal range contains `x`, or null
 * if the click was outside any measure's note area.
 */
export function measureAtX(
  measureRects: SheetMeasureRect[],
  x: number,
): number | null {
  for (const r of measureRects) {
    if (x >= r.noteStartX && x <= r.noteEndX) return r.measureIdx;
  }
  return null;
}

/**
 * Maps a click Y (in paper-div coord space) to a VexFlow pitch string
 * relative to the given measure's staff. Snaps to the nearest line or
 * space (5px = one staff step).
 *
 * Treble-clef step mapping (F5 = top line = step 0, going DOWN):
 *   0 → f/5      (top line)
 *   1 → e/5      (top space)
 *   2 → d/5      (4th line)
 *   3 → c/5      (3rd space)
 *   4 → b/4      (middle line)
 *   5 → a/4      (2nd space)
 *   6 → g/4      (2nd line)
 *   7 → f/4      (1st space)
 *   8 → e/4      (bottom line)
 *   9 → d/4      (1st space below)
 *   10 → c/4     (1st ledger line below = middle C)
 *   ...
 *
 * Step ABOVE F5 (clickY less than topLineY):
 *  -1 → g/5      (1st space above)
 *  -2 → a/5      (1st ledger line above)
 *  -3 → b/5
 *  -4 → c/6      (2nd ledger line above)
 *  ...
 */
export function pitchAtClickY(
  measure: SheetMeasureRect,
  clickY: number,
): string {
  const step = Math.round((clickY - measure.topLineY) / STAFF_STEP_PX);
  // Letter: 7-letter cycle modulo (with proper handling of negative
  // steps).
  const letterIdx = ((step % 7) + 7) % 7;
  const letter = LETTER_CYCLE_DOWN_FROM_F5[letterIdx];
  // Octave: F5 = 5. The boundary changes at step 3→4 (C5→B4 transition):
  //   step 0 (F5), 1 (E5), 2 (D5), 3 (C5) — octave 5
  //   step 4 (B4), 5 (A4), 6 (G4), 7 (F4), 8 (E4), 9 (D4), 10 (C4) — octave 4
  //   step 11 (B3) — octave 3
  // Formula: octave = 5 - floor((step + 3) / 7)
  const octave = 5 - Math.floor((step + 3) / 7);
  return `${letter}/${octave}`;
}

/**
 * Pure: returns a new measures array with a new note (or rest) appended
 * to measure[measureIdx]. Other measures are returned by reference.
 */
export function appendMelodyNote(
  sheet: Sheet,
  measureIdx: number,
  note: MelodyNote,
): Sheet["measures"] {
  return sheet.measures.map((m, mi) => {
    if (mi !== measureIdx) return m;
    const next = [...(m.melody ?? []), note];
    return { ...m, melody: next };
  });
}

/**
 * Build a fresh pitched MelodyNote from the side-panel state + the
 * resolved pitch.
 */
export function buildPitchedNote(
  pitch: string,
  duration: MelodyDuration,
  dotted: boolean,
): MelodyNote {
  return { kind: "note", pitch, duration, dotted };
}

/** Build a fresh rest MelodyNote from the side-panel state. */
export function buildRestNote(
  duration: MelodyDuration,
  dotted: boolean,
): MelodyNote {
  return { kind: "rest", duration, dotted };
}
