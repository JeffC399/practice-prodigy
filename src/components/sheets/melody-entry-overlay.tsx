"use client";

import { useRef } from "react";
import type { SheetMeasureRect } from "@/components/sheets/sheet-surface";
import {
  measureAtX,
  pitchAtClickY,
} from "@/lib/sheets/melody-entry";

/**
 * Phase 25.0 — click-on-staff melody entry overlay.
 *
 * Positioned absolutely over a `<SheetSurface>` paper. Listens for
 * clicks anywhere on the paper; for clicks that land inside a measure's
 * staff area (with a generous vertical buffer for above-/below-staff
 * notes), invokes `onPlaceNote(measureIdx, pitch)` with the inferred
 * pitch. The parent then decides whether to place a note or a rest
 * (based on the side-panel state).
 *
 * Visual: crosshair cursor while inside the paper; no other affordance
 * yet. Visual caret + click-to-set-position land in Phase 25.2.
 */
export type MelodyEntryOverlayProps = {
  measureRects: SheetMeasureRect[];
  paperHeight: number;
  /**
   * Fires when the user clicks on a staff area inside a measure.
   * The parent uses the side-panel state to construct the actual
   * MelodyNote and write it to the sheet.
   */
  onPlaceNote: (measureIdx: number, pitch: string) => void;
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
  onPlaceNote,
  onExit,
}: MelodyEntryOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
        onPlaceNote(measureIdx, pitch);
      }}
    />
  );
}
