"use client";

import { useEffect, useRef } from "react";
import {
  SHEET_LYRIC_INPUT_OFFSET,
  SHEET_NOTE_HIT_REGION_HEIGHT,
  type SheetNotePosition,
} from "@/components/sheets/sheet-surface";
import type { LyricCursor } from "@/lib/sheets/lyric-cursor";

/**
 * Lyric editing overlay (Phase 24c).
 *
 * Positioned absolutely over a `<SheetSurface>`. Renders:
 *   - A button-sized click region for every pitched note. Clicking a
 *     region places the lyric cursor at that note.
 *   - A subtle highlight ring around the currently focused note.
 *   - A floating `<input>` anchored below the cursor note. Auto-
 *     focuses on mount and on cursor changes.
 *
 * The overlay only renders when its parent (the editor page) has
 * lyric mode toggled on. Outside lyric mode, the SheetSurface stays a
 * pure render with no click handlers.
 */
export type LyricOverlayProps = {
  positions: SheetNotePosition[];
  cursor: LyricCursor | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSetCursor: (cursor: LyricCursor) => void;
  /** Space / Tab / Enter: commit + advance. */
  onCommitAdvance: () => void;
  /** Backspace on empty input: commit (or clear) + retreat. */
  onRetreat: () => void;
  /** Escape: exit lyric mode. */
  onExit: () => void;
};

export function LyricOverlay({
  positions,
  cursor,
  draft,
  onDraftChange,
  onSetCursor,
  onCommitAdvance,
  onRetreat,
  onExit,
}: LyricOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input whenever the cursor moves to a new note. Without
  // this, advancing via space would leave focus on the prior input.
  useEffect(() => {
    if (cursor && inputRef.current) {
      inputRef.current.focus();
      // Place caret at the end so backspace behaves naturally.
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [cursor]);

  const cursorPosition = cursor
    ? positions.find(
        (p) =>
          p.measureIdx === cursor.measureIdx && p.noteIdx === cursor.noteIdx,
      )
    : null;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-label="Lyric editing overlay"
    >
      {/* Click regions for every pitched note. */}
      {positions
        .filter((p) => p.isPitched)
        .map((p) => {
          const isActive =
            cursor &&
            cursor.measureIdx === p.measureIdx &&
            cursor.noteIdx === p.noteIdx;
          return (
            <button
              key={`${p.measureIdx}-${p.noteIdx}`}
              type="button"
              onClick={() =>
                onSetCursor({
                  measureIdx: p.measureIdx,
                  noteIdx: p.noteIdx,
                })
              }
              className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
                isActive
                  ? "bg-amber-400/30 ring-2 ring-amber-500/70"
                  : "hover:bg-amber-300/15"
              }`}
              style={{
                left: p.x,
                top: p.y,
                width: Math.max(20, p.width),
                height: SHEET_NOTE_HIT_REGION_HEIGHT,
              }}
              aria-label={`Edit lyric on measure ${p.measureIdx + 1}, note ${p.noteIdx + 1}`}
            />
          );
        })}

      {/* Floating input anchored under the cursor note. */}
      {cursorPosition && (
        <div
          className="pointer-events-auto absolute -translate-x-1/2"
          style={{
            left: cursorPosition.x,
            top: cursorPosition.staffBottomY + SHEET_LYRIC_INPUT_OFFSET,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Tab" || e.key === "Enter") {
                e.preventDefault();
                onCommitAdvance();
              } else if (e.key === "Backspace" && draft === "") {
                e.preventDefault();
                onRetreat();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onExit();
              }
            }}
            className="w-24 rounded border-2 border-amber-500/70 bg-white px-1.5 py-0.5 text-center font-serif text-[12px] text-black shadow-sm outline-none focus:border-amber-600"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            spellCheck={false}
            autoComplete="off"
            aria-label="Lyric syllable"
          />
        </div>
      )}
    </div>
  );
}
