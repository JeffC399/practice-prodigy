import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  makeDefaultSheet,
  newSheetId,
  type Sheet,
} from "@/lib/sheets/types";

/**
 * Lead-sheets library — Phase 24a.
 *
 * Persists user-authored lead sheets. CRUD shape mirrors the
 * drills-library + custom-patterns-library stores so the UX is
 * consistent across modules: a top-level library of "your stuff"
 * with create / edit / delete / open semantics.
 *
 * Phase 26 — Undo / Redo: every user-driven `updateSheet` call pushes
 * the PRIOR sheet snapshot onto a per-sheet undo stack (bounded at
 * UNDO_STACK_MAX entries). `undo(id)` pops the top of the undo stack
 * and swaps in that snapshot, pushing the current state onto the
 * redo stack. `redo(id)` is the symmetric operation. Stacks are
 * EPHEMERAL — not persisted across page loads (Zustand persist
 * `partialize` excludes them).
 */
const UNDO_STACK_MAX = 100;

type SheetsLibraryStore = {
  sheets: Sheet[];
  /** Phase 26 — per-sheet undo stack (most recent prior state at the end). */
  undoStacks: Record<string, Sheet[]>;
  /** Phase 26 — per-sheet redo stack. */
  redoStacks: Record<string, Sheet[]>;
  getById: (id: string) => Sheet | undefined;
  createSheet: () => string;
  /**
   * Phase 33 — clone a Sheet imported from a share URL / JSON file
   * into the local library. Generates a fresh id + timestamps so the
   * import doesn't collide with anything already saved.
   */
  importSheet: (incoming: Sheet) => string;
  /**
   * Apply an update to a sheet. By default, pushes the PRIOR snapshot
   * onto the undo stack (and clears the redo stack — new branch).
   * Pass `{ trackUndo: false }` for non-user-driven writes that
   * shouldn't pollute the history (e.g. lastOpenedAt stamping).
   */
  updateSheet: (
    id: string,
    update: Partial<Sheet>,
    options?: { trackUndo?: boolean },
  ) => void;
  deleteSheet: (id: string) => void;
  /** Stamp lastOpenedAt — call when the user opens a sheet for view/edit. */
  markSheetOpened: (id: string) => void;
  /** Phase 26 — pop undo stack and apply. No-op if empty. */
  undo: (id: string) => void;
  /** Phase 26 — pop redo stack and apply. No-op if empty. */
  redo: (id: string) => void;
  canUndo: (id: string) => boolean;
  canRedo: (id: string) => boolean;
};

