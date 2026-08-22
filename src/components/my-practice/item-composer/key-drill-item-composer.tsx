"use client";

import { useMemo } from "react";
import { LibraryItemFields } from "./library-item-fields";
import { useKeyDrillsLibrary } from "@/lib/key-sequencer/library-store";
import { MODULE_DEFAULT_CATEGORY } from "@/lib/tracking/category-defaults";
import {
  newRoutineItemId,
  type RoutineItem,
} from "@/lib/practice/routine-types";

/**
 * KeyDrillItemComposer — Slice B.5 (Phase 105).
 *
 * Thin wrapper around LibraryItemFields for Key Sequencer drills.
 * Draws from the same store the /practice/keys page uses; starter
 * templates are included alongside user drills (both are user-owned
 * once the starters seed).
 */
export function KeyDrillItemComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (item: RoutineItem) => void;
  onCancel: () => void;
}) {
  const drills = useKeyDrillsLibrary((s) => s.drills);

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
      emptyMessage="No Key Sequencer drills yet. Build one on /practice/keys, then come back."
      moduleDefaultCategory={MODULE_DEFAULT_CATEGORY["key-sequencer"]}
      itemType="key-drill"
      onCancel={onCancel}
      onSubmit={({ pickedId, label, category, methodologyId, estimatedSeconds }) => {
        const item: RoutineItem = {
          id: newRoutineItemId(),
          type: "key-drill",
          keyDrillId: pickedId,
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
