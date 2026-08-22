"use client";

import { Music } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import {
  SONG_STATUS_LABELS,
  useSongsLibrary,
  type Song,
  type SongStatus,
} from "@/lib/practice/songs-library";

/**
 * SongsProgressPanel — Slice C.5 / D.6 (Phase 132).
 *
 * Compact per-song rollup for the Reports tab. Shows up to N songs
 * sorted by total practice time DESC, each row displaying:
 *
 *   - Title (+ artist if any)
 *   - Status chip
 *   - Total practice time (all-time)
 *   - Days-since-last-practice indicator with a "stale" nudge
 *
 * Retired songs are excluded — this panel is about the active
 * repertoire's momentum.
 *
 * ## Panel is Reports-only for now
 *
 * The plan spec put this in D.6. It requires Songs (Slice C) to
 * exist, so it shipped as C.5 / D.6 combined once Slice C landed.
 * The panel renders `null` when the user has no songs so the
 * Reports tab doesn't grow an empty section.
 */
const DEFAULT_LIMIT = 8;
const STALE_THRESHOLD_DAYS = 14;

export function SongsProgressPanel({
  limit = DEFAULT_LIMIT,
}: {
  limit?: number;
}) {
  const songs = useSongsLibrary((s) => s.songs);

  const displayed = useMemo(() => {
    const active = songs.filter((s) => s.status !== "retired");
    // Sort by totalPracticeSeconds DESC. Songs with zero time still
    // included so a brand-new song shows up at the bottom rather than
    // being invisible — helps users see their whole active list.
    active.sort((a, b) => b.totalPracticeSeconds - a.totalPracticeSeconds);
    return active.slice(0, limit);
  }, [songs, limit]);

  if (songs.length === 0) {
    // No songs at all → don't render. The Songs tab has its own
    // empty state.
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/40 px-4 py-3">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Songs progress
          </h3>
          <p className="text-[11px] text-muted-foreground/70">
            Total practice time per song (all-time). Retired songs
            hidden. Add songs to routines to accumulate time here.
          </p>
        </div>
        <Link
          href="/my-practice?tab=songs"
          className="font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
        >
          Manage
        </Link>
      </header>

      {displayed.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          All your songs are retired. Un-retire from the Songs tab to
          see them here.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {displayed.map((song) => (
            <SongProgressRow key={song.id} song={song} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SongProgressRow({ song }: { song: Song }) {
  const daysSince = daysSincePractice(song.lastPracticedAt);
  const stale =
    daysSince !== null && daysSince >= STALE_THRESHOLD_DAYS;

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
      <Music className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm text-foreground">
          {song.title}
          {song.artist && (
            <span className="ml-2 text-xs text-muted-foreground">
              {song.artist}
            </span>
          )}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {SONG_STATUS_LABELS[song.status]}
          {daysSince !== null && (
            <>
              <span className="text-muted-foreground/40"> · </span>
              <span className={stale ? "text-amber-400" : ""}>
                last {formatDaysSince(daysSince)}
                {stale && " · stale"}
              </span>
            </>
          )}
          {daysSince === null && (
            <>
              <span className="text-muted-foreground/40"> · </span>
              <span>not yet practiced</span>
            </>
          )}
        </span>
      </div>
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {formatTotal(song.totalPracticeSeconds)}
      </span>
    </li>
  );
}

function daysSincePractice(
  lastAt: number | undefined,
  now: number = Date.now(),
): number | null {
  if (!lastAt) return null;
  const diff = now - lastAt;
  const day = 24 * 60 * 60 * 1000;
  return Math.floor(diff / day);
}

function formatDaysSince(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatTotal(sec: number): string {
  if (sec <= 0) return "0m";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Warm up the SongStatus type so a rename elsewhere shows up here.
void ({} as SongStatus);
