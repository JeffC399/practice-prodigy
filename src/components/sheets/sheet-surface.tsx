"use client";

import { useEffect, useRef } from "react";
import {
  Barline,
  Beam,
  Curve,
  Dot,
  Formatter,
  Renderer,
  Repetition,
  Stave,
  StaveNote,
  StaveTie,
  Tuplet,
  Voice,
} from "vexflow";
import type { PitchClass } from "@/lib/music/chord";
import { renderChord } from "@/lib/music/render-chord";
import type {
  MelodyNote,
  Sheet,
  SheetMeasure,
  SheetOctavaShift,
} from "@/lib/sheets/types";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * Lead-sheet "paper" surface (Phase 24b.3 visual rework, Phase 24c
 * lyric pass).
 *
 * Renders a Sheet as a multi-line continuous staff on a light paper
 * background, following standard engraving conventions:
 *   - Clef + key signature at the start of every line
 *   - Time signature only on the first line (per piece)
 *   - Single barlines between measures; final barline at the very end
 *   - Chord symbols positioned directly above each measure
 *   - Measure-number label above the first measure of each line
 *   - Serif title block (title centered, style top-left, composer top-right)
 *   - Phase 24c: lyric syllables rendered below the staff (serif).
 *     Trailing dash for hyphen continuation; horizontal line for
 *     underscore (melisma) continuation, within-measure scope.
 *
 * Replaces the previous one-measure-per-card grid. The single-measure
 * `<MelodyStaff>` component is retained for the in-modal preview where
 * a single-measure render is what the user is editing.
 *
 * Lyric editing layer: when `onLayout` is supplied, the renderer fires
 * a callback after each draw with the pixel positions of every melody
 * note in the sheet (in the paper's coordinate space). The editor uses
 * these positions to overlay a floating lyric input and click regions.
 */

/** One note's pixel position within the paper-div coord space. */
export type SheetNotePosition = {
  measureIdx: number;
  noteIdx: number;
  /** Center X of the note glyph within the paper div. */
  x: number;
  /** Center Y of the note (used for click-region centering). */
  y: number;
  /** Stave bottom Y — anchor for the lyric band below. */
  staffBottomY: number;
  /** Approximate hit-region width (px). */
  width: number;
  /** True for pitched notes; false for rests. */
  isPitched: boolean;
};

/**
 * Phase 25 — per-measure pixel rect within the paper-div coord space.
 * Used by the click-on-staff melody-entry overlay to map click X → which
 * measure was clicked, and click Y → pitch via the topLineY anchor.
 */
export type SheetMeasureRect = {
  measureIdx: number;
  /** Note-area X start (after clef/keysig/timesig for first-of-line measures). */
  noteStartX: number;
  /** Note-area X end (before the right barline). */
  noteEndX: number;
  /** Stave top Y. */
  staveTopY: number;
  /** Y of the top staff line (F5 in treble clef). Used for pitch math. */
  topLineY: number;
  /** Y of the bottom staff line (E4 in treble clef). */
  bottomLineY: number;
};

export type SheetSurfaceLayout = {
  positions: SheetNotePosition[];
  /** Phase 25: per-measure rects for click-on-staff overlay. */
  measureRects: SheetMeasureRect[];
  paperWidth: number;
  paperHeight: number;
};

export type SheetSurfaceProps = {
  sheet: Sheet;
  /** Width of the rendered paper in px. */
  width?: number;
  /** Measures per line — default 4 (jazz-lead-sheet convention). */
  measuresPerLine?: number;
  /**
   * Fires after each render with per-note pixel positions. Used by the
   * editor's lyric-mode overlay to position click regions + the
   * floating input. Undefined in pure-view contexts (view page, print).
   */
  onLayout?: (layout: SheetSurfaceLayout) => void;
};

/**
 * Phase 24c.2: standardized US Letter paper dimensions for WYSIWYG —
 * what renders on screen matches what prints. CSS pixels are defined
 * as 1/96 of an inch, so:
 *   - Letter page: 8.5" × 11" = 816 × 1056 px
 *   - Margins: 0.75" each side = 72 px
 *   - Content area: 7" × 9.5" = 672 × 912 px
 *
 * SheetSurface defaults to PAPER_WIDTH_LETTER (callers can override
 * for A4 etc. in a future phase). The paper div is forced to these
 * dimensions regardless of content height so the user always sees
 * "the whole page" while authoring.
 */
const PAPER_WIDTH_LETTER = 816;
const PAPER_HEIGHT_LETTER = 1056;
const PAGE_MARGIN = 72;
const PAPER_PADDING_X = PAGE_MARGIN;
const PAPER_PADDING_Y = PAGE_MARGIN;
const LINE_GAP = 14;
/**
 * Phase 24c.1: chord band shrunk from 22 → 18 (chord text + measure
 * number fits in less vertical space; less empty whitespace between
 * chord row and staff).
 */
const CHORD_BAND_HEIGHT = 18;
const STAVE_GAP_TOP = 6;
const STAVE_HEIGHT = 78;
/**
 * Phase 24c.1: lyric band bumped 22 → 34 so syllables clear the bottom
 * of note glyphs + stems extending below the staff. Pairs with the
 * larger LYRIC_BASELINE_OFFSET below.
 * Phase 24c.1.1: further bumped 34 → 42 after a residual collision
 * between low-pitch eighth notes' stem flags and the top of lyric
 * letters showed up in production.
 */
const LYRIC_BAND_HEIGHT = 42;
const LINE_HEIGHT =
  CHORD_BAND_HEIGHT + STAVE_GAP_TOP + STAVE_HEIGHT + LYRIC_BAND_HEIGHT;

// Approximate overhead widths used to apportion measure note-areas
// before VexFlow has drawn. Actual VexFlow widths may differ a few px;
// we trade pixel-perfect alignment for synchronous layout.
const CLEF_PX = 30;
const KEY_SIG_PX_PER_ACCIDENTAL = 9;
const TIME_SIG_PX = 28;
const MIN_MEASURE_NOTE_WIDTH = 110;

/**
 * Vertical offset from staff bottom to lyric text baseline.
 * Phase 24c.1: 16 → 26 (the 16px offset was being eaten by stems
 * extending below the staff and ledger lines on low notes, causing
 * lyric collisions with the note glyphs).
 * Phase 24c.1.1: 26 → 34 after a residual stem-flag collision on
 * low-pitch eighth notes survived the first bump.
 */
const LYRIC_BASELINE_OFFSET = 34;
/** Vertical extra padding for the click region below the staff. */
const NOTE_HIT_REGION_HEIGHT = 44;
/**
 * Right-side canvas padding so the END barline glyph (double-bar) at
 * the very end of the last measure of the last line doesn't get
 * clipped by the SVG canvas right edge. Phase 24c.1 fix.
 */
const CANVAS_RIGHT_PADDING = 16;
/**
 * Approximate baseline-to-baseline distance for one staff step (one
 * line or one space). VexFlow's staff lines are 10px apart, so one
 * step (line-to-space or space-to-line) is 5px.
 */
const STAFF_STEP_PX = 5;

const KEY_SPEC_MAJOR: Record<PitchClass, string> = {
  C: "C",
  "C#": "C#",
  D: "D",
  "D#": "Eb", // enharmonic — D# major isn't a standard key signature
  E: "E",
  F: "F",
  "F#": "F#",
  G: "G",
  "G#": "Ab", // enharmonic
  A: "A",
  "A#": "Bb", // enharmonic
  B: "B",
};

const KEY_SPEC_MINOR: Record<PitchClass, string> = {
  C: "Cm",
  "C#": "C#m",
  D: "Dm",
  "D#": "D#m",
  E: "Em",
  F: "Fm",
  "F#": "F#m",
  G: "Gm",
  "G#": "G#m",
  A: "Am",
  "A#": "Bbm", // enharmonic — A# minor would be 7 sharps incl. double-sharp
  B: "Bm",
};

function vexKeySpec(
  tonic: PitchClass,
  mode: "major" | "minor",
): string {
  return mode === "minor" ? KEY_SPEC_MINOR[tonic] : KEY_SPEC_MAJOR[tonic];
}

const ACCIDENTAL_COUNT: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  "F#": 6,
  "C#": 7,
  F: 1,
  Bb: 2,
  Eb: 3,
  Ab: 4,
  Db: 5,
  Gb: 6,
  Cb: 7,
};

