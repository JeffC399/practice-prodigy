"use client";

import type { CustomPattern } from "@/lib/music/custom-patterns";
import { useCustomPatternsLibrary } from "@/lib/state/custom-patterns-library";
import { createCollectionSyncAdapter } from "./collection-adapter";

/**
 * Custom arpeggio patterns library sync adapter — Slice A.5 (Phase 85).
 *
 * Wraps user-authored patterns (Custom Patterns editor). Standard
 * collection shape.
 */
export const customPatternsSyncAdapter = createCollectionSyncAdapter<
  ReturnType<typeof useCustomPatternsLibrary.getState>,
  CustomPattern
>({
  storeKey: "custom-patterns",
  tableName: "custom_patterns",
  displayLabel: "Custom patterns",
  store: useCustomPatternsLibrary,
  getItems: (s) => s.patterns,
  setItems: (patterns) => useCustomPatternsLibrary.setState({ patterns }),
});
