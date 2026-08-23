"use client";

import { FolderTree, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CollectionCard } from "./collection-card";
import { CollectionFormModal } from "./collection-form-modal";
import {
  collectionToRoutineItems,
  useCollections,
} from "@/lib/practice/collections";
import { useRoutinesLibrary } from "@/lib/practice/routines-library";

/**
 * CollectionsTab — Slice I.2 (Phase 149).
 *
 * The Collections pane inside /my-practice. Sorted by most-recently-
 * updated first — that surfaces the collection you're actively curating.
 *
 * Phase 149 ships the metadata surface only: create / rename / recolor /
 * delete. Membership editing (adding drills / sheets / songs to a
 * collection) lives on the drill / sheet / song cards themselves in
 * Phase 150.
 */
export function CollectionsTab() {
  const collections = useCollections((s) => s.collections);
  const [editingId, setEditingId] = useState<string | null | undefined>(
    undefined,
  );

  const sorted = [...collections].sort((a, b) => b.updatedAt - a.updatedAt);
  const isEmpty = sorted.length === 0;

  const openCreate = () => setEditingId(null);
  const openEdit = (id: string) => setEditingId(id);
  const closeForm = () => setEditingId(undefined);

  const router = useRouter();
  const handleRun = useCallback(
    (collectionId: string) => {
      const collection = useCollections
        .getState()
        .collections.find((c) => c.id === collectionId);
      if (!collection) return;
      const items = collectionToRoutineItems(collection);
      const id = useRoutinesLibrary.getState().saveRoutine({
        name: collection.name,
        notes: collection.description,
        items,
        source: "template",
        sourceRef: collection.id,
      });
      router.push(`/my-practice?tab=routines&routine=${id}`);
    },
    [router],
  );

  return (
    <>
      <section className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">
              Collections
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cross-module groups. Bundle drills, sheets, and songs
              around a theme — a piece you&rsquo;re learning, a
              technique focus, a semester of work.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New collection
          </button>
        </header>

        {isEmpty ? (
          <EmptyState onCreate={openCreate} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((c) => (
              <li key={c.id}>
                <CollectionCard
                collection={c}
                onEdit={openEdit}
                onRun={handleRun}
              />
              </li>
            ))}
          </ul>
        )}
      </section>

      {editingId !== undefined && (
        <CollectionFormModal collectionId={editingId} onClose={closeForm} />
      )}
    </>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-background/20 px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FolderTree className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-sm text-foreground">No collections yet.</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Collections gather related material into one named group.
          Perfect for &ldquo;Learn the Fretboard&rdquo;, &ldquo;Bebop
          Standards&rdquo;, or &ldquo;This semester&rsquo;s recital
          program.&rdquo;
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Create your first collection
      </button>
    </div>
  );
}
