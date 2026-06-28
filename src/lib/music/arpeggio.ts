import type { Chord } from "./chord";
import {
  CHORD_DEFAULT_SCALE,
  CHORD_INTERVALS,
  SCALE_INTERVALS,
  semitoneToMidi,
} from "./intervals";

/**
 * Arpeggio pattern generation.
 *
 * Each pattern produces an ordered list of MIDI note numbers to play for
 * a given chord. The four v1 patterns come from PROJECT-DESIGN.md §4.3.
 * Octave/register is auto-selected to keep notes in a comfortable middle
 * bass range (root anchored at octave 2 → typical notes around E2–C4).
 */

export const ARPEGGIO_PATTERNS = [
  "scale-tones",
  "arp-7ths",
  "triads-with-lt",
  "descending",
] as const;

export type ArpeggioPattern = (typeof ARPEGGIO_PATTERNS)[number];

export const ARPEGGIO_PATTERN_DISPLAY_NAMES: Record<ArpeggioPattern, string> =
  {
    "scale-tones": "Scale Tones (1–2–3–4–5–6–7–8)",
    "arp-7ths": "Arpeggiated 7ths (1–3–5–7)",
    "triads-with-lt": "Triads with Leading Tones (1–3–5–LT)",
    descending: "Descending (8–7–5–3)",
  };

/** Short labels for compact UI surfaces like the drill-screen header. */
export const ARPEGGIO_PATTERN_SHORT_NAMES: Record<ArpeggioPattern, string> = {
  "scale-tones": "Scale Tones",
  "arp-7ths": "Arp 7ths",
  "triads-with-lt": "Triads + LT",
  descending: "Descending",
};

export const ARPEGGIO_PATTERN_DESCRIPTIONS: Record<ArpeggioPattern, string> = {
  "scale-tones":
    "Eight notes ascending one octave through the chord's scale.",
  "arp-7ths":
    "Four chord tones (1-3-5-7). Triads default to 1-3-5-8 (octave).",
  "triads-with-lt":
    "Four notes: triad + leading tone (half-step below the next chord's root). Single-chord drills fall back to 1-3-5-8.",
  descending:
    "Four notes descending: octave, scale's 7th, chord's 5th, chord's 3rd.",
};

/**
 * Anchor the chord's root at octave 2 — sits comfortably in the middle
 * of a 4-string bass's range (E1–G4, with E2–C4 being the meat). Pattern
 * notes ascend or descend from there per the pattern definition.
 */
const ANCHOR_OCTAVE = 2;

/**
 * Generate the MIDI note sequence for a chord + pattern combination.
 */
export function generateArpeggio(
  chord: Chord,
  pattern: ArpeggioPattern,
): number[] {
  const chordTones = CHORD_INTERVALS[chord.quality];
  const scaleName = CHORD_DEFAULT_SCALE[chord.quality];
  const scaleTones = SCALE_INTERVALS[scaleName];

  switch (pattern) {
    case "scale-tones": {
      // 1, 2, 3, 4, 5, 6, 7, 8(=octave). Take the 7 scale tones, append 12.
      const offsets = [...scaleTones, 12];
      return offsets.map((o) =>
        semitoneToMidi(chord.root, ANCHOR_OCTAVE, o),
      );
    }

    case "arp-7ths": {
      // For chords with a 7th, play 1-3-5-7. For triads (no 7th in chord
      // tones), play 1-3-5-8 (octave) per §4.3 default.
      const hasSeventh = chordTones.length >= 4;
      const offsets = hasSeventh
        ? chordTones.slice(0, 4)
        : [...chordTones.slice(0, 3), 12];
      return offsets.map((o) =>
        semitoneToMidi(chord.root, ANCHOR_OCTAVE, o),
      );
    }

    case "triads-with-lt": {
      // Single-chord context → no "next chord" to derive LT from, so fall
      // back to 1-3-5-8 per §4.3. Multi-chord sequences will replace the
      // final note with the half-step-below-next-root LT.
      const offsets = [...chordTones.slice(0, 3), 12];
      return offsets.map((o) =>
        semitoneToMidi(chord.root, ANCHOR_OCTAVE, o),
      );
    }

    case "descending": {
      // 8 (octave), 7 (scale's 7th degree), 5 (chord's 5th), 3 (chord's 3rd).
      const scaleSeventh = scaleTones[6] ?? 11;
      const chordFifth = chordTones[2] ?? 7;
      const chordThird = chordTones[1] ?? 4;
      const offsets = [12, scaleSeventh, chordFifth, chordThird];
      return offsets.map((o) =>
        semitoneToMidi(chord.root, ANCHOR_OCTAVE, o),
      );
    }
  }
}
