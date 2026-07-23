"use client";

import { useState } from "react";
import type { CategoryId } from "@/lib/practice/categories";
import { CategoryChip } from "./category-chip";
import { CategoryPicker } from "./category-picker";

/**
 * CategoryChipWithPopover — Slice A.10 (Phase 92).
 *
 * The composed chip + popover picker that library cards use. Wraps
 * CategoryChip so clicking opens CategoryPicker in an absolutely
 * positioned popover below. Handles all the popover open/close
 * plumbing so each card call-site is a one-liner:
 *
 *   <CategoryChipWithPopover
 *     value={drill.category}
 *     onChange={(next) => drillsLib.setDrillCategory(drill.id, next)}
 *   />
 *
 * The popover is positioned bottom-left relative to the chip. If
 * that puts it off-screen, callers can pass `align="right"` to flip.
 * z-index 30 keeps it above card content but below modal overlays
 * (z-50).
 */

type Props = {
  value?: CategoryId;
  onChange: (next: CategoryId | undefined) => void;
  size?: "sm" | "md";
  align?: "left" | "right";
};

export function CategoryChipWithPopover({
  value,
  onChange,
  size = "sm",
  align = "left",
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <CategoryChip
        categoryId={value}
        onClick={() => setOpen((v) => !v)}
        size={size}
      />
      {open && (
        <div
          className={`absolute z-30 mt-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <CategoryPicker
            value={value}
            onChange={(next) => {
              onChange(next);
              setOpen(false);
            }}
            onDismiss={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
