"use client";

import { useMemo } from "react";
import { LibraryItemFields } from "./library-item-fields";
import { useScaleDrillsLibrary } from "@/lib/scale-driller/library-store";
import { MODULE_DEFAULT_CATEGORY } from "@/lib/tracking/category-defaults";
import {
  newRoutineItemId,
  type RoutineItem,
} from "@/lib/practice/routine-types";

/**
 * ScaleDrillItemComposer — Slice B.5 (Phase 105).
 *
 * Thin wrapper around LibraryItemFields for Scale Driller drills.
 */
export function ScaleDrillItemComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (item: RoutineItem) => void;
  onCancel: () => void;
}) {
  const drills = useScaleDrillsLibrary((s) => s.drills);

  const library = useMemo(
    () =>
      drills.map((d) => ({
        id: d.id,
        name: d.isStarter ? `${d.name} (template)` : d.name,
        category: d.category,
      })),
    [drills],
  );

  return (
    <LibraryItemFields
      library={library}
      emptyMessage="No Scale Driller drills yet. Build one on /practice/scales, then come back."
      moduleDefaultCategory={MODULE_DEFAULT_CATEGORY["scale-driller"]}
      itemType="scale-drill"
      onCancel={onCancel}
      onSubmit={({ pickedId, label, category, methodologyId, estimatedSeconds }) => {
        const item: RoutineItem = {
          id: newRoutineItemId(),
          type: "scale-drill",
          scaleDrillId: pickedId,
          label,
          category,
          methodologyId,
          estimatedSeconds,
        };
        onSubmit(item);
      }}
    />
  );
}