function accidentalCount(spec: string): number {
  const key = spec.endsWith("m") ? spec.slice(0, -1) : spec;
  return ACCIDENTAL_COUNT[key] ?? 0;
}

/**
 * Phase 30.3 — apply an ottava shift to a VexFlow pitch string for
 * DISPLAY purposes. `8va` written above notes means "sound one octave
 * higher than written," so a note stored at its sounding pitch is
 * drawn one octave LOWER on the staff. `8vb` is the mirror. Returns
 * the original string unchanged when `shift` is undefined or the pitch
 * doesn't parse.
 */
function applyOctavaShiftToPitch(
  pitch: string,
  shift: SheetOctavaShift | undefined,
): string {
  if (!shift) return pitch;
  const slash = pitch.lastIndexOf("/");
  if (slash < 0) return pitch;
  const letter = pitch.slice(0, slash);
  const octaveNum = parseInt(pitch.slice(slash + 1), 10);
  if (Number.isNaN(octaveNum)) return pitch;
  // 8va / 8vb shift by 1 octave; 15ma / 15mb shift by 2 octaves.
  // Sign matches the "sounding is above/below written" semantics:
  // shift-DOWN in display for `va` variants, shift-UP for `vb`.
  const octaveDelta =
    shift === "8va" ? -1 : shift === "8vb" ? 1 : shift === "15ma" ? -2 : 2;
  return `${letter}/${octaveNum + octaveDelta}`;
}

/**
 * Phase 30.3 — return a display version of a measure's melody where
 * every pitched note's pitch is shifted per the measure's ottava
 * setting. Rests are unchanged. When `shift` is undefined this is a
 * no-op that returns the same array reference.
 */
function melodyForDisplay(
  melody: MelodyNote[],
  shift: SheetOctavaShift | undefined,
): MelodyNote[] {
  if (!shift) return melody;
  return melody.map((n) =>
    n.kind === "note"
      ? { ...n, pitch: applyOctavaShiftToPitch(n.pitch, shift) }
      : n,
  );
}

function buildStaveNotesForMelody(
  melody: MelodyNote[],
  clef: "treble" | "bass" = "treble",
): StaveNote[] {
  // Rests need to sit visually IN the middle of the staff regardless
  // of clef. Treble middle line = B4 ("b/4"); bass middle line = D3
  // ("d/3"). Without this per-clef adjustment, rests would drift up
  // or down when switching clefs.
  const restKey = clef === "bass" ? "d/3" : "b/4";
  return melody.map((n) => {
    if (n.kind === "rest") {
      const note = new StaveNote({
        keys: [restKey],
        duration: `${n.duration}r`,
        clef,
      });
      if (n.dotted) Dot.buildAndAttach([note], { all: true });
      return note;
    }
    // Phase 32.2.2 — pass the clef so VexFlow places the note at
    // the correct absolute pitch position for that clef. Without
    // this, "f/4" would sit at the treble F4 Y coordinate even
    // when drawn on a bass stave, so it visually read as "A" (bass
    // clef's bottom-space pitch at that Y).
    const note = new StaveNote({
      keys: [n.pitch],
      duration: n.duration,
      clef,
    });
    if (n.dotted) Dot.buildAndAttach([note], { all: true });
    return note;
  });
}

function collectTuplets(
  melody: MelodyNote[],
  staveNotes: StaveNote[],
): Tuplet[] {
  const tuplets: Tuplet[] = [];
  let i = 0;
  while (i < melody.length) {
    const groupId = melody[i].tupletGroup;
    if (!groupId) {
      i++;
      continue;
    }
    let j = i;
    while (j < melody.length && melody[j].tupletGroup === groupId) j++;
    const runNotes = staveNotes.slice(i, j);
    if (runNotes.length >= 2) {
      const tuplet = new Tuplet(runNotes, {
        numNotes: runNotes.length,
        notesOccupied: Math.pow(
          2,
          Math.floor(Math.log2(runNotes.length)),
        ),
        // Force the numeral to sit above the notes; default location is
        // direction-dependent and was rendering below-staff (and off-
        // canvas) for ascending lines with stem-up beams.
        location: Tuplet.LOCATION_TOP,
        bracketed: true,
      });
      tuplets.push(tuplet);
    }
    i = j;
  }
  return tuplets;
}

/**
 * VexFlow pitch ("c/4", "f#/5", "bb/3", …) → staff steps above the top
 * staff line of treble clef (F5 = step 0). Each integer step = one
 * half of a staff space = 5px of vertical staff travel.
 *
 *   F5 → 0 (top line)
 *   G5 → 1 (space above)
 *   A5 → 2 (1st ledger line above)
 *   B5 → 3
 *   C6 → 4 (2nd ledger line above)
 *   D6 → 5
 *   E6 → 6 (3rd ledger line above)
 *
 * Negative for pitches on or below the top line.
 */
function pitchStepsAboveTopLine(pitch: string): number {
  const slash = pitch.indexOf("/");
  if (slash < 0) return 0;
  const letter = pitch[0]?.toLowerCase();
  const octave = parseInt(pitch.slice(slash + 1), 10);
  if (!letter || Number.isNaN(octave)) return 0;
  const letterIdx = "cdefgab".indexOf(letter);
  if (letterIdx < 0) return 0;
  // C4 → 0, D4 → 1, …, B4 → 6, C5 → 7, …
  const totalStepsFromC4 = (octave - 4) * 7 + letterIdx;
  // F5 → (5-4)*7 + 3 = 10
  return totalStepsFromC4 - 10;
}

