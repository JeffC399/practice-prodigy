"use client";

import { ChevronDown, ChevronRight, FolderTree } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  useCollections,
  type Collection,
  type CollectionMemberType,
} from "@/lib/practice/collections";

/**
 * CollectionsSectionedList — Slice I.4 (Phase 151).
 *
 * Reshapes a flat list of library items into per-collection sections
 * with an "Ungrouped" bucket at the bottom. Each section header is
 * a click-to-collapse row showing the collection's emoji/color +
 * name + count.
 *
 * ## Behavior
 *
 * - Only collections that CONTAIN at least one item from this module
 *   render a header. A collection with 0 members in this module
 *   (e.g. a Songs-only collection viewed from Key Sequencer) is
 *   hidden entirely so we don't fill the screen with empty groups.
 * - An item can belong to multiple collections; the same item
 *   appears under each collection's header (as a card in each
 *   section). This matches the many-to-many mental model —
 *   collections aren't exclusive.
 * - When the user has zero collections, the shell short-circuits
 *   and just renders the items flat (with no "Ungrouped" header).
 *   Users who haven't opted into collections shouldn't see extra
 *   chrome.
 *
 * ## Collapse state
 *
 * Held in component state, keyed by collection id. Not persisted
 * (yet) — a reload starts everything expanded. Persistence is a
 * later polish pass.
 */
export function CollectionsSectionedList<TItem extends { id: string }>({
  items,
  memberType,
  renderItem,
  renderEmpty,
  className = "",
  sectionClassName = "",
}: {
  items: readonly TItem[];
  memberType: CollectionMemberType;
  renderItem: (item: TItem) => ReactNode;
  /** Rendered when items.length === 0. Optional; passthrough helper. */
  renderEmpty?: () => ReactNode;
  /** Wrapping class for the outer container. */
  className?: string;
  /** Class applied to each section's inner list (grid, gap, etc.). */
  sectionClassName?: string;
}) {
  const collections = useCollections((s) => s.collections);

  const groups = useMemo(
    () => groupItemsByCollection(items, collections, memberType),
    [items, collections, memberType],
  );

  // Short-circuit — no collections OR no items → just render items
  // flat (or empty state). Keeps the UI clean for users who haven't
  // opted into collections yet.
  if (items.length === 0 && renderEmpty) return <>{renderEmpty()}</>;
  if (collections.length === 0) {
    return (
      <div className={sectionClassName}>{items.map((item) => renderItem(item))}</div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {groups.perCollection.map((group) => (
        <CollectionSection
          key={group.collection.id}
          collection={group.collection}
          items={group.items}
          renderItem={renderItem}
          sectionClassName={sectionClassName}
        />
      ))}
      {groups.ungrouped.length > 0 && (
        <UngroupedSection
          items={groups.ungrouped}
          renderItem={renderItem}
          sectionClassName={sectionClassName}
          hasCollections={groups.perCollection.length > 0}
        />
      )}
    </div>
  );
}

function CollectionSection<TItem extends { id: string }>({
  collection,
  items,
  renderItem,
  sectionClassName,
}: {
  collection: Collection;
  items: readonly TItem[];
  renderItem: (item: TItem) => ReactNode;
  sectionClassName: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section
      className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/20 p-3"
      style={
        collection.color
          ? { borderColor: `${collection.color}55` }
          : undefined
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-background/60"
      >
        {open ? (
          <ChevronDown
            className="h-3.5 w-3.5 text-muted-foreground/70"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            className="h-3.5 w-3.5 text-muted-foreground/70"
            aria-hidden="true"
          />
        )}
        {collection.emoji ? (
          <span className="text-base" aria-hidden="true">
            {collection.emoji}
          </span>
        ) : (
          <FolderTree
            className="h-4 w-4"
            style={{ color: collection.color ?? "currentColor" }}
            aria-hidden="true"
          />
        )}
        <span className="text-sm font-medium text-foreground">
          {collection.name}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </button>
      {open && (
        <div className={sectionClassName}>
          {items.map((item) => renderItem(item))}
        </div>
      )}
    </section>
  );
}

function UngroupedSection<TItem extends { id: string }>({
  items,
  renderItem,
  sectionClassName,
  hasCollections,
}: {
  items: readonly TItem[];
  renderItem: (item: TItem) => ReactNode;
  sectionClassName: string;
  hasCollections: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-dashed border-border/60 bg-background/10 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-background/60"
      >
        {open ? (
          <ChevronDown
            className="h-3.5 w-3.5 text-muted-foreground/70"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            className="h-3.5 w-3.5 text-muted-foreground/70"
            aria-hidden="true"
          />
        )}
        <span className="text-sm font-medium text-muted-foreground">
          {hasCollections ? "Ungrouped" : "All items"}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </button>
      {open && (
        <div className={sectionClassName}>
          {items.map((item) => renderItem(item))}
        </div>
      )}
    </section>
  );
}

/**
 * Bucket items into `{ perCollection: [{collection, items[]}],
 * ungrouped: [] }`. An item belonging to multiple collections
 * appears in each — deliberate, matches the many-to-many model.
 */
function groupItemsByCollection<TItem extends { id: string }>(
  items: readonly TItem[],
  collections: readonly Collection[],
  memberType: CollectionMemberType,
): {
  perCollection: { collection: Collection; items: TItem[] }[];
  ungrouped: TItem[];
} {
  // Build a per-collection set of item ids that are members of this
  // module. One pass over collections × members; small in practice.
  const collectionToItemIds = new Map<string, Set<string>>();
  const memberedIds = new Set<string>();
  for (const c of collections) {
    const set = new Set<string>();
    for (const m of c.members) {
      if (m.type === memberType) {
        set.add(m.id);
        memberedIds.add(m.id);
      }
    }
    if (set.size > 0) collectionToItemIds.set(c.id, set);
  }

  const itemById = new Map(items.map((it) => [it.id, it]));

  const perCollection: { collection: Collection; items: TItem[] }[] = [];
  for (const c of collections) {
    const set = collectionToItemIds.get(c.id);
    if (!set) continue;
    const groupItems: TItem[] = [];
    for (const id of set) {
      const item = itemById.get(id);
      if (item) groupItems.push(item);
    }
    if (groupItems.length > 0) {
      perCollection.push({ collection: c, items: groupItems });
    }
  }

  const ungrouped = items.filter((it) => !memberedIds.has(it.id));
  return { perCollection, ungrouped };
}
