"use client";

import type { Song } from "@/lib/practice/songs-library";
import { useSongsLibrary } from "@/lib/practice/songs-library";
import { createCollectionSyncAdapter } from "./collection-adapter";

/**
 * Songs library sync adapter — Slice C.1 (Phase 128).
 *
 * Standard collection-adapter shape (same as drills, sheets,
 * key-drills, routines). Every saved song round-trips through the
 * `songs` Supabase table via the shared `(id text, user_id uuid,
 * data jsonb, updated_at)` collection layout.
 *
 * Registered in SyncBoot as the 9th synced store. No new migration
 * needed — the `songs` table was provisioned in the 0007 schema reset.
 */
export const songsSyncAdapter = createCollectionSyncAdapter<
  ReturnType<typeof useSongsLibrary.getState>,
  Song
>({
  storeKey: "songs",
  tableName: "songs",
  displayLabel: "Songs library",
  store: useSongsLibrary,
  getItems: (s) => s.songs,
  setItems: (songs) => useSongsLibrary.setState({ songs }),
});
