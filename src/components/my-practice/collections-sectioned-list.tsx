"use client";

import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FolderTree,
  GripVertical,
} from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { BulkAddToCollectionMenu } from "./bulk-add-to-collection-menu";
import {
  useCollections,
  type Collection,
  type CollectionMember,
  type CollectionMemberType,
} from "@/lib/practice/collections";

/**
 * CollectionsSectionedList — Slice I.4 (Phase 151), + DnD in Phase 163.
 *
 * Reshapes a flat list of library items into per-collection sections
 * with an "Ungrouped" bucket at the bottom. Users can:
 *
 *   - Click a section header to collapse / expand.
 *   - Drag an item's grip handle to another section (move it between
 *     collections, or into/out of Ungrouped).
 *   - Drag within a section to reorder (updates the collection's
 *     `members` array order — Ungrouped reorders are a no-op since
 *     Ungrouped has no persistent order).
 *
 * Drag is MOVE semantics: dragging an item from Collection A to
 * Collection B removes it from A and adds it to B. Users who want the
 * same item in multiple collections should use the CollectionsChip's
 * checkbox picker (many-to-many).
 *
 * ## Behavior
 *
 * - Only collections that CONTAIN at least one item from this module
 *   render a header. A collection with 0 members in this module is
 *   hidden entirely so we don't fill the screen with empty groups.
 * - When the user has zero collections, the shell short-circuits and
 *   just renders the items flat (no DnD, no headers) — users who
 *   haven't opted in shouldn't see extra chrome.
 * - When a collection ends up empty after a drag, the section
 *   disappears on the next render (its group.items becomes empty).
 */

/** Sentinel section id for the ungrouped bucket. */
const UNGROUPED_ID = "__ungrouped__";

