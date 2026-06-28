import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PracticeConfig } from "./practice-config";

/**
 * Drills library — the user-saved configurations they can one-click
 * launch from the Quick Start surface at the top of /practice.
 *
 * A "Drill" is the complete PracticeConfig snapshot plus a name. Each
 * save creates a new entry; overwrite semantics (Save vs Save as new)
 * is a follow-up polish item (see IDEAS.md).
 *
 * Persistence: separate store from practice-config so each layer has
 * its own concerns. Persisted to localStorage under its own key.
 */

export type Drill = {
  id: string;
  name: string;
  config: PracticeConfig;
  createdAt: number;
  updatedAt: number;
};

type DrillsLibraryStore = {
  drills: Drill[];
  saveDrill: (name: string, config: PracticeConfig) => string;
  updateDrillConfig: (id: string, config: PracticeConfig) => void;
  renameDrill: (id: string, name: string) => void;
  deleteDrill: (id: string) => void;
};

function newDrillId(): string {
  return `drill_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export const useDrillsLibrary = create<DrillsLibraryStore>()(
  persist(
    (set) => ({
      drills: [],
      saveDrill: (name, config) => {
        const id = newDrillId();
        const now = Date.now();
        set((state) => ({
          drills: [
            ...state.drills,
            {
              id,
              name: name.trim() || "Untitled drill",
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
            d.id === id
              ? { ...d, config, updatedAt: Date.now() }
              : d,
          ),
        })),
      renameDrill: (id, name) =>
        set((state) => ({
          drills: state.drills.map((d) =>
            d.id === id
              ? { ...d, name: name.trim() || d.name, updatedAt: Date.now() }
              : d,
          ),
        })),
      deleteDrill: (id) =>
        set((state) => ({
          drills: state.drills.filter((d) => d.id !== id),
        })),
    }),
    {
      name: "practice-prodigy:drills-library:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
