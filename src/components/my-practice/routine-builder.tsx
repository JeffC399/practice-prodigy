"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, GripVertical, ListChecks, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CategoryTimeBar } from "@/components/my-practice/category-time-bar";
import { ItemPickerModal } from "@/components/my-practice/item-picker-modal";
import { CategoryChip } from "@/components/practice/category-chip";
import { getMethodology } from "@/lib/practice/methodologies";
import { PRACTICE_MODULE_LABELS } from "@/lib/practice/types";
import {
  categoryTimeBreakdown,
  useRoutinesLibrary,
} from "@/lib/practice/routines-library";
import {
  ROUTINE_ITEM_TYPE_LABELS,
  totalEstimatedSeconds,
  type Routine,
  type RoutineItem,
  type RoutineItemType,
} from "@/lib/practice/routine-types";

/**
 * RoutineBuilder — Slice B.4 (Phase 104).
 *
 * The dedicated builder view for a single routine. Opened by clicking
 * a routine card's name in the Routines tab; closed via a "Done"
 * button or the browser back button (URL query param drives the
 * open state so refresh + deep link + back all work).
 *
 * ## Phase 104 scope
 *
 * - Header: back link + editable name (live-save, matches card).
 * - Notes: editable textarea (live-save).
 * - Item list: renders items when present + a disabled "Add item"
 *   placeholder until B.5 wires the picker. Each item shows its
 *   type, label, category chip, and estimated duration.
 * - Per-item Delete (two-click confirm) works today.
 * - Summary bar: total item count + total estimated time + category
 *   mix chips.
 *
 * ## Not in Phase 104 (deferred to later phases)
 *
 * - B.5: item type picker + first three composers (drill/key/scale).
 * - B.6: metronome/leadsheet/custom/rest composers.
 * - B.7: drag-reorder via dnd-kit.
 * - B.9: Launch action (currently disabled).
 *
 * ## Live-save vs buffered-draft
 *
 * Name and notes live-save via updateRoutineMeta on blur — matches
 * the RoutineCard's inline-edit pattern. If we later need a
 * buffered-draft model for item mutations (add/remove/reorder), we
 * can layer that on top; scalars don't need it.
 */

type RoutineBuilderProps = {
  routine: Routine;
  /** Called when the user clicks Done / back — parent clears the URL param. */
  onClose: () => void;
};

export function RoutineBuilder({ routine, onClose }: RoutineBuilderProps) {
  const lib = useRoutinesLibrary();
  const [pickerOpen, setPickerOpen] = useState(false);

  const totalSec = totalEstimatedSeconds(routine);
  const timeBreakdown = useMemo(
    () => categoryTimeBreakdown(routine),
    [routine],
  );

  const handleAddItem = (item: RoutineItem) => {
    lib.updateRoutineItems(routine.id, [...routine.items, item]);
  };

  // Phase 107 (B.7) — drag-reorder support via dnd-kit. Same sensor
  // config as the Bass Arpeggios chord-pool reorder (4px activation
  // distance keeps micro-drags from stealing click intent + full
  // keyboard support via sortableKeyboardCoordinates).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = routine.items.findIndex((i) => i.id === active.id);
    const toIndex = routine.items.findIndex((i) => i.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...routine.items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    lib.updateRoutineItems(routine.id, next);
  };

  // Stable memoized id array for SortableContext (dnd-kit re-runs some
  // internal setup when the ref changes; memoizing keeps drop
  // animation crisp).
  const sortableIds = useMemo(
    () => routine.items.map((i) => i.id),
    [routine.items],
  );

  return (
    <section className="flex flex-col gap-6">
      {/* Top bar — back link + Done button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All routines
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Done
        </button>
      </div>

      {/* Header — routine name (large, editable) + notes */}
      <header className="flex flex-col gap-3 rounded-lg border-2 border-primary/40 bg-primary/5 px-5 py-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
            Editing routine
          </span>
          <input
            key={`${routine.id}-name`}
            type="text"
            defaultValue={routine.name}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== routine.name) {
                lib.updateRoutineMeta(routine.id, { name: next });
              } else if (!next) {
                e.target.value = routine.name;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Routine name"
            className="w-full min-w-0 rounded-md border border-border/50 bg-background/60 px-3 py-2 text-2xl font-semibold text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <textarea
          key={`${routine.id}-notes`}
          defaultValue={routine.notes ?? ""}
          onBlur={(e) => {
            const next = e.target.value.trim().slice(0, 300);
            if (next !== (routine.notes ?? "")) {
              lib.updateRoutineMeta(routine.id, { notes: next });
            }
          }}
          placeholder="Add notes (optional) — describe the routine's purpose, focus, or method."
          rows={2}
          className="w-full resize-none rounded-md border border-border/50 bg-background/60 px-3 py-2 text-sm text-muted-foreground focus:border-primary focus:outline-none focus:text-foreground"
        />
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          Name and notes save automatically when you click outside the
          field. Add items below to build the routine sequence.
        </p>
      </header>

      {/* Summary bar — item count + total time + category time
          breakdown (Phase 108). Stacked bar + legend gives users an
          at-a-glance sense of "is this routine balanced?" */}
      <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/40 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
          <span>
            {routine.items.length}{" "}
            {routine.items.length === 1 ? "item" : "items"}
          </span>
          {totalSec > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>{formatDuration(totalSec)} total</span>
            </>
          )}
        </div>
        {routine.items.length > 0 && (
          <CategoryTimeBar slices={timeBreakdown} />
        )}
      </div>

      {/* Items section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Items
          </h3>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add item
          </button>
        </div>

        {routine.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-background/20 px-6 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ListChecks className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex max-w-sm flex-col gap-1">
              <p className="text-sm text-foreground">No items yet.</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Click <span className="font-medium text-foreground">+ Add item</span>{" "}
                above to pick a saved drill, add a metronome, insert a
                rest, or write your own custom activity.
              </p>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortableIds}
              strategy={verticalListSortingStrategy}
            >
              <ol className="flex flex-col gap-2">
                {routine.items.map((item, idx) => (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    index={idx}
                    onDelete={() =>
                      lib.updateRoutineItems(
                        routine.id,
                        routine.items.filter((i) => i.id !== item.id),
                      )
                    }
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {/* Item type picker + composer modal — Slice B.5 (Phase 105). */}
      <ItemPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSubmit={handleAddItem}
      />
    </section>
  );
}

