import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CategoryId } from "@/lib/practice/categories";
import {
  newSessionId,
  sessionItemKey,
  type PracticeModule,
  type PracticeSession,
  type SessionItem,
} from "@/lib/practice/types";
import { MODULE_DEFAULT_CATEGORY } from "./category-defaults";

/**
 * useSessionTracker — Slice A.6 (Phase 86).
 *
 * The single source of truth for "what practice happened when." Every
 * drilling / practicing module heartbeats into this store; the store
 * accumulates SessionItems into the current PracticeSession, and
 * auto-closes the session after 5 min of inactivity.
 *
 * ## Contract for module wire-ups (A.7–A.8)
 *
 * Modules call `reportActivity({ module, itemId?, category? })` on
 * every "practice tick" — start of drill playback, metronome tick,
 * sheet playback beat, etc. Fire liberally: the store dedupes and
 * rate-limits internally, so calling this on every audio tick is
 * cheap. NOT called from setup / library / navigation surfaces —
 * only from actual playing surfaces.
 *
 * ## Session lifecycle
 *
 * 1. First `reportActivity` call with no active session → start a
 *    new PracticeSession, create the first SessionItem.
 * 2. Subsequent `reportActivity` calls extend the current item (or
 *    add a new item if module/itemId changed) and bump lastActivityAt.
 * 3. Every ~30s a background ticker checks: if `now - lastActivityAt`
 *    on the current session exceeds INACTIVITY_TIMEOUT_MS, auto-end
 *    the session. Items keep their accumulated durationSec.
 * 4. User can explicitly call `endSession()` from a "Stop session"
 *    button (future UI, Slice D+).
 *
 * ## Persistence
 *
 * Zustand persist middleware writes to localStorage. On hydrate:
 *   - If `current` exists and its lastActivityAt is >5 min old,
 *     end it retroactively at that timestamp (user closed tab
 *     without properly ending; count the time they DID practice).
 *   - If `current` exists and is still within the window, keep it
 *     live — activity will pick up where it left off.
 *
 * `history` holds the last MAX_HISTORY sessions locally. Slice A.12
 * adds cloud sync via the standard SyncAdapter pattern; the local
 * cap is a bound on offline-only memory, not a data retention policy.
 *
 * ## What A.6 does NOT do
 *
 * - No cloud sync (deferred to A.12).
 * - No module wire-ups (A.7 wires Arpeggios; A.8 wires the rest).
 * - No category overrides per item (A.9 adds the per-item UI).
 * - No Reports UI (Slice D consumes the accumulated history).
 */

/** Wall-clock ms after which a session auto-ends. */
export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 min per ROUTINE-DESIGN.md §5.1

/** Background ticker cadence — checks for inactivity every N ms. */
export const INACTIVITY_CHECK_INTERVAL_MS = 30 * 1000; // 30 sec

/** Local cap on retained history entries. Cloud (A.12) is the real store. */
const MAX_HISTORY = 100;

/**
 * Minimum ms between rate-limit-eligible activity updates for the
 * SAME item. Prevents metronome tick spam (potentially 4+ Hz) from
 * writing to Zustand thousands of times per minute. Higher-fidelity
 * events still count toward duration on the next tick past the gap.
 */
const ACTIVITY_RATE_LIMIT_MS = 5 * 1000; // 5 sec — coarse enough for reports

type ReportActivityInput = {
  module: PracticeModule;
  /** Saved tool id (drill, sheet, song, routine-item id). Omit for ad-hoc. */
  itemId?: string;
  /**
   * Explicit category override. Defaults to MODULE_DEFAULT_CATEGORY
   * for the module. Slice A.9 wire-up will pass the per-item override
   * from the saved tool.
   */
  category?: CategoryId;
  /**
   * Routine-item id when this activity is part of a My Practice
   * routine run (Slice B). Ties SessionItems back to the routine
   * template for retrospective reports.
   */
  routineItemId?: string;
  /**
   * Routine-execution id shared across all items of one routine run
   * (Slice B). Stored on the parent PracticeSession, not per-item.
   */
  routineExecutionId?: string;
};

type SessionTrackerStore = {
  /** The currently-live session, or null if no practice is happening. */
  current: PracticeSession | null;
  /** Most-recent ended sessions, newest first, capped at MAX_HISTORY. */
  history: PracticeSession[];

  /** Called by every module heartbeat. See §Contract above. */
  reportActivity: (input: ReportActivityInput) => void;

  /**
   * Manually end the current session (user tap on a future
   * "Stop session" button, or in-app "Sign out" cleanup).
   * No-op if there's no live session.
   */
  endSession: () => void;

  /**
   * Called by the boot ticker (~every 30s). Ends the current session
   * if it's been inactive past the timeout. Exposed for tests; UI
   * code should not call this directly.
   */
  checkInactivity: (now?: number) => void;

  /**
   * Test-only escape hatch — clear all state without persisting a
   * fake session end. Do not use from UI code.
   */
  _reset: () => void;
};

function moveCurrentToHistory(
  current: PracticeSession,
  history: PracticeSession[],
  endedAt: number,
): PracticeSession[] {
  const finalized: PracticeSession = { ...current, endedAt };
  const nextHistory = [finalized, ...history];
  return nextHistory.length > MAX_HISTORY
    ? nextHistory.slice(0, MAX_HISTORY)
    : nextHistory;
}