/**
 * Phase 24c.1: ledger-line-aware chord-Y push-up.
 *
 * Walks every pitched note in the given measures (one line's worth)
 * and finds the highest pitch above the top staff line. Returns the
 * extra vertical pixels to push chord symbols UP across the whole
 * line so they don't collide with high notes / ledger lines.
 *
 * Per-line (not per-measure) so the chord row stays visually aligned
 * across the line — standard engraving convention.
 */
function chordPushUpForLine(measures: SheetMeasure[]): number {
  let maxSteps = 0;
  for (const m of measures) {
    for (const n of m.melody ?? []) {
      if (n.kind !== "note") continue;
      const steps = pitchStepsAboveTopLine(n.pitch);
      if (steps > maxSteps) maxSteps = steps;
    }
  }
  if (maxSteps <= 0) return 0;
  // Each step above the top line = 5px of vertical staff travel. Add
  // 6px headroom so the chord clears note heads / ledger glyphs.
  return maxSteps * STAFF_STEP_PX + 6;
}

function collectTies(
  melody: MelodyNote[],
  staveNotes: StaveNote[],
): StaveTie[] {
  const ties: StaveTie[] = [];
  for (let k = 0; k < melody.length - 1; k++) {
    const cur = melody[k];
    if (cur.kind !== "note" || !cur.tieToNext) continue;
    const next = melody[k + 1];
    if (next.kind === "note" && next.pitch === cur.pitch) {
      ties.push(
        new StaveTie({
          firstNote: staveNotes[k],
          lastNote: staveNotes[k + 1],
          firstIndexes: [0],
          lastIndexes: [0],
        }),
      );
    }
  }
  return ties;
}

/**
 * Phase 29.1 — collect intra-measure slurs. Walk the melody looking
 * for contiguous runs of same-`slurGroup` notes and emit one VexFlow
 * `Curve` per run of 2+ notes. Cross-measure slurs render as one
 * Curve per measure segment (each measure's chunk of the group draws
 * its own arc); a proper multi-measure slur coordinator lands later
 * if tester feedback demands it.
 */
function collectSlurs(
  melody: MelodyNote[],
  staveNotes: StaveNote[],
): Curve[] {
  const slurs: Curve[] = [];
  let k = 0;
  while (k < melody.length) {
    const groupId = melody[k].slurGroup;
    if (!groupId) {
      k++;
      continue;
    }
    const runStart = k;
    while (k < melody.length && melody[k].slurGroup === groupId) {
      k++;
    }
    const runEnd = k - 1;
    if (runEnd > runStart) {
      slurs.push(
        new Curve(staveNotes[runStart], staveNotes[runEnd], {
          cps: [
            { x: 0, y: 15 },
            { x: 0, y: 15 },
          ],
          thickness: 2,
          position: Curve.Position.NEAR_HEAD,
          positionEnd: Curve.Position.NEAR_HEAD,
          invert: false,
        }),
      );
    }
  }
  return slurs;
}

