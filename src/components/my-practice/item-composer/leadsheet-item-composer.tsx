"use client";

import { useMemo } from "react";
import { LibraryItemFields } from "./library-item-fields";
import {
  newRoutineItemId,
  type RoutineItem,
} from "@/lib/practice/routine-types";
import { useSheetsLibrary } from "@/lib/state/sheets-library";
import { MODULE_DEFAULT_CATEGORY } from "@/lib/tracking/category-defaults";

/**
 * LeadsheetItemComposer — Slice B.6 (Phase 106).
 *
 * Thin wrapper around LibraryItemFields for lead-sheet playback
 * items. Pulls from useSheetsLibrary (same store /sheets uses).
 */
export function LeadsheetItemComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (item: RoutineItem) => void;
  onCancel: () => void;
}) {
  const sheets = useSheetsLibrary((s) => s.sheets);

  const library = useMemo(
    () =>
      sheets.map((sheet) => ({
        id: sheet.id,
        // Fall back for untitled sheets so the dropdown never renders blank.
        name: sheet.title.trim() || "Untitled sheet",
        category: sheet.category,
      })),
    [sheets],
  );

  return (
    <LibraryItemFields
      library={library}
      emptyMessage="No lead sheets yet. Create one on /sheets, then come back."
      moduleDefaultCategory={MODULE_DEFAULT_CATEGORY["lsb-playback"]}
      onCancel={onCancel}
      onSubmit={({ pickedId, label, category, estimatedSeconds }) => {
        const item: RoutineItem = {
          id: newRoutineItemId(),
          type: "leadsheet",
          leadSheetId: pickedId,
          label,
          category,
          estimatedSeconds,
        };
        onSubmit(item);
      }}
    />
  );
}
