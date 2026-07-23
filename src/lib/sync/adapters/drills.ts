"use client";

import { useDrillsLibrary, type Drill } from "@/lib/state/drills-library";
import { createCollectionSyncAdapter } from "./collection-adapter";

/**
 * Drills library sync adapter — Slice A.5 (Phase 85).
 *
 * Wraps the Bass Arpeggios drills library (Quick Start entries at
 * the top of /practice). Standard collection shape; all the mechanics
 * live in `collection-adapter.ts`.
 */
export const drillsSyncAdapter = createCollectionSyncAdapter<
  ReturnType<typeof useDrillsLibrary.getState>,
  Drill
>({
  storeKey: "drills",
  tableName: "drills",
  displayLabel: "Bass drills",
  store: useDrillsLibrary,
  getItems: (s) => s.drills,
  setItems: (drills) => useDrillsLibrary.setState({ drills }),
});
