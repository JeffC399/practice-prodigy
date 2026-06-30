"use client";

import { useRef } from "react";
import type { SheetMeasureRect } from "@/components/sheets/sheet-surface";
import type { MelodyCaret } from "@/lib/sheets/melody-caret";
import {
  measureAtX,
  pitchAtClickY,
} from "@/lib/sheets/melody-entry";

/**
 * Phase 25.0 — click-on-staff melody entry overlay.
 * Phase 25.1 — adds a visible vertical caret in the active measure +
 * exposes the caret position so the editor can keyboard-drive it.
 *
 * Positioned absolutely over a `<SheetSurface>` paper. Listens for
 * clicks anywhere on the paper; for clicks that land inside a measure's
 * staff area (with a generous vertical buffer for above-/below-staff
 * notes), invokes `onClickStaff(measureIdx, pitch)` with the inferred
 * pitch. The parent then decides whether to place a note or a rest
 * (based on the side-panel state).
 *
 * Visual: crosshair cursor inside the paper + a vertical sky-blue
 * caret line in the active measure (when a caret position is set).
 * Visual caret + click-to-set-position land in Phase 25.2 (with
 * beat-targeting click X).
 */
export type MelodyEntryOverlayProps = {
  measureRects: SheetMeasureRect[];
  paperHeight: number;
  /** Current caret position; null if no caret active. */
  caret: MelodyCaret | null;
  /** Beats per measure — used to interpolate caret X within a measure. */
  beatsPerMeasure: number;
  /**
   * Fires when the user clicks on a staff area inside a measure.
   * The parent uses the side-panel state to construct the actual
   * MelodyNote and write it to the sheet.
   */
  onClickStaff: (measureIdx: number, pitch: string) => void;
  /** Called when the user presses Escape — parent exits the mode. */
  onExit: () => void;
};

/** Vertical buffer above the top staff line + below the bottom staff
 *  line where clicks still register as note placements. Lets users
 *  place ledger-line notes above/below the staff. */
const STAFF_HIT_BUFFER = 36;

export function MelodyEntryOverlay({
  measureRects,
  paperHeight,
  caret,
  beatsPerMeasure,
  onClickStaff,
  onExit,
}: MelodyEntryOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Phase 25.1: caret rendering math. The caret X is a linear
  // interpolation across the active measure's note area; Y spans the
  // staff (plus a small overhang above + below). VexFlow's proportional
  // X spacing makes the linear approximation visually wrong for
  // partially-filled measures, but it's accurate enough to anchor
  // keyboard input in 25.1 — 25.2 will refine to actual beat positions.
  const caretMeasure = caret
    ? measureRects.find((r) => r.measureIdx === caret.measureIdx)
    : null;
  const caretX = caretMeasure
    ? caretMeasure.noteStartX +
      (caret!.beatOffset / Math.max(1, beatsPerMeasure)) *
        (caretMeasure.noteEndX - caretMeasure.noteStartX)
    : 0;
  const caretYTop = caretMeasure ? caretMeasure.topLineY - 8 : 0;
  const caretYBottom = caretMeasure ? caretMeasure.bottomLineY + 10 : 0;
  const caretHeight = caretYBottom - caretYTop;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ height: paperHeight, cursor: "crosshair" }}
      role="presentation"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onExit();
        }
      }}
      onClick={(e) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const measureIdx = measureAtX(measureRects, clickX);
        if (measureIdx === null) return;
        const targetRect = measureRects.find(
          (r) => r.measureIdx === measureIdx,
        );
        if (!targetRect) return;
        // Reject clicks too far above / below the staff so users don't
        // accidentally place a note when clicking near the title block
        // or in the lyric band area.
        if (
          clickY < targetRect.topLineY - STAFF_HIT_BUFFER ||
          clickY > targetRect.bottomLineY + STAFF_HIT_BUFFER
        ) {
          return;
        }
        const pitch = pitchAtClickY(targetRect, clickY);
        onClickStaff(measureIdx, pitch);
      }}
    >
      {caretMeasure && (
        <div
          aria-hidden
          className="pointer-events-none absolute animate-pulse"
          style={{
            left: caretX,
            top: caretYTop,
            width: 2,
            height: caretHeight,
            backgroundColor: "#0ea5e9", // sky-500
            borderRadius: 1,
            boxShadow: "0 0 6px rgba(14, 165, 233, 0.6)",
          }}
        />
      )}
    </div>
  );
}
