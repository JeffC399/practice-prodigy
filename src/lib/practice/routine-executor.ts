import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getRoutineById, useRoutinesLibrary } from "./routines-library";
import { useSongsLibrary } from "./songs-library";
import type { RoutineItem } from "./routine-types";
import type {
  SessionCategoryFeedback,
  SessionCategoryFeedbackRating,
} from "./types";
import type { CategoryId } from "./categories";

/**
 * useRoutineExecutor — Slice B.9 (Phase 109).
 *
 * Central state machine for running a routine end-to-end. Persisted
 * to localStorage so a mid-routine tab crash can resume (B.11 will
 * add the actual "Resume routine?" prompt on next load).
 *
 * ## State shape
 *
 *   execution: null                        → no active run
 *   execution: { status: "running", ... }  → user is on an item, clock running
 *   execution: { status: "paused", ...  }  → user hit pause
 *   execution: { status: "complete", ... } → all items done, end-of-summary UI
 *
 * ## Item advancement
 *
 * The executor tracks `currentIndex` into the routine's items[] +
 * `itemStartedAt` (ms epoch) for the item's own clock. On advance /
 * previous / skip, the current item's actual elapsed time is
 * captured into completedItems[] as `secondsSpent`. Skip and next
 * behave identically for the state machine — the distinction is
 * user-visible only (Skip implies "I didn't finish this one").
 *
 * ## What's in Phase 109 vs deferred
 *
 * Phase 109 ships:
 *   - The executor state machine + persistence.
 *   - Runnable rest / custom / metronome items (they don't need
 *     module take-over — the player renders them directly).
 *   - Placeholder screens for drill / key-drill / scale-drill /
 *     leadsheet items so the user can navigate through the routine
 *     to test the flow. Skip works; the drill doesn't actually
 *     play yet.
 *
 * Phase 110 (B.10) wires the drilling modules for real take-over
 * via a routineMode query param.
 * Phase 111 (B.11) adds the resume prompt + end-of-summary UI.
 */

export type ExecutionStatus =
  | "idle"
  | "running"
  | "paused"
  | "complete";

/**
 * Timing record for one item once the user leaves it (via next /
 * skip / previous). Feeds the end-of-routine summary and, later,
 * the session tracker's per-item attribution.
 */
export type CompletedItemRecord = {
  routineItemId: string;
  /** Actual seconds the user spent on this item (paused time excluded). */
  secondsSpent: number;
  /**
   * "completed" = user hit Next when the item felt done; "skipped"
   * = user hit Skip; "revisited" = user went back to a previous item.
   */
  outcome: "completed" | "skipped" | "revisited";
};

export type RoutineExecution = {
  /** Stable id for this run (feeds the future PracticeSession row). */
  id: string;
  routineId: string;
  status: ExecutionStatus;
  /** ms epoch — set on start. */
  startedAt: number;
  /**
   * ms epoch — set every time the CURRENT item's clock starts (on
   * start, advance, previous, resume). Used with Date.now() to
   * compute elapsedSec.
   */
  itemStartedAt: number;
  /**
   * ms epoch of the last pause event, or null if not currently
   * paused. When resuming, the pause duration is subtracted from
   * itemStartedAt so elapsedSec stays honest.
   */
  pausedAt: number | null;
  /** Zero-based index into routine.items. */
  currentIndex: number;
  /** Per-item timing records, appended when the user leaves an item. */
  completedItems: CompletedItemRecord[];
  /**
   * Slice B.12 (Phase 112) — Per-category vibe-check captured on the
   * end-of-routine summary screen. Optional (user can skip all).
   * Empty array = user hasn't touched the vibe-check yet OR skipped.
   * Feeds AI Coach "recent feel" signals + Reports narratives.
   */
  categoryFeedback: SessionCategoryFeedback[];
};

