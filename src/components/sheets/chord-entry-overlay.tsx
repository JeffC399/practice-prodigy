"use client";

import { useEffect, useRef } from "react";
import type { SheetMeasureRect } from "@/components/sheets/sheet-surface";

/**
 * Phase 25.2 — chord entry overlay.
 *
 * Positioned absolutely over a `<SheetSurface>` paper. When the
 * "chord-entry" editor mode is active, the overlay renders one click
 * region per BEAT of every measure (sized to the time signature), in a
 * thin band above the staff. Clicking a region anchors the chord
 * cursor at that (measureIdx, beat) and shows an inline text input
 * with an autocomplete dropdown.
 *
 * The overlay is purely a UI surface — all chord-parsing and write
 * logic lives in the editor wiring (using `chord-parser.ts` helpers).
 * Print-hidden by virtue of being rendered inside the editor only;
 * the view page never mounts this overlay.
 */

export type ChordCursor = {
  measureIdx: number;
  /** 1-indexed beat within the measure. */
  beat: number;
};

export type ChordEntryOverlayProps = {
  measureRects: SheetMeasureRect[];
  paperHeight: number;
  beatsPerMeasure: number;
  cursor: ChordCursor | null;
  /** Current draft text in the inline input. */
  draft: string;
  /** Autocomplete suggestions for the current draft. */
  suggestions: string[];
  onDraftChange: (value: string) => void;
  onSetCursor: (cursor: ChordCursor) => void;
  /** Commit current draft + advance cursor by 1 beat. */
  onCommitAdvance: () => void;
  /** Commit + retreat. */
  onCommitRetreat: () => void;
  /** Pick a specific autocomplete suggestion. */
  onPickSuggestion: (suggestion: string) => void;
  /**
   * Phase 25.2.1: fires when the user clicks anywhere outside the
   * input/dropdown wrapper AND outside any beat hit region. The parent
   * commits the current draft and clears the cursor (which hides the
   * input + dropdown) but stays in chord-entry mode so hit regions
   * remain available.
   */
  onClickOutside: () => void;
  /** Exit chord-entry mode entirely. */
  onExit: () => void;
};

/** Vertical band above the staff where chord hit regions sit. */
const CHORD_BAND_TOP_OFFSET = 28;
const CHORD_BAND_HEIGHT = 22;

export function ChordEntryOverlay({
  measureRects,
  paperHeight,
  beatsPerMeasure,
  cursor,
  draft,
  suggestions,
  onDraftChange,
  onSetCursor,
  onCommitAdvance,
  onCommitRetreat,
  onPickSuggestion,
  onClickOutside,
  onExit,
}: ChordEntryOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  // Auto-focus the input whenever the cursor changes.
  useEffect(() => {
    if (cursor && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [cursor]);

  /**
   * Phase 25.2.1 — click-outside-closes. Listens for mousedown
   * anywhere on the document while the inline input/dropdown is
   * open. If the click landed outside the wrapper AND outside any
   * beat hit region (those handle their own re-anchor via onSetCursor),
   * commit + clear the cursor via onClickOutside. mousedown (not
   * click) so the close fires before any subsequent focus/blur
   * disrupts the next interaction.
   */
  useEffect(() => {
    if (!cursor) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Inside the input + dropdown wrapper? — leave it alone.
      if (editorWrapperRef.current?.contains(target)) return;
      // Inside a beat hit region? — its own onClick will re-anchor
      // the cursor, so don't preemptively close.
      if (target.closest("[data-chord-hit]")) return;
      onClickOutside();
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [cursor, onClickOutside]);

  // Compute the inline-input position from the active cursor.
  const activeRect = cursor
    ? measureRects.find((r) => r.measureIdx === cursor.measureIdx)
    : null;
  const measureWidth = activeRect
    ? activeRect.noteEndX - activeRect.noteStartX
    : 0;
  const beatFraction = cursor
    ? (cursor.beat - 1) / Math.max(1, beatsPerMeasure)
    : 0;
  const inputX = activeRect
    ? activeRect.noteStartX + beatFraction * measureWidth
    : 0;
  const inputY = activeRect
    ? activeRect.topLineY - CHORD_BAND_TOP_OFFSET
    : 0;

  return (
    <div
      className="pointer-events-none absolute inset-0 print:hidden"
      style={{ height: paperHeight }}
      aria-label="Chord entry overlay"
    >
      {/* Per-beat hit regions across every measure. */}
      {measureRects.flatMap((rect) => {
        const mWidth = rect.noteEndX - rect.noteStartX;
        const beatWidth = mWidth / Math.max(1, beatsPerMeasure);
        return Array.from({ length: beatsPerMeasure }, (_, beatIdx) => {
          const beat = beatIdx + 1;
          const isActive =
            cursor &&
            cursor.measureIdx === rect.measureIdx &&
            cursor.beat === beat;
          const x = rect.noteStartX + beatIdx * beatWidth;
          const y = rect.topLineY - CHORD_BAND_TOP_OFFSET;
          return (
            <button
              key={`${rect.measureIdx}-${beat}`}
              type="button"
              data-chord-hit="true"
              onClick={() =>
                onSetCursor({ measureIdx: rect.measureIdx, beat })
              }
              className={`pointer-events-auto absolute rounded-sm border transition-colors ${
                isActive
                  ? "border-emerald-500/70 bg-emerald-500/20"
                  : "border-emerald-500/0 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500/40"
              }`}
              style={{
                left: x,
                top: y,
                width: beatWidth - 2,
                height: CHORD_BAND_HEIGHT,
              }}
              aria-label={`Edit chord at measure ${rect.measureIdx + 1} beat ${beat}`}
              title={`Measure ${rect.measureIdx + 1}, beat ${beat}`}
            />
          );
        });
      })}

      {/* Inline text input + autocomplete dropdown. */}
      {cursor && activeRect && (
        <div
          ref={editorWrapperRef}
          className="pointer-events-auto absolute"
          style={{ left: inputX, top: inputY - 32 }}
        >
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" || e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) onCommitRetreat();
                else onCommitAdvance();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onExit();
              }
            }}
            placeholder="Cmaj7"
            className="w-28 rounded border-2 border-emerald-500/70 bg-white px-1.5 py-0.5 text-center font-mono text-sm text-black shadow-md outline-none focus:border-emerald-600"
            spellCheck={false}
            autoComplete="off"
            aria-label="Chord symbol"
          />
          {suggestions.length > 0 && (
            <ul
              className="absolute left-0 top-full mt-1 max-h-56 w-32 overflow-y-auto rounded-md border border-emerald-500/40 bg-white shadow-xl"
              role="listbox"
            >
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => onPickSuggestion(s)}
                    className="block w-full px-2 py-1 text-left font-mono text-xs text-black hover:bg-emerald-100"
                    role="option"
                    aria-selected={false}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
