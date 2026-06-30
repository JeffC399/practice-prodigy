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

export type SheetSurfaceLayout = {
  positions: SheetNotePosition[];
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

const PAPER_PADDING_X = 64;
const PAPER_PADDING_Y = 48;
const LINE_GAP = 14;
const CHORD_BAND_HEIGHT = 22;
const STAVE_GAP_TOP = 6;
const STAVE_HEIGHT = 78;
/** Phase 24c: extra vertical space below each staff for lyrics. */
const LYRIC_BAND_HEIGHT = 22;
const LINE_HEIGHT =
  CHORD_BAND_HEIGHT + STAVE_GAP_TOP + STAVE_HEIGHT + LYRIC_BAND_HEIGHT;

// Approximate overhead widths used to apportion measure note-areas
// before VexFlow has drawn. Actual VexFlow widths may differ a few px;
// we trade pixel-perfect alignment for synchronous layout.
const CLEF_PX = 30;
const KEY_SIG_PX_PER_ACCIDENTAL = 9;
const TIME_SIG_PX = 28;
const MIN_MEASURE_NOTE_WIDTH = 110;

/** Vertical offset from staff bottom to lyric text baseline. */
const LYRIC_BASELINE_OFFSET = 16;
/** Vertical extra padding for the click region below the staff. */
const NOTE_HIT_REGION_HEIGHT = 44;

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
  width = 880,
  measuresPerLine = 4,
  onLayout,
}: SheetSurfaceProps) {
  const musicRef = useRef<HTMLDivElement>(null);
  const notationStyle = useUserPrefs((s) => s.notationDefault);

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
    const totalHeight =
      lines.length * LINE_HEIGHT +
      (lines.length - 1) * LINE_GAP +
      24;

    const renderer = new Renderer(
      musicRef.current,
      Renderer.Backends.SVG,
    );
    renderer.resize(contentWidth, totalHeight);
    const ctx = renderer.getContext();

    /** Local pixel positions in the music-ref coord space — translated
     *  to paper-div space at the end before firing `onLayout`. */
    const localPositions: Array<
      SheetNotePosition & { _measureFirstIdx: number }
    > = [];

    lines.forEach((lineMeasures, lineIdx) => {
      const showTimeSig = lineIdx === 0;
      const isLastLine = lineIdx === lines.length - 1;
      const lineY = lineIdx * (LINE_HEIGHT + LINE_GAP);
      const staveY = lineY + CHORD_BAND_HEIGHT + STAVE_GAP_TOP;
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
        const chordY = staveY - 6;

        if (measure.chords.length > 0) {
          ctx.save();
          ctx.setFont("Georgia, 'Times New Roman', serif", 14, "bold");
          if (measure.chords.length === 1) {
            ctx.fillText(
              renderChord(measure.chords[0], notationStyle),
              noteStartX,
              chordY,
            );
          } else {
            const slot = (noteEndX - noteStartX) / measure.chords.length;
            measure.chords.forEach((chord, ci) => {
              ctx.fillText(
                renderChord(chord, notationStyle),
                noteStartX + ci * slot,
                chordY,
              );
            });
          }
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
        const lyricY = staveY + STAVE_HEIGHT + LYRIC_BASELINE_OFFSET;
        ctx.save();
        ctx.setFont("Georgia, 'Times New Roman', serif", 11, "");

        const noteAbsoluteXs: number[] = staveNotes.map((sn) =>
          sn.getAbsoluteX(),
        );

        // For each pitched note with a lyric, draw the text. For
        // hyphen continuation: append a trailing dash. For underscore
        // continuation: draw a horizontal line from this note's right
        // edge to the right edge of the last melisma note within this
        // measure (boundary = next note with its own lyric, or end of
        // measure).
        melody.forEach((mn, noteIdxInMeasure) => {
          if (mn.kind !== "note") return;
          if (!mn.lyric || mn.lyric.text.length === 0) return;
          const noteX = noteAbsoluteXs[noteIdxInMeasure];
          const displayText =
            mn.lyric.continuation === "hyphen"
              ? `${mn.lyric.text}-`
              : mn.lyric.text;
          // Crude width approximation — VexFlow's context doesn't
          // expose measureText in a portable way across backends.
          // 6.2px per char @ 11pt serif is a workable estimate.
          const approxTextWidth = displayText.length * 6.2;
          const textX = noteX - approxTextWidth / 2;
          ctx.fillText(displayText, textX, lyricY);

          if (mn.lyric.continuation === "underscore") {
            // Find the next pitched note in this measure that has its
            // own lyric (or end of measure). The line draws to the
            // right edge of the LAST melisma note before that
            // boundary.
            let lastMelismaIdx = noteIdxInMeasure;
            for (let q = noteIdxInMeasure + 1; q < melody.length; q++) {
              const nq = melody[q];
              if (nq.kind === "note") {
                if (nq.lyric && nq.lyric.text.length > 0) break;
                lastMelismaIdx = q;
              }
            }
            if (lastMelismaIdx > noteIdxInMeasure) {
              const lineStartX = textX + approxTextWidth + 2;
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
      onLayout({
        positions,
        paperWidth: width,
        paperHeight: musicOffsetTop + totalHeight + PAPER_PADDING_Y,
      });
    }
  }, [sheet, notationStyle, width, measuresPerLine, onLayout]);

  return (
    <div
      className="sheet-paper relative mx-auto rounded-sm shadow-2xl print:shadow-none"
      style={{
        background: "#fbfaf5",
        color: "#1a1a1a",
        width,
      }}
    >
      <div
        style={{
          padding: `${PAPER_PADDING_Y}px ${PAPER_PADDING_X}px`,
        }}
      >
        <header className="mb-7 border-b border-black/10 pb-4">
          <h1
            className="mb-3 text-center text-3xl font-bold tracking-tight"
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              color: "#1a1a1a",
            }}
          >
            {sheet.title || "Untitled"}
          </h1>
          <div
            className="flex items-end justify-between text-sm"
            style={{ fontFamily: "Georgia, serif", color: "#333" }}
          >
            <div className="flex min-h-[1.25rem] flex-col gap-0.5">
              {sheet.style && <span className="italic">{sheet.style}</span>}
              {sheet.bpm && (
                <span className="font-medium">♩ = {sheet.bpm}</span>
              )}
            </div>
            <div className="flex flex-col items-end">
              {sheet.composer && (
                <span className="italic">{sheet.composer}</span>
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
