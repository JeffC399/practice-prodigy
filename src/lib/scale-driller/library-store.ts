import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { STARTER_TEMPLATES } from "./starter-templates";
import {
  newScaleDrillId,
  type ScaleDrill,
  type ScaleDrillConfig,
} from "./types";

/**
 * User's saved Scale Driller drills — parallels useKeyDrillsLibrary /
 * useDrillsLibrary. Cards appear on the /practice/scales setup page.
 */

type ScaleDrillsLibraryStore = {
  drills: ScaleDrill[];
  seededStartersVersion?: number;
  saveDrill: (
    name: string,
    config: ScaleDrillConfig,
    notes?: string,
  ) => string;
  updateDrillConfig: (id: string, config: ScaleDrillConfig) => void;
  updateDrillMeta: (
    id: string,
    meta: { name?: string; notes?: string },
  ) => void;
  renameDrill: (id: string, name: string) => void;
  /**
   * Slice A.10 (Phase 90) — Set (or clear with `undefined`) the
   * per-drill category override.
   */
  setDrillCategory: (id: string, category: string | undefined) => void;
  markDrillLoaded: (id: string) => void;
  duplicateDrill: (id: string) => string | null;
  deleteDrill: (id: string) => void;
  seedStartersIfNeeded: () => void;
  restoreMissingStarters: () => void;
};

const SEED_VERSION = 1;

export const useScaleDrillsLibrary = create<ScaleDrillsLibraryStore>()(
  persist(
    (set, get) => ({
      drills: [],
      saveDrill: (name, config, notes) => {
        const id = newScaleDrillId();
        const now = Date.now();
        set((state) => ({
          drills: [
            ...state.drills,
            {
              id,
              name: name.trim() || "Untitled scale drill",
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
            const next: ScaleDrill = { ...d, updatedAt: Date.now() };
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
      setDrillCategory: (id, category) =>
        set((state) => ({
          drills: state.drills.map((d) =>
            d.id === id ? { ...d, category, updatedAt: Date.now() } : d,
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
        const newId = newScaleDrillId();
        const now = Date.now();
        const clonedConfig: ScaleDrillConfig =
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
              isStarter: false,
            },
          ],
        }));
        return newId;
      },
      deleteDrill: (id) =>
        set((state) => ({
          drills: state.drills.filter((d) => d.id !== id),
        })),
      restoreMissingStarters: () => {
        const state = get();
        const existingNames = new Set(state.drills.map((d) => d.name));
        const missing = STARTER_TEMPLATES.filter(
          (t) => !existingNames.has(t.name),
        );
        if (missing.length === 0) return;
        const now = Date.now();
        const restored: ScaleDrill[] = missing.map((t, i) => ({
          id: newScaleDrillId(),
          name: t.name,
          notes: t.notes,
          config: t.config,
          createdAt: now - (missing.length - i),
          updatedAt: now - (missing.length - i),
          isStarter: true,
        }));
        set({ drills: [...state.drills, ...restored] });
      },
      seedStartersIfNeeded: () => {
        const state = get();
        if ((state.seededStartersVersion ?? 0) >= SEED_VERSION) return;
        const now = Date.now();
        const seeded: ScaleDrill[] = STARTER_TEMPLATES.map((t, i) => ({
          id: newScaleDrillId(),
          name: t.name,
          notes: t.notes,
          config: t.config,
          createdAt: now - (STARTER_TEMPLATES.length - i),
          updatedAt: now - (STARTER_TEMPLATES.length - i),
          isStarter: true,
        }));
        set({
          drills: [...state.drills, ...seeded],
          seededStartersVersion: SEED_VERSION,
        });
      },
    }),
    {
      name: "practice-prodigy:scale-drills-library:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
