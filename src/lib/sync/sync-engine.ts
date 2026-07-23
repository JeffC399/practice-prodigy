"use client";

import { createClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { LocalRow, SyncAdapter, SyncStatus, SyncableRow } from "./types";

/**
 * Union of all syncable table names in the Supabase schema. Adapters
 * declare `tableName` as a plain `string` for API ergonomics, so we
 * narrow to this union at the `.from()` boundary. Extending the
 * schema (Slice B/C) automatically extends this union.
 */
type SyncableTableName = keyof Database["public"]["Tables"];

/**
 * Sync engine — Slice A.3 (Phase 81).
 *
 * One engine instance per SyncAdapter. Handles the local↔cloud
 * dance: push local changes to Supabase (debounced), pull cloud
 * changes on start, and report status changes to any listener.
 *
 * Design decisions:
 *
 * - **Local-first**: every write goes to Zustand first (Zustand's
 *   persist middleware handles localStorage). The engine's job is
 *   to mirror those writes to Supabase in the background. Losing
 *   internet doesn't lose data.
 *
 * - **Debounced push**: local changes fire the adapter's subscribe
 *   callback. The engine coalesces bursts of changes into one push
 *   after `PUSH_DEBOUNCE_MS` of quiet.
 *
 * - **Last-write-wins conflict resolution**: pulls from cloud
 *   compare `updated_at`. Local wins if newer; cloud wins if newer.
 *   No merge attempts. Documented in ROUTINE-DESIGN.md §13.3.
 *
 * - **No retry queue in this slice**: A.3 ships the happy path.
 *   Offline handling + retry queue lands in a follow-up phase
 *   (probably A.5 or later polish). Errors surface as `error` status;
 *   the next successful change/pull recovers.
 *
 * - **Not React-aware**: the engine is a plain object. React
 *   consumers subscribe via `use-sync-status.ts`.
 */

const PUSH_DEBOUNCE_MS = 500;

export type SyncEngine = {
  /** Begin syncing (call after sign-in). Fires an initial pull. */
  start: () => Promise<void>;

  /** Pause syncing (call after sign-out). Cancels pending pushes. */
  stop: () => void;

  /** Force pull from cloud now (returns when done). */
  pull: () => Promise<void>;

  /** Force push local state to cloud now (returns when done). */
  push: () => Promise<void>;

  /** Subscribe to status changes. Returns unsubscribe. */
  subscribe: (listener: (status: SyncStatus) => void) => () => void;

  /** Current status (synchronous read). */
  getStatus: () => SyncStatus;
};

export function createSyncEngine<TData = unknown>(
  adapter: SyncAdapter<TData>,
): SyncEngine {
  const supabase = createClient();
  let status: SyncStatus = "signed-out";
  const listeners = new Set<(s: SyncStatus) => void>();

  let unsubLocal: (() => void) | null = null;
  let pushTimeout: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<void> | null = null;
  let userId: string | null = null;

  const setStatus = (next: SyncStatus) => {
    if (status === next) return;
    status = next;
    listeners.forEach((l) => l(next));
  };

  const getUserId = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  };

  const doPush = async () => {
    if (!userId) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("syncing");
    try {
      const rows = adapter.extractLocal();
      const wireRows: Array<Omit<SyncableRow, "user_id">> = rows.map((r) => ({
        id: adapter.isSingleton ? userId! : r.id,
        data: r.data,
        updated_at: new Date(r.updatedAt).toISOString(),
      }));
      // Upsert each row. Postgres handles ON CONFLICT via primary key
      // (id). Batched as one call for efficiency.
      //
      // The `as never` bridge here tells TS "trust the runtime string
      // matches one of the real tables" — adapter.tableName is typed
      // `string` (adapter-driven), so Supabase's generic .from() can't
      // narrow to a single table. Every syncable table in
      // database.types.ts has the same 4-column shape, so the payload
      // is always structurally valid.
      if (wireRows.length > 0) {
        // userId is proven non-null by the guard at doPush's top; the
        // closure loses that narrowing so we re-assert with `!` here.
        // data casts to Json because adapter state is TData=unknown at
        // the engine level; the DB column is jsonb and the store
        // owner is responsible for keeping shapes JSON-serializable.
        const uid = userId!;
        const payload = wireRows.map((r) => ({
          id: r.id,
          data: r.data as Json,
          updated_at: r.updated_at,
          user_id: uid,
        }));
        const { error } = await supabase
          .from(adapter.tableName as SyncableTableName)
          .upsert(payload, { onConflict: "id" });
        if (error) throw error;
      }
      setStatus("idle");
    } catch (err) {
      console.warn(`[sync ${adapter.storeKey}] push failed:`, err);
      setStatus("error");
    }
  };

  const doPull = async () => {
    if (!userId) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("syncing");
    try {
      const { data, error } = await supabase
        .from(adapter.tableName as SyncableTableName)
        .select("id, data, updated_at")
        .eq("user_id", userId);
      if (error) throw error;
      const rows: LocalRow<TData>[] = (data ?? []).map((r) => ({
        id: r.id,
        data: r.data as TData,
        updatedAt: new Date(r.updated_at).getTime(),
      }));
      adapter.applyRemote(rows);
      setStatus("idle");
    } catch (err) {
      console.warn(`[sync ${adapter.storeKey}] pull failed:`, err);
      setStatus("error");
    }
  };

  const schedulePush = () => {
    if (pushTimeout) clearTimeout(pushTimeout);
    pushTimeout = setTimeout(() => {
      pushTimeout = null;
      // If a push is in flight, wait for it; the tail will re-fire.
      if (inflight) {
        inflight.then(() => schedulePush());
        return;
      }
      inflight = doPush().finally(() => {
        inflight = null;
      });
    }, PUSH_DEBOUNCE_MS);
  };

  return {
    async start() {
      userId = await getUserId();
      if (!userId) {
        setStatus("signed-out");
        return;
      }
      // Initial pull to hydrate local from cloud.
      await doPull();
      // Now subscribe to local changes for background push.
      unsubLocal?.();
      unsubLocal = adapter.subscribeLocal(schedulePush);
    },

    stop() {
      unsubLocal?.();
      unsubLocal = null;
      if (pushTimeout) {
        clearTimeout(pushTimeout);
        pushTimeout = null;
      }
      userId = null;
      setStatus("signed-out");
    },

    async pull() {
      if (!userId) userId = await getUserId();
      await doPull();
    },

    async push() {
      if (!userId) userId = await getUserId();
      await doPush();
    },

    subscribe(listener) {
      listeners.add(listener);
      // Emit current status immediately so late subscribers hydrate.
      listener(status);
      return () => listeners.delete(listener);
    },

    getStatus: () => status,
  };
}
