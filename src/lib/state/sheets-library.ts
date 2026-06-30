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
 */
type SheetsLibraryStore = {
  sheets: Sheet[];
  getById: (id: string) => Sheet | undefined;
  createSheet: () => string;
  updateSheet: (id: string, update: Partial<Sheet>) => void;
  deleteSheet: (id: string) => void;
  /** Stamp lastOpenedAt — call when the user opens a sheet for view/edit. */
  markSheetOpened: (id: string) => void;
};

export const useSheetsLibrary = create<SheetsLibraryStore>()(
  persist(
    (set, get) => ({
      sheets: [],
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
      updateSheet: (id, update) =>
        set((state) => ({
          sheets: state.sheets.map((s) =>
            s.id === id ? { ...s, ...update, updatedAt: Date.now() } : s,
          ),
        })),
      deleteSheet: (id) =>
        set((state) => ({
          sheets: state.sheets.filter((s) => s.id !== id),
        })),
      markSheetOpened: (id) =>
        set((state) => ({
          sheets: state.sheets.map((s) =>
            s.id === id ? { ...s, lastOpenedAt: Date.now() } : s,
          ),
        })),
    }),
    {
      name: "practice-prodigy:sheets-library:v1",
      storage: createJSONStorage(() => localStorage),
      version: 2,
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
        return next;
      },
    },
  ),
);