function createFreshItem(
  now: number,
  input: ReportActivityInput,
): SessionItem {
  return {
    id: sessionItemKey(input.module, input.itemId),
    module: input.module,
    itemId: input.itemId,
    category: input.category ?? MODULE_DEFAULT_CATEGORY[input.module],
    startedAt: now,
    lastActivityAt: now,
    // Zero-length until the second report bumps duration. Prevents
    // "just landed on a practice surface" from stealing 30s of credit.
    durationSec: 0,
    routineItemId: input.routineItemId,
  };
}

function extendItem(
  item: SessionItem,
  now: number,
  input: ReportActivityInput,
): SessionItem {
  const elapsedSec = Math.max(0, Math.floor((now - item.lastActivityAt) / 1000));
  // If the gap since the last report exceeds the inactivity timeout,
  // don't count the gap — the user was AFK. Just bump lastActivityAt
  // and let a new item start on the next report if the module changed.
  const active = now - item.lastActivityAt <= INACTIVITY_TIMEOUT_MS;
  return {
    ...item,
    lastActivityAt: now,
    durationSec: active ? item.durationSec + elapsedSec : item.durationSec,
    // Allow category / routineItemId to update on later reports
    // (routine wire-up may pass richer context on some ticks).
    category: input.category ?? item.category,
    routineItemId: input.routineItemId ?? item.routineItemId,
  };
}

export const useSessionTracker = create<SessionTrackerStore>()(
  persist(
    (set, get) => ({
      current: null,
      history: [],

      reportActivity: (input) => {
        const now = Date.now();
        const state = get();
        // Auto-end the current session if it aged out silently between
        // reports (e.g. the user closed the tab for 10 minutes).
        if (
          state.current &&
          now - lastActivityFor(state.current) > INACTIVITY_TIMEOUT_MS
        ) {
          set({
            current: null,
            history: moveCurrentToHistory(
              state.current,
              state.history,
              lastActivityFor(state.current),
            ),
          });
        }

        set((s) => {
          const currentNow = s.current;
          if (!currentNow) {
            // Brand-new session, first item.
            const session: PracticeSession = {
              id: newSessionId(),
              startedAt: now,
              endedAt: null,
              items: [createFreshItem(now, input)],
              routineExecutionId: input.routineExecutionId,
            };
            return { current: session };
          }

          const key = sessionItemKey(input.module, input.itemId);
          const existingIdx = currentNow.items.findIndex((it) => it.id === key);
          if (existingIdx === -1) {
            // New item added to the live session.
            return {
              current: {
                ...currentNow,
                items: [...currentNow.items, createFreshItem(now, input)],
                routineExecutionId:
                  currentNow.routineExecutionId ?? input.routineExecutionId,
              },
            };
          }

          // Rate-limit updates to the same item — most modules will
          // report multiple times per second, but we only need to
          // update Zustand every ACTIVITY_RATE_LIMIT_MS.
          const existing = currentNow.items[existingIdx];
          const sinceLast = now - existing.lastActivityAt;
          if (sinceLast < ACTIVITY_RATE_LIMIT_MS) return s;

          const nextItems = [...currentNow.items];
          nextItems[existingIdx] = extendItem(existing, now, input);
          return {
            current: {
              ...currentNow,
              items: nextItems,
              routineExecutionId:
                currentNow.routineExecutionId ?? input.routineExecutionId,
            },
          };
        });
      },

      endSession: () => {
        const state = get();
        if (!state.current) return;
        const endedAt = Date.now();
        set({
          current: null,
          history: moveCurrentToHistory(state.current, state.history, endedAt),
        });
      },

      checkInactivity: (nowArg) => {
        const now = nowArg ?? Date.now();
        const state = get();
        if (!state.current) return;
        const lastAt = lastActivityFor(state.current);
        if (now - lastAt > INACTIVITY_TIMEOUT_MS) {
          set({
            current: null,
            history: moveCurrentToHistory(state.current, state.history, lastAt),
          });
        }
      },

      _reset: () => set({ current: null, history: [] }),
    }),
    {
      name: "practice-prodigy:session-tracker:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      /**
       * On hydrate, retroactively close any session that was
       * left live in localStorage but is now stale (user closed
       * the tab mid-session).
       */
      onRehydrateStorage: () => (state) => {
        if (!state?.current) return;
        const stale = state.current;
        const lastAt = lastActivityFor(stale);
        if (Date.now() - lastAt > INACTIVITY_TIMEOUT_MS) {
          state.history = moveCurrentToHistory(stale, state.history, lastAt);
          state.current = null;
        }
      },
    },
  ),
);

/**
 * The most-recent lastActivityAt across all items of a session.
 * Used to decide whether a session is idle. If items[] is empty
 * (shouldn't happen for a live session but defensive), falls back
 * to startedAt.
 */
function lastActivityFor(session: PracticeSession): number {
  let latest = session.startedAt;
  for (const it of session.items) {
    if (it.lastActivityAt > latest) latest = it.lastActivityAt;
  }
  return latest;
}
