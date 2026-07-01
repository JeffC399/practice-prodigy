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

const HIGH_THRESHOLD = 84; // above ~C6 -> apply 8va
const LOW_THRESHOLD = 55; // below ~G3 -> apply 8vb
// One-octave shift + still out of range → escalate to 15ma / 15mb.
// After a 12-semitone shift, the effective range is the raw range
// ±12. So if raw hi > (HIGH_THRESHOLD + 12) = 96, even 8va won't
// bring it in and we need 15ma.
const HIGH_15_THRESHOLD = 96; // above ~C7 -> apply 15ma
const LOW_15_THRESHOLD = 43; // below ~G2 -> apply 15mb
// Hysteresis: once a shift is applied, we don't remove it until the
// notes are well INSIDE the staff. Avoids flickering when a note
// hovers right at the threshold.
const HIGH_RELEASE = 79; // above ~G5 (top space)
const LOW_RELEASE = 60; // below ~C4 (middle C, one ledger line below)
const HIGH_15_RELEASE = 91; // above ~G6
const LOW_15_RELEASE = 48; // below ~C3

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
 * Phase 31.7 — the ORIGINAL suggestion helper: returns a shift only
 * for measures that DON'T already have one and whose notes need it.
 * Used by the manual "+ 8vb?" suggestion chip in the Measures list.
 */
export function suggestOttavaForMeasure(
  measure: SheetMeasure,
): SheetOctavaShift | null {
  if (measure.octavaShift) return null;
  const range = measureMidiRange(measure);
  if (!range) return null;
  if (range.hi > HIGH_15_THRESHOLD) return "15ma";
  if (range.hi > HIGH_THRESHOLD) return "8va";
  if (range.lo < LOW_15_THRESHOLD) return "15mb";
  if (range.lo < LOW_THRESHOLD) return "8vb";
  return null;
}

/**
 * Phase 31.7.1 — automatic-mode helper: computes the "ideal" ottava
 * for a measure based purely on its stored notes, ignoring the
 * current shift. Returns `null` when the notes are comfortably on
 * the staff and don't warrant any shift.
 *
 * Uses HYSTERESIS: once a shift is present, the removal thresholds
 * are TIGHTER (HIGH_RELEASE / LOW_RELEASE) than the application
 * thresholds. Prevents flickering when a note sits right at the
 * boundary and the user is editing back and forth.
 *
 * Used by the editor's auto-apply effect that keeps every measure's
 * ottava in sync with its note range.
 */
export function computeIdealOttava(
  measure: SheetMeasure,
): SheetOctavaShift | null {
  const range = measureMidiRange(measure);
  if (!range) return null;
  const current = measure.octavaShift;

  // Hysteresis on the current shift: keep it unless the range has
  // moved well INSIDE the release threshold. Also allow escalation
  // when notes have moved further out (e.g. 8vb → 15mb).
  if (current === "8va") {
    if (range.hi > HIGH_15_THRESHOLD) return "15ma"; // escalate
    return range.hi > HIGH_RELEASE ? "8va" : null;
  }
  if (current === "15ma") {
    // De-escalate to 8va once the top note is inside the 15-release
    // window but still above the 8va-release window.
    if (range.hi > HIGH_15_RELEASE) return "15ma";
    if (range.hi > HIGH_RELEASE) return "8va";
    return null;
  }
  if (current === "8vb") {
    if (range.lo < LOW_15_THRESHOLD) return "15mb"; // escalate
    return range.lo < LOW_RELEASE ? "8vb" : null;
  }
  if (current === "15mb") {
    if (range.lo < LOW_15_RELEASE) return "15mb";
    if (range.lo < LOW_RELEASE) return "8vb";
    return null;
  }
  // No shift currently — apply if the notes are outside the
  // application thresholds. Escalate straight to 15 when far out.
  if (range.hi > HIGH_15_THRESHOLD) return "15ma";
  if (range.hi > HIGH_THRESHOLD) return "8va";
  if (range.lo < LOW_15_THRESHOLD) return "15mb";
  if (range.lo < LOW_THRESHOLD) return "8vb";
  return null;
}
