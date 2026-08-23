"use client";

import { FolderTree, Pencil, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  useCollections,
  type Collection,
} from "@/lib/practice/collections";

/**
 * CollectionCard — Slice I.2 (Phase 149).
 *
 * One saved collection rendered as a tile in the Collections tab.
 * Shows:
 *   - Optional emoji + name (with color swatch when set)
 *   - Description (if any)
 *   - Member count
 *   - Hover-revealed edit + delete
 *
 * A future phase will replace the plain click with a jump to a
 * collection-detail view where the user can drag members around.
 * For Phase 149 clicking Edit opens the metadata modal only —
 * membership editing lives on the drill / sheet / song cards
 * themselves (Phase 150).
 */
export function CollectionCard({
  collection,
  onEdit,
  onRun,
}: {
  collection: Collection;
  onEdit: (id: string) => void;
  /**
   * Slice I.6 (Phase 153) — When set, a Run button appears that
   * converts the collection's members into a new routine and jumps
   * to the builder. Owned by CollectionsTab so it can use the
   * router without importing next/navigation here.
   */
  onRun?: (id: string) => void;
}) {
  const deleteCollection = useCollections((s) => s.deleteCollection);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const memberCount = collection.members.length;
  const runnable = onRun && memberCount > 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border-2 border-border bg-background/40 transition-all hover:border-primary/60 hover:bg-primary/5 hover:shadow-md">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base"
            style={{
              backgroundColor: collection.color
                ? `${collection.color}20`
                : undefined,
              color: collection.color,
              borderColor: collection.color,
            }}
            aria-hidden="true"
          >
            {collection.emoji || <FolderTree className="h-4 w-4" />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-base font-medium text-foreground">
              {collection.name}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
              {memberCount} {memberCount === 1 ? "item" : "items"}
            </span>
          </div>
        </div>

        {collection.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {collection.description}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-1 border-t border-border/60 bg-background/30 px-3 py-2 opacity-100 transition-opacity md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto">
        {runnable && (
          <button
            type="button"
            onClick={() => onRun!(collection.id)}
            aria-label={`Run collection ${collection.name} as a new routine`}
            title="Convert this collection to a new routine + open in builder"
            className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Play className="h-3 w-3" aria-hidden="true" />
            Run
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(collection.id)}
          aria-label={`Edit collection ${collection.name}`}
          title="Edit"
          className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
          Edit
        </button>
        {confirmingDelete ? (
          <>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                deleteCollection(collection.id);
                setConfirmingDelete(false);
              }}
              className="inline-flex h-7 items-center justify-center rounded-md bg-destructive px-2 text-[11px] font-medium text-destructive-foreground transition-opacity hover:opacity-90"
            >
              Confirm
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete collection ${collection.name}`}
            title="Delete"
            className="inline-flex h-7 items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