export const useSheetsLibrary = create<SheetsLibraryStore>()(
  persist(
    (set, get) => ({
      sheets: [],
      undoStacks: {},
      redoStacks: {},
      getById: (id) => get().sheets.find((s) => s.id === id),
      createSheet: () => {
        const id = newSheetId();
        const now = Date.now();
        set((state) => ({
          sheets: [
            ...state.sheets,
            {
              id,
              ...makeDefaultSheet(),
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return id;
      },
      importSheet: (incoming) => {
        const id = newSheetId();
        const now = Date.now();
        // Strip the incoming id/timestamps; keep everything else.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
          id: _oldId,
          createdAt: _oldCreated,
          updatedAt: _oldUpdated,
          lastOpenedAt: _oldOpened,
          ...rest
        } = incoming;
        void _oldId;
        void _oldCreated;
        void _oldUpdated;
        void _oldOpened;
        set((state) => ({
          sheets: [
            ...state.sheets,
            {
              id,
              ...rest,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return id;
      },
      updateSheet: (id, update, options) => {
        const trackUndo = options?.trackUndo !== false;
        set((state) => {
          const current = state.sheets.find((s) => s.id === id);
          if (!current) return state;
          const nextSheet: Sheet = {
            ...current,
            ...update,
            updatedAt: Date.now(),
          };
          // Bail if nothing actually changed (excluding updatedAt).
          // Cheap shallow check on touched keys.
          const touched = Object.keys(update) as Array<keyof Sheet>;
          const anyChanged = touched.some(
            (k) => current[k] !== nextSheet[k],
          );
          if (!anyChanged) return state;
          let undoStacks = state.undoStacks;
          let redoStacks = state.redoStacks;
          if (trackUndo) {
            const stack = state.undoStacks[id] ?? [];
            const nextStack = [...stack, current].slice(-UNDO_STACK_MAX);
            undoStacks = { ...state.undoStacks, [id]: nextStack };
            // New branch — redo stack is invalidated.
            if (state.redoStacks[id]?.length) {
              redoStacks = { ...state.redoStacks, [id]: [] };
            }
          }
          return {
            ...state,
            sheets: state.sheets.map((s) =>
              s.id === id ? nextSheet : s,
            ),
            undoStacks,
            redoStacks,
          };
        });
      },
      deleteSheet: (id) =>
        set((state) => {
          const { [id]: _u, ...restUndo } = state.undoStacks;
          const { [id]: _r, ...restRedo } = state.redoStacks;
          void _u;
          void _r;
          return {
            ...state,
            sheets: state.sheets.filter((s) => s.id !== id),
            undoStacks: restUndo,
            redoStacks: restRedo,
          };
        }),
      markSheetOpened: (id) =>
        set((state) => ({
          sheets: state.sheets.map((s) =>
            s.id === id ? { ...s, lastOpenedAt: Date.now() } : s,
          ),
        })),
      undo: (id) =>
        set((state) => {
          const stack = state.undoStacks[id] ?? [];
          if (stack.length === 0) return state;
          const current = state.sheets.find((s) => s.id === id);
          if (!current) return state;
          const prior = stack[stack.length - 1];
          const newUndo = stack.slice(0, -1);
          const redo = state.redoStacks[id] ?? [];
          const newRedo = [...redo, current].slice(-UNDO_STACK_MAX);
          return {
            ...state,
            sheets: state.sheets.map((s) =>
              s.id === id ? prior : s,
            ),
            undoStacks: { ...state.undoStacks, [id]: newUndo },
            redoStacks: { ...state.redoStacks, [id]: newRedo },
          };
        }),
      redo: (id) =>
        set((state) => {
          const stack = state.redoStacks[id] ?? [];
          if (stack.length === 0) return state;
          const current = state.sheets.find((s) => s.id === id);
          if (!current) return state;
          const future = stack[stack.length - 1];
          const newRedo = stack.slice(0, -1);
          const undo = state.undoStacks[id] ?? [];
          const newUndo = [...undo, current].slice(-UNDO_STACK_MAX);
          return {
            ...state,
            sheets: state.sheets.map((s) =>
              s.id === id ? future : s,
            ),
            undoStacks: { ...state.undoStacks, [id]: newUndo },
            redoStacks: { ...state.redoStacks, [id]: newRedo },
          };
        }),
      canUndo: (id) => (get().undoStacks[id]?.length ?? 0) > 0,
      canRedo: (id) => (get().redoStacks[id]?.length ?? 0) > 0,
    }),
    {
      name: "practice-prodigy:sheets-library:v1",
      storage: createJSONStorage(() => localStorage),
      version: 5,
      // Phase 26: undo/redo stacks are session-ephemeral; persist only
      // the sheets array (everything else can be rebuilt at runtime).
      partialize: (state) => ({ sheets: state.sheets }),
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState;
        }
        const next = { ...(persistedState as Record<string, unknown>) };
        // v1 → v2: Phase 24b added optional `melody` per measure.
        // Backfill empty arrays so the renderer doesn't get undefined
        // when iterating existing measures.
        if (version <= 1) {
          const sheets = Array.isArray(next.sheets)
            ? (next.sheets as Array<Record<string, unknown>>)
            : [];
          next.sheets = sheets.map((s) => {
            const measures = Array.isArray(s.measures)
              ? (s.measures as Array<Record<string, unknown>>)
              : [];
            return {
              ...s,
              measures: measures.map((m) => ({
                ...m,
                melody: Array.isArray(m.melody) ? m.melody : [],
              })),
            };
          });
        }
        // v2 → v3: Phase 24b.2 added optional `tieToNext` + `tupletGroup`
        // on MelodyNote. Both are optional, so existing notes default
        // to undefined / false — no data migration needed. Bump the
        // version for cleanliness.
        if (version <= 2) {
          void next; // explicit no-op
        }
        // v3 → v4: Phase 24c added optional `lyric` on the note variant
        // of MelodyNote. Optional + additive — no data migration needed.
        if (version <= 3) {
          void next; // explicit no-op
        }
        // v4 → v5: Phase 25.2 — chord model shifted from flat Chord[]
        // to ChordBeat[] (per-beat positioning). Convert existing
        // measure.chords entries to ChordBeat entries, assigning beat
        // positions per the previous implicit convention: 1st chord on
        // the downbeat (beat 1), 2nd chord at the half-bar (beat
        // floor(beatsPerMeasure/2) + 1 ≈ beat 3 in 4/4).
        if (version <= 4) {
          const sheets = Array.isArray(next.sheets)
            ? (next.sheets as Array<Record<string, unknown>>)
            : [];
          next.sheets = sheets.map((s) => {
            const ts = s.timeSignature as
              | { beatsPerMeasure?: number }
              | undefined;
            const beatsPerMeasure = ts?.beatsPerMeasure ?? 4;
            const halfBarBeat = Math.floor(beatsPerMeasure / 2) + 1;
            const measures = Array.isArray(s.measures)
              ? (s.measures as Array<Record<string, unknown>>)
              : [];
            return {
              ...s,
              measures: measures.map((m) => {
                const oldChords = Array.isArray(m.chords)
                  ? (m.chords as Array<Record<string, unknown>>)
                  : [];
                const newChords = oldChords.map((c, idx) => ({
                  chord: c,
                  beat: idx === 0 ? 1 : halfBarBeat,
                }));
                return { ...m, chords: newChords };
              }),
            };
          });
        }
        return next;
      },
    },
  ),
);
