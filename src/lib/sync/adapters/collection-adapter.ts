"use client";

import type { StoreApi, UseBoundStore } from "zustand";
import type { LocalRow, SyncAdapter } from "../types";

/**
 * Factory for collection-store sync adapters — Slice A.5 (Phase 85),
 * per-row LWW merge added in the ship-week hotfix.
 *
 * All collection stores (drills / key drills / scale drills / sheets /
 * custom patterns / routines / songs / practice sessions / collections)
 * follow the same shape: a Zustand store with a `TItems[]` field. Each
 * entity has a stable string `id`, an `updatedAt` epoch-millis
 * timestamp, and everything else is opaque payload the app validates
 * on read.
 *
 * This factory captures that shared shape so each store only writes
 * ~15 lines of glue instead of ~80.
 *
 * ## Per-row LWW merge (applyRemote)
 *
 * When the sync engine pulls from cloud, we don't blindly replace the
 * local set — we merge per id, keeping whichever side has the newer
 * `updatedAt`. Rules:
 *
 *   1. Row exists LOCAL only  → keep local. It hasn't been pushed yet
 *      (or the push failed); wiping it here would lose user work.
 *   2. Row exists REMOTE only → add remote. Cloud has something the
 *      local device doesn't yet.
 *   3. Row exists BOTH        → keep the newer one by updatedAt.
 *      Ties break toward remote (cloud is canonical on ties).
 *
 * ## The "applying-remote" flag
 *
 * `applyRemote` calls `setState`, which fires `subscribeLocal` and
 * would schedule a push of what we just pulled. The flag suppresses
 * that immediate fire-back for the CASE WHERE THE MERGE IS A NO-OP
 * (rare — usually pull result equals local exactly). When the merge
 * changes the shape (added remote rows, replaced older locals), we
 * DELIBERATELY let the subscribe callback fire so the next push
 * carries any local-only rows up. So the flag only fires-and-forgets
 * the first change; if the merge output != local, subsequent
 * subscribes push normally.
 */

export type CollectionEntity = {
  id: string;
  updatedAt: number;
};

export type CreateCollectionAdapterOptions<
  TStore,
  TEntity extends CollectionEntity,
> = {
  storeKey: string;
  tableName: string;
  displayLabel: string;
  store: UseBoundStore<StoreApi<TStore>>;
  getItems: (state: TStore) => TEntity[];
  setItems: (items: TEntity[]) => void;
};

export function createCollectionSyncAdapter<
  TStore,
  TEntity extends CollectionEntity,
>(
  opts: CreateCollectionAdapterOptions<TStore, TEntity>,
): SyncAdapter<TEntity> {
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
      const local = opts.getItems(opts.store.getState());
      const merged = mergeByLwwId(local, rows);

      // No-op check: if the merged shape matches local exactly (same
      // items in the same order), skip the setState + the fire-back
      // suppression. Prevents empty-cloud pulls from wiping locals
      // that would otherwise re-serialize identically.
      if (arraysEqualByIdAndUpdatedAt(local, merged)) return;

      // If merged has local-only rows that need to be pushed up, we
      // want the subscribe callback to fire so schedulePush runs.
      // Setting applyingRemote here suppresses only the FIRST fire
      // (the setState we're about to do); subsequent user mutations
      // still push normally. That's fine here because the current
      // setState IS the fire we want to schedule a push on when
      // there are local-only rows — but the flag suppresses it.
      //
      // So: only set the flag when the merge output === pulled rows
      // exactly (remote was strictly newer). When we kept any locals
      // that aren't in remote, LET the fire go through so those get
      // pushed up.
      const hasLocalOnly = local.some(
        (l) => !rows.some((r) => r.id === l.id),
      );
      if (!hasLocalOnly) {
        applyingRemote = true;
      }
      opts.setItems(merged);
    },

    getLocalCount() {
      return opts.getItems(opts.store.getState()).length;
    },
  };
}

/**
 * Merge local items + remote rows by id, taking whichever side has
 * the newer `updatedAt`. Preserves local ordering for items that
 * stay local; appends any remote-only items to the end.
 */
function mergeByLwwId<TEntity extends CollectionEntity>(
  local: readonly TEntity[],
  remote: readonly LocalRow<TEntity>[],
): TEntity[] {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const out: TEntity[] = [];

  // Walk local first so its order is preserved. For each local item,
  // pick the newer of {local, remote-with-same-id}.
  for (const localItem of local) {
    const r = remoteById.get(localItem.id);
    if (!r) {
      // Local-only — keep as-is; the next push carries it up.
      out.push(localItem);
      seen.add(localItem.id);
      continue;
    }
    // Both sides have it — take the newer. Ties break to remote
    // (cloud is canonical on equal timestamps).
    if (localItem.updatedAt > r.updatedAt) {
      out.push(localItem);
    } else {
      out.push(r.data);
    }
    seen.add(localItem.id);
  }

  // Add remote-only items at the end.
  for (const r of remote) {
    if (!seen.has(r.id)) out.push(r.data);
  }

  return out;
}

/**
 * Cheap shape equality — same ids in the same order and same
 * updatedAt values. Used to skip a setState when the pull produced
 * no meaningful change.
 */
function arraysEqualByIdAndUpdatedAt<TEntity extends CollectionEntity>(
  a: readonly TEntity[],
  b: readonly TEntity[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id) return false;
    if (a[i].updatedAt !== b[i].updatedAt) return false;
  }
  return true;
}
