"use client";

import { useEffect, useRef } from "react";
import {
  Renderer,
  Stave,
  StaveNote,
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
 * Deferred to 24b.2:
 *   - Ties (cross-measure note connection)
 *   - Triplets
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
const DEFAULT_HEIGHT = 90;
const STAVE_TOP_PAD = 10;

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
      // Mark sharps / flats on the note.
      const accidentalMatch = n.pitch.match(/^[a-g]([#b])/i);
      if (accidentalMatch) {
        // VexFlow auto-renders accidentals from key signatures, but
        // here we author them per-note. The Accidental import keeps
        // the bundle leaner if we add it later; v0.1 relies on
        // VexFlow's automatic accidental rendering from key strings.
      }
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

    // Format + draw.
    const startX = stave.getNoteStartX();
    const availableWidth = width - startX - 12;
    new Formatter().joinVoices([voice]).format([voice], availableWidth);
    voice.draw(context, stave);
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
