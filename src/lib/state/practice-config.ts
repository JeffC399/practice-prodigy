import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ArpeggioPattern } from "@/lib/music/arpeggio";
import type { Chord, PitchClass, ChordQuality } from "@/lib/music/chord";
import type { ChordNotationStyle } from "@/lib/music/render-chord";

/**
 * Persistent practice configuration store.
 *
 * Holds the chord pool, tempo, meter, count-in, and session length that
 * drive the /practice/session drill screen. Persisted to localStorage so
 * the user's last setup survives reloads and revisits — they don't have
 * to re-pick everything every time.
 *
 * This is the first concrete piece of the **cascading defaults**
 * architecture (PROJECT-DESIGN.md §3.2). For this slice it's a single
 * flat layer; future slices will introduce the four-layer cascade
 * (System → User → Pattern → Per-session override).
 */

export const TIME_SIGNATURES = [
  { beatsPerMeasure: 2, beatUnit: 4 },
  { beatsPerMeasure: 3, beatUnit: 4 },
  { beatsPerMeasure: 4, beatUnit: 4 },
  { beatsPerMeasure: 5, beatUnit: 4 },
  { beatsPerMeasure: 7, beatUnit: 4 },
  { beatsPerMeasure: 5, beatUnit: 8 },
  { beatsPerMeasure: 6, beatUnit: 8 },
  { beatsPerMeasure: 7, beatUnit: 8 },
  { beatsPerMeasure: 9, beatUnit: 8 },
  { beatsPerMeasure: 12, beatUnit: 8 },
] as const;

export type TimeSignature = (typeof TIME_SIGNATURES)[number];

export const COUNT_IN_OPTIONS = [
  { measures: 0, label: "Off" },
  { measures: 1, label: "1 measure" },
  { measures: 2, label: "2 measures" },
] as const;

/**
 * Ordering strategies per PROJECT-DESIGN.md §4.4. v1 ships all 8; this
 * slice implements only "custom" (the user's exact pool order). The
 * remaining 7 land in the next slice without changing the store shape.
 */
export const ORDERING_STRATEGIES = [
  "custom",
  "chromaticAsc",
  "chromaticDesc",
  "cycleOf5ths",
  "cycleOf4ths",
  "randomReplace",
  "randomShuffleOnce",
  "randomShuffleEachPass",
] as const;

export type OrderingStrategy = (typeof ORDERING_STRATEGIES)[number];

export type PracticeConfig = {
  chordPool: Chord[];
  orderingStrategy: OrderingStrategy;
  measuresPerChord: number;
  bpm: number;
  timeSignature: TimeSignature;
  countInMeasures: number;
  sessionMeasures: number;
  notationStyle: ChordNotationStyle;
  arpeggioPattern: ArpeggioPattern;
};

export const BPM_MIN = 30;
export const BPM_MAX = 300;
export const SESSION_MIN = 1;
export const SESSION_MAX = 64;
export const POOL_MAX = 32;

const DEFAULT_CONFIG: PracticeConfig = {
  chordPool: [{ root: "A", quality: "min7" }],
  orderingStrategy: "custom",
  measuresPerChord: 1,
  bpm: 90,
  timeSignature: { beatsPerMeasure: 4, beatUnit: 4 },
  countInMeasures: 1,
  sessionMeasures: 8,
  notationStyle: "jazz-minus",
  arpeggioPattern: "arp-7ths",
};

type PracticeConfigStore = PracticeConfig & {
  addChord: (chord?: Chord) => void;
  removeChordAt: (index: number) => void;
  setChordRootAt: (index: number, root: PitchClass) => void;
  setChordQualityAt: (index: number, quality: ChordQuality) => void;
  setOrderingStrategy: (strategy: OrderingStrategy) => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  setCountInMeasures: (measures: number) => void;
  setSessionMeasures: (measures: number) => void;
  setNotationStyle: (style: ChordNotationStyle) => void;
  setArpeggioPattern: (pattern: ArpeggioPattern) => void;
  resetToDefaults: () => void;
};

export const usePracticeConfig = create<PracticeConfigStore>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIG,
      addChord: (chord) =>
        set((state) => {
          if (state.chordPool.length >= POOL_MAX) return {};
          // Default a new chord to a copy of the last one — usually the
          // user's next chord is closely related to the previous.
          const newChord: Chord =
            chord ??
            (state.chordPool.length > 0
              ? { ...state.chordPool[state.chordPool.length - 1] }
              : { root: "A", quality: "min7" });
          return { chordPool: [...state.chordPool, newChord] };
        }),
      removeChordAt: (index) =>
        set((state) => {
          // Keep at least one chord — the drill needs something to play.
          if (state.chordPool.length <= 1) return {};
          return {
            chordPool: state.chordPool.filter((_, i) => i !== index),
          };
        }),
      setChordRootAt: (index, root) =>
        set((state) => ({
          chordPool: state.chordPool.map((c, i) =>
            i === index ? { ...c, root } : c,
          ),
        })),
      setChordQualityAt: (index, quality) =>
        set((state) => ({
          chordPool: state.chordPool.map((c, i) =>
            i === index ? { ...c, quality } : c,
          ),
        })),
      setOrderingStrategy: (orderingStrategy) => set({ orderingStrategy }),
      setBpm: (bpm) =>
        set({ bpm: clamp(Math.round(bpm), BPM_MIN, BPM_MAX) }),
      setTimeSignature: (timeSignature) => set({ timeSignature }),
      setCountInMeasures: (countInMeasures) => set({ countInMeasures }),
      setSessionMeasures: (sessionMeasures) =>
        set({
          sessionMeasures: clamp(
            Math.round(sessionMeasures),
            SESSION_MIN,
            SESSION_MAX,
          ),
        }),
      setNotationStyle: (notationStyle) => set({ notationStyle }),
      setArpeggioPattern: (arpeggioPattern) => set({ arpeggioPattern }),
      resetToDefaults: () => set(DEFAULT_CONFIG),
    }),
    {
      name: "practice-prodigy:practice-config:v1",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // v1 → v2: single `chord` field became `chordPool` array. Wrap
      // the old chord into a single-element pool so users don't lose
      // their last setup across the schema change.
      migrate: (persistedState, version) => {
        if (
          version === 1 &&
          persistedState &&
          typeof persistedState === "object"
        ) {
          const old = persistedState as Record<string, unknown>;
          const oldChord = old.chord as Chord | undefined;
          const migrated: Record<string, unknown> = { ...old };
          delete migrated.chord;
          migrated.chordPool = oldChord
            ? [oldChord]
            : DEFAULT_CONFIG.chordPool;
          migrated.orderingStrategy = DEFAULT_CONFIG.orderingStrategy;
          migrated.measuresPerChord = DEFAULT_CONFIG.measuresPerChord;
          return migrated;
        }
        return persistedState;
      },
    },
  ),
);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
