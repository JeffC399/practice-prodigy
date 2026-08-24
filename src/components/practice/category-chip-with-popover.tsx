"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Portal + fixed positioning so card `overflow-hidden` can't clip
  // the picker (same fix as CollectionsChip). Recompute on scroll /
  // resize so the popover tracks the trigger.
  useLayoutEffect(() => {
    if (!open) return;
    const POPOVER_WIDTH = 256; // matches w-64 on the picker
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < 320;
      const top = openUp ? Math.max(8, r.top - 8 - 320) : r.bottom + 4;
      const leftUnclamped =
        align === "right" ? r.right - POPOVER_WIDTH : r.left;
      const left = Math.max(
        8,
        Math.min(window.innerWidth - POPOVER_WIDTH - 8, leftUnclamped),
      );
      setCoords({ top, left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, align]);

  return (
    <div ref={triggerRef} className="relative inline-block">
      <CategoryChip
        categoryId={value}
        onClick={() => setOpen((v) => !v)}
        size={size}
      />
      {open &&
        mounted &&
        coords &&
        createPortal(
          <div
            className="fixed z-50"
            style={{ top: coords.top, left: coords.left }}
          >
            <CategoryPicker
              value={value}
              onChange={(next) => {
                onChange(next);
                setOpen(false);
              }}
              onDismiss={() => setOpen(false)}
              ignoreRef={triggerRef}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
