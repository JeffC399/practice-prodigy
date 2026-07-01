"use client";

import { useEffect, useRef, useState } from "react";
import type { SheetNotePosition } from "@/components/sheets/sheet-surface";
import type { MelodySelection } from "@/lib/sheets/selection";
import { refId } from "@/lib/sheets/selection";

/**
 * Phase 31.4 — Selection overlay.
 *
 * Renders above the SheetSurface paper. Two responsibilities:
 *
 *   1. Draw a sky-blue highlight ring around every note that's in the
 *      current selection. Positions come from SheetSurface's onLayout
 *      note-positions array.
 *   2. Handle click + shift-click + drag-marquee selection input.
 *      Clicks on a note toggle-or-set that note; clicks on empty
 *      space start a marquee drag that adds notes inside the box.
 *
 * The overlay is fully controlled — it never owns selection state.
 * Selection lives in the editor page so keyboard shortcuts (Delete,
 * arrows, Cmd+C/V) can operate on it from anywhere.
 */

export type SelectionOverlayProps = {
  positions: SheetNotePosition[];
  paperHeight: number;
  selection: MelodySelection;
  onSelectionChange: (next: MelodySelection) => void;
  /** Optional cursor override; defaults to "cell" so the marquee reads as selectable. */
  cursor?: string;
};

const HIT_RADIUS_PX = 14;
const HIGHLIGHT_RADIUS_PX = 12;

function hitTest(
  positions: SheetNotePosition[],
  x: number,
  y: number,
): SheetNotePosition | null {
  // Take the closest note whose center is within HIT_RADIUS.
  let best: SheetNotePosition | null = null;
  let bestDist = HIT_RADIUS_PX;
  for (const p of positions) {
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

function notesInsideRect(
  positions: SheetNotePosition[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): SheetNotePosition[] {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return positions.filter(
    (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
  );
}

export function SelectionOverlay({
  positions,
  paperHeight,
  selection,
  onSelectionChange,
  cursor = "cell",
}: SelectionOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    /** Snapshot of selection at drag start — marquee adds to this on move. */
    baseSelection: MelodySelection;
    /** Whether shift was held on mousedown (append) vs. fresh (replace). */
    appendMode: boolean;
  } | null>(null);

  // Convert an event's client coords into paper-relative coords.
  const paperCoords = (
    e: React.MouseEvent<HTMLDivElement>,
  ): { x: number; y: number } => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const { x, y } = paperCoords(e);
    const hit = hitTest(positions, x, y);
    const shift = e.shiftKey;
    if (hit) {
      // Click-select on a note.
      const id = refId({
        measureIdx: hit.measureIdx,
        noteIdx: hit.noteIdx,
      });
      const next = new Set(shift ? selection : []);
      if (shift && selection.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange(next);
      return;
    }
    // Empty-space click → start marquee.
    const base = shift ? new Set(selection) : new Set<string>();
    if (!shift) onSelectionChange(new Set());
    setDrag({
      startX: x,
      startY: y,
      curX: x,
      curY: y,
      baseSelection: base,
      appendMode: shift,
    });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDrag((d) => (d ? { ...d, curX: x, curY: y } : d));
      const hits = notesInsideRect(
        positions,
        drag.startX,
        drag.startY,
        x,
        y,
      );
      const next = new Set(drag.baseSelection);
      for (const p of hits) {
        next.add(refId({ measureIdx: p.measureIdx, noteIdx: p.noteIdx }));
      }
      onSelectionChange(next);
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // `drag.baseSelection` + `drag.startX/Y` are captured at drag-start
    // and don't change during the drag; positions changes are handled
    // by the effect re-running on positions/selection updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.startX, drag?.startY, positions]);

  const marqueeRect = drag
    ? {
        left: Math.min(drag.startX, drag.curX),
        top: Math.min(drag.startY, drag.curY),
        width: Math.abs(drag.curX - drag.startX),
        height: Math.abs(drag.curY - drag.startY),
      }
    : null;

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-10 print:hidden"
      style={{
        cursor,
        height: paperHeight,
      }}
      onMouseDown={onMouseDown}
    >
      {/* Selection highlights. */}
      {positions.map((p) => {
        const id = refId({
          measureIdx: p.measureIdx,
          noteIdx: p.noteIdx,
        });
        if (!selection.has(id)) return null;
        return (
          <div
            key={id}
            className="absolute rounded-full border-2 border-sky-500 bg-sky-500/20 pointer-events-none"
            style={{
              left: p.x - HIGHLIGHT_RADIUS_PX,
              top: p.y - HIGHLIGHT_RADIUS_PX,
              width: HIGHLIGHT_RADIUS_PX * 2,
              height: HIGHLIGHT_RADIUS_PX * 2,
            }}
          />
        );
      })}
      {/* Marquee rectangle. */}
      {marqueeRect && (
        <div
          className="absolute border border-sky-500 bg-sky-500/10 pointer-events-none"
          style={{
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
          }}
        />
      )}
    </div>
  );
}
