import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  CUSTOM_PATTERN_LENGTHS,
  CUSTOM_PATTERN_MAX_NOTES,
  DEFAULT_NOTE_DURATION,
  NOTE_DURATIONS,
  newCustomPatternId,
  type CustomPattern,
  type CustomPatternLength,
  type NoteDuration,
  type PatternNote,
} from "@/lib/music/custom-patterns";

/**
 * Custom patterns library — Phase 13 (now extended in Phase 14 with
 * note durations + rests + multi-measure pattern length).
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
  createPattern: (input: {
    name: string;
    notes: PatternNote[];
    lengthInMeasures: number;
  }) => string;
  /** Update name and/or notes and/or length on an existing pattern. */
  updatePattern: (
    id: string,
    update: {
      name?: string;
      notes?: PatternNote[];
      lengthInMeasures?: number;
    },
  ) => void;
  deletePattern: (id: string) => void;
};

const ALLOWED_LENGTHS: ReadonlySet<number> = new Set(CUSTOM_PATTERN_LENGTHS);
const ALLOWED_DURATIONS: ReadonlySet<string> = new Set(NOTE_DURATIONS);

function sanitizeLength(value: unknown): CustomPatternLength {
  const n = typeof value === "number" ? value : 1;
  return (ALLOWED_LENGTHS.has(n) ? n : 1) as CustomPatternLength;
}

function sanitizeDuration(value: unknown): NoteDuration {
  return ALLOWED_DURATIONS.has(value as string)
    ? (value as NoteDuration)
    : DEFAULT_NOTE_DURATION;
}

function sanitizeNotes(notes: PatternNote[]): PatternNote[] {
  return notes
    .slice(0, CUSTOM_PATTERN_MAX_NOTES)
    .map((raw): PatternNote | null => {
      if (!raw || typeof raw !== "object") return null;
      const duration = sanitizeDuration(
        (raw as { duration?: unknown }).duration,
      );
      if ((raw as { kind?: string }).kind === "rest") {
        return { kind: "rest", duration };
      }
      // Default kind: "note" (covers both legacy {semitones} entries and
      // the new explicit {kind: "note", semitones, duration} shape).
      const semitones = (raw as { semitones?: number }).semitones;
      if (
        typeof semitones !== "number" ||
        !Number.isFinite(semitones) ||
        semitones < 0 ||
        semitones > 12
      ) {
        return null;
      }
      return {
        kind: "note",
        semitones: Math.round(semitones),
        duration,
      };
    })
    .filter((n): n is PatternNote => n !== null);
}

export const useCustomPatternsLibrary = create<CustomPatternsLibraryStore>()(
  persist(
    (set, get) => ({
      patterns: [],
      getById: (id) => get().patterns.find((p) => p.id === id),
      createPattern: ({ name, notes, lengthInMeasures }) => {
        const id = newCustomPatternId();
        const now = Date.now();
        const trimmedName = name.trim() || "Untitled pattern";
        set((state) => ({
          patterns: [
            ...state.patterns,
            {
              id,
              name: trimmedName,
              notes: sanitizeNotes(notes),
              lengthInMeasures: sanitizeLength(lengthInMeasures),
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
            if (update.lengthInMeasures !== undefined) {
              next.lengthInMeasures = sanitizeLength(update.lengthInMeasures);
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
      version: 2,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState;
        }
        const next = { ...(persistedState as Record<string, unknown>) };

        // v1 → v2: PatternNote gained `kind` and `duration`; CustomPattern
        // gained `lengthInMeasures`. Pre-v2 notes were bare `{semitones}`
        // entries with implicit "evenly-spread-across-1-measure" semantics.
        // We normalize by tagging them as notes with `duration: "quarter"`
        // and giving each pattern `lengthInMeasures: 1`. That preserves
        // the most common case (≤4 notes in 4/4 = one note per beat) and
        // lets the user edit anything that doesn't sit right.
        if (version <= 1) {
          const patterns = next.patterns as
            | Array<Record<string, unknown>>
            | undefined;
          if (Array.isArray(patterns)) {
            next.patterns = patterns.map((p) => {
              const rawNotes = Array.isArray(p.notes)
                ? (p.notes as Array<Record<string, unknown>>)
                : [];
              const upgradedNotes = rawNotes.map((n) => ({
                kind: "note",
                semitones:
                  typeof n.semitones === "number" ? n.semitones : 0,
                duration: DEFAULT_NOTE_DURATION,
              }));
              return {
                ...p,
                notes: upgradedNotes,
                lengthInMeasures:
                  typeof p.lengthInMeasures === "number"
                    ? p.lengthInMeasures
                    : 1,
              };
            });
          }
        }
        return next;
      },
    },
  ),
);