export function CollectionsSectionedList<TItem extends { id: string }>({
  items,
  memberType,
  renderItem,
  renderEmpty,
  className = "",
  sectionClassName = "",
  enableBulkSelect = false,
  itemLabel = "drill",
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
  /**
   * When true, exposes a "Select" toolbar above the list that lets the
   * user pick multiple items and add them all to one collection in a
   * single action. Off by default so callers opt into the extra chrome.
   */
  enableBulkSelect?: boolean;
  /**
   * Singular noun used in bulk-select copy ("Select drills…",
   * "3 drills selected"). Defaults to "drill".
   */
  itemLabel?: string;
}) {
  const collections = useCollections((s) => s.collections);
  const addMember = useCollections((s) => s.addMember);
  const removeMember = useCollections((s) => s.removeMember);
  const setMembers = useCollections((s) => s.setMembers);

  const groups = useMemo(
    () => groupItemsByCollection(items, collections, memberType),
    [items, collections, memberType],
  );

  // Sensors: pointer (mouse/touch) + keyboard for a11y. 6px activation
  // distance keeps micro-drags from stealing click intent — users can
  // still click the drill card to launch it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  void activeId; // available for future drag-overlay work

  // Multi-select state — lives inside the list so no external plumbing
  // is required. `selectionMode` toggles the UI affordance; `selected`
  // holds the item ids the user has ticked.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const bulkTriggerRef = useRef<HTMLButtonElement | null>(null);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelected(new Set());
    setBulkMenuOpen(false);
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(items.map((it) => it.id)));
  };

  // Look up which section holds an item id — used to reject drags
  // that would produce a no-op.
  const findSectionOfItem = (itemId: string): string | null => {
    for (const g of groups.perCollection) {
      if (g.items.some((it) => it.id === itemId)) return g.collection.id;
    }
    if (groups.ungrouped.some((it) => it.id === itemId)) return UNGROUPED_ID;
    return null;
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const sourceSection = findSectionOfItem(activeId);
    if (!sourceSection) return;

    // The `over` id can be either another item id (reorder / cross-
    // section drop on a specific item) OR a section container id
    // (drop into an empty section or below the last item).
    let destSection: string | null = null;
    if (overId === UNGROUPED_ID || collections.some((c) => c.id === overId)) {
      destSection = overId;
    } else {
      destSection = findSectionOfItem(overId);
    }
    if (!destSection) return;

    const member: CollectionMember = { type: memberType, id: activeId };

    if (sourceSection === destSection) {
      // Reorder within the same section.
      if (destSection === UNGROUPED_ID) return; // Ungrouped has no persistent order.
      const collection = collections.find((c) => c.id === destSection);
      if (!collection) return;
      // Build the current in-module member id order + move activeId to
      // the position of overId.
      const inModule = collection.members.filter((m) => m.type === memberType);
      const notInModule = collection.members.filter(
        (m) => m.type !== memberType,
      );
      const currentOrder = inModule.map((m) => m.id);
      const fromIdx = currentOrder.indexOf(activeId);
      const toIdx = currentOrder.indexOf(overId);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = currentOrder.splice(fromIdx, 1);
      currentOrder.splice(toIdx, 0, moved);
      const nextMembers = [
        ...notInModule,
        ...currentOrder.map((id) => ({ type: memberType, id })),
      ];
      setMembers(collection.id, nextMembers);
      return;
    }

    // Cross-section drop: remove from source, add to dest.
    if (sourceSection !== UNGROUPED_ID) {
      removeMember(sourceSection, member);
    }
    if (destSection !== UNGROUPED_ID) {
      addMember(destSection, member);
    }
    // Ungrouped → Ungrouped can't happen (same-section case above).
    // Ungrouped → Collection = add only. Collection → Ungrouped =
    // remove only. Handled.
  };

  // Short-circuit — no collections OR no items → just render items
  // flat. No DnD when there are no sections to drop between.
  if (items.length === 0 && renderEmpty) return <>{renderEmpty()}</>;
  if (collections.length === 0 && !enableBulkSelect) {
    return (
      <div className={sectionClassName}>
        {items.map((item) => renderItem(item))}
      </div>
    );
  }

  const selectionApi: SelectionApi | undefined = selectionMode
    ? { selected, toggle: toggleSelected }
    : undefined;

  const allSelected =
    selectionMode && selected.size === items.length && items.length > 0;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {enableBulkSelect && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background/30 px-3 py-2">
          {!selectionMode ? (
            <button
              type="button"
              onClick={() => setSelectionMode(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Select multiple
            </button>
          ) : (
            <>
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {selected.size} {selected.size === 1 ? itemLabel : `${itemLabel}s`} selected
              </span>
              <button
                type="button"
                onClick={allSelected ? () => setSelected(new Set()) : selectAll}
                className="rounded-md border border-border/70 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  ref={bulkTriggerRef}
                  type="button"
                  onClick={() => setBulkMenuOpen((v) => !v)}
                  disabled={selected.size === 0}
                  className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add to collection…
                </button>
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  className="rounded-md border border-border/70 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {bulkMenuOpen && selected.size > 0 && (
        <BulkAddToCollectionMenu
          triggerRef={bulkTriggerRef}
          memberType={memberType}
          selectedIds={Array.from(selected)}
          onDismiss={() => setBulkMenuOpen(false)}
          onCommitted={exitSelectionMode}
        />
      )}

      {collections.length === 0 ? (
        <div className={sectionClassName}>
          {items.map((item) => (
            <SelectionShell
              key={item.id}
              id={item.id}
              selection={selectionApi}
            >
              {renderItem(item)}
            </SelectionShell>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-4">
            {groups.perCollection.map((group) => (
              <CollectionSection
                key={group.collection.id}
                collection={group.collection}
                items={group.items}
                renderItem={renderItem}
                sectionClassName={sectionClassName}
                selection={selectionApi}
              />
            ))}
            {(groups.ungrouped.length > 0 ||
              groups.perCollection.length > 0) && (
              <UngroupedSection
                items={groups.ungrouped}
                renderItem={renderItem}
                sectionClassName={sectionClassName}
                hasCollections={groups.perCollection.length > 0}
                selection={selectionApi}
              />
            )}
          </div>
        </DndContext>
      )}
    </div>
  );
}

type SelectionApi = {
  selected: Set<string>;
  toggle: (id: string) => void;
};

function CollectionSection<TItem extends { id: string }>({
  collection,
  items,
  renderItem,
  sectionClassName,
  selection,
}: {
  collection: Collection;
  items: readonly TItem[];
  renderItem: (item: TItem) => ReactNode;
  sectionClassName: string;
  selection?: SelectionApi;
}) {
  const [open, setOpen] = useState(true);
  const { setNodeRef, isOver } = useDroppable({ id: collection.id });

  return (
    <section
      ref={setNodeRef}
      className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
        isOver
          ? "border-primary bg-primary/10"
          : "border-border/60 bg-background/20"
      }`}
      style={
        collection.color && !isOver
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
        <SortableContext
          items={items.map((it) => it.id)}
          strategy={rectSortingStrategy}
        >
          <div className={sectionClassName}>
            {items.map((item) => (
              <SortableItemRow
                key={item.id}
                id={item.id}
                selection={selection}
              >
                {renderItem(item)}
              </SortableItemRow>
            ))}
          </div>
        </SortableContext>
      )}
    </section>
  );
}

function UngroupedSection<TItem extends { id: string }>({
  items,
  renderItem,
  sectionClassName,
  hasCollections,
  selection,
}: {
  items: readonly TItem[];
  renderItem: (item: TItem) => ReactNode;
  sectionClassName: string;
  hasCollections: boolean;
  selection?: SelectionApi;
}) {
  const [open, setOpen] = useState(true);
  const { setNodeRef, isOver } = useDroppable({ id: UNGROUPED_ID });

  return (
    <section
      ref={setNodeRef}
      className={`flex flex-col gap-2 rounded-lg border border-dashed p-3 transition-colors ${
        isOver
          ? "border-primary bg-primary/10"
          : "border-border/60 bg-background/10"
      }`}
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
        <span className="text-sm font-medium text-muted-foreground">
          {hasCollections ? "Ungrouped" : "All items"}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </button>
      {open && (
        <SortableContext
          items={items.map((it) => it.id)}
          strategy={rectSortingStrategy}
        >
          <div className={sectionClassName}>
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/40 bg-background/20 px-4 py-6 text-center text-xs italic text-muted-foreground">
                Drag items here to remove from every collection.
              </div>
            ) : (
              items.map((item) => (
                <SortableItemRow
                  key={item.id}
                  id={item.id}
                  selection={selection}
                >
                  {renderItem(item)}
                </SortableItemRow>
              ))
            )}
          </div>
        </SortableContext>
      )}
    </section>
  );
}

/**
 * Wraps a rendered item card with a small grip handle in the top-
 * right corner. The whole card body stays interactive (click to
 * launch, hover-revealed actions, etc.); only the grip fires drag.
 * Uses `group/dnd` so the grip appears on hover without conflicting
 * with existing `group` scopes on child cards.
 */
function SortableItemRow({
  id,
  children,
  selection,
}: {
  id: string;
  children: ReactNode;
  selection?: SelectionApi;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    activeIndex,
    overIndex,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Slice I hotfix — show an "insertion here" outline on the row
  // that's the current drop target (but not the row being dragged
  // itself). Direction (above vs below) mirrors dnd-kit's index
  // comparison so the ring sits on the edge where the item would
  // actually land.
  const showDropRing =
    isOver && !isDragging && activeIndex !== -1 && overIndex !== -1;
  const dropSide =
    showDropRing && activeIndex < overIndex ? "bottom" : "top";

  const inSelectionMode = !!selection;
  const isSelected = selection?.selected.has(id) ?? false;

  return (
    <div ref={setNodeRef} style={style} className="group/dnd relative">
      {/* Selection overlay — only when selection mode is active. Sits
          above the card body and intercepts all clicks so the card's
          own onClick (launch drill, open editor, etc.) doesn't fire
          while the user is picking multiple items. */}
      {inSelectionMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            selection.toggle(id);
          }}
          aria-pressed={isSelected}
          aria-label={isSelected ? "Deselect item" : "Select item"}
          className={`absolute inset-0 z-20 rounded-lg border-2 transition-colors ${
            isSelected
              ? "border-primary bg-primary/15"
              : "border-transparent hover:border-primary/40 hover:bg-primary/5"
          }`}
        >
          <span
            className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border-2 shadow ${
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background/95 text-transparent"
            }`}
            aria-hidden="true"
          >
            <Check className="h-3 w-3" />
          </span>
        </button>
      )}

      {/* Drag handle — sits in the LOWER-LEFT corner of the card, so
          it never conflicts with per-card badges in the top-right
          (EDITING chip on KeyDrillCard), top-left icons (Play), or the
          main click-to-configure body. Hidden entirely while in
          selection mode since drag would conflict with click-to-pick. */}
      {!inSelectionMode && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to another collection or reorder"
          title="Drag to another collection or reorder"
          className="absolute -bottom-2 -left-2 z-10 flex h-6 w-6 cursor-grab items-center justify-center rounded-md border border-border bg-background text-muted-foreground/70 opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover/dnd:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {/* Insertion indicator: a strong colored line on the top or
          bottom edge showing where the dragged item would land if
          dropped here. Only renders while a drag is in progress AND
          this row is the current over-target. */}
      {showDropRing && !inSelectionMode && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 h-1 rounded-full bg-primary ${
            dropSide === "top" ? "-top-1" : "-bottom-1"
          }`}
        />
      )}

      {children}
    </div>
  );
}

/**
 * Bare wrapper for the "no collections yet" flat-list path. Same
 * selection overlay behavior as SortableItemRow, without any of the
 * DnD plumbing — the flat layout doesn't need it.
 */
function SelectionShell({
  id,
  selection,
  children,
}: {
  id: string;
  selection?: SelectionApi;
  children: ReactNode;
}) {
  if (!selection) return <>{children}</>;
  const isSelected = selection.selected.has(id);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          selection.toggle(id);
        }}
        aria-pressed={isSelected}
        aria-label={isSelected ? "Deselect item" : "Select item"}
        className={`absolute inset-0 z-20 rounded-lg border-2 transition-colors ${
          isSelected
            ? "border-primary bg-primary/15"
            : "border-transparent hover:border-primary/40 hover:bg-primary/5"
        }`}
      >
        <span
          className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border-2 shadow ${
            isSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background/95 text-transparent"
          }`}
          aria-hidden="true"
        >
          <Check className="h-3 w-3" />
        </span>
      </button>
      {children}
    </div>
  );
}

