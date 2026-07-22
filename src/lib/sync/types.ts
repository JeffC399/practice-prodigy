/**
 * Sync layer types — Slice A.3 (Phase 81).
 *
 * Cross-store contract for local-first cloud sync. Each Zustand store
 * that wants to sync provides a `SyncAdapter` implementation; the
 * generic engine (sync-engine.ts) handles the push/pull/status
 * mechanics uniformly.
 *
 * Two shapes of syncable state:
 *
 * 1. **Collection stores** — many entities per user (drills, sheets,
 *    songs, routines). Each entity is one row in a Supabase table.
 *    Adapter's `extractLocal` returns many rows.
 *
 * 2. **Singleton stores** — one row per user (profile, prefs).
 *    Adapter's `extractLocal` returns exactly one row whose id
 *    equals the user's id.
 *
 * Both use the same table shape (see docs/SUPABASE-SCHEMA.md):
 *
 *   id uuid primary key
 *   user_id uuid references auth.users(id) on delete cascade
 *   data jsonb not null
 *   updated_at timestamptz not null default now()
 *
 * Row-Level Security policies ensure each user only sees their own
 * rows. Details in the schema doc.
 */

export type SyncStatus =
  /** Nothing is syncing right now. All local state matches cloud. */
  | "idle"
  /** Push or pull in flight. */
  | "syncing"
  /** Last sync attempt failed; will retry. */
  | "error"
  /** Offline; will resume on reconnect. */
  | "offline"
  /** User isn't signed in; sync is not attempted. */
  | "signed-out";

/**
 * Wire-format for a row in Supabase. All syncable tables have this
 * shape. `data` is the store-specific payload (a full drill, a
 * profile blob, etc.).
 */
export type SyncableRow = {
  id: string;
  user_id: string;
  data: unknown;
  updated_at: string; // ISO-8601 timestamp
};

/**
 * The unit an adapter emits when reading local state. `updatedAt` is
 * a millisecond epoch (local `Date.now()`) that the engine converts
 * to ISO for the wire.
 */
export type LocalRow<TData = unknown> = {
  id: string;
  data: TData;
  updatedAt: number; // milliseconds since epoch
};

/**
 * A syncable store's contract. Implementations wrap a Zustand store
 * to make it visible to the sync engine.
 *
 * The engine treats each adapter as a black box: it calls
 * `extractLocal()` to read, `applyRemote(rows)` to write, and
 * `subscribeLocal(cb)` to know when to push. No knowledge of the
 * store's shape leaks into the engine.
 */
export interface SyncAdapter<TData = unknown> {
  /** Unique identifier for this store — used in the sync status registry. */
  storeKey: string;

  /** Supabase table name. Must exist with the standard 4-column shape. */
  tableName: string;

  /**
   * True if this store maps to exactly one row per user. When true,
   * the engine sets `id = user_id` on push. Prevents accidental
   * duplicate rows for stores where the whole state is one blob.
   */
  isSingleton?: boolean;

  /**
   * Read current local state as a list of sync rows. For collection
   * stores this returns many entries; for singleton stores it
   * returns exactly one (the engine still uses `id = user_id` when
   * `isSingleton` is true).
   *
   * Called on every push. Should be fast — read straight from
   * Zustand state, don't do any heavy work.
   */
  extractLocal: () => LocalRow<TData>[];

  /**
   * Subscribe to local state changes. Return an unsubscribe function.
   * The engine calls this on start; it fires a debounced push each
   * time the callback runs.
   */
  subscribeLocal: (onChange: () => void) => () => void;

  /**
   * Apply cloud rows to the local store. Called after a successful
   * pull. Implementations decide how to merge:
   *   - Collection stores: replace the store's entity list with the
   *     cloud rows (or merge by id + last-write-wins).
   *   - Singleton stores: replace the store's fields with the row's
   *     data payload.
   */
  applyRemote: (rows: LocalRow<TData>[]) => void;
}
