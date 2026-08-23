"use client";

import { FolderTree } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CollectionsMembershipPicker } from "./collections-membership-picker";
import {
  collectionsContaining,
  useCollections,
  type CollectionMember,
} from "@/lib/practice/collections";

/**
 * CollectionsChip — Slice I.3 (Phase 150).
 *
 * Small chip placed on drill / sheet / song cards showing which
 * collections the item belongs to. Clicking opens the membership
 * picker.
 *
 * Two visual states:
 *   1. Member of 1+ collections → shows "In: {emoji or icon} A,
 *      {emoji or icon} B" (max 2 names, then "+N more")
 *   2. Member of 0 collections → shows "+ Collection" outline button
 *
 * Subscribes to useCollections so it updates live as membership
 * changes elsewhere (e.g. from the Collections tab).
 */
export function CollectionsChip({
  member,
  align = "right",
}: {
  member: CollectionMember;
  /**
   * Which side of the trigger the popover opens on. Cards' chip lives
   * in a tight footer, so "right" (opens leftward) is the default —
   * prevents overflow off narrow cards.
   */
  align?: "left" | "right";
}) {
  // Subscribe to the store so we re-render when membership changes.
  const collections = useCollections((s) => s.collections);
  void collections; // Referenced only for subscription; read via helper below.
  const memberships = collectionsContaining(member);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on Esc for accessibility.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isEmpty = memberships.length === 0;
  const shown = memberships.slice(0, 2);
  const remaining = memberships.length - shown.length;

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label="Manage collections for this item"
        title={
          isEmpty
            ? "Add to a collection"
            : memberships.map((c) => c.name).join(", ")
        }
        className={
          isEmpty
            ? "inline-flex items-center gap-1 rounded-md border border-dashed border-border/70 bg-transparent px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground"
            : "inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        }
      >
        {isEmpty ? (
          <>
            <FolderTree className="h-3 w-3" aria-hidden="true" />
            <span>+ Collection</span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground/70">In:</span>
            {shown.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-0.5">
                {c.emoji ? (
                  <span aria-hidden="true">{c.emoji}</span>
                ) : (
                  <FolderTree
                    className="h-3 w-3"
                    style={{ color: c.color ?? "currentColor" }}
                    aria-hidden="true"
                  />
                )}
                <span className="max-w-24 truncate">{c.name}</span>
              </span>
            ))}
            {remaining > 0 && (
              <span className="text-muted-foreground/70">
                +{remaining} more
              </span>
            )}
          </>
        )}
      </button>
      {open && (
        <div
          className={`absolute top-full z-30 mt-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <CollectionsMembershipPicker
            member={member}
            onDismiss={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
