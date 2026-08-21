import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CategoryId } from "./categories";
import {
  newRoutineId,
  type MethodologyId,
  type Routine,
  type RoutineItem,
  type RoutineSource,
} from "./routine-types";

/**
 * useRoutinesLibrary — Slice B.1 (Phase 101).
 *
 * The user's saved My Practice routines. Persisted locally via Zustand
 * persist middleware; synced to Supabase via the standard SyncAdapter
 * pattern (src/lib/sync/adapters/routines.ts). Every mutation bumps
 * `updatedAt` so cloud LWW works correctly.
 *
 * ## API surface
 *
 * B.1 ships the CRUD primitives every downstream slice needs:
 *
 *   - saveRoutine(name, items, ...meta)  → creates a fresh routine
 *   - updateRoutineMeta(id, patch)       → name, notes, methodology
 *   - updateRoutineItems(id, items)      → bulk items update
 *                                          (drag-reorder, add, remove)
 *   - markRoutineRun(id)                 → stamp lastRunAt after
 *                                          the executor completes / user
 *                                          launches a run
 *   - duplicateRoutine(id)               → clone; name gets "(copy)"
 *   - deleteRoutine(id)                  → hard delete
 *
 * Item-level mutations (add / remove / reorder) go through
 * updateRoutineItems with a fresh items array. That keeps the store's
 * public surface small and mirrors how the drills-library store handles
 * per-drill config mutation.
 *
 * ## Cloud sync
 *
 * Registered in SyncBoot alongside the other 7 adapters. Push happens
 * automatically 500ms after any mutation; pull happens on sign-in.
 * Per-item entity updatedAt is the LWW anchor (already maintained by
 * every setter here).
 */

type RoutinesLibraryStore = {
  /** All saved routines. Order is insertion; UI can re-sort as needed. */
  routines: Routine[];

  /**
   * Create a fresh routine. Returns the new id so callers can navigate
   * to it or open it in the builder immediately. `items` may be empty.
   */
  saveRoutine: (input: {
    name: string;
    items?: RoutineItem[];
    notes?: string;
    methodologyId?: MethodologyId;
    source?: RoutineSource;
    sourceRef?: string;
  }) => string;

  /**
   * Partial-update the routine's metadata. Any subset of the four
   * fields; passing `undefined` for notes / methodologyId clears them.
   * Empty / whitespace-only name is silently snapped back to the
   * existing name (no accidental blanking).
   */
  updateRoutineMeta: (
    id: string,
    patch: {
      name?: string;
      notes?: string | undefined;
      methodologyId?: MethodologyId | undefined;
    },
  ) => void;

  /**
   * Replace the items array wholesale. This is how add / remove /
   * reorder / edit-item all commit — callers build the next items[]
   * and pass it in. Mirrors how drills-library handles config updates.
   */
  updateRoutineItems: (id: string, items: RoutineItem[]) => void;

  /**
   * Stamp lastRunAt = now. Called by the routine executor on launch
   * so the "Recently used" sort surfaces recently-run routines to
   * the top of the routines tab.
   */
  markRoutineRun: (id: string) => void;

  /**
   * Duplicate an existing routine. Returns the new id or null if the
   * source id doesn't exist. Name gets " (copy)" appended. items are
   * deep-cloned so future edits to the copy don't touch the original.
   * lastRunAt is intentionally cleared so the copy sorts to "recently
   * modified" not "recently used."
   */
  duplicateRoutine: (id: string) => string | null;

  /** Hard-delete. Also removes from cloud on next push (via LWW cascade). */
  deleteRoutine: (id: string) => void;
};

