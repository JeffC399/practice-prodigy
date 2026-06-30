"use client";

import { useEffect, useRef } from "react";
import {
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Tuplet,
  Voice,
  Formatter,
  Dot,
  type RenderContext,
} from "vexflow";
import type {
  MelodyNote,
  SheetTimeSignature,
} from "@/lib/sheets/types";

/**
 * Single-measure melody staff (Phase 24b).
 *
 * Renders a treble-clef staff for a single measure using VexFlow.
 * Client-only — VexFlow draws to a `<div>` via an SVG renderer.
 *
 * v0.1 scope:
 *   - Notes + rests at whole / half / quarter / eighth / sixteenth
 *   - Dotted modifier (note.duration * 1.5)
 *   - Clef shown only on the first measure of a line (caller-driven)
 *   - Time signature shown only on the first measure (caller-driven)
 *
 * Phase 24c — lyrics. Single-measure preview renders any lyric
 * syllables below the staff (matches the SheetSurface engraving so
 * the in-modal preview is faithful to the final output).
 *
 * Deferred to 24b.4:
 *   - Cross-measure ties (multi-measure render coordination required)
 *   - Slurs / phrasing
 *   - Multi-voice
 */

export type MelodyStaffProps = {
  /** Notes + rests to render. */
  melody: MelodyNote[];
  /** Time signature for this measure. */
  timeSignature: SheetTimeSignature;
  /** Show the treble clef + key signature (first measure of a line). */
  showClef?: boolean;
  /** Show the time signature (first measure only). */
  showTimeSignature?: boolean;
  /** Optional width in px; defaults to a sensible per-measure width. */
  width?: number;
  /** Height in px; default fits a single staff plus padding. */
  height?: number;
};

/** Standard per-measure width when not overridden. */
const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 138;
const STAVE_TOP_PAD = 10;
const STAVE_VISUAL_HEIGHT = 40;
/**
 * Phase 24c.1: bumped 26 → 36 to match SheetSurface lyric offset.
 * Phase 24c.1.1: bumped 36 → 44 to match the bumped SheetSurface
 * offset (residual stem-flag collisions).
 */
const LYRIC_OFFSET_BELOW_STAFF = 44;

