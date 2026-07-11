"use client";

import { ArrowLeft, Check, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { SheetSurface } from "@/components/sheets/sheet-surface";
import { decodeSheet } from "@/lib/sheets/share";
import { useSheetsLibrary } from "@/lib/state/sheets-library";

/**
 * Phase 33 — `/sheets/shared?d=<encoded>` route.
 *
 * Read-only view of a shared sheet. The encoded payload lives in the
 * URL query (`?d=...`); we decode client-side and render via the
 * standard `SheetSurface`. A "Save to my library" CTA imports the
 * sheet into the local store and navigates to the editor.
 *
 * When the payload is missing or malformed we show a friendly error
 * with a link back to the library.
 */
export default function SharedSheetPage() {
  // Next.js 16 requires useSearchParams to be inside a Suspense
  // boundary during prerender — wrap the real content so builds
  // succeed and the fallback shows briefly on slow first paints.
  return (
    <Suspense fallback={null}>
      <SharedSheetContent />
    </Suspense>
  );
}

function SharedSheetContent() {
  const params = useSearchParams();
  const router = useRouter();
  const importSheet = useSheetsLibrary((s) => s.importSheet);
  const [saved, setSaved] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const encoded = params.get("d") ?? "";
  const sheet = useMemo(() => decodeSheet(encoded), [encoded]);

  if (!mounted) {
    // Avoid hydration mismatch on the empty-search-params state.
    return null;
  }

  if (!sheet) {
    return (
      <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg font-semibold">Couldn’t load this shared sheet.</p>
          <p className="max-w-md text-sm text-muted-foreground">
            The link may be truncated, expired, or from an older version
            of Practice Prodigy. Ask the sender to reshare or send the
            JSON file instead.
          </p>
          <Link
            href="/sheets"
            className="mt-2 flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:border-primary/40 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to your library
          </Link>
        </div>
      </main>
    );
  }

  const onSave = () => {
    const newId = importSheet(sheet);
    setSaved(newId);
    // Small delay so the user sees the "Saved" state before we navigate.
    setTimeout(() => router.push(`/sheets/${newId}/edit`), 600);
  };

  return (
    <main id="main-content" className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/sheets"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All sheets
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-medium text-sky-500">
              Shared with you — read only
            </span>
            <button
              type="button"
              disabled={saved !== null}
              onClick={onSave}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                saved
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-500"
                  : "border-primary/60 bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved to library — opening…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save to my library
                </>
              )}
            </button>
          </div>
        </div>
        <SheetSurface
          sheet={sheet}
          measuresPerLine={sheet.measuresPerLine}
        />
      </div>
    </main>
  );
}
