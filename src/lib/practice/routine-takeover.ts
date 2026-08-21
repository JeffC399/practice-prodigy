"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { useRoutineExecutor } from "./routine-executor";
import { getRoutineById } from "./routines-library";
import type { RoutineItem, RoutineItemType } from "./routine-types";

/**
 * Routine take-over — Slice B.10 (Phase 110).
 *
 * When the routine executor lands on a drilling item (drill / key-
 * drill / scale-drill / metronome / leadsheet), it can't render the
 * drill's UI inside the /my-practice/execute route — the drill's
 * page has all the state + interactions. Instead the executor
 * navigates the browser to the drill's URL with `?routineMode=1`,
 * and the drill page reads this hook to know it's being run inside
 * a routine.
 *
 * ## The URL contract
 *
 *   Regular drill visit:   /practice/session
 *   Routine take-over:     /practice/session?routineMode=1
 *
 * That single flag is enough — the current execution + routine
 * lookup all live in useRoutineExecutor's persisted state, so no
 * IDs need to travel via URL.
 *
 * ## What the hook returns
 *
 *   - isActive: is this page currently in a routine take-over?
 *   - currentItem: the routine item this take-over corresponds to.
 *     May be null if the executor state is out of sync (defensive
 *     — treat as "not active" in that case).
 *   - routine progress numbers for the chip.
 *   - advance(outcome): finish this item and navigate back to the
 *     executor for the next item.
 *   - exit(): abort the whole run, navigate away.
 *
 * ## Type-narrow expectation
 *
 * Pass `expectedType` to guard against a mismatch (e.g. an executor
 * that thinks the current item is a key-drill somehow landing on
 * the Bass Arpeggios session). When set and mismatched, isActive
 * returns false — the drill renders normally and the executor is
 * left alone until the user manually exits.
 */

export type RoutineTakeoverState = {
  /** True when this page IS a routine take-over. */
  isActive: boolean;
  /** The routine item this take-over corresponds to. Null when inactive. */
  currentItem: RoutineItem | null;
  /** Human-readable routine name for the chip. */
  routineName: string;
  /** 1-based index of the current item, for "Item 3 of 7" display. */
  currentIndex: number;
  /** Total items in the routine. */
  totalItems: number;
  /**
   * Mark the current item as completed / skipped and navigate back
   * to the executor route, which will advance to the next item.
   */
  advance: (outcome: "completed" | "skipped") => void;
  /** Abandon the whole run. Navigates back to /my-practice. */
  exit: () => void;
};

/**
 * Hook consumed by every drilling module's page. Pass the RoutineItemType
 * the current page can handle so a mismatched executor state is safely
 * treated as "not a take-over."
 */
export function useRoutineTakeover(
  expectedType?: RoutineItemType,
): RoutineTakeoverState {
  const router = useRouter();
  const searchParams = useSearchParams();
  const execution = useRoutineExecutor((s) => s.execution);
  const advanceExecutor = useRoutineExecutor((s) => s.advance);
  const exitExecutor = useRoutineExecutor((s) => s.exit);

  const flagPresent = searchParams.get("routineMode") === "1";

  // Resolve routine + current item.
  const { routineName, currentItem, currentIndex, totalItems } = useMemo(() => {
    if (!flagPresent || !execution) {
      return {
        routineName: "",
        currentItem: null,
        currentIndex: 0,
        totalItems: 0,
      };
    }
    const routine = getRoutineById(execution.routineId);
    if (!routine) {
      return {
        routineName: "",
        currentItem: null,
        currentIndex: 0,
        totalItems: 0,
      };
    }
    const item = routine.items[execution.currentIndex] ?? null;
    return {
      routineName: routine.name,
      currentItem: item,
      currentIndex: execution.currentIndex + 1,
      totalItems: routine.items.length,
    };
  }, [flagPresent, execution]);

  // A take-over is only "active" when the flag is set AND the executor
  // resolves cleanly AND (if the caller specified expectedType) the
  // current item matches. Defensive against stale URLs / mismatched
  // executor state / manual URL fiddling.
  const isActive =
    flagPresent &&
    !!currentItem &&
    (!expectedType || currentItem.type === expectedType);

  const advance = useCallback(
    (outcome: "completed" | "skipped") => {
      if (!execution) {
        // Fallback: no executor state at all — bail to /my-practice.
        router.push("/my-practice");
        return;
      }
      advanceExecutor({ outcome });
      router.push(`/my-practice/execute/${execution.routineId}`);
    },
    [advanceExecutor, execution, router],
  );

  const exit = useCallback(() => {
    exitExecutor();
    router.push("/my-practice?tab=routines");
  }, [exitExecutor, router]);

  return {
    isActive,
    currentItem,
    routineName,
    currentIndex,
    totalItems,
    advance,
    exit,
  };
}
