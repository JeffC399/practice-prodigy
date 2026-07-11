import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  newKeyDrillId,
  type KeyDrill,
  type KeySequencerConfig,
} from "./types";

/**
 * User's saved Key Sequencer drills — parallels useDrillsLibrary
 * (Bass Arpeggios). Cards appear on the /practice/keys setup page.
 */

type KeyDrillsLibraryStore = {
  drills: KeyDrill[];
  saveDrill: (
    name: string,
    config: KeySequencerConfig,
    notes?: string,
  ) => string;
  updateDrillConfig: (id: string, config: KeySequencerConfig) => void;
  updateDrillMeta: (
    id: string,
    meta: { name?: string; notes?: string },
  ) => void;
  renameDrill: (id: string, name: string) => void;
  /** Stamp lastLoadedAt — call when the user launches a drill. */
  markDrillLoaded: (id: string) => void;
  /** Duplicate an existing drill; returns the new id or null on miss. */
  duplicateDrill: (id: string) => string | null;
  deleteDrill: (id: string) => void;
};

export const useKeyDrillsLibrary = create<KeyDrillsLibraryStore>()(
  persist(
    (set, get) => ({
      drills: [],
      saveDrill: (name, config, notes) => {
        const id = newKeyDrillId();
        const now = Date.now();
        set((state) => ({
          drills: [
            ...state.drills,
            {
              id,
              name: name.trim() || "Untitled key drill",
              notes: notes?.trim() || undefined,
              config,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return id;
      },
      updateDrillConfig: (id, config) =>
        set((state) => ({
          drills: state.drills.map((d) =>
            d.id === id ? { ...d, config, updatedAt: Date.now() } : d,
          ),
        })),
      updateDrillMeta: (id, meta) =>
        set((state) => ({
          drills: state.drills.map((d) => {
            if (d.id !== id) return d;
            const next: KeyDrill = { ...d, updatedAt: Date.now() };
            if (meta.name !== undefined) {
              next.name = meta.name.trim() || d.name;
            }
            if (meta.notes !== undefined) {
              const trimmed = meta.notes.trim();
              next.notes = trimmed.length > 0 ? trimmed : undefined;
            }
            return next;
          }),
        })),
      renameDrill: (id, name) =>
        set((state) => ({
          drills: state.drills.map((d) =>
            d.id === id
              ? { ...d, name: name.trim() || d.name, updatedAt: Date.now() }
              : d,
          ),
        })),
      markDrillLoaded: (id) =>
        set((state) => ({
          drills: state.drills.map((d) =>
            d.id === id ? { ...d, lastLoadedAt: Date.now() } : d,
          ),
        })),
      duplicateDrill: (id) => {
        const src = get().drills.find((d) => d.id === id);
        if (!src) return null;
        const newId = newKeyDrillId();
        const now = Date.now();
        const clonedConfig: KeySequencerConfig =
          typeof structuredClone === "function"
            ? structuredClone(src.config)
            : JSON.parse(JSON.stringify(src.config));
        set((state) => ({
          drills: [
            ...state.drills,
            {
              id: newId,
              name: `${src.name} (copy)`,
              notes: src.notes,
              config: clonedConfig,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return newId;
      },
      deleteDrill: (id) =>
        set((state) => ({
          drills: state.drills.filter((d) => d.id !== id),
        })),
    }),
    {
      name: "practice-prodigy:key-drills-library:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
