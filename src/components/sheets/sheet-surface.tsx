"use client";

import { useEffect, useRef } from "react";
import {
  Barline,
  Beam,
  Dot,
  Formatter,
  Renderer,
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

function buildStaveNotesForMelody(melody: MelodyNote[]): StaveNote[] {
  return melody.map((n) => {
    if (n.kind === "rest") {
      const note = new StaveNote({
        keys: ["b/4"],
        duration: `${n.duration}r`,
      });
      if (n.dotted) Dot.buildAndAttach([note], { all: true });
      return note;
    }
    const note = new StaveNote({
      keys: [n.pitch],
      duration: n.duration,
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
      const noteAreaTotal = Math.max(
        MIN_MEASURE_NOTE_WIDTH * lineMeasures.length,
        contentWidth - lineOverhead,
      );
      const noteAreaPer = noteAreaTotal / lineMeasures.length;

      // Measure-number label above the first measure of this line.
      ctx.save();
      ctx.setFont("monospace", 10, "");
      ctx.fillText(String(lineIdx * measuresPerLine + 1), 0, lineY + 10);
      ctx.restore();

      lineMeasures.forEach((measure, i) => {
        const isFirst = i === 0;
        const staveX = isFirst ? 0 : lineOverhead + i * noteAreaPer;
        const staveWidth = isFirst
          ? lineOverhead + noteAreaPer
          : noteAreaPer;
        // Original measure index in the sheet's flat measures array.
        const measureIdx = lineIdx * measuresPerLine + i;

        const stave = new Stave(staveX, staveY, staveWidth);
        if (isFirst) {
          stave.addClef("treble");
          stave.addKeySignature(keySpec);
          if (showTimeSig) {
            stave.addTimeSignature(
              `${sheet.timeSignature.beatsPerMeasure}/${sheet.timeSignature.beatUnit}`,
            );
          }
        }
        if (isLastLine && i === lineMeasures.length - 1) {
          stave.setEndBarType(Barline.type.END);
        }
        stave.setContext(ctx).draw();

        const noteStartX = stave.getNoteStartX();
        const noteEndX = stave.getX() + stave.getWidth();
        // Phase 24c.1: chord baseline tightened from -6 to -3 above
        // staff top so chord symbols sit closer to the staff.
        const chordY = staveY - 3;

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
          // Phase 25.2: render each ChordBeat at its beat-derived X
          // position. Sorted by beat so visual order matches musical
          // order. Slash chord bass override renders as "Chord/Bass".
          // Phase 26.1: two-pass layout to avoid horizontal collision
          // on consecutive-beat chords (e.g. dense bossa-nova bars
          // with a different chord on every quarter). Pass 1 collects
          // wanted X + measured width per chord; pass 2 walks left-to-
          // right and shifts later chords right whenever they would
          // overlap the previous one's right edge. Engraving trade-off:
          // chords drift slightly off-beat in service of readability —
          // same convention used by lyrics, same MIN_CHORD_GAP semantic.
          const beatsPerMeasure = sheet.timeSignature.beatsPerMeasure;
          const measureWidth = noteEndX - noteStartX;
          const sortedChords = [...measure.chords].sort(
            (a, b) => a.beat - b.beat,
          );
          type ChordLayout = {
            text: string;
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
            return { text, leftX: x, width };
          });
          const MIN_CHORD_GAP = 6;
          let prevRight = -Infinity;
          chordLayouts.forEach((cl) => {
            if (cl.leftX < prevRight + MIN_CHORD_GAP) {
              cl.leftX = prevRight + MIN_CHORD_GAP;
            }
            prevRight = cl.leftX + cl.width;
          });
          chordLayouts.forEach((cl) => {
            ctx.fillText(cl.text, cl.leftX, chordY);
          });
          ctx.restore();
        }

        const melody = measure.melody ?? [];
        if (melody.length === 0) return;
        const staveNotes = buildStaveNotesForMelody(melody);
        const voice = new Voice({
          numBeats: sheet.timeSignature.beatsPerMeasure,
          beatValue: sheet.timeSignature.beatUnit,
        });
        voice.setStrict(false);
        voice.addTickables(staveNotes);

        const tuplets = collectTuplets(melody, staveNotes);
        const ties = collectTies(melody, staveNotes);
        // Auto-beam consecutive eighth/sixteenth notes that are NOT in
        // a tuplet. Tuplets handle their own visual grouping via the
        // Tuplet bracket + numeral; auto-beaming them would suppress
        // the bracket and push the numeral off-canvas.
        const beamableNotes = staveNotes.filter(
          (_, i) => !melody[i].tupletGroup,
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
            className={`mb-3 text-center tracking-tight text-3xl ${
              fontStyle === "handwritten" ? "" : "font-bold"
            }`}
            style={{
              fontFamily: titleFont,
              color: "#1a1a1a",
            }}
          >
            {sheet.title || "Untitled"}
          </h1>
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
              {sheet.composer && (
                <span className={fontStyle === "handwritten" ? "" : "italic"}>
                  {sheet.composer}
                </span>
              )}
              <span className="text-xs text-black/50">
                {sheet.keyTonic} {sheet.keyMode}
              </span>
            </div>
          </div>
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
