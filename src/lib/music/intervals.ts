import type { ChordQuality, PitchClass } from "./chord";

/**
 * Pure interval math for chord and scale construction.
 *
 * All intervals are expressed as semitone offsets from the root (0). We
 * deliberately hardcode these rather than reach for tonal.js — for the
 * v1 vocabulary this stays compact, explicit, and easy to audit against
 * standard music theory references.
 */

/** Pitch class → semitone offset from C. */
export const PITCH_CLASS_TO_SEMITONE: Record<PitchClass, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

/**
 * Chord tones as semitone offsets from the root, in order 1, 3, 5, (7),
 * (9, 11, 13...) when applicable. These are what gets played for the
 * 1-3-5-7 / 1-3-5-8 patterns.
 *
 * For altered dominants we model the bare chord tones (1, 3, 5, b7) and
 * let the SCALE_INTERVALS table carry the alterations — that keeps the
 * "play the chord tones" pattern stable across all dominant variants.
 */
export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  aug: [0, 4, 8],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  halfDim7: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  maj9: [0, 4, 7, 11],
  min9: [0, 3, 7, 10],
  dom9: [0, 4, 7, 10],
  dom13: [0, 4, 7, 10],
  dom7b9: [0, 4, 7, 10],
  dom7sharp9: [0, 4, 7, 10],
  dom7alt: [0, 4, 7, 10],
  dom7b5: [0, 4, 6, 10],
  dom7sharp5: [0, 4, 8, 10],
};

/**
 * Scale intervals as semitone offsets from the root. 7-note scales except
 * where noted. Used by the Scale Tones pattern (1..7 + octave) and the
 * Descending pattern (which needs the scale's 7th degree).
 */
export const SCALE_INTERVALS: Record<string, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  wholeTone: [0, 2, 4, 6, 8, 10], // 6 notes
  diminished: [0, 2, 3, 5, 6, 8, 9, 11], // whole-half (8 notes)
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  lydianDominant: [0, 2, 4, 6, 7, 9, 10],
  altered: [0, 1, 3, 4, 6, 8, 10],
};

/**
 * Default chord → scale mapping for v1, jazz-convention.
 * Per PROJECT-DESIGN.md §4.2: Maj7 → Lydian and m7 → Aeolian are
 * available as Advanced overrides post-v1; these are the system defaults.
 */
export const CHORD_DEFAULT_SCALE: Record<ChordQuality, string> = {
  maj: "ionian",
  min: "dorian",
  aug: "wholeTone",
  dom7: "mixolydian",
  min7: "dorian",
  maj7: "ionian",
  halfDim7: "locrian",
  dim7: "diminished",
  sus2: "ionian",
  sus4: "mixolydian",
  "7sus4": "mixolydian",
  maj9: "ionian",
  min9: "dorian",
  dom9: "mixolydian",
  dom13: "mixolydian",
  dom7b9: "phrygianDominant",
  dom7sharp9: "altered",
  dom7alt: "altered",
  dom7b5: "lydianDominant",
  dom7sharp5: "wholeTone",
};

/**
 * Compute the absolute MIDI note number for a (root, octave, semitoneOffset).
 * MIDI convention: C4 = 60, C0 = 12. So MIDI(C{octave}) = 12 * (octave + 1).
 */
export function semitoneToMidi(
  root: PitchClass,
  octave: number,
  semitoneOffset: number,
): number {
  const rootMidi = 12 * (octave + 1) + PITCH_CLASS_TO_SEMITONE[root];
  return rootMidi + semitoneOffset;
}