/**
 * One row in the items list — Phase 107 makes it draggable.
 *
 * Position number renders alongside a drag handle on the left. Actual
 * position is derived from array order (not the number displayed), so
 * dnd-kit's reorder just triggers a store update and the numbers
 * re-render naturally.
 */
function SortableItemRow({
  item,
  index,
  onDelete,
}: {
  item: RoutineItem;
  index: number;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2">
        {/* Drag handle. Only this button carries the listeners so
            clicking the row body doesn't accidentally start a drag. */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder item ${index + 1}`}
          title="Drag to reorder"
          className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-background/60 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground/70">
          {index + 1}.
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {item.label || itemFallbackLabel(item)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {ROUTINE_ITEM_TYPE_LABELS[item.type]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CategoryChip categoryId={item.category} size="sm" />
            {item.methodologyId && (
              <span
                className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground"
                title={getMethodology(item.methodologyId)?.summary ?? undefined}
              >
                {getMethodology(item.methodologyId)?.name ?? item.methodologyId}
              </span>
            )}
            {item.estimatedSeconds > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground/70">
                {formatDuration(item.estimatedSeconds)}
              </span>
            )}
          </div>
        </div>
        {confirmingDelete ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete();
                setConfirmingDelete(false);
              }}
              className="rounded-md bg-destructive px-2 py-1 text-[10px] font-medium text-destructive-foreground transition-opacity hover:opacity-90"
            >
              Confirm
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete item ${item.label}`}
            title="Delete item"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Fallback label for items whose author didn't provide one — surfaces
 * a sensible default so no row renders blank. E.g. a drill item
 * defaults to "[Bass Arpeggios drill]" until the user names it.
 */
function itemFallbackLabel(item: RoutineItem): string {
  const typeLabel = ROUTINE_ITEM_TYPE_LABELS[item.type];
  return `Untitled ${typeLabel.toLowerCase()}`;
}

/** Match RoutineCard's duration formatter exactly. */
function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins - hrs * 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

// Kept for potential future use in item-type filtering. Not currently
// referenced but exported so B.5's picker can consult it.
export function itemTypeToModuleLabel(type: RoutineItemType): string {
  switch (type) {
    case "drill":
      return PRACTICE_MODULE_LABELS.arpeggios;
    case "key-drill":
      return PRACTICE_MODULE_LABELS["key-sequencer"];
    case "scale-drill":
      return PRACTICE_MODULE_LABELS["scale-driller"];
    case "metronome":
      return PRACTICE_MODULE_LABELS.metronome;
    case "leadsheet":
      return PRACTICE_MODULE_LABELS["lsb-playback"];
    case "song":
      return "Song";
    case "ear-training":
      return "Ear Training";
    case "custom":
      return "Custom";
    case "rest":
      return "Rest";
  }
}
