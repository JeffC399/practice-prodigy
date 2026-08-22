"use client";

import { FileText, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSongsLibrary } from "@/lib/practice/songs-library";
import { useSheetsLibrary } from "@/lib/state/sheets-library";
import type { Sheet } from "@/lib/sheets/types";

/**
 * SongImportFromSheets — Slice C.6 (Phase 133).
 *
 * Modal that lists the user's lead sheets that AREN'T yet linked to
 * any song, with a checkbox per sheet. Confirming creates one song
 * per selected sheet, prefilled from the sheet's metadata:
 *
 *   - title        ← sheet.title
 *   - artist       ← sheet.composer
 *   - songKey      ← `${keyTonic} ${keyMode}`  (e.g. "Bb major")
 *   - timeSignature ← `${bpm}/${bu}`            (e.g. "4/4")
 *   - genre         ← sheet.style
 *   - leadSheetId  ← sheet.id
 *   - status       ← "learning" (default)
 *
 * ## Skips already-linked sheets
 *
 * If the user already imported a sheet before, its id is present on
 * an existing song's leadSheetId. We filter those out so re-opening
 * the importer doesn't create dupes. Users can still manually link a
 * new song to any sheet via the Edit modal.
 */
export function SongImportFromSheets({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const sheets = useSheetsLibrary((s) => s.sheets);
  const existingSongs = useSongsLibrary((s) => s.songs);
  const saveSong = useSongsLibrary((s) => s.saveSong);

  const alreadyLinked = useMemo(() => {
    const set = new Set<string>();
    for (const song of existingSongs) {
      if (song.leadSheetId) set.add(song.leadSheetId);
    }
    return set;
  }, [existingSongs]);

  const importable = useMemo(
    () =>
      sheets
        .filter((sh) => !alreadyLinked.has(sh.id))
        .sort((a, b) =>
          (a.title || "").localeCompare(b.title || "", undefined, {
            sensitivity: "base",
          }),
        ),
    [sheets, alreadyLinked],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset selection when the modal opens.
  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(importable.map((s) => s.id)));
  const selectNone = () => setSelected(new Set());

  const importSelected = () => {
    for (const id of selected) {
      const sheet = importable.find((sh) => sh.id === id);
      if (!sheet) continue;
      saveSong(songInputForSheet(sheet));
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4">
      <button
        type="button"
        aria-label="Close importer"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="song-import-title"
        className="relative z-10 mt-16 flex max-h-[80vh] w-full max-w-lg flex-col gap-4 overflow-hidden rounded-lg border-2 border-border bg-background shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border/60 px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span
              id="song-import-title"
              className="font-mono text-[10px] uppercase tracking-wider text-primary"
            >
              Import from lead sheets
            </span>
            <h2 className="text-lg font-semibold text-foreground">
              Pick sheets to add as songs
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {importable.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            {sheets.length === 0
              ? "You don't have any lead sheets yet."
              : "Every lead sheet is already linked to a song."}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 px-5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {selected.size} of {importable.length} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="font-mono text-[11px] uppercase tracking-wider text-primary hover:underline"
                >
                  All
                </button>
                <span className="text-muted-foreground/40">·</span>
                <button
                  type="button"
                  onClick={selectNone}
                  disabled={selected.size === 0}
                  className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  None
                </button>
              </div>
            </div>

            <ul className="flex flex-col gap-1 overflow-y-auto px-5">
              {importable.map((sh) => (
                <li key={sh.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2 transition-colors hover:border-primary/40">
                    <input
                      type="checkbox"
                      checked={selected.has(sh.id)}
                      onChange={() => toggle(sh.id)}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <FileText
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
                      aria-hidden="true"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm text-foreground">
                        {sh.title || "Untitled sheet"}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {describeSheet(sh)}
                      </span>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={importSelected}
            disabled={selected.size === 0}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Import {selected.size > 0 ? `${selected.size} song${selected.size === 1 ? "" : "s"}` : "songs"}
          </button>
        </div>
      </div>
    </div>
  );
}

function songInputForSheet(sheet: Sheet): Parameters<
  ReturnType<typeof useSongsLibrary.getState>["saveSong"]
>[0] {
  const keyLabel = [sheet.keyTonic, sheet.keyMode].filter(Boolean).join(" ");
  const tsLabel = sheet.timeSignature
    ? `${sheet.timeSignature.beatsPerMeasure}/${sheet.timeSignature.beatUnit}`
    : undefined;
  return {
    title: sheet.title.trim() || "Untitled song",
    artist: sheet.composer,
    songKey: keyLabel || undefined,
    timeSignature: tsLabel,
    genre: sheet.style,
    leadSheetId: sheet.id,
    status: "learning",
  };
}

function describeSheet(sheet: Sheet): string {
  const parts: string[] = [];
  if (sheet.composer) parts.push(sheet.composer);
  const keyLabel = [sheet.keyTonic, sheet.keyMode].filter(Boolean).join(" ");
  if (keyLabel) parts.push(keyLabel);
  if (sheet.timeSignature) {
    parts.push(
      `${sheet.timeSignature.beatsPerMeasure}/${sheet.timeSignature.beatUnit}`,
    );
  }
  if (sheet.style) parts.push(sheet.style);
  return parts.length > 0 ? parts.join(" · ") : "no metadata";
}
