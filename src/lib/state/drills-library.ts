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
  /** Free-text personal note shown as a third line on Quick Start cards. */
  notes?: string;
  /**
   * Timestamp of the last Launch from Quick Start. Drives the
   * recently-used sort on the Quick Start surface. Undefined means
   * "never launched yet" — those drills sort to the bottom.
   */
  lastLoadedAt?: number;
};

type DrillsLibraryStore = {
  drills: Drill[];
  saveDrill: (name: string, config: PracticeConfig, notes?: string) => string;
  updateDrillConfig: (id: string, config: PracticeConfig) => void;
  /** Update the name and/or notes of an existing drill. */
  updateDrillMeta: (
    id: string,
    meta: { name?: string; notes?: string },
  ) => void;
  renameDrill: (id: string, name: string) => void;
  /** Stamp lastLoadedAt — call when the user launches a drill. */
  markDrillLoaded: (id: string) => void;
  /**
   * Phase 42 — Duplicate an existing drill into a new entry.
   * Returns the new drill's id. Name gets " (copy)" appended so users
   * can find and rename the clone without confusing it with the
   * original. `lastLoadedAt` is intentionally cleared so the copy
   * sorts to the top of "recently modified" but not "recently used."
   */
  duplicateDrill: (id: string) => string | null;
  deleteDrill: (id: string) => void;
};

function newDrillId(): string {
  return `drill_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export const useDrillsLibrary = create<DrillsLibraryStore>()(
  persist(
    (set, get) => ({
      drills: [],
      saveDrill: (name, config, notes) => {
        const id = newDrillId();
        const now = Date.now();
        set((state) => ({
          drills: [
            ...state.drills,
            {
              id,
              name: name.trim() || "Untitled drill",
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
            d.id === id
              ? { ...d, config, updatedAt: Date.now() }
              : d,
          ),
        })),
      updateDrillMeta: (id, meta) =>
        set((state) => ({
          drills: state.drills.map((d) => {
            if (d.id !== id) return d;
            const next: Drill = { ...d, updatedAt: Date.now() };
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
        const newId = newDrillId();
        const now = Date.now();
        // Deep-clone the config so future edits to the copy don't
        // mutate the original's config object (structuredClone is
        // safe here — PracticeConfig is JSON-serializable data).
        const clonedConfig: PracticeConfig =
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
      name: "practice-prodigy:drills-library:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