export const useRoutinesLibrary = create<RoutinesLibraryStore>()(
  persist(
    (set, get) => ({
      routines: [],

      saveRoutine: ({
        name,
        items = [],
        notes,
        methodologyId,
        source = "manual",
        sourceRef,
      }) => {
        const id = newRoutineId();
        const now = Date.now();
        const routine: Routine = {
          id,
          name: name.trim() || "Untitled routine",
          notes: notes?.trim() || undefined,
          items,
          createdAt: now,
          updatedAt: now,
          methodologyId,
          source,
          sourceRef,
        };
        set((s) => ({ routines: [...s.routines, routine] }));
        return id;
      },

      updateRoutineMeta: (id, patch) =>
        set((state) => ({
          routines: state.routines.map((r) => {
            if (r.id !== id) return r;
            const next: Routine = { ...r, updatedAt: Date.now() };
            if (patch.name !== undefined) {
              const trimmed = patch.name.trim();
              if (trimmed) next.name = trimmed;
              // Empty / whitespace-only: silently snap back to existing name.
            }
            if (patch.notes !== undefined) {
              const trimmed = patch.notes?.trim() ?? "";
              next.notes = trimmed.length > 0 ? trimmed : undefined;
            }
            if (patch.methodologyId !== undefined) {
              // Empty string treated as clear.
              next.methodologyId = patch.methodologyId || undefined;
            }
            return next;
          }),
        })),

      updateRoutineItems: (id, items) =>
        set((state) => ({
          routines: state.routines.map((r) =>
            r.id === id
              ? { ...r, items, updatedAt: Date.now() }
              : r,
          ),
        })),

      markRoutineRun: (id) =>
        set((state) => ({
          routines: state.routines.map((r) =>
            r.id === id
              ? { ...r, lastRunAt: Date.now(), updatedAt: Date.now() }
              : r,
          ),
        })),

      duplicateRoutine: (id) => {
        const src = get().routines.find((r) => r.id === id);
        if (!src) return null;
        const newId = newRoutineId();
        const now = Date.now();
        // Deep-clone items so future edits to the copy don't mutate
        // the original's item objects. Routines are JSON-serializable
        // data — structuredClone is safe here.
        const clonedItems: RoutineItem[] =
          typeof structuredClone === "function"
            ? structuredClone(src.items)
            : JSON.parse(JSON.stringify(src.items));
        set((state) => ({
          routines: [
            ...state.routines,
            {
              ...src,
              id: newId,
              name: `${src.name} (copy)`,
              items: clonedItems,
              createdAt: now,
              updatedAt: now,
              // Reset lastRunAt so the copy doesn't pretend to have
              // been run.
              lastRunAt: undefined,
            },
          ],
        }));
        return newId;
      },

      deleteRoutine: (id) =>
        set((state) => ({
          routines: state.routines.filter((r) => r.id !== id),
        })),
    }),
    {
      name: "practice-prodigy:routines-library:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/**
 * Read helper — resolve a routine by id. Slice B.2+ UI code calls
 * this frequently for the current-routine-context lookups in the
 * builder / executor. Sync-safe (reads from Zustand's getState()).
 */
export function getRoutineById(id: string): Routine | undefined {
  return useRoutinesLibrary.getState().routines.find((r) => r.id === id);
}

/**
 * Read helper — aggregate every category touched by a routine's items,
 * deduped. Used by the Routine Overview screen (Slice B.14) for the
 * "category mix" chip. Placed here rather than in a UI component so
 * Reports (Slice D) can reuse the same aggregation.
 */
export function routineCategories(routine: Routine): CategoryId[] {
  const seen = new Set<CategoryId>();
  const out: CategoryId[] = [];
  for (const item of routine.items) {
    if (!seen.has(item.category)) {
      seen.add(item.category);
      out.push(item.category);
    }
  }
  return out;
}

/**
 * Read helper — Slice B.8 (Phase 108). Breaks a routine's total
 * estimated time down by category. Returns an array of
 * `{ categoryId, seconds, pct }` sorted by seconds desc so the
 * biggest slice always sits first in the legend + the stacked bar.
 *
 * Items with `estimatedSeconds === 0` are still included (aggregated
 * under their category) with 0 seconds; the bar/legend renderer skips
 * zero-time entries. This keeps the aggregation lossless for callers
 * that want the full category list.
 *
 * Reports (Slice D) will reuse this aggregation over a broader
 * date range of SessionItems, so keep the shape symmetric.
 */
export type CategoryTimeSlice = {
  categoryId: CategoryId;
  seconds: number;
  /** Fraction of the routine's total time, 0..1. NaN-safe when total=0. */
  pct: number;
};

export function categoryTimeBreakdown(
  routine: Routine,
): CategoryTimeSlice[] {
  const totals = new Map<CategoryId, number>();
  for (const item of routine.items) {
    const prev = totals.get(item.category) ?? 0;
    totals.set(item.category, prev + Math.max(0, item.estimatedSeconds));
  }
  const total = Array.from(totals.values()).reduce((s, n) => s + n, 0);
  const slices: CategoryTimeSlice[] = Array.from(totals.entries()).map(
    ([categoryId, seconds]) => ({
      categoryId,
      seconds,
      pct: total > 0 ? seconds / total : 0,
    }),
  );
  slices.sort((a, b) => b.seconds - a.seconds);
  return slices;
}
