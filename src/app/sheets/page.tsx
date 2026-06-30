"use client";

import { FileMusic, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSheetsLibrary } from "@/lib/state/sheets-library";

/**
 * /sheets — lead-sheet library landing page (Phase 24a MVP).
 *
 * Shows the user's saved sheets as a grid of cards. "+ New sheet"
 * creates a default 8-bar sheet and navigates to its editor.
 * Each card shows title + composer + key + measure count, plus
 * edit + delete affordances. Sort: most-recently-opened first.
 */
export default function SheetsLibraryPage() {
  const router = useRouter();
  const sheets = useSheetsLibrary((s) => s.sheets);
  const createSheet = useSheetsLibrary((s) => s.createSheet);
  const deleteSheet = useSheetsLibrary((s) => s.deleteSheet);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sortedSheets = [...sheets].sort(
    (a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt),
  );

  const handleCreate = () => {
    const id = createSheet();
    router.push(`/sheets/${id}/edit`);
  };

  if (!mounted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Loading sheets…
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Lead Sheets
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Author chord charts. v1 supports chord-only sheets with
            title, composer, style, key, time signature, and a
            per-measure chord grid. Melody, lyrics, and form
            markings ship in subsequent phases.
          </p>
        </header>

        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Your sheets
            {sortedSheets.length > 0 && (
              <span className="ml-1.5 text-muted-foreground/70 font-normal normal-case tracking-normal">
                · {sortedSheets.length}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            New sheet
          </button>
        </div>

        {sortedSheets.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-background/30 px-6 py-12 text-center">
            <FileMusic className="h-10 w-10 text-muted-foreground/40" />
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">
                No sheets yet
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Click <span className="font-medium">+ New sheet</span> to
                start a chord chart. You can add title, composer, key,
                time signature, and per-measure chords.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sortedSheets.map((sheet) => (
              <div
                key={sheet.id}
                className="group relative flex flex-col gap-1.5 rounded-xl border border-border bg-card/40 p-4 hover:border-primary/40 transition-colors"
              >
                <Link
                  href={`/sheets/${sheet.id}`}
                  className="flex flex-col gap-1.5"
                >
                  <span className="text-base font-medium text-foreground truncate pr-16">
                    {sheet.title || "Untitled"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {sheet.composer ? `${sheet.composer} · ` : ""}
                    {sheet.keyTonic} {sheet.keyMode} ·{" "}
                    {sheet.timeSignature.beatsPerMeasure}/
                    {sheet.timeSignature.beatUnit} ·{" "}
                    {sheet.measures.length} bar
                    {sheet.measures.length === 1 ? "" : "s"}
                  </span>
                  {sheet.style && (
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70">
                      {sheet.style}
                    </span>
                  )}
                </Link>
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <Link
                    href={`/sheets/${sheet.id}/edit`}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label={`Edit ${sheet.title}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  {confirmDeleteId === sheet.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        deleteSheet(sheet.id);
                        setConfirmDeleteId(null);
                      }}
                      className="rounded-md bg-destructive px-2 py-1 text-[11px] font-medium text-destructive-foreground hover:opacity-90 transition-opacity"
                      aria-label="Confirm delete"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(sheet.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label={`Delete ${sheet.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
