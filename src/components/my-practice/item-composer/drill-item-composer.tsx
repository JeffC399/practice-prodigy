"use client";

import { useMemo } from "react";
import { LibraryItemFields } from "./library-item-fields";
import { MODULE_DEFAULT_CATEGORY } from "@/lib/tracking/category-defaults";
import {
  newRoutineItemId,
  type RoutineItem,
} from "@/lib/practice/routine-types";
import { SHIPPED_DRILLS } from "@/lib/data/shipped-drills";
import { useDrillsLibrary } from "@/lib/state/drills-library";

/**
 * DrillItemComposer — Slice B.5 (Phase 105).
 *
 * Thin wrapper around LibraryItemFields for the Bass Arpeggios drill
 * type. Merges user-saved drills with shipped built-ins so both are
 * pickable in routines.
 */
export function DrillItemComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (item: RoutineItem) => void;
  onCancel: () => void;
}) {
  const userDrills = useDrillsLibrary((s) => s.drills);

  const library = useMemo(
    () => [
      ...userDrills.map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
      })),
      ...SHIPPED_DRILLS.map((d) => ({
        id: d.id,
        name: `${d.name} (built-in)`,
        category: undefined,
      })),
    ],
    [userDrills],
  );

  return (
    <LibraryItemFields
      library={library}
      emptyMessage="No drills yet. Save one on /practice, then come back."
      moduleDefaultCategory={MODULE_DEFAULT_CATEGORY.arpeggios}
      onCancel={onCancel}
      onSubmit={({ pickedId, label, category, estimatedSeconds }) => {
        const item: RoutineItem = {
          id: newRoutineItemId(),
          type: "drill",
          drillId: pickedId,
          label,
          category,
          estimatedSeconds,
        };
        onSubmit(item);
      }}
    />
  );
}
