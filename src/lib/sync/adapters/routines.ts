"use client";

import type { Routine } from "@/lib/practice/routine-types";
import { useRoutinesLibrary } from "@/lib/practice/routines-library";
import { createCollectionSyncAdapter } from "./collection-adapter";

/**
 * My Practice routines library sync adapter — Slice B.1 (Phase 101).
 *
 * Standard collection-adapter shape (same pattern as drills, sheets,
 * key-drills, etc.). Every saved routine round-trips through the
 * `routines` Supabase table — user builds on their laptop this
 * morning, opens their tablet tonight, sees the same routine.
 *
 * Registered in SyncBoot alongside the other 7 adapters. No new
 * schema migration needed — the `routines` table was already created
 * in migration 0008 with the universal `(id text, user_id uuid, data
 * jsonb, updated_at)` collection shape.
 */
export const routinesSyncAdapter = createCollectionSyncAdapter<
  ReturnType<typeof useRoutinesLibrary.getState>,
  Routine
>({
  storeKey: "routines",
  tableName: "routines",
  displayLabel: "Practice routines",
  store: useRoutinesLibrary,
  getItems: (s) => s.routines,
  setItems: (routines) => useRoutinesLibrary.setState({ routines }),
});
