import type {
  SheetMeasure,
  SheetOctavaShift,
} from "@/lib/sheets/types";

/**
 * Phase 31.7 — Auto-detect out-of-range measures and suggest an
 * ottava marking that would bring them back near the staff.
 *
 * Phase 32.2 — Clef-aware. The comfortable range for treble clef
 * is roughly MIDI 60-81 (C4 to A5); for bass clef it's MIDI 41-60
 * (F2 to C4). Thresholds shift down by ~20 semitones when the clef
 * is bass so the auto-ottava doesn't fire on notes that already
 * sit comfortably on the bass staff.
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

export type Clef = "treble" | "bass";

type Thresholds = {
  HIGH: number;
  LOW: number;
  HIGH_15: number;
  LOW_15: number;
  HIGH_RELEASE: number;
  LOW_RELEASE: number;
  HIGH_15_RELEASE: number;
  LOW_15_RELEASE: number;
};

const TREBLE: Thresholds = {
  // Comfortable range for treble: MIDI 60-81 (C4-A5).
  HIGH: 84, // stored > 84 -> apply 8va (display <= 72)
  LOW: 55, // stored < 55 -> apply 8vb (display >= 67)
  HIGH_15: 93, // stored > 93 -> apply 15ma
  LOW_15: 48, // stored < 48 -> apply 15mb
  HIGH_RELEASE: 79,
  LOW_RELEASE: 60,
  HIGH_15_RELEASE: 88,
  LOW_15_RELEASE: 53,
};

// Effectively-disabled sentinel — any real MIDI value is <= 127.
const NEVER = 9999;

const BASS: Thresholds = {
  // Comfortable range for bass: MIDI 41-60 (F2-C4). Notes on the
  // bass staff itself (G2=43 to A3=57) never trigger a shift.
  //
  // Auto-apply for HIGH shifts (8va / 15ma) is intentionally
  // DISABLED in bass clef. Reasons:
  //   1. A treble melody re-clef'd to bass would trigger 8va on
  //      every measure, drawing a messy bracket across the whole
  //      line that overlaps the chord row.
  //   2. Bass-clef instruments (cello, bassoon, low brass) routinely
  //      play notes with a few ledger lines above the staff without
  //      any ottava marking -- that's just how the notation reads.
  //   3. If the user genuinely wants 8va for a sustained high
  //      passage, they can apply it manually via the Measures list
  //      Ottava dropdown.
  //
  // LOW shifts still auto-apply because the visual clutter of many
  // ledger lines below the staff is worse, and 8vb / 15mb brackets
  // sit below the lyric band where they don't overlap anything.
  HIGH: NEVER,
  LOW: 40, // stored < 40 -> apply 8vb (display >= 52)
  HIGH_15: NEVER,
  LOW_15: 28, // stored < 28 -> apply 15mb
  HIGH_RELEASE: NEVER,
  LOW_RELEASE: 46,
  HIGH_15_RELEASE: NEVER,
  LOW_15_RELEASE: 34,
};

function thresholdsFor(clef: Clef | undefined): Thresholds {
  return clef === "bass" ? BASS : TREBLE;
}

/**
 * Compute the measure's stored-pitch MIDI range. Returns null when
 * the measure has no pitched notes.
 */
function measureMidiRange(
  measure: SheetMeasure,
): { hi: number; lo: number } | null {
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
  return { hi, lo };
}

/**
 * Manual "+ 8vb?" suggestion helper: returns a shift only for
 * measures that DON'T already have one and whose notes need it.
 */
export function suggestOttavaForMeasure(
  measure: SheetMeasure,
  clef: Clef | undefined = "treble",
): SheetOctavaShift | null {
  if (measure.octavaShift) return null;
  const range = measureMidiRange(measure);
  if (!range) return null;
  const t = thresholdsFor(clef);
  if (range.hi > t.HIGH_15) return "15ma";
  if (range.hi > t.HIGH) return "8va";
  if (range.lo < t.LOW_15) return "15mb";
  if (range.lo < t.LOW) return "8vb";
  return null;
}

/**
 * Automatic-mode helper: computes the "ideal" ottava for a measure
 * based purely on its stored notes AND the current clef, ignoring
 * the current shift. Returns `null` when the notes are comfortably
 * on the staff and don't warrant any shift.
 *
 * Uses HYSTERESIS: once a shift is present, the removal thresholds
 * are tighter than the application thresholds. Also supports
 * escalation (8vb → 15mb) and de-escalation (15mb → 8vb → none).
 */
export function computeIdealOttava(
  measure: SheetMeasure,
  clef: Clef | undefined = "treble",
): SheetOctavaShift | null {
  const range = measureMidiRange(measure);
  if (!range) return null;
  const current = measure.octavaShift;
  const t = thresholdsFor(clef);

  if (current === "8va") {
    if (range.hi > t.HIGH_15) return "15ma";
    return range.hi > t.HIGH_RELEASE ? "8va" : null;
  }
  if (current === "15ma") {
    if (range.hi > t.HIGH_15_RELEASE) return "15ma";
    if (range.hi > t.HIGH_RELEASE) return "8va";
    return null;
  }
  if (current === "8vb") {
    if (range.lo < t.LOW_15) return "15mb";
    return range.lo < t.LOW_RELEASE ? "8vb" : null;
  }
  if (current === "15mb") {
    if (range.lo < t.LOW_15_RELEASE) return "15mb";
    if (range.lo < t.LOW_RELEASE) return "8vb";
    return null;
  }
  // No shift currently — apply if the notes are outside the
  // application thresholds. Escalate straight to 15 when far out.
  if (range.hi > t.HIGH_15) return "15ma";
  if (range.hi > t.HIGH) return "8va";
  if (range.lo < t.LOW_15) return "15mb";
  if (range.lo < t.LOW) return "8vb";
  return null;
}
