import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Songs library — Slice C.1 (Phase 128).
 *
 * The user's repertoire — the pieces they're actively learning,
 * polishing, or maintaining. Songs are ORTHOGONAL to lead sheets:
 *
 *   - A Sheet is a specific chart/notation of the music.
 *   - A Song is your relationship with the piece (status, notes,
 *     target date, accumulated practice time).
 *
 * A Song can optionally link to a Sheet via `leadSheetId` — when
 * linked, launching the song in a routine opens the sheet's playback.
 * When unlinked, the song is a pure log entry ("I'm learning this;
 * clock the minutes").
 *
 * ## Cloud sync
 *
 * Persisted locally via Zustand persist middleware; synced to Supabase
 * via the standard SyncAdapter pattern (src/lib/sync/adapters/songs.ts).
 * Round-trips through the `songs` table. Uses the collection-adapter
 * shape so no new schema migration is needed — the existing
 * `(id text, user_id uuid, data jsonb, updated_at)` collection table
 * is enough.
 *
 * ## What ships in C.1 vs later phases
 *
 * C.1 (this file): types, store, CRUD primitives, aggregation
 *                  helpers used by Reports / Routines.
 * C.2: Songs tab list view + filter + sort.
 * C.3: Add / edit song form.
 * C.4: `song` routine item type is already declared in
 *      RoutineItem's union — C.4 wires the composer + player card.
 * C.5: Songs progress panel in Reports (unblocks D.6).
 * C.6: Bulk import from Lead Sheets.
 */

/**
 * Where a song sits in the learning arc. Deliberately coarse — most
 * users don't want to think in more than 4 buckets when deciding
 * "what am I working on today?"
 *
 *   learning         — In-progress; not yet ready to play through.
 *   polishing        — Can play through; refining details.
 *   performance-ready — Can play cleanly, on command.
 *   retired          — Set aside; not currently maintained.
 *
 * Retired songs stay in the library (they might come back). They just
 * default to hidden in the list view unless the user filters them in.
 */
export type SongStatus =
  | "learning"
  | "polishing"
  | "performance-ready"
  | "retired";

export const SONG_STATUS_ORDER: readonly SongStatus[] = [
  "learning",
  "polishing",
  "performance-ready",
  "retired",
] as const;

export const SONG_STATUS_LABELS: Record<SongStatus, string> = {
  learning: "Learning",
  polishing: "Polishing",
  "performance-ready": "Performance-ready",
  retired: "Retired",
};

/**
 * Per-status descriptions used in tooltips and the status picker.
 * Musicians recognize these arcs; the labels alone are usually
 * enough, but the hint is nice on first encounter.
 */
export const SONG_STATUS_DESCRIPTIONS: Record<SongStatus, string> = {
  learning: "In-progress. Not yet ready to play through.",
  polishing: "Can play through; refining details.",
  "performance-ready": "Can play cleanly, on command.",
  retired: "Set aside for now. Not currently maintained.",
};

/**
 * Saved song entry in the repertoire library. Only `title` is
 * required; everything else is optional so users can capture "I'm
 * working on Autumn Leaves" in three seconds.
 */
export type Song = {
  /** Client-generated text id in the standard prefix format. */
  id: string;
  /** User-authored title. Required. */
  title: string;
  /** Optional artist / composer credit. */
  artist?: string;
  /** Optional key (freeform text — "C major", "Bb", "modal on D", etc.). */
  songKey?: string;
  /** Optional time signature (freeform — "4/4", "3/4", "5/8", "mixed"). */
  timeSignature?: string;
  /** Optional genre tag (freeform — "jazz standard", "blues", "prog rock"). */
  genre?: string;
  status: SongStatus;
  /** Optional free-text notes ("focus on the bridge changes"). */
  personalNotes?: string;
  /**
   * Optional target performance date as YYYY-MM-DD. Kept as a string
   * to avoid timezone drift — a Date object would serialize wrongly
   * to JSON if the user's tz differed at write vs read time.
   */
  targetPerformanceDate?: string;
  /**
   * Optional link to a Lead Sheet in useSheetsLibrary. When set, the
   * song's routine-item launcher opens the sheet's playback surface.
   * Nullable rather than required — plenty of songs get logged
   * without an accompanying chart.
   */
  leadSheetId?: string;
  /**
   * Accumulated practice time in seconds. Updated by the routine
   * player's session-tracker attribution + by direct-song-launch
   * flows (Slice C.4). Reports (D.6, Slice C.5) reads this to
   * surface "most practiced" and "days since last practice."
   */
  totalPracticeSeconds: number;
  /** ms epoch of the last session that accrued time to this song, or undefined. */
  lastPracticedAt?: number;
  /** ms epoch — first save. */
  createdAt: number;
  /** ms epoch — bumped on any mutation. LWW anchor for sync. */
  updatedAt: number;
};

export function newSongId(): string {
  return `song_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Input shape for saveSong. Mirrors the Song type minus the fields
 * the store manages (id, timestamps, practice accumulators, default
 * status).
 */
export type SaveSongInput = {
  title: string;
  artist?: string;
  songKey?: string;
  timeSignature?: string;
  genre?: string;
  personalNotes?: string;
  targetPerformanceDate?: string;
  leadSheetId?: string;
  status?: SongStatus;
};

type SongsLibraryStore = {
  songs: Song[];

  /** Create a fresh song. Returns the new id. Untitled title snaps to "Untitled song". */
  saveSong: (input: SaveSongInput) => string;

  /**
   * Partial-update a song's metadata. Practice-accrual fields
   * (totalPracticeSeconds, lastPracticedAt) are updated via
   * `recordPractice`, not this method.
   */
  updateSong: (
    id: string,
    patch: Partial<Omit<Song, "id" | "createdAt" | "totalPracticeSeconds" | "lastPracticedAt">>,
  ) => void;

  /**
   * Change a song's status. Convenience wrapper over updateSong; kept
   * separate because status changes are common and status-only
   * transitions read cleaner in call sites (e.g. `setSongStatus(id,
   * "polishing")` beats a 3-line updateSong({...}) call).
   */
  setSongStatus: (id: string, status: SongStatus) => void;

  /**
   * Add `seconds` to a song's totalPracticeSeconds and update
   * lastPracticedAt. Called by the session tracker (Slice C.4 wire-up)
   * whenever the current activity is attributed to this song.
   * No-op when seconds <= 0 or the song doesn't exist.
   */
  recordPractice: (id: string, seconds: number, at?: number) => void;

  /**
   * Hard-delete. Sync engine cascades the delete on next push.
   * Callers should also unlink any RoutineItems that reference this
   * song id — but the executor tolerates dangling ids gracefully.
   */
  deleteSong: (id: string) => void;

  /** Test-only escape hatch. */
  _reset: () => void;
};

export const useSongsLibrary = create<SongsLibraryStore>()(
  persist(
    (set, get) => ({
      songs: [],

      saveSong: (input) => {
        const id = newSongId();
        const now = Date.now();
        const song: Song = {
          id,
          title: input.title.trim() || "Untitled song",
          artist: normalizeOptional(input.artist),
          songKey: normalizeOptional(input.songKey),
          timeSignature: normalizeOptional(input.timeSignature),
          genre: normalizeOptional(input.genre),
          status: input.status ?? "learning",
          personalNotes: normalizeOptional(input.personalNotes),
          targetPerformanceDate: normalizeOptional(input.targetPerformanceDate),
          leadSheetId: input.leadSheetId,
          totalPracticeSeconds: 0,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ songs: [...s.songs, song] }));
        return id;
      },

      updateSong: (id, patch) =>
        set((state) => ({
          songs: state.songs.map((s) => {
            if (s.id !== id) return s;
            const next: Song = { ...s, updatedAt: Date.now() };
            if (patch.title !== undefined) {
              const trimmed = patch.title.trim();
              if (trimmed) next.title = trimmed;
              // Whitespace-only title silently rejected — matches routines.
            }
            for (const key of [
              "artist",
              "songKey",
              "timeSignature",
              "genre",
              "personalNotes",
              "targetPerformanceDate",
            ] as const) {
              if (key in patch) {
                const value = patch[key];
                next[key] = normalizeOptional(value as string | undefined);
              }
            }
            if ("status" in patch && patch.status) next.status = patch.status;
            if ("leadSheetId" in patch) {
              next.leadSheetId = patch.leadSheetId || undefined;
            }
            return next;
          }),
        })),

      setSongStatus: (id, status) =>
        set((state) => ({
          songs: state.songs.map((s) =>
            s.id === id
              ? { ...s, status, updatedAt: Date.now() }
              : s,
          ),
        })),

      recordPractice: (id, seconds, at) => {
        if (seconds <= 0) return;
        const when = at ?? Date.now();
        set((state) => ({
          songs: state.songs.map((s) =>
            s.id === id
              ? {
                  ...s,
                  totalPracticeSeconds: s.totalPracticeSeconds + seconds,
                  lastPracticedAt: when,
                  updatedAt: when,
                }
              : s,
          ),
        }));
      },

      deleteSong: (id) =>
        set((state) => ({
          songs: state.songs.filter((s) => s.id !== id),
        })),

      _reset: () => set({ songs: [] }),
    }),
    {
      name: "practice-prodigy:songs-library:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/** Trim + convert empty string to undefined so persisted rows stay lean. */
function normalizeOptional(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** Read helper — resolve a song by id. */
export function getSongById(id: string): Song | undefined {
  return useSongsLibrary.getState().songs.find((s) => s.id === id);
}

/**
 * Read helper — songs sorted for the default "list" surface:
 * lastPracticedAt DESC (with nulls last), then updatedAt DESC.
 * Retired songs pushed to the bottom regardless.
 */
export function songsInDefaultOrder(songs: readonly Song[]): Song[] {
  const copy = [...songs];
  copy.sort((a, b) => {
    // Retired always last.
    if (a.status === "retired" && b.status !== "retired") return 1;
    if (b.status === "retired" && a.status !== "retired") return -1;
    // Then last-practiced DESC (nulls last).
    if (a.lastPracticedAt && b.lastPracticedAt) {
      return b.lastPracticedAt - a.lastPracticedAt;
    }
    if (a.lastPracticedAt) return -1;
    if (b.lastPracticedAt) return 1;
    // Fallback: updatedAt DESC.
    return b.updatedAt - a.updatedAt;
  });
  return copy;
}