/**
 * Bucket items into `{ perCollection: [{collection, items[]}],
 * ungrouped: [] }`. An item belonging to multiple collections
 * appears in each — deliberate, matches the many-to-many model.
 *
 * Per-collection items respect the collection's member order (so
 * drag-reorder within a section is visible on the next render).
 */
function groupItemsByCollection<TItem extends { id: string }>(
  items: readonly TItem[],
  collections: readonly Collection[],
  memberType: CollectionMemberType,
): {
  perCollection: { collection: Collection; items: TItem[] }[];
  ungrouped: TItem[];
} {
  const memberedIds = new Set<string>();
  for (const c of collections) {
    for (const m of c.members) {
      if (m.type === memberType) memberedIds.add(m.id);
    }
  }

  const itemById = new Map(items.map((it) => [it.id, it]));

  const perCollection: { collection: Collection; items: TItem[] }[] = [];
  for (const c of collections) {
    const groupItems: TItem[] = [];
    for (const m of c.members) {
      if (m.type !== memberType) continue;
      const item = itemById.get(m.id);
      if (item) groupItems.push(item);
    }
    if (groupItems.length > 0) {
      perCollection.push({ collection: c, items: groupItems });
    }
  }

  const ungrouped = items.filter((it) => !memberedIds.has(it.id));
  return { perCollection, ungrouped };
}
