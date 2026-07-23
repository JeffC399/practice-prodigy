"use client";

import { useKeyDrillsLibrary } from "@/lib/key-sequencer/library-store";
import type { KeyDrill } from "@/lib/key-sequencer/types";
import { createCollectionSyncAdapter } from "./collection-adapter";

/**
 * Key Sequencer drills library sync adapter — Slice A.5 (Phase 85).
 *
 * Wraps the /practice/keys library. Standard collection shape.
 */
export const keyDrillsSyncAdapter = createCollectionSyncAdapter<
  ReturnType<typeof useKeyDrillsLibrary.getState>,
  KeyDrill
>({
  storeKey: "key-drills",
  tableName: "key_drills",
  displayLabel: "Key Sequencer drills",
  store: useKeyDrillsLibrary,
  getItems: (s) => s.drills,
  setItems: (drills) => useKeyDrillsLibrary.setState({ drills }),
});
