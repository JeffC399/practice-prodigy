import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_METRONOME_CONFIG,
  METRONOME_SOUNDS,
  type BeatAccent,
  type MetronomeConfig,
  type MetronomeSound,
} from "@/lib/audio/standalone-metronome";

/**
 * User-defined time signature shape (broader than the built-in
 * readonly tuple type). Any numerator + standard denominator.
 */
export type CustomTimeSignature = {
  beatsPerMeasure: number;
  beatUnit: number;
};

/** Denominators we allow for custom time sigs (standard note values). */
export const CUSTOM_TIME_SIGNATURE_DENOMINATORS = [
  1, 2, 4, 8, 16, 32,
] as const;

export const CUSTOM_TIME_SIGNATURE_NUMERATOR_MAX = 32;

/**
 * Persistent user preferences for the standalone Metronome module.
 *
 * Holds the user's last-used config so the metronome page lands ready
 * to play on revisit. Also holds the user's visual-style preference
 * (which beat-indicator rendering they prefer).
 *
 * Persisted to its own localStorage key so it survives independently
 * of drill state.
 */

export const METRONOME_VISUAL_STYLES = ["dots", "pulse", "pendulum"] as const;
export type MetronomeVisualStyle = (typeof METRONOME_VISUAL_STYLES)[number];

export const METRONOME_VISUAL_STYLE_LABELS: Record<
  MetronomeVisualStyle,
  string
> = {
  dots: "Beat dots",
  pulse: "Pulsing circle",
  pendulum: "Pendulum",
};

type MetronomeStore = MetronomeConfig & {
  visualStyle: MetronomeVisualStyle;
  /**
   * User-saved custom time signatures (numerator + denominator).
   * Surfaced in the metronome time-signature picker alongside the
   * built-in TIME_SIGNATURES from practice-config.
   */
  customTimeSignatures: CustomTimeSignature[];
  setBpm: (bpm: number) => void;
  setBeatsPerMeasure: (n: number) => void;
  setBeatUnit: (n: number) => void;
  setSubdivisionsPerBeat: (n: 1 | 2 | 3 | 4) => void;
  cycleBeatAccent: (beatIdx: number) => void;
  setSound: (s: MetronomeSound) => void;
  setVolume: (v: number) => void;
  setVisualStyle: (s: MetronomeVisualStyle) => void;
  setPolyrhythm: (
    update: Partial<MetronomeConfig["polyrhythm"]>,
  ) => void;
  setTempoRamp: (
    update: Partial<MetronomeConfig["tempoRamp"]>,
  ) => void;
  setDropEveryNthMeasure: (n: number) => void;
  /** Add a custom time signature (no-op if a duplicate already exists). */
  addCustomTimeSignature: (sig: CustomTimeSignature) => void;
  /** Remove a custom time signature by its numerator+denominator. */
  removeCustomTimeSignature: (sig: CustomTimeSignature) => void;
  /** Resize the accent pattern when beatsPerMeasure changes. */
  resyncAccentPattern: () => void;
  resetToDefaults: () => void;
};

const MIN_BPM = 30;
const MAX_BPM = 300;
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function defaultAccentPattern(beatsPerMeasure: number): BeatAccent[] {
  return Array.from({ length: beatsPerMeasure }, (_, i) =>
    i === 0 ? "accent" : "normal",
  );
}

export const useMetronomePrefs = create<MetronomeStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_METRONOME_CONFIG,
      visualStyle: "dots",
      customTimeSignatures: [],
      setBpm: (bpm) => set({ bpm: clamp(Math.round(bpm), MIN_BPM, MAX_BPM) }),
      setBeatsPerMeasure: (beatsPerMeasure) =>
        set({
          beatsPerMeasure,
          accentPattern: defaultAccentPattern(beatsPerMeasure),
        }),
      setBeatUnit: (beatUnit) => set({ beatUnit }),
      setSubdivisionsPerBeat: (n) => set({ subdivisionsPerBeat: n }),
      cycleBeatAccent: (beatIdx) => {
        const state = get();
        const pattern = [...state.accentPattern];
        const current: BeatAccent = pattern[beatIdx] ?? "normal";
        const nextAccent: BeatAccent =
          current === "normal"
            ? "accent"
            : current === "accent"
              ? "mute"
              : "normal";
        pattern[beatIdx] = nextAccent;
        set({ accentPattern: pattern });
      },
      setSound: (sound) => set({ sound }),
      setVolume: (volume) => set({ volume: clamp(volume, 0, 1) }),
      setVisualStyle: (visualStyle) => set({ visualStyle }),
      setPolyrhythm: (update) =>
        set((state) => ({
          polyrhythm: { ...state.polyrhythm, ...update },
        })),
      setTempoRamp: (update) =>
        set((state) => ({
          tempoRamp: { ...state.tempoRamp, ...update },
        })),
      setDropEveryNthMeasure: (n) =>
        set({ dropEveryNthMeasure: clamp(Math.round(n), 0, 16) }),
      addCustomTimeSignature: (sig) =>
        set((state) => {
          const exists = state.customTimeSignatures.some(
            (s) =>
              s.beatsPerMeasure === sig.beatsPerMeasure &&
              s.beatUnit === sig.beatUnit,
          );
          if (exists) return {};
          return {
            customTimeSignatures: [...state.customTimeSignatures, sig],
          };
        }),
      removeCustomTimeSignature: (sig) =>
        set((state) => ({
          customTimeSignatures: state.customTimeSignatures.filter(
            (s) =>
              !(
                s.beatsPerMeasure === sig.beatsPerMeasure &&
                s.beatUnit === sig.beatUnit
              ),
          ),
        })),
      resyncAccentPattern: () => {
        const state = get();
        if (state.accentPattern.length === state.beatsPerMeasure) return;
        set({ accentPattern: defaultAccentPattern(state.beatsPerMeasure) });
      },
      resetToDefaults: () =>
        set((state) => ({
          ...DEFAULT_METRONOME_CONFIG,
          visualStyle: "dots",
          // Preserve the user's saved custom time signatures across
          // a defaults reset — those are library entries, not
          // session config.
          customTimeSignatures: state.customTimeSignatures,
        })),
    }),
    {
      name: "practice-prodigy:metronome-prefs:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState;
        }
        const next = {
          ...DEFAULT_METRONOME_CONFIG,
          visualStyle: "dots" as MetronomeVisualStyle,
          customTimeSignatures: [] as CustomTimeSignature[],
          ...(persistedState as Partial<MetronomeStore>),
        };
        // Sanity: ensure customTimeSignatures is always an array
        if (!Array.isArray(next.customTimeSignatures)) {
          next.customTimeSignatures = [];
        }
        // Sanity: accentPattern length must match beatsPerMeasure
        if (
          !Array.isArray(next.accentPattern) ||
          next.accentPattern.length !== next.beatsPerMeasure
        ) {
          next.accentPattern = defaultAccentPattern(next.beatsPerMeasure);
        }
        // Sanity: sound must be a known value
        if (!(METRONOME_SOUNDS as readonly string[]).includes(next.sound)) {
          next.sound = DEFAULT_METRONOME_CONFIG.sound;
        }
        return next;
      },
    },
  ),
);
