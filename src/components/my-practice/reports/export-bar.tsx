"use client";

import { Download, Printer } from "lucide-react";
import { useCallback } from "react";
import {
  buildCsvFilename,
  buildReportsCsv,
  downloadCsv,
} from "@/lib/practice/export-csv";
import type { ReportsRange } from "@/lib/practice/reports-queries";
import { useRoutinesLibrary } from "@/lib/practice/routines-library";
import type { PracticeSession } from "@/lib/practice/types";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * ExportBar — Slice D.10 (Phase 126).
 *
 * Two buttons above the analytics stack:
 *
 *   - CSV: builds a labeled-section spreadsheet-friendly file and
 *     triggers a browser download.
 *   - PDF: toggles the `.reports-print-mode` class on <html>, calls
 *     window.print() (which fires the browser's native "Save as
 *     PDF"), and cleans up when the print dialog closes.
 *
 * ## Why not a real PDF library?
 *
 * `window.print()` + print CSS is what every "export as PDF" flow
 * on Vercel Next apps ships as the first pass. It costs zero bundle
 * bytes, respects the user's chosen paper size + margins, and
 * produces a PDF that includes vector text (searchable, copyable).
 * If we later need pixel-perfect layouts we can pivot to jsPDF or a
 * server-side generator.
 */
export function ExportBar({
  sessionsInRange,
  range,
}: {
  sessionsInRange: readonly PracticeSession[];
  range: ReportsRange;
}) {
  const routines = useRoutinesLibrary((s) => s.routines);
  const customCategories = useUserPrefs((s) => s.customCategories);

  const handleCsv = useCallback(() => {
    const csv = buildReportsCsv({
      sessions: sessionsInRange,
      routines,
      customCategories,
      range,
    });
    downloadCsv(buildCsvFilename(range), csv);
  }, [sessionsInRange, routines, customCategories, range]);

  const handlePdf = useCallback(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    root.classList.add("reports-print-mode");
    // The `afterprint` event fires when the user closes the print
    // dialog (whether they printed or canceled). Clean up either way.
    const cleanup = () => {
      root.classList.remove("reports-print-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    // Small deferral so the print CSS has a chance to compute before
    // the print dialog captures the viewport.
    requestAnimationFrame(() => window.print());
  }, []);

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleCsv}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        title="Download the current view as a CSV file"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Export CSV
      </button>
      <button
        type="button"
        onClick={handlePdf}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        title="Open the browser's Print dialog — use 'Save as PDF' as the destination"
      >
        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
        Print / PDF
      </button>
    </div>
  );
}
