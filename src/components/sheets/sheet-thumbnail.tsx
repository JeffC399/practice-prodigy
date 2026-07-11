"use client";

import { FileMusic } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Sheet } from "@/lib/sheets/types";
import { SheetSurface } from "./sheet-surface";

/**
 * Live-rendered thumbnail preview of a lead sheet, shown on library
 * cards. Reuses `SheetSurface` at its native 816px paper width and
 * scales the whole render down with CSS `transform` inside a
 * responsive-width wrapper.
 *
 * Phase 36 shipped at fixed 240×120. Phase 41 makes the thumbnail
 * fill its container via ResizeObserver-driven scale — so the card
 * grid can have any column width and the thumbnail always fills it
 * cleanly, eliminating the dead space that the fixed-width version
 * left on wider cards.
 *
 * Design choice — reuse over rewrite: SheetSurface already handles
 * every notation detail (clefs, key sigs, chord symbols, ties, slurs,
 * ottava, lyrics, form markings). Writing a separate mini-renderer
 * would drift from the real engraving as SheetSurface evolves.
 *
 * Empty sheets skip VexFlow entirely and show a placeholder icon —
 * common case for freshly-created-then-abandoned sheets is cheap.
 */

const SOURCE_PAPER_WIDTH = 816;
/** Aspect ratio of the visible band we crop out — wider than tall so
 *  we see title block + roughly the first line of music. */
const THUMB_ASPECT = "2 / 1";

export function SheetThumbnail({ sheet }: { sheet: Sheet }) {
  const isEmpty = useMemo(() => {
    return sheet.measures.every(
      (m) => m.chords.length === 0 && (m.melody?.length ?? 0) === 0,
    );
  }, [sheet.measures]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setScale(w / SOURCE_PAPER_WIDTH);
      }
    });
    ro.observe(el);
    // Prime initial scale synchronously so first paint isn't blank.
    setScale(el.clientWidth / SOURCE_PAPER_WIDTH);
    return () => ro.disconnect();
  }, []);

  if (isEmpty) {
    return (
      <div
        className="flex w-full flex-col items-center justify-center gap-1.5 border-b border-border/60 bg-muted/20 text-muted-foreground/60"
        style={{ aspectRatio: THUMB_ASPECT }}
      >
        <FileMusic className="h-8 w-8" aria-hidden="true" />
        <span className="text-xs">Empty — start writing</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden bg-white"
      style={{ aspectRatio: THUMB_ASPECT }}
      aria-hidden="true"
    >
      {scale !== null && (
        <div
          style={{
            width: SOURCE_PAPER_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        >
          <SheetSurface sheet={sheet} measuresPerLine={4} />
        </div>
      )}
    </div>
  );
}
