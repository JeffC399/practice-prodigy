"use client";

import { ArrowLeft, Pencil, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSheetsLibrary } from "@/lib/state/sheets-library";
import { SheetSurface } from "@/components/sheets/sheet-surface";

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
      <div className="flex w-full max-w-5xl flex-col gap-6">
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

        {/* The printable sheet itself — light paper surface with
            continuous staff engraving (Phase 24b.3 rework). */}
        <div className="sheet-print-wrap">
          <SheetSurface sheet={sheet} />
        </div>
      </div>

      {/* @media print rules: hide chrome, ensure clean page */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0.5in;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .sheet-print-wrap {
            margin: 0 !important;
          }
          .sheet-paper {
            width: 100% !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </main>
  );
}
