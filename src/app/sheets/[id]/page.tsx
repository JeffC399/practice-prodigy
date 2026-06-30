"use client";

import { ArrowLeft, Pencil, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { renderChord } from "@/lib/music/render-chord";
import { useSheetsLibrary } from "@/lib/state/sheets-library";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * /sheets/[id] — read-only display + print view (Phase 24a MVP).
 *
 * Renders the chord chart in a clean printable layout. Browser
 * print dialog (window.print()) hands off to "Save as PDF" on
 * most platforms. CSS @media print rules hide the chrome
 * (header, footer, edit button) so only the chart prints.
 */
export default function SheetViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const sheet = useSheetsLibrary((s) => s.sheets.find((x) => x.id === id));
  const markSheetOpened = useSheetsLibrary((s) => s.markSheetOpened);
  const notationStyle = useUserPrefs((s) => s.notationDefault);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  useEffect(() => {
    if (id && mounted) markSheetOpened(id);
  }, [id, mounted, markSheetOpened]);

  if (!mounted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Loading sheet…
        </div>
      </main>
    );
  }

  if (!sheet) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">Sheet not found.</p>
          <Link
            href="/sheets"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to library
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        {/* Toolbar — hidden in print */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/sheets"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All sheets
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:border-primary/40 transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <Link
              href={`/sheets/${id}/edit`}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </div>

        {/* The printable sheet itself */}
        <article className="flex flex-col gap-6 rounded-xl border border-border bg-card/40 px-8 py-10 print:border-0 print:bg-transparent print:p-0">
          {/* Title block */}
          <header className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              {sheet.title || "Untitled"}
            </h1>
            {sheet.composer && (
              <p className="text-sm text-muted-foreground italic">
                {sheet.composer}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {sheet.style && <span>{sheet.style}</span>}
              {sheet.bpm && <span>♩ = {sheet.bpm}</span>}
              <span>
                {sheet.keyTonic} {sheet.keyMode}
              </span>
              <span>
                {sheet.timeSignature.beatsPerMeasure}/
                {sheet.timeSignature.beatUnit}
              </span>
            </div>
          </header>

          {/* Chord grid — 4 measures per line. Each measure renders
              its chords (with split-bar treatment for 2-chord bars). */}
          <div className="grid grid-cols-4 gap-0 border-l border-t border-foreground/30">
            {sheet.measures.map((measure, mIdx) => (
              <div
                key={measure.id}
                className="flex min-h-[4rem] items-center justify-center border-b border-r border-foreground/30 px-2 py-3"
              >
                {measure.chords.length === 0 ? (
                  <span className="font-mono text-xs text-muted-foreground/40">
                    —
                  </span>
                ) : measure.chords.length === 1 ? (
                  <span className="font-mono text-lg font-semibold text-foreground">
                    {renderChord(measure.chords[0], notationStyle)}
                  </span>
                ) : (
                  <div className="flex w-full items-center justify-around gap-2">
                    {measure.chords.map((chord, cIdx) => (
                      <span
                        key={cIdx}
                        className="font-mono text-base font-semibold text-foreground"
                      >
                        {renderChord(chord, notationStyle)}
                      </span>
                    ))}
                  </div>
                )}
                {/* Measure number — small, top-left */}
                <span className="absolute mt-[-2.5rem] ml-[-2.5rem] font-mono text-[9px] text-muted-foreground/60">
                  {mIdx + 1}
                </span>
              </div>
            ))}
          </div>

          {/* Footer (printable) */}
          <footer className="flex items-center justify-end font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Practice Prodigy
          </footer>
        </article>
      </div>

      {/* @media print rules: hide chrome, ensure clean page */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0.75in;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
