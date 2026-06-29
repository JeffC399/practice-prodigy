import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  CUSTOM_PATTERN_MAX_NOTES,
  newCustomPatternId,
  type CustomPattern,
  type PatternNote,
} from "@/lib/music/custom-patterns";

/**
 * Custom patterns library — Phase 13.
 *
 * Persists user-authored arpeggio patterns. Each entry is a named list
 * of semitone offsets that the engine plays over any chord, just like
 * the four built-in patterns but parameterized.
 *
 * Separate store from drills-library so the persistence keys are
 * independent — a user can rebuild their drill list without losing
 * their custom patterns, or vice versa.
 */
type CustomPatternsLibraryStore = {
  patterns: CustomPattern[];
  /** Look up a custom pattern by id (returns undefined if not found). */
  getById: (id: string) => CustomPattern | undefined;
  /** Create a new custom pattern; returns the generated id. */
  createPattern: (input: { name: string; notes: PatternNote[] }) => string;
  /** Update name and/or notes on an existing pattern. */
  updatePattern: (
    id: string,
    update: { name?: string; notes?: PatternNote[] },
  ) => void;
  deletePattern: (id: string) => void;
};

function sanitizeNotes(notes: PatternNote[]): PatternNote[] {
  return notes
    .slice(0, CUSTOM_PATTERN_MAX_NOTES)
    .filter(
      (n) =>
        typeof n.semitones === "number" &&
        Number.isFinite(n.semitones) &&
        n.semitones >= 0 &&
        n.semitones <= 12,
    )
    .map((n) => ({ semitones: Math.round(n.semitones) }));
}

export const useCustomPatternsLibrary = create<CustomPatternsLibraryStore>()(
  persist(
    (set, get) => ({
      patterns: [],
      getById: (id) => get().patterns.find((p) => p.id === id),
      createPattern: ({ name, notes }) => {
        const id = newCustomPatternId();
        const now = Date.now();
        const trimmedName = name.trim() || "Untitled pattern";
        const cleanNotes = sanitizeNotes(notes);
        set((state) => ({
          patterns: [
            ...state.patterns,
            {
              id,
              name: trimmedName,
              notes: cleanNotes,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return id;
      },
      updatePattern: (id, update) =>
        set((state) => ({
          patterns: state.patterns.map((p) => {
            if (p.id !== id) return p;
            const next: CustomPattern = { ...p, updatedAt: Date.now() };
            if (update.name !== undefined) {
              const trimmed = update.name.trim();
              if (trimmed.length > 0) next.name = trimmed;
            }
            if (update.notes !== undefined) {
              next.notes = sanitizeNotes(update.notes);
            }
            return next;
          }),
        })),
      deletePattern: (id) =>
        set((state) => ({
          patterns: state.patterns.filter((p) => p.id !== id),
        })),
    }),
    {
      name: "practice-prodigy:custom-patterns-library:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
