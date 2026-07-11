"use client";

import { FileMusic } from "lucide-react";
import { useMemo } from "react";
import type { Sheet } from "@/lib/sheets/types";
import { SheetSurface } from "./sheet-surface";

/**
 * Live-rendered thumbnail preview of a lead sheet, shown on library
 * cards. Reuses `SheetSurface` at its native 816px paper width and
 * scales the whole render down with CSS `transform`, cropped to a
 * fixed card-header rectangle that shows the title block + the first
 * line of music.
 *
 * Design choice — reuse over rewrite: SheetSurface already handles
 * every notation detail (clefs, key sigs, chord symbols, ties, slurs,
 * ottava, lyrics, form markings). Writing a separate mini-renderer
 * would drift from the real engraving as SheetSurface evolves. The
 * scale-and-crop approach gives a WYSIWYG preview automatically.
 *
 * Performance note: each thumbnail runs VexFlow on mount. For typical
 * libraries (~10-50 sheets) this is fine at page load; if a library
 * grows past ~100 sheets we'd want to lazy-render on IntersectionObserver.
 * Empty sheets skip VexFlow entirely via the placeholder path — the
 * common "user just clicked New sheet then abandoned" case is cheap.
 *
 * Fixed dimensions: 240x120 fits the current card grid comfortably at
 * both 1-column (mobile) and 2-column (desktop) widths.
 */

const THUMB_WIDTH = 240;
const THUMB_HEIGHT = 120;
const SOURCE_PAPER_WIDTH = 816;
const SCALE = THUMB_WIDTH / SOURCE_PAPER_WIDTH;

export function SheetThumbnail({ sheet }: { sheet: Sheet }) {
  const isEmpty = useMemo(() => {
    return sheet.measures.every(
      (m) => m.chords.length === 0 && (m.melody?.length ?? 0) === 0,
    );
  }, [sheet.measures]);

  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/20"
        style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
        aria-hidden="true"
      >
        <FileMusic className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-md border border-border/60 bg-white"
      style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
      aria-hidden="true"
    >
      <div
        style={{
          width: SOURCE_PAPER_WIDTH,
          transform: `scale(${SCALE})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        <SheetSurface sheet={sheet} measuresPerLine={4} />
      </div>
    </div>
  );
}
