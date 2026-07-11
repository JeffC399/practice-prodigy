import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { STARTER_TEMPLATES } from "./starter-templates";
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
  /**
   * Phase 45.5 — starter-template seed guard. Bumped when we ship a
   * new seed pass so existing users can also get new templates by
   * pushing this number up.
   */
  seededStartersVersion?: number;
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
  /**
   * Phase 45.5 — Seed the STARTER_TEMPLATES into the library on first
   * install. Guarded by `seededStartersVersion` — only runs when the
   * store hasn't seen the current seed version. Safe to call from a
   * setup page mount effect.
   */
  seedStartersIfNeeded: () => void;
};

/** Current seed pass; bump to re-seed for existing users. */
const SEED_VERSION = 1;

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
              // Phase 46 — starter → user drill on duplicate.
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
      seedStartersIfNeeded: () => {
        const state = get();
        // Already seeded this version? Nothing to do.
        if ((state.seededStartersVersion ?? 0) >= SEED_VERSION) return;
        const now = Date.now();
        const seeded: KeyDrill[] = STARTER_TEMPLATES.map((t, i) => ({
          id: newKeyDrillId(),
          name: t.name,
          notes: t.notes,
          config: t.config,
          // Stagger createdAt so the "recently launched" sort has a
          // stable default order matching the template array order.
          createdAt: now - (STARTER_TEMPLATES.length - i),
          updatedAt: now - (STARTER_TEMPLATES.length - i),
          // Phase 46 — marks these as starter templates so the setup
          // page renders them in the separate Templates section.
          isStarter: true,
        }));
        set({
          drills: [...state.drills, ...seeded],
          seededStartersVersion: SEED_VERSION,
        });
      },
    }),
    {
      name: "practice-prodigy:key-drills-library:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
