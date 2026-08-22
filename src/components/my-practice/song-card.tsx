"use client";

import { Music, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
 * SongCard — Slice C.2 (Phase 129).
 *
 * One saved song rendered as a tile in the Songs tab. Mirrors
 * RoutineCard's shape so the two libraries feel like siblings:
 * bordered rounded tile with inline-editable title + hover-revealed
 * footer actions.
 *
 * C.2 keeps the card lean — title (editable), status chip (cycles
 * on click), artist / key inline (if set), last-practiced summary,
 * open-sheet affordance (if linked), delete.
 *
 * Phase C.3 adds an Edit button that opens a full form covering
 * genre / notes / target date / etc.
 */
export function SongCard({
  song,
  onEdit,
}: {
  song: Song;
  /**
   * Called when the user clicks the Edit button. Wired in Phase C.3.
   * If not provided, the button is hidden.
   */
  onEdit?: (id: string) => void;
}) {
  const updateSong = useSongsLibrary((s) => s.updateSong);
  const setSongStatus = useSongsLibrary((s) => s.setSongStatus);
  const deleteSong = useSongsLibrary((s) => s.deleteSong);
  const sheets = useSheetsLibrary((s) => s.sheets);

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const linkedSheet =
    song.leadSheetId != null
      ? sheets.find((sh) => sh.id === song.leadSheetId)
      : undefined;

  const cycleStatus = () => {
    const idx = SONG_STATUS_ORDER.indexOf(song.status);
    const next = SONG_STATUS_ORDER[(idx + 1) % SONG_STATUS_ORDER.length];
    setSongStatus(song.id, next);
  };

  const summaryParts: string[] = [];
  if (song.totalPracticeSeconds > 0) {
    summaryParts.push(formatDuration(song.totalPracticeSeconds));
  }
  if (song.lastPracticedAt) {
    summaryParts.push(`last ${formatRelative(song.lastPracticedAt)}`);
  } else {
    summaryParts.push("not yet practiced");
  }
  const summary = summaryParts.join(" · ");

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border-2 border-border bg-background/40 transition-all hover:border-primary/60 hover:bg-primary/5 hover:shadow-md">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <Music
            className="h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <input
            key={`${song.id}-title`}
            type="text"
            defaultValue={song.title}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== song.title) {
                updateSong(song.id, { title: next });
              } else if (!next) {
                e.target.value = song.title;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Song title"
            className="flex-1 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-base font-medium text-foreground focus:border-border/60 focus:bg-background/60 focus:outline-none"
          />
        </div>

        {(song.artist || song.songKey || song.timeSignature) && (
          <p className="pl-6 truncate text-xs text-muted-foreground">
            {[song.artist, song.songKey, song.timeSignature]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        <div className="pl-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={cycleStatus}
            title={`${SONG_STATUS_DESCRIPTIONS[song.status]} — click to cycle status`}
            className={statusChipClass(song.status)}
          >
            {SONG_STATUS_LABELS[song.status]}
          </button>
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {summary}
          </span>
          {linkedSheet && (
            <Link
              href={`/sheets/${linkedSheet.id}`}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              title={`Linked sheet: ${linkedSheet.title || "Untitled sheet"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              Sheet
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 border-t border-border/60 bg-background/30 px-3 py-2 opacity-100 transition-opacity md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto">
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(song.id)}
            className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Edit
          </button>
        )}
        {confirmingDelete ? (
          <>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                deleteSong(song.id);
                setConfirmingDelete(false);
              }}
              className="inline-flex h-7 items-center justify-center rounded-md bg-destructive px-2 text-[11px] font-medium text-destructive-foreground transition-opacity hover:opacity-90"
            >
              Confirm
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete song ${song.title}`}
            title="Delete song"
            className="inline-flex h-7 items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

function statusChipClass(status: SongStatus): string {
  const base =
    "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors hover:opacity-90";
  switch (status) {
    case "learning":
      return `${base} border-amber-500/40 bg-amber-500/10 text-amber-400`;
    case "polishing":
      return `${base} border-sky-500/40 bg-sky-500/10 text-sky-400`;
    case "performance-ready":
      return `${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-400`;
    case "retired":
      return `${base} border-border bg-background text-muted-foreground`;
  }
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins - hrs * 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

function formatRelative(at: number, now: number = Date.now()): string {
  const diff = now - at;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "today";
  const days = Math.floor(diff / day);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
