"use client";

import type { Collection } from "@/lib/practice/collections";
import { useCollections } from "@/lib/practice/collections";
import { createCollectionSyncAdapter } from "./collection-adapter";

/**
 * Collections library sync adapter — Slice I.1 (Phase 148).
 *
 * Standard collection-adapter shape (same as drills, sheets, songs,
 * routines). Every saved Collection round-trips through the
 * `collections` Supabase table via the shared `(id text, user_id
 * uuid, data jsonb, updated_at)` layout.
 *
 * Registered in SyncBoot as the 10th synced store. Requires migration
 * 0009_collections.sql to have been applied to the target project.
 */
export const collectionsSyncAdapter = createCollectionSyncAdapter<
  ReturnType<typeof useCollections.getState>,
  Collection
>({
  storeKey: "collections",
  tableName: "collections",
  displayLabel: "Collections",
  store: useCollections,
  getItems: (s) => s.collections,
  setItems: (collections) => useCollections.setState({ collections }),
});
