"use client";

import { FileMusic, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SheetThumbnail } from "@/components/sheets/sheet-thumbnail";
import { decodeSheet } from "@/lib/sheets/share";
import { useSheetsLibrary } from "@/lib/state/sheets-library";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * /sheets — lead-sheet library landing page.
 *
 * Phase 24a MVP: grid of cards + "+ New sheet".
 * Phase 35 (this pass): search filter, JSON import for sheets shared
 * as files (round-trips with Phase 33's share modal), refreshed
 * description text now that the LSB is feature-complete for the
 * Basic Tier.
 */
export default function SheetsLibraryPage() {
  const router = useRouter();
  const sheets = useSheetsLibrary((s) => s.sheets);
  const createSheet = useSheetsLibrary((s) => s.createSheet);
  // Phase 34 — the user's global chord-font default seeds the fontStyle
  // of freshly-created sheets. Only "handwritten" maps to the sheet's
  // handwritten aesthetic voice; every other chord-font pref (serif,
  // sans, mono) lands as the standard/serif look, which each sheet's
  // own font-style picker can still override.
  const chordFontDefault = useUserPrefs((s) => s.chordFontDefault);
  const deleteSheet = useSheetsLibrary((s) => s.deleteSheet);
  const importSheet = useSheetsLibrary((s) => s.importSheet);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Phase 35 — search filter + JSON import.
  const [query, setQuery] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedSheets = useMemo(
    () =>
      [...sheets].sort(
        (a, b) =>
          (b.lastOpenedAt ?? b.updatedAt) -
          (a.lastOpenedAt ?? a.updatedAt),
      ),
    [sheets],
  );

  const filteredSheets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedSheets;
    return sortedSheets.filter((s) => {
      const haystack = [
        s.title,
        s.composer,
        s.lyricist,
        s.arranger,
        s.style,
        s.source,
        `${s.keyTonic} ${s.keyMode}`,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sortedSheets, query]);

  const handleCreate = () => {
    const initialFontStyle =
      chordFontDefault === "handwritten" ? "handwritten" : "standard";
    const id = createSheet({ fontStyle: initialFontStyle });
    router.push(`/sheets/${id}/edit`);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // Allow re-selecting the same file next time.
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      // Two supported inputs:
      //   (1) A .json file exported via the Share modal — plain JSON
      //       payload of the Sheet object.
      //   (2) An encoded string (base64url) copied out of a share URL
      //       — decodeSheet handles that shape too.
      let sheet: ReturnType<typeof decodeSheet> = null;
      try {
        const parsed = JSON.parse(text);
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof parsed.title === "string" &&
          Array.isArray(parsed.measures)
        ) {
          sheet = parsed;
        }
      } catch {
        // Not JSON — try as encoded string.
      }
      if (!sheet) sheet = decodeSheet(text.trim());
      if (!sheet) {
        setImportError(
          "Couldn't read that file — expected a sheet .json exported from Practice Prodigy.",
        );
        return;
      }
      const newId = importSheet(sheet);
      router.push(`/sheets/${newId}/edit`);
    } catch (err) {
      console.error("[sheets/import]", err);
      setImportError("Something went wrong reading that file.");
    }
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
            Author chord charts with melody, lyrics, form markings, and
            live audio playback. Share via URL or JSON, print to PDF,
            and drive melody entry with a MIDI keyboard.
          </p>
        </header>

        {/* Toolbar: search + new sheet + import.
            Phase 36.1 — All three controls share a fixed `h-9` (36px)
            so their heights match visually. Previously each used
            `py-1.5` which resolved to different intrinsic heights
            because the buttons carry icons (h-4 = 16px) while the
            input relied on browser default sizing. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              {/* Phase 36.1.3 — `type="text"` instead of `type="search"`.
                  Even with `appearance-none`, Chrome retains subtle
                  vertical-metric differences for search inputs vs
                  plain text inputs that made the search bar visually
                  read as a slightly different height than the sibling
                  `<button>` Import + New sheet controls. Plain text
                  input renders with the same box metrics as the
                  buttons. Also matched Import's `font-medium` +
                  `text-muted-foreground` so the placeholder text
                  weight + baseline align identically. */}
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, composer, style, key…"
                className="h-9 w-full appearance-none rounded-md border border-border bg-background pl-8 pr-3 text-sm font-medium text-muted-foreground placeholder:text-muted-foreground/70 placeholder:font-normal focus:outline-none focus:border-primary/40"
                aria-label="Search sheets"
              />
            </div>
            {/* Phase 36.1.4 — Both toolbar buttons share:
                • min-w-[128px] so their footprints are identical
                  rectangles even though "New sheet" is longer text.
                • min-h-9 max-h-9 in addition to h-9 so no browser
                  rendering pass can nudge the height off 36px.
                • justify-center so their icon+text center inside the
                  fixed-width box. */}
            <button
              type="button"
              onClick={handleImport}
              className="flex h-9 min-h-9 max-h-9 min-w-[128px] items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              title="Import a .json sheet shared with you"
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
            {/* Hidden file input driven by the Import button. */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json,text/plain"
              onChange={onFilePicked}
              className="hidden"
            />
          </div>
          {/* Phase 36.1.2 — `border border-transparent` matches the
              1px border on the sibling Search + Import controls, so
              the interior colored fill on all three occupies the
              same 34px (36 total − 1 top border − 1 bottom border).
              Phase 36.1.4 — matches Import's min-w-[128px] +
              min-h-9 max-h-9 + justify-center so both buttons share
              an identical rectangle footprint. */}
          <button
            type="button"
            onClick={handleCreate}
            className="flex h-9 min-h-9 max-h-9 min-w-[128px] items-center justify-center gap-1.5 rounded-md border border-transparent bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            New sheet
          </button>
        </div>

        {importError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {importError}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Your sheets
            {sortedSheets.length > 0 && (
              <span className="ml-1.5 text-muted-foreground/70 font-normal normal-case tracking-normal">
                · {filteredSheets.length}
                {query && filteredSheets.length !== sortedSheets.length && (
                  <> of {sortedSheets.length}</>
                )}
              </span>
            )}
          </h2>
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
                start authoring, or use{" "}
                <span className="font-medium">Import</span> to open a
                sheet someone shared with you as a .json file.
              </p>
            </div>
          </div>
        ) : filteredSheets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-background/30 px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No sheets match “{query}”.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredSheets.map((sheet) => (
              <div
                key={sheet.id}
                className="group relative flex flex-col gap-2 rounded-xl border border-border bg-card/40 p-4 hover:border-primary/40 transition-colors"
              >
                <Link
                  href={`/sheets/${sheet.id}`}
                  className="flex flex-col gap-2"
                >
                  {/* Phase 36 — live-rendered thumbnail. Reuses SheetSurface
                      at native paper width and scales the whole render down
                      via CSS transform, cropped to a fixed rectangle showing
                      the title block + first line of music. */}
                  <SheetThumbnail sheet={sheet} />
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
