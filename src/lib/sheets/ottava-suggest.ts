import type {
  SheetMeasure,
  SheetOctavaShift,
} from "@/lib/sheets/types";

/**
 * Phase 31.7 — Auto-detect out-of-range measures and suggest an
 * ottava marking that would bring them back near the treble staff.
 *
 * Rule of thumb (treble clef):
 *   - The staff itself spans E4 (MIDI 64) at the bottom line to
 *     F5 (MIDI 77) at the top line.
 *   - Comfortable range with a couple of ledger lines each side:
 *     roughly C4 (MIDI 60) up to C6 (MIDI 84).
 *   - Beyond that in either direction, an ottava marking is the
 *     standard engraving fix.
 *
 * Suggests:
 *   - `8va` when the measure's HIGHEST note lands above MIDI 84
 *     (i.e. above ~C6 — needs 3+ ledger lines above the staff).
 *   - `8vb` when the measure's LOWEST note lands below MIDI 55
 *     (i.e. below ~G3 — needs 3+ ledger lines below the staff).
 *   - `null` otherwise (or when the measure already has an
 *     `octavaShift` set — the user has already decided).
 *
 * Cheap enough to run on every render — no memoisation needed.
 */

const LETTER_TO_SEMITONE: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

function pitchToMidi(pitch: string): number | null {
  const slash = pitch.indexOf("/");
  if (slash < 0) return null;
  const letter = pitch[0]?.toLowerCase();
  const accidental = pitch[1];
  const octave = parseInt(pitch.slice(slash + 1), 10);
  if (!letter || Number.isNaN(octave)) return null;
  const base = LETTER_TO_SEMITONE[letter];
  if (base === undefined) return null;
  let semitone = base;
  if (accidental === "#") semitone += 1;
  else if (accidental === "b") semitone -= 1;
  return 12 * (octave + 1) + semitone;
}

const HIGH_THRESHOLD = 84; // above ~C6
const LOW_THRESHOLD = 55; // below ~G3

export function suggestOttavaForMeasure(
  measure: SheetMeasure,
): SheetOctavaShift | null {
  if (measure.octavaShift) return null;
  const melody = measure.melody ?? [];
  let hi = -Infinity;
  let lo = Infinity;
  let count = 0;
  for (const n of melody) {
    if (n.kind !== "note") continue;
    const midi = pitchToMidi(n.pitch);
    if (midi === null) continue;
    if (midi > hi) hi = midi;
    if (midi < lo) lo = midi;
    count++;
  }
  if (count === 0) return null;
  if (hi > HIGH_THRESHOLD) return "8va";
  if (lo < LOW_THRESHOLD) return "8vb";
  return null;
}