export function SheetSurface({
  sheet,
  width = PAPER_WIDTH_LETTER,
  measuresPerLine = 4,
  onLayout,
}: SheetSurfaceProps) {
  const musicRef = useRef<HTMLDivElement>(null);
  const notationStyle = useUserPrefs((s) => s.notationDefault);
  /**
   * Phase 25.0.2 — font family family selector. "standard" uses the
   * classic serif Georgia/Times engraving; "handwritten" uses Patrick
   * Hand for a Real Book / iReal Pro vibe. Lyrics, chord symbols, and
   * the title block all switch together so the whole page reads with
   * one aesthetic voice.
   */
  const fontStyle = sheet.fontStyle ?? "standard";
  const titleFont =
    fontStyle === "handwritten"
      ? "var(--font-patrick-hand), 'Patrick Hand', cursive"
      : "Georgia, 'Times New Roman', serif";
  const chordFont =
    fontStyle === "handwritten"
      ? "'Patrick Hand', cursive"
      : "Georgia, 'Times New Roman', serif";
  const lyricFont =
    fontStyle === "handwritten"
      ? "'Patrick Hand', cursive"
      : "Georgia, 'Times New Roman', serif";
  // Patrick Hand reads slightly narrower than Georgia bold at the same
  // nominal size — bump rendered point sizes a touch for readability,
  // but not as aggressively as v0 (chord 18 → 16, lyric 14 → 13) so
  // the chart still reads as a "tight real chart" rather than oversized.
  const chordSize = fontStyle === "handwritten" ? 16 : 14;
  const lyricSize = fontStyle === "handwritten" ? 13 : 11;

  useEffect(() => {
    if (!musicRef.current) return;
    musicRef.current.innerHTML = "";

    const keySpec = vexKeySpec(sheet.keyTonic, sheet.keyMode);
    const keyAccidentalPx =
      accidentalCount(keySpec) * KEY_SIG_PX_PER_ACCIDENTAL;

    // Split measures into lines of N (default 4).
    const lines: SheetMeasure[][] = [];
    for (let i = 0; i < sheet.measures.length; i += measuresPerLine) {
      lines.push(sheet.measures.slice(i, i + measuresPerLine));
    }
    if (lines.length === 0) return;

    const contentWidth = width - PAPER_PADDING_X * 2;

    // Phase 24c.1: per-line chord-pushup means lines can have variable
    // heights. Pre-compute pushups + lineYs so the renderer + total
    // height stay in sync.
    const linePushUps = lines.map(chordPushUpForLine);
    const lineYs: number[] = [];
    {
      let y = 0;
      for (let i = 0; i < lines.length; i++) {
        lineYs.push(y);
        y += LINE_HEIGHT + linePushUps[i] + LINE_GAP;
      }
    }
    const totalHeight =
      (lineYs[lineYs.length - 1] ?? 0) +
      LINE_HEIGHT +
      (linePushUps[linePushUps.length - 1] ?? 0) +
      24;

    const renderer = new Renderer(
      musicRef.current,
      Renderer.Backends.SVG,
    );
    // Phase 24c.1: add right-side canvas padding so the END barline's
    // outer line glyph isn't clipped by the SVG canvas edge.
    renderer.resize(contentWidth + CANVAS_RIGHT_PADDING, totalHeight);
    const ctx = renderer.getContext();

    /** Local pixel positions in the music-ref coord space — translated
     *  to paper-div space at the end before firing `onLayout`. */
    const localPositions: Array<
      SheetNotePosition & { _measureFirstIdx: number }
    > = [];
    /** Phase 25: per-measure rects, also in music-ref coord space until
     *  translation. Used by the click-on-staff overlay. */
    const localMeasureRects: SheetMeasureRect[] = [];

    /**
     * Phase 29 — Cross-measure tie tracker. Persists across measures
     * AND across line boundaries so a tie from the last note of
     * measure N to the first same-pitch note of measure N+1 draws
     * even when they're on different lines.
     *
     *   `outgoingNote` non-null: measure N is on the current line; the
     *   next matching note in this line draws a full arc.
     *   `outgoingNote` null: measure N was on the PREVIOUS line; its
     *   outgoing half-arc has already been drawn. The next matching
     *   note draws only the incoming half-arc.
     */
    let pendingCrossMeasureTie: {
      pitch: string;
      outgoingNote: StaveNote | null;
    } | null = null;

    // Phase 33 — Track the previously rendered clef across measures
    // AND across line boundaries. Used to decide whether a mid-line
    // clef change needs to draw a new clef glyph. First-of-line
    // measures always draw their clef.
    let previousRenderedClef: "treble" | "bass" =
      sheet.clef ?? "treble";
    const defaultClef: "treble" | "bass" = sheet.clef ?? "treble";

    lines.forEach((lineMeasures, lineIdx) => {
      const showTimeSig = lineIdx === 0;
      const isLastLine = lineIdx === lines.length - 1;
      const lineY = lineYs[lineIdx];
      // Phase 24c.1: push the staff down by the line's chord-pushup so
      // the chord row gets extra headroom above ledger-line notes.
      const chordPushUp = linePushUps[lineIdx];
      const staveY =
        lineY + CHORD_BAND_HEIGHT + STAVE_GAP_TOP + chordPushUp;
      const staffBottomY = staveY + STAVE_HEIGHT * 0.55; // approx 5-line bottom

      const lineOverhead =
        CLEF_PX + keyAccidentalPx + (showTimeSig ? TIME_SIG_PX : 0);
      // Phase 31.9 — Under-filled last-line fix. Previously divided
      // the full page width by `lineMeasures.length`, which stretched
      // a 2-measure last line as wide as a 4-measure line above it.
      // Standard engraving convention keeps the per-measure width
      // consistent and lets the last line be visually shorter with
      // trailing whitespace.
      const perMeasureWidth =
        (contentWidth - lineOverhead) / measuresPerLine;
      const noteAreaPer = Math.max(
        MIN_MEASURE_NOTE_WIDTH,
        perMeasureWidth,
      );
      const noteAreaTotal = noteAreaPer * lineMeasures.length;

      // Measure-number label above the first measure of this line.
      ctx.save();
      ctx.setFont("monospace", 10, "");
      ctx.fillText(String(lineIdx * measuresPerLine + 1), 0, lineY + 10);
      ctx.restore();

      // Phase 28: volta-span detection. Walk the line measures and
      // build contiguous runs of equal `volta` numbers; render a
      // bracket per run after all staves draw.
      type VoltaSpan = {
        number: number;
        startMeasureIdx: number;
        endMeasureIdx: number;
      };
      const voltaSpansForLine: VoltaSpan[] = [];
      {
        let currentVolta: number | undefined = undefined;
        let voltaStartIdx = 0;
        for (let mi = 0; mi < lineMeasures.length; mi++) {
          const m = lineMeasures[mi];
          if (m.volta !== undefined) {
            if (currentVolta !== m.volta) {
              if (currentVolta !== undefined) {
                voltaSpansForLine.push({
                  number: currentVolta,
                  startMeasureIdx: voltaStartIdx,
                  endMeasureIdx: mi - 1,
                });
              }
              currentVolta = m.volta;
              voltaStartIdx = mi;
            }
          } else if (currentVolta !== undefined) {
            voltaSpansForLine.push({
              number: currentVolta,
              startMeasureIdx: voltaStartIdx,
              endMeasureIdx: mi - 1,
            });
            currentVolta = undefined;
          }
        }
        if (currentVolta !== undefined) {
          voltaSpansForLine.push({
            number: currentVolta,
            startMeasureIdx: voltaStartIdx,
            endMeasureIdx: lineMeasures.length - 1,
          });
        }
      }

      // Phase 30.3 — ottava-span detection. Same contiguous-run pattern
      // as volta detection above. One dashed bracket per span; 8va sits
      // above the staff, 8vb below.
      type OctavaSpan = {
        shift: SheetOctavaShift;
        startMeasureIdx: number;
        endMeasureIdx: number;
      };
      const octavaSpansForLine: OctavaSpan[] = [];
      {
        let currentShift: SheetOctavaShift | undefined = undefined;
        let shiftStartIdx = 0;
        for (let mi = 0; mi < lineMeasures.length; mi++) {
          const m = lineMeasures[mi];
          if (m.octavaShift) {
            if (currentShift !== m.octavaShift) {
              if (currentShift !== undefined) {
                octavaSpansForLine.push({
                  shift: currentShift,
                  startMeasureIdx: shiftStartIdx,
                  endMeasureIdx: mi - 1,
                });
              }
              currentShift = m.octavaShift;
              shiftStartIdx = mi;
            }
          } else if (currentShift !== undefined) {
            octavaSpansForLine.push({
              shift: currentShift,
              startMeasureIdx: shiftStartIdx,
              endMeasureIdx: mi - 1,
            });
            currentShift = undefined;
          }
        }
        if (currentShift !== undefined) {
          octavaSpansForLine.push({
            shift: currentShift,
            startMeasureIdx: shiftStartIdx,
            endMeasureIdx: lineMeasures.length - 1,
          });
        }
      }

      // Track per-measure note-area X bounds so we can draw voltas
      // after the loop.
      const measureXBounds: Array<{ noteStartX: number; noteEndX: number }> =
        [];

      lineMeasures.forEach((measure, i) => {
        const isFirst = i === 0;
        const staveX = isFirst ? 0 : lineOverhead + i * noteAreaPer;
        const staveWidth = isFirst
          ? lineOverhead + noteAreaPer
          : noteAreaPer;
        // Original measure index in the sheet's flat measures array.
        const measureIdx = lineIdx * measuresPerLine + i;

        // Phase 33 — Per-measure clef resolution. Falls back to the
        // sheet-level clef, then to treble.
        const measureClef: "treble" | "bass" =
          measure.clef ?? defaultClef;
        // Draw the clef at the start of the line (always) AND at the
        // start of any measure where the clef differs from the
        // previously-rendered one.
        const drawClef = isFirst || measureClef !== previousRenderedClef;

        const stave = new Stave(staveX, staveY, staveWidth);
        if (drawClef) {
          // Phase 32.1 — Clef selection. VexFlow uses absolute pitch
          // (StaveNote pitches don't change) — the clef just tells
          // the renderer where each MIDI value sits on the staff.
          stave.addClef(measureClef);
        }
        if (isFirst) {
          stave.addKeySignature(keySpec);
          if (showTimeSig) {
            stave.addTimeSignature(
              `${sheet.timeSignature.beatsPerMeasure}/${sheet.timeSignature.beatUnit}`,
            );
          }
        }
        // Phase 28: repeat barlines. setBegBarType for repeat-start;
        // setEndBarType for repeat-end (overrides the default single
        // barline).
        if (measure.repeatStart) {
          stave.setBegBarType(Barline.type.REPEAT_BEGIN);
        }
        if (measure.repeatEnd) {
          stave.setEndBarType(Barline.type.REPEAT_END);
        } else if (isLastLine && i === lineMeasures.length - 1) {
          stave.setEndBarType(Barline.type.END);
        }
        // Phase 28: Coda / Segno marks attached to the stave (VexFlow
        // renders them as glyphs above the staff). Repetition.type
        // values: CODA_LEFT / CODA_RIGHT / SEGNO_LEFT etc. Place above
        // the first beat for either mark.
        if (measure.mark === "coda") {
          stave.addModifier(
            new Repetition(Repetition.type.CODA_LEFT, -36, -22),
          );
        } else if (measure.mark === "segno") {
          stave.addModifier(
            new Repetition(Repetition.type.SEGNO_LEFT, -36, -22),
          );
        }
        // Phase 28: D.C. al Fine / D.S. al Coda / To Coda / Fine — these
        // render as text above the END barline of the measure they're
        // anchored to. We use Repetition's text variants.
        if (measure.instruction === "dc-al-fine") {
          stave.addModifier(
            new Repetition(Repetition.type.DC_AL_FINE, 0, -22),
          );
        } else if (measure.instruction === "ds-al-coda") {
          stave.addModifier(
            new Repetition(Repetition.type.DS_AL_CODA, 0, -22),
          );
        } else if (measure.instruction === "to-coda") {
          stave.addModifier(
            new Repetition(Repetition.type.TO_CODA, 0, -22),
          );
        } else if (measure.instruction === "fine") {
          stave.addModifier(
            new Repetition(Repetition.type.FINE, 0, -22),
          );
        }
        stave.setContext(ctx).draw();

        const noteStartX = stave.getNoteStartX();
        const noteEndX = stave.getX() + stave.getWidth();
        // Phase 24c.1: chord baseline tightened from -6 to -3 above
        // staff top so chord symbols sit closer to the staff.
        const chordY = staveY - 3;

        // Phase 28: cache X bounds for the volta-rendering pass below.
        measureXBounds[i] = { noteStartX, noteEndX };
        // Phase 28: section label above the measure (left-aligned to
        // the note area, bold serif). Renders above the chord row.
        if (measure.sectionLabel) {
          ctx.save();
          ctx.setFont("Georgia, 'Times New Roman', serif", 12, "bold");
          ctx.fillText(
            measure.sectionLabel,
            noteStartX,
            lineY + 10,
          );
          ctx.restore();
        }
        // Phase 25: capture this measure's rect for the click-on-staff
        // overlay. topLineY / bottomLineY are computed via VexFlow's
        // line-Y helper so pitch math stays accurate even if the stave
        // is positioned differently in future layouts.
        localMeasureRects.push({
          measureIdx,
          noteStartX,
          noteEndX,
          staveTopY: staveY,
          topLineY: stave.getYForLine(0),
          bottomLineY: stave.getYForLine(4),
        });

        if (measure.chords.length > 0) {
          ctx.save();
          ctx.setFont(
            chordFont,
            chordSize,
            fontStyle === "handwritten" ? "" : "bold",
          );
          // Phase 25.2: render each ChordBeat at its beat-derived X.
          // Phase 26.1: collision-avoidance two-pass layout.
          // Phase 26.1.1: when the collision-shifted layout would
          // overflow the measure's right edge, SHRINK the chord font
          // proportionally to fit (floor at 9pt for readability).
          // Engraving convention — dense bars get smaller chord text
          // rather than getting clipped.
          const beatsPerMeasure = sheet.timeSignature.beatsPerMeasure;
          const measureWidth = noteEndX - noteStartX;
          const sortedChords = [...measure.chords].sort(
            (a, b) => a.beat - b.beat,
          );
          type ChordLayout = {
            text: string;
            /** Beat-derived target X (immutable). */
            wantedX: number;
            /** Final X after shift (mutable). */
            leftX: number;
            width: number;
          };
          const chordLayouts: ChordLayout[] = sortedChords.map((cb) => {
            const fraction =
              Math.max(
                0,
                Math.min(beatsPerMeasure - 0.001, cb.beat - 1),
              ) / beatsPerMeasure;
            const x = noteStartX + fraction * measureWidth;
            const base = renderChord(cb.chord, notationStyle);
            const text = cb.bass ? `${base}/${cb.bass}` : base;
            const measured = ctx.measureText
              ? ctx.measureText(text)
              : null;
            const width =
              measured && typeof measured.width === "number"
                ? measured.width
                : text.length * (chordSize * 0.55);
            return { text, wantedX: x, leftX: x, width };
          });
          const MIN_CHORD_GAP = 6;
          const CHORD_FONT_FLOOR = 9;

          // Test pass: where would the rightmost edge land after the
          // collision shift? (Doesn't mutate chordLayouts.)
          let testPrevRight = -Infinity;
          let testMaxRight = noteStartX;
          chordLayouts.forEach((cl) => {
            const left = Math.max(
              cl.wantedX,
              testPrevRight + MIN_CHORD_GAP,
            );
            const right = left + cl.width;
            testPrevRight = right;
            if (right > testMaxRight) testMaxRight = right;
          });

          // Phase 26.1.1: shrink font + re-measure if we'd overflow.
          if (testMaxRight > noteEndX) {
            const required = testMaxRight - noteStartX;
            const scale = measureWidth / required;
            const newSize = Math.max(
              chordSize * scale,
              CHORD_FONT_FLOOR,
            );
            ctx.setFont(
              chordFont,
              newSize,
              fontStyle === "handwritten" ? "" : "bold",
            );
            chordLayouts.forEach((cl) => {
              const measured = ctx.measureText
                ? ctx.measureText(cl.text)
                : null;
              cl.width =
                measured && typeof measured.width === "number"
                  ? measured.width
                  : cl.text.length * (newSize * 0.55);
            });
          }

          // Final collision-shift pass with (possibly shrunk) widths.
          let prevRight = -Infinity;
          chordLayouts.forEach((cl) => {
            cl.leftX = Math.max(
              cl.wantedX,
              prevRight + MIN_CHORD_GAP,
            );
            prevRight = cl.leftX + cl.width;
          });

          chordLayouts.forEach((cl) => {
            ctx.fillText(cl.text, cl.leftX, chordY);
          });
          ctx.restore();
        }

        const melody = measure.melody ?? [];
        if (melody.length === 0) {
          // Empty melody — even so, if a cross-measure tie is pending
          // it should be cleared here (an empty measure can't be the
          // tie's landing point). Standard convention: silence breaks
          // a tie chain.
          pendingCrossMeasureTie = null;
          // Phase 33 — still update the clef tracker so subsequent
          // measures know what clef this measure rendered.
          previousRenderedClef = measureClef;
          return;
        }
        // Phase 30.3 — apply per-measure ottava shift as a DISPLAY
        // transformation. Storage pitches are the sounding pitches
        // (from MIDI / click / keyboard entry); the renderer shifts
        // each pitched note by ±1 octave so the notes sit near the
        // staff instead of far above or below on many ledger lines.
        // All downstream renderer helpers (ties, slurs, tuplets,
        // lyric layout) see the same shifted melody, so pitch-
        // equality checks (used by ties + slurs) stay consistent.
        const displayMelody = melodyForDisplay(melody, measure.octavaShift);
        const staveNotes = buildStaveNotesForMelody(
          displayMelody,
          measureClef,
        );
        const voice = new Voice({
          numBeats: sheet.timeSignature.beatsPerMeasure,
          beatValue: sheet.timeSignature.beatUnit,
        });
        voice.setStrict(false);
        voice.addTickables(staveNotes);

        const tuplets = collectTuplets(displayMelody, staveNotes);
        const ties = collectTies(displayMelody, staveNotes);
        const slurs = collectSlurs(displayMelody, staveNotes);

        // Phase 29 — cross-measure tie IN. If the previous measure
        // ended with a tieToNext-flagged pitched note AND this
        // measure's first pitched note matches its pitch, draw the
        // connecting arc.
        //   - Full arc (both endpoints): previous measure on same line.
        //   - Incoming half-arc only: previous measure on previous line
        //     (its outgoing half-arc was already drawn there).
        if (pendingCrossMeasureTie) {
          // Find the first PITCHED note in this measure. Leading rests
          // don't break a tie — the tie lands on the first pitched note.
          let firstPitchedIdx = -1;
          for (let ki = 0; ki < displayMelody.length; ki++) {
            if (displayMelody[ki].kind === "note") {
              firstPitchedIdx = ki;
              break;
            }
          }
          if (firstPitchedIdx >= 0) {
            const firstMel = displayMelody[firstPitchedIdx];
            if (
              firstMel.kind === "note" &&
              firstMel.pitch === pendingCrossMeasureTie.pitch
            ) {
              const firstStaveNote = staveNotes[firstPitchedIdx];
              if (pendingCrossMeasureTie.outgoingNote) {
                // Full cross-measure tie within the same line.
                ties.push(
                  new StaveTie({
                    firstNote: pendingCrossMeasureTie.outgoingNote,
                    lastNote: firstStaveNote,
                    firstIndexes: [0],
                    lastIndexes: [0],
                  }),
                );
              } else {
                // Incoming half-arc from previous line.
                ties.push(
                  new StaveTie({
                    firstNote: undefined,
                    lastNote: firstStaveNote,
                    firstIndexes: [0],
                    lastIndexes: [0],
                  }),
                );
              }
            }
          }
          pendingCrossMeasureTie = null;
        }

        // Auto-beam consecutive eighth/sixteenth notes that are NOT in
        // a tuplet. Tuplets handle their own visual grouping via the
        // Tuplet bracket + numeral; auto-beaming them would suppress
        // the bracket and push the numeral off-canvas.
        const beamableNotes = staveNotes.filter(
          (_, i) => !displayMelody[i].tupletGroup,
        );
        const beams = Beam.generateBeams(beamableNotes);

        new Formatter()
          .joinVoices([voice])
          .format([voice], Math.max(40, noteEndX - noteStartX - 12));
        voice.draw(ctx, stave);
        beams.forEach((b) => b.setContext(ctx).draw());
        // Tuplets after beams so the bracket + numeral sit on top.
        tuplets.forEach((t) => t.setContext(ctx).draw());
        ties.forEach((t) => t.setContext(ctx).draw());
        // Phase 29.1 — slur arcs drawn after ties so they sit visually
        // above them if both are present on the same note.
        slurs.forEach((s) => s.setContext(ctx).draw());

        // Phase 29 — cross-measure tie OUT. If this measure ends with
        // a tieToNext-flagged pitched note AND another measure follows
        // in the sheet, arm the pendingCrossMeasureTie so the next
        // measure's render draws the connecting arc.
        let lastPitchedIdx = -1;
        for (let ki = displayMelody.length - 1; ki >= 0; ki--) {
          if (displayMelody[ki].kind === "note") {
            lastPitchedIdx = ki;
            break;
          }
        }
        if (lastPitchedIdx >= 0) {
          const lastMel = displayMelody[lastPitchedIdx];
          const isLastMeasureInSheet =
            measureIdx === sheet.measures.length - 1;
          if (
            lastMel.kind === "note" &&
            lastMel.tieToNext === true &&
            !isLastMeasureInSheet
          ) {
            const isLastMeasureInLine = i === lineMeasures.length - 1;
            if (isLastMeasureInLine) {
              // Draw the outgoing half-arc on THIS line's last note
              // right now (its context is still current). Then park a
              // "null-outgoingNote" pending tie so the NEXT line's
              // first measure draws only the incoming half-arc.
              new StaveTie({
                firstNote: staveNotes[lastPitchedIdx],
                lastNote: undefined,
                firstIndexes: [0],
                lastIndexes: [0],
              })
                .setContext(ctx)
                .draw();
              pendingCrossMeasureTie = {
                pitch: lastMel.pitch,
                outgoingNote: null,
              };
            } else {
              // Same-line tie — the next measure's render will emit
              // the full arc using this measure's last StaveNote as
              // the outgoing endpoint.
              pendingCrossMeasureTie = {
                pitch: lastMel.pitch,
                outgoingNote: staveNotes[lastPitchedIdx],
              };
            }
          }
        }

        // Phase 24c — Lyrics. Render syllable text below the staff and
        // collect note positions for the editor's interactive layer.
        // Phase 24c.1.2: two-pass layout. Pass 1 computes wanted X /
        // width for each syllable; pass 2 walks left-to-right and
        // SHIFTS overlapping syllables right so closely-spaced eighth
        // notes (e.g. "know" + "where") don't collide into "knowwhere".
        const lyricY = staveY + STAVE_HEIGHT + LYRIC_BASELINE_OFFSET;
        ctx.save();
        ctx.setFont(lyricFont, lyricSize, "");

        const noteAbsoluteXs: number[] = staveNotes.map((sn) =>
          sn.getAbsoluteX(),
        );

        type SyllableLayout = {
          noteIdx: number;
          text: string;
          centerX: number;
          width: number;
          continuation: "none" | "hyphen" | "underscore";
        };
        // Pass 1: collect syllable positions + widths.
        // Phase 24c.2: use VexFlow's measureText() for actual rendered
        // width instead of a per-char approximation — gets us
        // pixel-accurate widths so the collision pass below produces
        // the right spacing even for wide letters like 'w' / 'm'.
        const syllables: SyllableLayout[] = [];
        melody.forEach((mn, noteIdxInMeasure) => {
          if (mn.kind !== "note") return;
          if (!mn.lyric || mn.lyric.text.length === 0) return;
          const displayText =
            mn.lyric.continuation === "hyphen"
              ? `${mn.lyric.text}-`
              : mn.lyric.text;
          // measureText is provided by VexFlow's SVG context with the
          // currently-set font. Fall back to a conservative per-char
          // approximation if the runtime doesn't expose it.
          const measured = ctx.measureText
            ? ctx.measureText(displayText)
            : null;
          const width =
            measured && typeof measured.width === "number"
              ? measured.width
              : displayText.length * 7.5;
          syllables.push({
            noteIdx: noteIdxInMeasure,
            text: displayText,
            centerX: noteAbsoluteXs[noteIdxInMeasure],
            width,
            continuation: mn.lyric.continuation,
          });
        });
        // Pass 2: collision avoidance — if a syllable's left edge would
        // collide with the previous syllable's right edge, shift this
        // one right. Engraving convention: lyrics CAN drift off their
        // note when the notes are too close, in service of readability.
        // Phase 24c.2: 8 → 12 (clearly visible breathing room).
        const MIN_LYRIC_GAP = 12;
        let prevRight = -Infinity;
        syllables.forEach((s) => {
          const leftEdge = s.centerX - s.width / 2;
          if (leftEdge < prevRight + MIN_LYRIC_GAP) {
            s.centerX = prevRight + MIN_LYRIC_GAP + s.width / 2;
          }
          prevRight = s.centerX + s.width / 2;
        });
        // Pass 3: draw + melisma lines.
        syllables.forEach((s) => {
          const textX = s.centerX - s.width / 2;
          ctx.fillText(s.text, textX, lyricY);
          if (s.continuation === "underscore") {
            // Melisma extends from this syllable's right edge to the
            // last melisma note's right edge within this measure.
            let lastMelismaIdx = s.noteIdx;
            for (let q = s.noteIdx + 1; q < melody.length; q++) {
              const nq = melody[q];
              if (nq.kind === "note") {
                if (nq.lyric && nq.lyric.text.length > 0) break;
                lastMelismaIdx = q;
              }
            }
            if (lastMelismaIdx > s.noteIdx) {
              const lineStartX = s.centerX + s.width / 2 + 2;
              const lineEndX = noteAbsoluteXs[lastMelismaIdx] + 6;
              const lineY = lyricY - 3;
              ctx.beginPath();
              ctx.moveTo(lineStartX, lineY);
              ctx.lineTo(lineEndX, lineY);
              ctx.setLineWidth(1.2);
              ctx.stroke();
            }
          }
        });
        ctx.restore();

        // Record positions for every note (pitched or rest) so the
        // editor's cursor walk can map rest indices too if needed.
        melody.forEach((mn, noteIdxInMeasure) => {
          const noteX = noteAbsoluteXs[noteIdxInMeasure];
          localPositions.push({
            measureIdx,
            noteIdx: noteIdxInMeasure,
            x: noteX,
            y: staveY + STAVE_HEIGHT / 2,
            staffBottomY,
            width: Math.max(28, noteAreaPer / Math.max(1, melody.length)),
            isPitched: mn.kind === "note",
            _measureFirstIdx: i, // unused once translated
          });
        });
        // Phase 33 — remember the clef we rendered so the next
        // measure can decide whether to draw its own clef glyph.
        previousRenderedClef = measureClef;
      });

      // Phase 28: volta-bracket render pass. After all measures of the
      // line are drawn, walk the detected spans and draw a bracket per
      // span just above the chord band. Engraving convention: a thin
      // horizontal line with a downward tick on each side and a small
      // number label ("1." or "2.") at the upper-left of the bracket.
      voltaSpansForLine.forEach((span) => {
        const startBounds = measureXBounds[span.startMeasureIdx];
        const endBounds = measureXBounds[span.endMeasureIdx];
        if (!startBounds || !endBounds) return;
        const bracketY = lineY + 4;
        const tickHeight = 12;
        const xL = startBounds.noteStartX - 2;
        const xR = endBounds.noteEndX + 2;
        ctx.save();
        ctx.beginPath();
        // Left downward tick.
        ctx.moveTo(xL, bracketY);
        ctx.lineTo(xL, bracketY + tickHeight);
        // Top bracket line.
        ctx.moveTo(xL, bracketY);
        ctx.lineTo(xR, bracketY);
        // Right downward tick.
        ctx.moveTo(xR, bracketY);
        ctx.lineTo(xR, bracketY + tickHeight);
        ctx.setLineWidth(1.3);
        ctx.stroke();
        // Number label.
        ctx.setFont("Georgia, 'Times New Roman', serif", 11, "bold");
        ctx.fillText(`${span.number}.`, xL + 4, bracketY + 11);
        ctx.restore();
      });

      // Phase 30.3 — ottava-bracket render pass. One bracket per
      // contiguous same-shift span. Standard engraving convention:
      //   - "8" italic serif label at the LEFT edge (or "8va" / "8vb")
      //   - Dashed horizontal line across the span
      //   - A short vertical hook at the RIGHT end (down for 8va sitting
      //     above notes, up for 8vb sitting below notes)
      // 8va sits above the chord row (well above the notes). 8vb sits
      // below the staff, near / among any lyrics. Positioning is
      // conservative — a fully-featured coordinator would also push
      // the line spacing outward when a big ottava bracket appears,
      // but for a first pass a fixed offset works.
      octavaSpansForLine.forEach((span) => {
        const startBounds = measureXBounds[span.startMeasureIdx];
        const endBounds = measureXBounds[span.endMeasureIdx];
        if (!startBounds || !endBounds) return;
        const xL = startBounds.noteStartX - 2;
        const xR = endBounds.noteEndX + 2;
        const label = span.shift;
        // Above (8va / 15ma) sits above the chord row. Below (8vb /
        // 15mb) sits BELOW the lyric band so the bracket clears
        // descending stems, ledger-line notes below the staff, AND
        // any lyric syllables on this line.
        const isAbove = span.shift === "8va" || span.shift === "15ma";
        const bracketY = isAbove
          ? lineY + CHORD_BAND_HEIGHT - 4
          : staveY + STAVE_HEIGHT + LYRIC_BASELINE_OFFSET + 18;
        const hookHeight = 8;
        const hookSign = isAbove ? 1 : -1; // hook DOWN for above, UP for below
        ctx.save();
        // Italic serif label at the left edge, vertically centered
        // on the bracket line.
        ctx.setFont(
          "Georgia, 'Times New Roman', serif",
          11,
          "bold italic",
        );
        ctx.fillText(label, xL, bracketY + 4);
        // Dashed line from just after the label to xR.
        const labelWidth = ctx.measureText
          ? (ctx.measureText(label)?.width ?? 20) + 3
          : 22;
        ctx.beginPath();
        const dashStartX = xL + labelWidth;
        const dashLen = 4;
        const gapLen = 3;
        let x = dashStartX;
        while (x < xR) {
          const segEnd = Math.min(x + dashLen, xR);
          ctx.moveTo(x, bracketY);
          ctx.lineTo(segEnd, bracketY);
          x = segEnd + gapLen;
        }
        // Right hook (short vertical stroke away from the notes).
        ctx.moveTo(xR, bracketY);
        ctx.lineTo(xR, bracketY + hookSign * hookHeight);
        ctx.setLineWidth(1.1);
        ctx.stroke();
        ctx.restore();
      });
    });

    if (onLayout) {
      const musicOffsetTop = musicRef.current.offsetTop;
      const musicOffsetLeft = musicRef.current.offsetLeft;
      const positions: SheetNotePosition[] = localPositions.map((p) => ({
        measureIdx: p.measureIdx,
        noteIdx: p.noteIdx,
        x: p.x + musicOffsetLeft,
        y: p.y + musicOffsetTop,
        staffBottomY: p.staffBottomY + musicOffsetTop,
        width: p.width,
        isPitched: p.isPitched,
      }));
      const measureRects: SheetMeasureRect[] = localMeasureRects.map(
        (r) => ({
          measureIdx: r.measureIdx,
          noteStartX: r.noteStartX + musicOffsetLeft,
          noteEndX: r.noteEndX + musicOffsetLeft,
          staveTopY: r.staveTopY + musicOffsetTop,
          topLineY: r.topLineY + musicOffsetTop,
          bottomLineY: r.bottomLineY + musicOffsetTop,
        }),
      );
      onLayout({
        positions,
        measureRects,
        paperWidth: width,
        paperHeight: musicOffsetTop + totalHeight + PAPER_PADDING_Y,
      });
    }
  }, [
    sheet,
    notationStyle,
    width,
    measuresPerLine,
    onLayout,
    fontStyle,
    chordFont,
    chordSize,
    lyricFont,
    lyricSize,
  ]);

  return (
    <div
      className="sheet-paper relative mx-auto rounded-sm shadow-2xl print:shadow-none"
      style={{
        background: "#fbfaf5",
        color: "#1a1a1a",
        width,
        // Phase 24c.2: lock to Letter paper height so the user always
        // sees the full page bounds while authoring. Content that
        // overflows extends past the lock (multi-page rendering is a
        // future polish slice).
        minHeight: PAPER_HEIGHT_LETTER,
      }}
    >
      <div
        style={{
          padding: `${PAPER_PADDING_Y}px ${PAPER_PADDING_X}px`,
        }}
      >
        <header className="mb-7 border-b border-black/10 pb-4">
          <h1
            className={`text-center tracking-tight text-3xl ${
              fontStyle === "handwritten" ? "" : "font-bold"
            } ${sheet.source?.trim() ? "mb-1" : "mb-3"}`}
            style={{
              fontFamily: titleFont,
              color: "#1a1a1a",
            }}
          >
            {sheet.title || "Untitled"}
          </h1>
          {/* Phase 27.1.3 — Source attribution as italic subtitle. */}
          {sheet.source?.trim() && (
            <p
              className={`mb-3 text-center text-sm ${
                fontStyle === "handwritten" ? "" : "italic"
              }`}
              style={{
                fontFamily: titleFont,
                color: "#555",
              }}
            >
              {sheet.source}
            </p>
          )}
          <div
            className="flex items-end justify-between text-sm"
            style={{ fontFamily: titleFont, color: "#333" }}
          >
            <div className="flex min-h-[1.25rem] flex-col gap-0.5">
              {/* Phase 25.0.3: drop italic in handwritten mode — Real
                  Book convention keeps composer/style in the same
                  hand-print as everything else; browser-synthesized
                  italic on Patrick Hand reads as awkwardly slanted. */}
              {sheet.style && (
                <span className={fontStyle === "handwritten" ? "" : "italic"}>
                  {sheet.style}
                </span>
              )}
              {sheet.bpm && (
                <span className="font-medium">♩ = {sheet.bpm}</span>
              )}
            </div>
            <div className="flex flex-col items-end">
              {/* Phase 27.1.2 — smart composer / lyricist credit.
                  - Both set, same person → "Music and Lyrics by X"
                  - Both set, different → "Music by X" / "Words by Y"
                  - Only one → plain name
                  - Neither → nothing
                  Italic in standard engraving; drops italic in
                  handwritten mode (synthesized italic on Patrick
                  Hand reads awkwardly).
              */}
              {(() => {
                const composer = sheet.composer?.trim();
                const lyricist = sheet.lyricist?.trim();
                const arranger = sheet.arranger?.trim();
                const italicClass =
                  fontStyle === "handwritten" ? "" : "italic";
                const lines: React.ReactNode[] = [];
                if (composer && lyricist) {
                  if (
                    composer.toLowerCase() === lyricist.toLowerCase()
                  ) {
                    lines.push(
                      <span
                        key="composer-lyricist"
                        className={italicClass}
                      >
                        Music and Lyrics by {composer}
                      </span>,
                    );
                  } else {
                    lines.push(
                      <span key="music" className={italicClass}>
                        Music by {composer}
                      </span>,
                      <span key="words" className={italicClass}>
                        Words by {lyricist}
                      </span>,
                    );
                  }
                } else if (composer) {
                  lines.push(
                    <span key="composer" className={italicClass}>
                      {composer}
                    </span>,
                  );
                } else if (lyricist) {
                  lines.push(
                    <span key="lyricist" className={italicClass}>
                      {lyricist}
                    </span>,
                  );
                }
                if (arranger) {
                  lines.push(
                    <span key="arranger" className={italicClass}>
                      arr. by {arranger}
                    </span>,
                  );
                }
                return lines.length > 0 ? <>{lines}</> : null;
              })()}
              <span className="text-xs text-black/50">
                {sheet.keyTonic} {sheet.keyMode}
              </span>
            </div>
          </div>
          {/* Phase 27.1.3 — Copyright line. Bottom-right of the title
              block, very small (not italic — matches engraving
              convention for copyright notices). */}
          {sheet.copyright?.trim() && (
            <p
              className="mt-2 text-right text-[10px] text-black/50"
              style={{ fontFamily: titleFont }}
            >
              {sheet.copyright}
            </p>
          )}
        </header>
        <div ref={musicRef} />
      </div>
    </div>
  );
}

/** Hit-region height used by the editor's note click overlay. */
export const SHEET_NOTE_HIT_REGION_HEIGHT = NOTE_HIT_REGION_HEIGHT;

/** Approx Y offset from staffBottomY where the lyric input should center. */
export const SHEET_LYRIC_INPUT_OFFSET = LYRIC_BASELINE_OFFSET + 6;
