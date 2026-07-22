"use client";

import { createClient } from "@/lib/supabase/client";
import { createSyncEngine, type SyncEngine } from "./sync-engine";
import type { SyncAdapter, SyncStatus } from "./types";

/**
 * Sync registry — Slice A.3 (Phase 81).
 *
 * Global registry of sync engines. Slice A.5 will register each
 * store's adapter here; A.3 just ships the plumbing.
 *
 * Orchestration:
 *   - On sign-in (Supabase auth change), calls `start()` on every
 *     registered engine. Each engine pulls its cloud state and
 *     begins subscribing to local changes for background push.
 *   - On sign-out, calls `stop()` on every registered engine.
 *     Local state stays intact (Zustand persist middleware handles
 *     localStorage); the engine just stops syncing to cloud.
 *   - Aggregate status: computes an overall status across all
 *     registered engines (worst wins: syncing > error > offline >
 *     idle > signed-out). Consumers of `useSyncStatus()` see this.
 *
 * Adapters can register at any time (e.g. lazily when their store
 * is first imported). The registry handles late registrations by
 * calling `start()` immediately if the user is already signed in.
 */

const engines = new Map<string, SyncEngine>();
const aggregateListeners = new Set<(status: SyncStatus) => void>();
let currentUserId: string | null = null;
let authWatcherStarted = false;

/**
 * Register a store's sync adapter. Idempotent — calling twice with
 * the same storeKey replaces the earlier registration (useful in
 * dev with hot reload).
 *
 * If a user is already signed in when this is called, the engine
 * starts immediately. Otherwise it waits for the next sign-in.
 */
export function registerSyncAdapter<TData>(adapter: SyncAdapter<TData>): void {
  ensureAuthWatcher();
  // Stop any previous engine for this key (hot-reload safety).
  const existing = engines.get(adapter.storeKey);
  if (existing) existing.stop();

  const engine = createSyncEngine(adapter);
  engines.set(adapter.storeKey, engine);

  // Emit aggregate status when this engine changes.
  engine.subscribe(() => emitAggregate());

  if (currentUserId) {
    void engine.start();
  }
}

/**
 * Compute the aggregate status across all registered engines. The
 * "worst" state wins (in a UX-relevant sense — user cares most
 * about seeing that something is broken or in flight).
 */
function computeAggregate(): SyncStatus {
  if (engines.size === 0) return "signed-out";
  const statuses = new Set<SyncStatus>();
  for (const e of engines.values()) statuses.add(e.getStatus());
  // Precedence: error > syncing > offline > signed-out > idle
  if (statuses.has("error")) return "error";
  if (statuses.has("syncing")) return "syncing";
  if (statuses.has("offline")) return "offline";
  if (statuses.has("signed-out")) return "signed-out";
  return "idle";
}

function emitAggregate() {
  const s = computeAggregate();
  aggregateListeners.forEach((l) => l(s));
}

/**
 * Subscribe to aggregate sync status changes. Consumed by
 * `use-sync-status.ts` for UI display.
 */
export function subscribeAggregateStatus(
  listener: (status: SyncStatus) => void,
): () => void {
  aggregateListeners.add(listener);
  listener(computeAggregate());
  return () => aggregateListeners.delete(listener);
}

/**
 * Force all registered engines to pull now. Used by manual "Sync
 * now" affordances and by the migration prompt (A.4).
 */
export async function pullAll(): Promise<void> {
  await Promise.all(Array.from(engines.values()).map((e) => e.pull()));
}

/**
 * Force all registered engines to push now. Rarely needed — pushes
 * happen automatically on local change. Exposed for the migration
 * prompt (A.4) to flush existing local data on first sign-in.
 */
export async function pushAll(): Promise<void> {
  await Promise.all(Array.from(engines.values()).map((e) => e.push()));
}

/**
 * Attach the Supabase auth-state watcher once. Starts/stops all
 * registered engines whenever the user signs in / out.
 *
 * Idempotent — calling twice does nothing extra.
 */
function ensureAuthWatcher() {
  if (authWatcherStarted) return;
  authWatcherStarted = true;
  const supabase = createClient();

  // Hydrate current user id.
  void supabase.auth.getUser().then(({ data }) => {
    const uid = data.user?.id ?? null;
    if (uid !== currentUserId) {
      currentUserId = uid;
      if (uid) {
        for (const e of engines.values()) void e.start();
      }
    }
  });

  // React to auth changes.
  supabase.auth.onAuthStateChange((_event, session) => {
    const uid = session?.user?.id ?? null;
    if (uid === currentUserId) return;
    currentUserId = uid;
    if (uid) {
      // Signed in — start every registered engine (fresh device
      // hydrates from cloud; existing device pushes local changes).
      for (const e of engines.values()) void e.start();
    } else {
      // Signed out — stop every engine (local state stays intact
      // in Zustand persist; sync just pauses).
      for (const e of engines.values()) e.stop();
    }
    emitAggregate();
  });
}