type RoutineExecutorStore = {
  execution: RoutineExecution | null;

  /**
   * Kick off a fresh run of `routineId`. If a run is already active,
   * it's silently discarded (the ExitConfirm dialog in Phase 111
   * will guard this at the UI layer). Bumps the routine's
   * lastRunAt so it sorts recent-first in the library.
   */
  start: (routineId: string) => void;

  /**
   * Advance to the next item. If there IS no next item, mark the
   * execution complete instead — the UI will render the end-of-
   * routine summary at that point.
   */
  advance: (opts?: { outcome?: "completed" | "skipped" }) => void;

  /** Go back one item. Records the current as "revisited." No-op at index 0. */
  previous: () => void;

  /** Pause the current item's clock. No-op if already paused/idle. */
  pause: () => void;

  /** Resume the current item. Subtracts pause duration from itemStartedAt. */
  resume: () => void;

  /**
   * Explicitly close the run (Exit button). Any in-progress item
   * gets captured into completedItems as "skipped" before clearing.
   * Status flips to null (not "complete") — an aborted run isn't
   * a completed one.
   */
  exit: () => void;

  /**
   * Slice B.12 (Phase 112) — Set the vibe-check rating for one
   * category. Overwrites any prior rating for that category (users
   * can change their mind before hitting Done). No-op when no
   * execution is active.
   */
  setCategoryFeedback: (
    categoryId: CategoryId,
    rating: SessionCategoryFeedbackRating,
  ) => void;

  /**
   * Slice B.12 (Phase 112) — Clear any captured vibe-check ratings.
   * Wired to the "Skip all" button on the end screen so a user who
   * accidentally tapped can back out cleanly.
   */
  clearCategoryFeedback: () => void;

  /** Clear all execution state without recording anything. Test-only. */
  _reset: () => void;
};

