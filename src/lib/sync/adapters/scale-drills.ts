"use client";

import { useScaleDrillsLibrary } from "@/lib/scale-driller/library-store";
import type { ScaleDrill } from "@/lib/scale-driller/types";
import { createCollectionSyncAdapter } from "./collection-adapter";

/**
 * Scale Driller drills library sync adapter — Slice A.5 (Phase 85).
 *
 * Wraps the /practice/scales library. Standard collection shape.
 */
export const scaleDrillsSyncAdapter = createCollectionSyncAdapter<
  ReturnType<typeof useScaleDrillsLibrary.getState>,
  ScaleDrill
>({
  storeKey: "scale-drills",
  tableName: "scale_drills",
  displayLabel: "Scale Driller drills",
  store: useScaleDrillsLibrary,
  getItems: (s) => s.drills,
  setItems: (drills) => useScaleDrillsLibrary.setState({ drills }),
});
