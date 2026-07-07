"use client";

import {
  ArrowLeft,
  Loader2,
  Pencil,
  Play,
  Printer,
  Share2,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { sheetPlayback } from "@/lib/audio/sheet-playback";
import { ShareModal } from "@/components/sheets/share-modal";
import { SheetSurface } from "@/components/sheets/sheet-surface";
import { useSheetsLibrary } from "@/lib/state/sheets-library";

/**
 * /sheets/[id] — read-only display + print view.
 *
 * Phase 24a MVP shipped Print + Edit only.
 * Phase 34.7 (this pass): also surfaces **Play** and **Share** so
 * consuming actions (hear the chart aloud, send it to someone) don't
 * require entering Edit mode first. Editing-scoped actions (undo,
 * chord entry, focus mode, etc.) still live only on the edit page.
 *
 * Renders the chord chart in a clean printable layout. Browser
 * print dialog (window.print()) hands off to "Save as PDF" on
 * most platforms. CSS @media print rules hide the chrome
 * (header, footer, toolbar) so only the chart prints.
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

  // Phase 34.7 — playback + share state, mirrored from the edit page's
  // pattern. Simpler here: no tempo / loop / audio-settings controls
  // (those stay in Edit) — just Play/Stop with default tempo + count-in
  // from the sheet's own metadata.
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Stop playback on unmount so navigating away doesn't leave audio
  // running in the background.
  useEffect(() => {
    return () => {
      sheetPlayback.cancel();
    };
  }, []);

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

  const handlePlayToggle = async () => {
    if (isPlaying) {
      sheetPlayback.cancel();
      setIsPlaying(false);
      return;
    }
    setIsLoadingAudio(true);
    try {
      await sheetPlayback.play(sheet, {
        countIn: sheet.countIn ?? false,
        onEnded: () => setIsPlaying(false),
      });
      setIsPlaying(true);
    } catch (err) {
      console.error("[sheet-view] play() failed", err);
      setIsPlaying(false);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        {/* Toolbar — hidden in print. Phase 34.7: Play is now the
            primary CTA (consume the sheet); Share, Print, Edit are
            secondary. Order matches the edit page's toolbar so the two
            views feel continuous. */}
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
              disabled={isLoadingAudio}
              onClick={handlePlayToggle}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isPlaying
                  ? "border-rose-500/60 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                  : "border-emerald-500/40 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/15"
              }`}
              title={isPlaying ? "Stop playback" : "Play this sheet aloud"}
              aria-label={isPlaying ? "Stop playback" : "Play"}
            >
              {isLoadingAudio ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Square className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isLoadingAudio ? "Loading…" : isPlaying ? "Stop" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              title="Share this sheet"
              aria-label="Share"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
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
          <SheetSurface sheet={sheet} measuresPerLine={sheet.measuresPerLine} />
        </div>
      </div>

      {/* Phase 34.7 — Share modal reused from the edit page. */}
      <ShareModal
        sheet={sheet}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />

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
