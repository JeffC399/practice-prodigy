"use client";

import type { Sheet } from "@/lib/sheets/types";
import { useSheetsLibrary } from "@/lib/state/sheets-library";
import { createCollectionSyncAdapter } from "./collection-adapter";

/**
 * Lead Sheet Builder sheets library sync adapter — Slice A.5 (Phase 85).
 *
 * Wraps the /sheets library. Standard collection shape.
 */
export const sheetsSyncAdapter = createCollectionSyncAdapter<
  ReturnType<typeof useSheetsLibrary.getState>,
  Sheet
>({
  storeKey: "sheets",
  tableName: "sheets",
  displayLabel: "Lead sheets",
  store: useSheetsLibrary,
  getItems: (s) => s.sheets,
  setItems: (sheets) => useSheetsLibrary.setState({ sheets }),
});
