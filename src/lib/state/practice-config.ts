import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ArpeggioPattern } from "@/lib/music/arpeggio";
import type { Chord, PitchClass, ChordQuality } from "@/lib/music/chord";
import type { ChordNotationStyle } from "@/lib/music/render-chord";

/**
 * Persistent practice configuration store.
 *
 * Holds the chord, tempo, meter, count-in, and session length that drive the
 * /practice/session drill screen. Persisted to localStorage so the user's
 * last setup survives reloads and revisits — they don't have to re-pick
 * everything every time.
 *
 * This is the first concrete piece of the **cascading defaults** architecture
 * (PROJECT-DESIGN.md §3.2). For this slice it's a single flat layer; future
 * slices will introduce the four-layer cascade (System → User → Pattern →
 * Per-session override).
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

export type PracticeConfig = {
  chord: Chord;
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

const DEFAULT_CONFIG: PracticeConfig = {
  chord: { root: "A", quality: "min7" },
  bpm: 90,
  timeSignature: { beatsPerMeasure: 4, beatUnit: 4 },
  countInMeasures: 1,
  sessionMeasures: 8,
  notationStyle: "jazz-minus",
  arpeggioPattern: "arp-7ths",
};

type PracticeConfigStore = PracticeConfig & {
  setRoot: (root: PitchClass) => void;
  setQuality: (quality: ChordQuality) => void;
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
      setRoot: (root) =>
        set((state) => ({ chord: { ...state.chord, root } })),
      setQuality: (quality) =>
        set((state) => ({ chord: { ...state.chord, quality } })),
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
      // Version bump should follow any breaking schema change to PracticeConfig.
      version: 1,
    },
  ),
);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