export function MelodyStaff({
  melody,
  timeSignature,
  showClef = false,
  showTimeSignature = false,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: MelodyStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Clear any previous render (effect re-runs on prop changes).
    containerRef.current.innerHTML = "";

    const renderer = new Renderer(
      containerRef.current,
      Renderer.Backends.SVG,
    );
    renderer.resize(width, height);
    const context: RenderContext = renderer.getContext();

    // Staff. Position + width tuned so notes have breathing room
    // after the optional clef + time-sig.
    const stave = new Stave(0, STAVE_TOP_PAD, width);
    if (showClef) stave.addClef("treble");
    if (showTimeSignature) {
      stave.addTimeSignature(
        `${timeSignature.beatsPerMeasure}/${timeSignature.beatUnit}`,
      );
    }
    stave.setContext(context).draw();

    if (melody.length === 0) {
      // Empty measure: just the staff, no notes/rests.
      return;
    }

    // Convert MelodyNote[] to VexFlow StaveNote[].
    const staveNotes = melody.map((n) => {
      if (n.kind === "rest") {
        // Rests sit in the middle of the staff (b/4 line for rest glyphs).
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

    // Voice. Use a permissive total-beat strict mode so users can
    // author over- or under-fill measures (useful for pickup bars).
    const voice = new Voice({
      numBeats: timeSignature.beatsPerMeasure,
      beatValue: timeSignature.beatUnit,
    });
    voice.setStrict(false);
    voice.addTickables(staveNotes);

    // Phase 24b.2 — Tuplets. Group consecutive notes that share the
    // same tupletGroup id and wrap them in a VexFlow Tuplet. The
    // Tuplet renders the bracket + the number ("3" for triplet).
    const tuplets: Tuplet[] = [];
    let i = 0;
    while (i < melody.length) {
      const groupId = melody[i].tupletGroup;
      if (!groupId) {
        i++;
        continue;
      }
      // Collect run of consecutive same-group notes.
      let j = i;
      while (j < melody.length && melody[j].tupletGroup === groupId) j++;
      const runNotes = staveNotes.slice(i, j);
      if (runNotes.length >= 2) {
        tuplets.push(
          new Tuplet(runNotes, {
            numNotes: runNotes.length,
            // For a triplet (3 in space of 2) at any duration, the
            // notesOccupied is the next-power-of-2 below the count.
            // Tuple of 3 → 2, 5 → 4, 6 → 4, 7 → 4. Standard.
            notesOccupied: Math.pow(
              2,
              Math.floor(Math.log2(runNotes.length)),
            ),
          }),
        );
      }
      i = j;
    }

    // Phase 24b.2 — Intra-measure ties. For each note with tieToNext
    // set, build a StaveTie connecting it to the next note.
    // Cross-measure ties are deferred to Phase 24b.3 (would require
    // multi-measure render coordination).
    const ties: StaveTie[] = [];
    for (let k = 0; k < melody.length - 1; k++) {
      const cur = melody[k];
      if (cur.kind !== "note" || !cur.tieToNext) continue;
      const next = melody[k + 1];
      // Only render a tie when the next note is a pitched note (not a
      // rest) and same pitch — that's the musically meaningful case.
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

    // Format + draw.
    const startX = stave.getNoteStartX();
    const availableWidth = width - startX - 12;
    new Formatter().joinVoices([voice]).format([voice], availableWidth);
    voice.draw(context, stave);
    tuplets.forEach((t) => t.setContext(context).draw());
    ties.forEach((t) => t.setContext(context).draw());

    // Phase 24c — Lyrics. Render syllables below the staff. Matches
    // the SheetSurface engraving so the modal preview is faithful.
    // Phase 24c.1.2: same two-pass collision-avoidance layout as
    // SheetSurface so syllables don't run together on closely-spaced
    // eighth notes within the modal preview.
    const lyricY = STAVE_TOP_PAD + STAVE_VISUAL_HEIGHT + LYRIC_OFFSET_BELOW_STAFF;
    context.save();
    context.setFont("Georgia, 'Times New Roman', serif", 11, "");
    const noteAbsoluteXs = staveNotes.map((sn) => sn.getAbsoluteX());
    type SyllableLayout = {
      noteIdx: number;
      text: string;
      centerX: number;
      width: number;
      continuation: "none" | "hyphen" | "underscore";
    };
    const syllables: SyllableLayout[] = [];
    melody.forEach((mn, idx) => {
      if (mn.kind !== "note") return;
      if (!mn.lyric || mn.lyric.text.length === 0) return;
      const displayText =
        mn.lyric.continuation === "hyphen"
          ? `${mn.lyric.text}-`
          : mn.lyric.text;
      const w = displayText.length * 7.2;
      syllables.push({
        noteIdx: idx,
        text: displayText,
        centerX: noteAbsoluteXs[idx],
        width: w,
        continuation: mn.lyric.continuation,
      });
    });
    // Phase 24c.1.3: bumped 3 → 8 to match SheetSurface.
    const MIN_LYRIC_GAP = 8;
    let prevRight = -Infinity;
    syllables.forEach((s) => {
      const leftEdge = s.centerX - s.width / 2;
      if (leftEdge < prevRight + MIN_LYRIC_GAP) {
        s.centerX = prevRight + MIN_LYRIC_GAP + s.width / 2;
      }
      prevRight = s.centerX + s.width / 2;
    });
    syllables.forEach((s) => {
      const textX = s.centerX - s.width / 2;
      context.fillText(s.text, textX, lyricY);
      if (s.continuation === "underscore") {
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
          context.beginPath();
          context.moveTo(lineStartX, lineY);
          context.lineTo(lineEndX, lineY);
          context.setLineWidth(1.2);
          context.stroke();
        }
      }
    });
    context.restore();
  }, [melody, timeSignature, showClef, showTimeSignature, width, height]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden"
      style={{ width, height }}
      aria-label="Melody staff"
    />
  );
}