function newExecutionId(): string {
  return `exec_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Compute current-item elapsed seconds, honouring paused time. */
export function elapsedSecondsOnCurrentItem(
  execution: RoutineExecution,
  now: number = Date.now(),
): number {
  const anchor =
    execution.pausedAt !== null ? execution.pausedAt : now;
  const ms = anchor - execution.itemStartedAt;
  return Math.max(0, Math.floor(ms / 1000));
}

export const useRoutineExecutor = create<RoutineExecutorStore>()(
  persist(
    (set, get) => ({
      execution: null,

      start: (routineId) => {
        const routine = getRoutineById(routineId);
        if (!routine) return;
        const now = Date.now();
        set({
          execution: {
            id: newExecutionId(),
            routineId,
            status: routine.items.length === 0 ? "complete" : "running",
            startedAt: now,
            itemStartedAt: now,
            pausedAt: null,
            currentIndex: 0,
            completedItems: [],
            categoryFeedback: [],
          },
        });
        // Stamp lastRunAt on the routine so it sorts recent-first.
        useRoutinesLibrary.getState().markRoutineRun(routineId);
      },

      advance: (opts) => {
        const state = get();
        if (!state.execution) return;
        const routine = getRoutineById(state.execution.routineId);
        if (!routine) return;

        // Capture the elapsed seconds for the item we're leaving.
        const currentIndex = state.execution.currentIndex;
        const currentItem = routine.items[currentIndex];
        if (!currentItem) return;
        const secondsSpent = elapsedSecondsOnCurrentItem(state.execution);
        const outcome = opts?.outcome ?? "completed";
        const record: CompletedItemRecord = {
          routineItemId: currentItem.id,
          secondsSpent,
          outcome,
        };

        // Slice C.4 (Phase 131) — Song per-item practice attribution.
        // Only count actually-completed items so a stray Skip on a
        // song doesn't inflate its total.
        attributeSongPractice(currentItem, secondsSpent, outcome);

        const nextIndex = currentIndex + 1;
        const isDone = nextIndex >= routine.items.length;
        const now = Date.now();

        set({
          execution: {
            ...state.execution,
            currentIndex: nextIndex,
            status: isDone ? "complete" : "running",
            itemStartedAt: now,
            pausedAt: null,
            completedItems: [...state.execution.completedItems, record],
          },
        });
      },

      previous: () => {
        const state = get();
        if (!state.execution || state.execution.currentIndex <= 0) return;
        const routine = getRoutineById(state.execution.routineId);
        if (!routine) return;

        const currentIndex = state.execution.currentIndex;
        const currentItem = routine.items[currentIndex];
        const secondsSpent = elapsedSecondsOnCurrentItem(state.execution);
        const record: CompletedItemRecord | null = currentItem
          ? {
              routineItemId: currentItem.id,
              secondsSpent,
              outcome: "revisited",
            }
          : null;

        // Credit song practice even on Previous — the user practiced
        // that time regardless of navigation direction.
        if (currentItem) {
          attributeSongPractice(currentItem, secondsSpent, "revisited");
        }

        const now = Date.now();
        set({
          execution: {
            ...state.execution,
            currentIndex: currentIndex - 1,
            status: "running",
            itemStartedAt: now,
            pausedAt: null,
            completedItems: record
              ? [...state.execution.completedItems, record]
              : state.execution.completedItems,
          },
        });
      },

      pause: () => {
        const state = get();
        if (!state.execution || state.execution.status !== "running") return;
        set({
          execution: {
            ...state.execution,
            status: "paused",
            pausedAt: Date.now(),
          },
        });
      },

      resume: () => {
        const state = get();
        if (!state.execution || state.execution.status !== "paused") return;
        const pauseDuration = Date.now() - (state.execution.pausedAt ?? Date.now());
        set({
          execution: {
            ...state.execution,
            status: "running",
            // Shift itemStartedAt forward by the pause duration so
            // elapsedSecondsOnCurrentItem stays honest.
            itemStartedAt: state.execution.itemStartedAt + pauseDuration,
            pausedAt: null,
          },
        });
      },

      exit: () => {
        const state = get();
        if (!state.execution) return;
        // If the run was still in progress, capture the current item
        // as "skipped" for the summary trail (which becomes visible
        // if the user resumes or reviews history later).
        const routine = getRoutineById(state.execution.routineId);
        const currentItem =
          routine?.items[state.execution.currentIndex] ?? null;
        if (
          currentItem &&
          state.execution.status !== "complete"
        ) {
          const secondsSpent = elapsedSecondsOnCurrentItem(state.execution);
          if (secondsSpent > 0) {
            state.execution.completedItems.push({
              routineItemId: currentItem.id,
              secondsSpent,
              outcome: "skipped",
            });
            // The user actually played that time — credit songs the
            // same as a Skip during advance() does (which is: not at
            // all). Kept symmetric so users aren't surprised by
            // "practice appeared after I exited" vs "after I skipped."
          }
        }
        set({ execution: null });
      },

      setCategoryFeedback: (categoryId, rating) => {
        const state = get();
        if (!state.execution) return;
        // ?? [] guards against executions persisted before B.12
        // when this field didn't exist yet.
        const others = (state.execution.categoryFeedback ?? []).filter(
          (f) => f.categoryId !== categoryId,
        );
        set({
          execution: {
            ...state.execution,
            categoryFeedback: [...others, { categoryId, rating }],
          },
        });
      },

      clearCategoryFeedback: () => {
        const state = get();
        if (!state.execution) return;
        set({
          execution: {
            ...state.execution,
            categoryFeedback: [],
          },
        });
      },

      _reset: () => set({ execution: null }),
    }),
    {
      name: "practice-prodigy:routine-executor:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/**
 * Slice C.4 (Phase 131) — When the item the user just left is a song,
 * bump that song's totalPracticeSeconds + lastPracticedAt via the
 * songs library. Skipped items don't get credit (the user explicitly
 * said "I didn't practice this"). Revisits and completions both do.
 * No-op for non-song items and for zero-seconds runs.
 */
function attributeSongPractice(
  item: RoutineItem,
  secondsSpent: number,
  outcome: "completed" | "skipped" | "revisited",
): void {
  if (item.type !== "song") return;
  if (outcome === "skipped") return;
  if (secondsSpent <= 0) return;
  useSongsLibrary.getState().recordPractice(item.songId, secondsSpent);
}
