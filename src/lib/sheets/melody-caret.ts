import type {
  MelodyDuration,
  MelodyNote,
  Sheet,
  SheetMeasure,
} from "@/lib/sheets/types";
import { MELODY_DURATION_BEATS } from "@/lib/sheets/types";

/**
 * Phase 25.1 — melody-entry caret helpers.
 *
 * The caret marks where the NEXT note will be inserted during
 * keyboard / click-on-staff melody entry. It tracks a measure index,
 * a beat offset within that measure, and a default octave used when
 * the user types a letter key without specifying octave.
 *
 * The model is intentionally linear (advance by `note.beatDuration`
 * per placement) rather than VexFlow-formatted-position-aware. The
 * pixel mapping of `beatOffset` → caret X is a linear interpolation
 * across the measure's note area. A future polish slice (25.2) can
 * refine this to use VexFlow's proportional spacing.
 */
export type MelodyCaret = {
  measureIdx: number;
  /** Beat offset within the measure: 0 = before beat 1, beatsPerMeasure = end. */
  beatOffset: number;
  /** Default octave used by A-G letter keys. */
  octave: number;
};

/** Beats for a note duration, with optional dotted modifier (×1.5). */
export function durationToBeats(
  duration: MelodyDuration,
  dotted?: boolean,
): number {
  const base = MELODY_DURATION_BEATS[duration] ?? 1;
  return dotted ? base * 1.5 : base;
}

/** Sum of beat durations of all notes currently in a measure. */
export function existingBeatsInMeasure(measure: SheetMeasure): number {
  return (measure.melody ?? []).reduce(
    (sum, n) => sum + durationToBeats(n.duration, n.dotted),
    0,
  );
}

/**
 * Default caret position for a measure: just after the last existing
 * note. For an empty measure, beatOffset is 0 (= before beat 1).
 */
export function caretAtEndOfMeasure(
  sheet: Sheet,
  measureIdx: number,
  octave = 4,
): MelodyCaret {
  const measure = sheet.measures[measureIdx];
  const beatOffset = measure ? existingBeatsInMeasure(measure) : 0;
  return { measureIdx, beatOffset, octave };
}

/**
 * Advance the caret by a number of beats. Crosses measure boundaries
 * as needed; clamps to the last measure if there's nowhere left to go.
 */
export function advanceCaret(
  caret: MelodyCaret,
  byBeats: number,
  sheet: Sheet,
): MelodyCaret {
  let newOffset = caret.beatOffset + byBeats;
  let newMeasure = caret.measureIdx;
  const measureBeats = sheet.timeSignature.beatsPerMeasure;
  while (newOffset >= measureBeats && newMeasure < sheet.measures.length - 1) {
    newOffset -= measureBeats;
    newMeasure += 1;
  }
  if (newMeasure >= sheet.measures.length - 1 && newOffset > measureBeats) {
    newOffset = measureBeats;
  }
  return { ...caret, measureIdx: newMeasure, beatOffset: newOffset };
}

/**
 * Retreat the caret by a number of beats. Crosses measure boundaries
 * as needed; clamps to 0 / first measure if there's nowhere left to go.
 */
export function retreatCaret(
  caret: MelodyCaret,
  byBeats: number,
  sheet: Sheet,
): MelodyCaret {
  let newOffset = caret.beatOffset - byBeats;
  let newMeasure = caret.measureIdx;
  const measureBeats = sheet.timeSignature.beatsPerMeasure;
  while (newOffset < 0 && newMeasure > 0) {
    newMeasure -= 1;
    newOffset += measureBeats;
  }
  if (newOffset < 0) newOffset = 0;
  return { ...caret, measureIdx: newMeasure, beatOffset: newOffset };
}

/** A-G letter to VexFlow pitch string at given octave. */
export function letterToPitch(letter: string, octave: number): string {
  return `${letter.toLowerCase()}/${octave}`;
}

/**
 * Nudge a pitch by one staff step (one letter). +1 = up (B → C goes to
 * next octave), -1 = down (C → B goes to previous octave).
 */
export function nudgePitch(pitch: string, direction: 1 | -1): string {
  const slash = pitch.indexOf("/");
  if (slash < 0) return pitch;
  const letter = pitch[0]?.toLowerCase();
  const octave = parseInt(pitch.slice(slash + 1), 10);
  if (!letter || Number.isNaN(octave)) return pitch;
  // Staff order ascending: c d e f g a b c'
  const cycle = ["c", "d", "e", "f", "g", "a", "b"];
  const idx = cycle.indexOf(letter);
  if (idx < 0) return pitch;
  let newIdx = idx + direction;
  let newOctave = octave;
  if (newIdx > 6) {
    newIdx = 0;
    newOctave += 1;
  } else if (newIdx < 0) {
    newIdx = 6;
    newOctave -= 1;
  }
  return `${cycle[newIdx]}/${newOctave}`;
}

/**
 * Update the LAST note in a measure's melody — returns a new measures
 * array. Used by Arrow-Up / Arrow-Down to nudge the most recently
 * placed note. Returns the existing measures unchanged if there's no
 * pitched note to nudge.
 */
export function nudgeLastNoteInMeasure(
  sheet: Sheet,
  measureIdx: number,
  direction: 1 | -1,
): Sheet["measures"] | null {
  const measure = sheet.measures[measureIdx];
  if (!measure) return null;
  const melody = measure.melody ?? [];
  if (melody.length === 0) return null;
  // Walk backward to find the last pitched note (skip rests).
  for (let i = melody.length - 1; i >= 0; i--) {
    const n = melody[i];
    if (n.kind === "note") {
      const newPitch = nudgePitch(n.pitch, direction);
      const next: MelodyNote[] = melody.map((m, j) =>
        j === i ? { ...n, pitch: newPitch } : m,
      );
      return sheet.measures.map((m, mi) =>
        mi === measureIdx ? { ...m, melody: next } : m,
      );
    }
  }
  return null;
}
