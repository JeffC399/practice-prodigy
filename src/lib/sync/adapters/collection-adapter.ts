"use client";

import type { StoreApi, UseBoundStore } from "zustand";
import type { LocalRow, SyncAdapter } from "../types";

/**
 * Factory for collection-store sync adapters — Slice A.5 (Phase 85).
 *
 * All five collection stores (drills, key drills, scale drills,
 * sheets, custom patterns) follow the same shape: a Zustand store
 * with a `TItems[]` field. Each entity has a stable string `id`, an
 * `updatedAt` epoch-millis timestamp, and everything else is opaque
 * payload the app validates on read.
 *
 * This factory captures that shared shape so each store only writes
 * ~15 lines of glue instead of ~80. See `drills.ts`, `key-drills.ts`,
 * etc. for the actual adapters that call this.
 *
 * ## The "applying-remote" flag
 *
 * Same pattern as user-prefs: `applyRemote` calls `setState` which
 * fires our `subscribeLocal` callback and would trigger a push of
 * what we just pulled. The flag suppresses the immediate fire-back.
 */

export type CollectionEntity = {
  id: string;
  updatedAt: number;
};

export type CreateCollectionAdapterOptions<
  TStore,
  TEntity extends CollectionEntity,
> = {
  /** Unique key across all adapters (also used in log lines). */
  storeKey: string;
  /** Matches a table name in database.types.ts. */
  tableName: string;
  /** Human-readable label for the migration prompt UI. */
  displayLabel: string;
  /** The Zustand store hook (returned by `create()`). */
  store: UseBoundStore<StoreApi<TStore>>;
  /** Read the entity array out of the store state. */
  getItems: (state: TStore) => TEntity[];
  /** Replace the entity array in the store. Called after a pull. */
  setItems: (items: TEntity[]) => void;
};

export function createCollectionSyncAdapter<
  TStore,
  TEntity extends CollectionEntity,
>(
  opts: CreateCollectionAdapterOptions<TStore, TEntity>,
): SyncAdapter<TEntity> {
  // Module-scoped so a single closure instance survives across
  // subscribe callbacks and applyRemote calls.
  let applyingRemote = false;

  return {
    storeKey: opts.storeKey,
    tableName: opts.tableName,
    displayLabel: opts.displayLabel,

    extractLocal(): LocalRow<TEntity>[] {
      const items = opts.getItems(opts.store.getState());
      return items.map((item) => ({
        id: item.id,
        data: item,
        updatedAt: item.updatedAt,
      }));
    },

    subscribeLocal(onChange) {
      // Use a selector-based subscription so we only fire when the
      // items array reference changes (not on every unrelated action).
      return opts.store.subscribe((state, prev) => {
        if (opts.getItems(state) === opts.getItems(prev)) return;
        if (applyingRemote) {
          applyingRemote = false;
          return;
        }
        onChange();
      });
    },

    applyRemote(rows) {
      applyingRemote = true;
      // Cloud is source of truth on pull. Replace local items with
      // the pulled set. For A.5 this is a full replace; per-row LWW
      // merge is deferred to A.15 polish per MY-PRACTICE-BUILD-PLAN.md.
      opts.setItems(rows.map((r) => r.data));
    },

    getLocalCount() {
      return opts.getItems(opts.store.getState()).length;
    },
  };
}
