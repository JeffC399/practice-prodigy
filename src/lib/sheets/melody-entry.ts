import type { SheetMeasureRect } from "@/components/sheets/sheet-surface";
import type {
  MelodyDuration,
  MelodyNote,
  Sheet,
} from "@/lib/sheets/types";
import { MELODY_DURATION_BEATS } from "@/lib/sheets/types";

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

/** VexFlow letter cycle going DOWNWARD from F5 (treble top staff line). */
const LETTER_CYCLE_DOWN_FROM_F5 = ["f", "e", "d", "c", "b", "a", "g"] as const;
/** VexFlow letter cycle going DOWNWARD from A3 (bass top staff line). */
const LETTER_CYCLE_DOWN_FROM_A3 = ["a", "g", "f", "e", "d", "c", "b"] as const;
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
  clef: "treble" | "bass" = "treble",
): string {
  const step = Math.round((clickY - measure.topLineY) / STAFF_STEP_PX);
  const letterIdx = ((step % 7) + 7) % 7;
  if (clef === "bass") {
    // Bass clef step map (A3 = top line = step 0, going DOWN):
    //   0 (A3), 1 (G3), 2 (F3), 3 (E3), 4 (D3), 5 (C3) — octave 3
    //   6 (B2), 7 (A2), 8 (G2), 9 (F2), 10 (E2), 11 (D2), 12 (C2) — octave 2
    //   13 (B1) — octave 1
    // Octave decrement fires at c→b (steps 5→6). Formula:
    //   octave = 3 - floor((step + 1) / 7)
    const letter = LETTER_CYCLE_DOWN_FROM_A3[letterIdx];
    const octave = 3 - Math.floor((step + 1) / 7);
    return `${letter}/${octave}`;
  }
  // Treble clef step map (F5 = top line = step 0, going DOWN):
  //   0 (F5), 1 (E5), 2 (D5), 3 (C5) — octave 5
  //   4 (B4), 5 (A4), 6 (G4), 7 (F4), 8 (E4), 9 (D4), 10 (C4) — octave 4
  //   11 (B3) — octave 3
  const letter = LETTER_CYCLE_DOWN_FROM_F5[letterIdx];
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

/**
 * Phase 31.1 — greedy decomposition of a beat count into a list of
 * standard note durations (whole / half / quarter / 8th / 16th, plus
 * dotted variants). Used by `appendMelodyNoteWithSplit` to fit a
 * multi-beat note into a partial measure using multiple tied pieces.
 *
 * Returns pieces in descending duration order. Terminates when the
 * remaining beats fall below the 16th-note precision (0.25 beats);
 * any leftover is silently dropped (rare in practice — hits when
 * the user's rhythm value doesn't align with 16th-note precision).
 */
type NotePiece = { duration: MelodyDuration; dotted: boolean };

const DECOMPOSITION_OPTIONS: (NotePiece & { beats: number })[] = [
  { duration: "w", dotted: false, beats: MELODY_DURATION_BEATS.w },
  { duration: "h", dotted: true, beats: MELODY_DURATION_BEATS.h * 1.5 },
  { duration: "h", dotted: false, beats: MELODY_DURATION_BEATS.h },
  { duration: "q", dotted: true, beats: MELODY_DURATION_BEATS.q * 1.5 },
  { duration: "q", dotted: false, beats: MELODY_DURATION_BEATS.q },
  { duration: "8", dotted: true, beats: MELODY_DURATION_BEATS["8"] * 1.5 },
  { duration: "8", dotted: false, beats: MELODY_DURATION_BEATS["8"] },
  { duration: "16", dotted: true, beats: MELODY_DURATION_BEATS["16"] * 1.5 },
  { duration: "16", dotted: false, beats: MELODY_DURATION_BEATS["16"] },
];

const EPS = 1e-6;

export function decomposeBeatsIntoNotes(beats: number): NotePiece[] {
  const pieces: NotePiece[] = [];
  let remaining = beats;
  while (remaining >= 0.25 - EPS) {
    const opt = DECOMPOSITION_OPTIONS.find((o) => o.beats <= remaining + EPS);
    if (!opt) break;
    pieces.push({ duration: opt.duration, dotted: opt.dotted });
    remaining -= opt.beats;
  }
  return pieces;
}

function beatsForPiece(p: {
  duration: MelodyDuration;
  dotted?: boolean;
}): number {
  const base = MELODY_DURATION_BEATS[p.duration] ?? 1;
  return p.dotted ? base * 1.5 : base;
}

function measureUsedBeats(m: Sheet["measures"][number]): number {
  return (m.melody ?? []).reduce(
    (sum, n) =>
      sum +
      (MELODY_DURATION_BEATS[n.duration] ?? 1) * (n.dotted ? 1.5 : 1),
    0,
  );
}

/**
 * Phase 31.1 — Auto-splitting placement. Extends `appendMelodyNote`
 * by splitting the incoming note across measure boundaries when it
 * doesn't fit in the current measure. Emits tied pieces per standard
 * engraving convention. Only pitched notes tie; rests just distribute.
 *
 * Returns:
 *   - `measures`: the new measures array
 *   - `beatsPlaced`: total beats actually placed (may be less than
 *     requested if the sheet ran out of measures; the caller can
 *     decide whether to auto-add a new measure and retry)
 *
 * Handles the common cases only; does NOT auto-add measures at the
 * end of the sheet, and does not preserve the incoming note's
 * `slurGroup` / `tupletGroup` / `lyric` across the split (those get
 * attached to the FIRST piece only — the head of the tie chain — which
 * matches how professional engraving lays out lyrics and phrasing).
 */
/**
 * Phase 31.8 — Pad an under-filled measure with rests. Decomposes the
 * remaining beats via `decomposeBeatsIntoNotes` and appends one rest
 * per piece. Returns the original measures array unchanged when the
 * measure is already full or over-filled (we don't truncate — that's
 * destructive).
 */
export function padMeasureWithRests(
  sheet: Sheet,
  measureIdx: number,
): Sheet["measures"] {
  const m = sheet.measures[measureIdx];
  if (!m) return sheet.measures;
  const beatsPerMeasure = sheet.timeSignature.beatsPerMeasure;
  const used = (m.melody ?? []).reduce(
    (s, n) =>
      s + (MELODY_DURATION_BEATS[n.duration] ?? 1) * (n.dotted ? 1.5 : 1),
    0,
  );
  const remaining = beatsPerMeasure - used;
  if (remaining <= 0.001) return sheet.measures;
  const pieces = decomposeBeatsIntoNotes(remaining);
  if (pieces.length === 0) return sheet.measures;
  const newRests: MelodyNote[] = pieces.map((p) => ({
    kind: "rest" as const,
    duration: p.duration,
    dotted: p.dotted,
  }));
  return sheet.measures.map((mm, mi) =>
    mi === measureIdx
      ? { ...mm, melody: [...(mm.melody ?? []), ...newRests] }
      : mm,
  );
}

export function appendMelodyNoteWithSplit(
  sheet: Sheet,
  measureIdx: number,
  note: MelodyNote,
): { measures: Sheet["measures"]; beatsPlaced: number } {
  const beatsPerMeasure = sheet.timeSignature.beatsPerMeasure;
  const totalBeats = beatsForPiece(note);
  const isPitched = note.kind === "note";

  // Fast path: fits entirely in the current measure. Delegates to the
  // existing appendMelodyNote so we don't duplicate its map logic.
  const currentMeasure = sheet.measures[measureIdx];
  if (!currentMeasure) {
    return { measures: sheet.measures, beatsPlaced: 0 };
  }
  const remainingInCurrent =
    beatsPerMeasure - measureUsedBeats(currentMeasure);
  if (totalBeats <= remainingInCurrent + EPS) {
    return {
      measures: appendMelodyNote(sheet, measureIdx, note),
      beatsPlaced: totalBeats,
    };
  }

  // Slow path: split across measures with ties.
  const measures = [...sheet.measures];
  let remaining = totalBeats;
  let mi = measureIdx;
  let isFirstPiece = true;

  while (remaining > EPS && mi < measures.length) {
    const m = measures[mi];
    const capacity = beatsPerMeasure - measureUsedBeats(m);
    if (capacity <= EPS) {
      mi++;
      continue;
    }
    const fit = Math.min(remaining, capacity);
    const pieces = decomposeBeatsIntoNotes(fit);
    if (pieces.length === 0) break; // undecomposable remainder — bail
    // Determine which piece will be THE VERY LAST piece of the whole
    // split (last piece in this measure AND fit >= remaining). Only
    // the head lyric / groups attach to the FIRST piece; only the
    // very-last piece skips tieToNext.
    const newNotes: MelodyNote[] = pieces.map((p, pi) => {
      const isLastPieceInThisMeasure = pi === pieces.length - 1;
      const isVeryLastPieceOverall =
        isLastPieceInThisMeasure && fit >= remaining - EPS;
      if (isPitched) {
        const head = isFirstPiece && pi === 0;
        return {
          kind: "note" as const,
          pitch: note.pitch,
          duration: p.duration,
          dotted: p.dotted,
          tieToNext: !isVeryLastPieceOverall,
          ...(head && note.lyric ? { lyric: note.lyric } : {}),
          ...(head && note.slurGroup ? { slurGroup: note.slurGroup } : {}),
          ...(head && note.tupletGroup
            ? { tupletGroup: note.tupletGroup }
            : {}),
        };
      } else {
        // Rests never tie; but slurGroup / tupletGroup can carry.
        const head = isFirstPiece && pi === 0;
        return {
          kind: "rest" as const,
          duration: p.duration,
          dotted: p.dotted,
          ...(head && note.slurGroup ? { slurGroup: note.slurGroup } : {}),
          ...(head && note.tupletGroup
            ? { tupletGroup: note.tupletGroup }
            : {}),
        };
      }
    });
    measures[mi] = { ...m, melody: [...(m.melody ?? []), ...newNotes] };
    remaining -= fit;
    mi++;
    isFirstPiece = false;
  }

  return { measures, beatsPlaced: totalBeats - remaining };
}
