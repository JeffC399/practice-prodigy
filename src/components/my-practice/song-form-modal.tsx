"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SONG_STATUS_DESCRIPTIONS,
  SONG_STATUS_LABELS,
  SONG_STATUS_ORDER,
  useSongsLibrary,
  type Song,
  type SongStatus,
} from "@/lib/practice/songs-library";
import { useSheetsLibrary } from "@/lib/state/sheets-library";

/**
 * SongFormModal — Slice C.3 (Phase 130).
 *
 * Compact modal for editing all of a song's fields at once. Opened
 * from SongCard's "Edit" button. The card handles title inline; this
 * form covers everything else — artist, key, time signature, genre,
 * status, personal notes, target performance date, linked lead sheet.
 *
 * ## Save semantics
 *
 * Save writes ALL fields in one updateSong call so a single sync push
 * flushes the whole edit. Cancel discards changes without touching
 * the store. Esc = cancel.
 *
 * ## Linked sheet picker
 *
 * A native <select> populated from useSheetsLibrary. Empty option
 * = unlinked. Users can also open the sheet directly from the card;
 * this form is just where the link gets set.
 */
export function SongFormModal({
  songId,
  onClose,
}: {
  songId: string;
  onClose: () => void;
}) {
  const song = useSongsLibrary((s) =>
    s.songs.find((x) => x.id === songId),
  );
  const updateSong = useSongsLibrary((s) => s.updateSong);
  const sheets = useSheetsLibrary((s) => s.sheets);

  const [title, setTitle] = useState(song?.title ?? "");
  const [artist, setArtist] = useState(song?.artist ?? "");
  const [songKey, setSongKey] = useState(song?.songKey ?? "");
  const [timeSignature, setTimeSignature] = useState(song?.timeSignature ?? "");
  const [genre, setGenre] = useState(song?.genre ?? "");
  const [status, setStatus] = useState<SongStatus>(song?.status ?? "learning");
  const [notes, setNotes] = useState(song?.personalNotes ?? "");
  const [targetDate, setTargetDate] = useState(
    song?.targetPerformanceDate ?? "",
  );
  const [leadSheetId, setLeadSheetId] = useState(song?.leadSheetId ?? "");

  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Esc dismisses. Click-outside dismisses (backdrop is a sibling).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sortedSheets = useMemo(
    () =>
      [...sheets].sort((a, b) =>
        (a.title || "").localeCompare(b.title || "", undefined, {
          sensitivity: "base",
        }),
      ),
    [sheets],
  );

  if (!song) {
    // Song might have been deleted while the modal was open (e.g.
    // another tab). Close silently rather than render an empty shell.
    onClose();
    return null;
  }

  const canSave = title.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    updateSong(song.id, {
      title: title.trim(),
      artist,
      songKey,
      timeSignature,
      genre,
      status,
      personalNotes: notes,
      targetPerformanceDate: targetDate,
      leadSheetId: leadSheetId || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close song editor"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="song-form-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border-2 border-border bg-background p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span
              id="song-form-title"
              className="font-mono text-[10px] uppercase tracking-wider text-primary"
            >
              Edit song
            </span>
            <h2 className="text-lg font-semibold text-foreground">
              {song.title}
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

        <div className="grid grid-cols-1 gap-3">
          <TextField
            label="Title"
            value={title}
            onChange={setTitle}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Artist / composer"
              value={artist}
              onChange={setArtist}
              placeholder="e.g. Bill Evans"
            />
            <TextField
              label="Genre"
              value={genre}
              onChange={setGenre}
              placeholder="e.g. jazz standard"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Key"
              value={songKey}
              onChange={setSongKey}
              placeholder="e.g. Bb major"
            />
            <TextField
              label="Time signature"
              value={timeSignature}
              onChange={setTimeSignature}
              placeholder="e.g. 4/4, 3/4"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {SONG_STATUS_ORDER.map((s) => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    title={SONG_STATUS_DESCRIPTIONS[s]}
                    aria-pressed={active}
                    className={`rounded-md border px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {SONG_STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="song-target-date"
              className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
            >
              Target performance date (optional)
            </label>
            <input
              id="song-target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="song-lead-sheet"
              className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
            >
              Linked lead sheet (optional)
            </label>
            <select
              id="song-lead-sheet"
              value={leadSheetId}
              onChange={(e) => setLeadSheetId(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">— No sheet</option>
              {sortedSheets.map((sh) => (
                <option key={sh.id} value={sh.id}>
                  {sh.title || "Untitled sheet"}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground/70">
              When linked, launching the song from a routine opens the
              sheet&rsquo;s playback surface.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="song-notes"
              className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
            >
              Personal notes (optional)
            </label>
            <textarea
              id="song-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Focus areas, tricky sections, gear settings, anything you want to remember…"
              rows={4}
              className="resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-primary"> *</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
    </label>
  );
}

/**
 * Type-only export the reference is used elsewhere. Sheet type from
 * the store isn't exported so we don't need to import it here.
 */
export type { Song };
