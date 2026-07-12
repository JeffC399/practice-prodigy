import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_SCALE_DRILL_CONFIG,
  type ScaleDrillConfig,
  type ScaleInstance,
} from "./types";

/**
 * Live Scale Driller config — the setup screen writes here; the
 * session screen reads. Parallels useKeySequencerConfig one-for-one.
 *
 * Persisted so a browser refresh mid-setup doesn't lose work.
 */

type ScaleDrillConfigStore = ScaleDrillConfig & {
  /** Bulk load — used when a saved drill is loaded from the library. */
  loadConfig: (config: ScaleDrillConfig) => void;
  /** Reset to defaults. */
  reset: () => void;

  setScalePool: (scalePool: ScaleInstance[]) => void;
  setOrdering: (o: ScaleDrillConfig["ordering"]) => void;
  setTransitionUnit: (u: "measures" | "beats") => void;
  setTransitionMeasures: (n: number) => void;
  setTransitionBeats: (n: number) => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (ts: ScaleDrillConfig["timeSignature"]) => void;
  setMeasuresPerScale: (n: number) => void;
  setRepetitions: (n: number) => void;
  setRepeatIndefinitely: (v: boolean) => void;
  setCountInMeasures: (n: number) => void;
  setEnharmonicPreference: (
    p: ScaleDrillConfig["enharmonicPreference"],
  ) => void;
  setDisplayMode: (m: ScaleDrillConfig["displayMode"]) => void;
  setVoiceAnnounce: (v: ScaleDrillConfig["voiceAnnounce"]) => void;
  setLoadedScaleDrillId: (id: string | undefined) => void;
};

export const useScaleDrillConfig = create<ScaleDrillConfigStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SCALE_DRILL_CONFIG,
      loadConfig: (config) => set({ ...config }),
      reset: () =>
        set({
          ...DEFAULT_SCALE_DRILL_CONFIG,
          loadedScaleDrillId: undefined,
        }),
      setScalePool: (scalePool) => set({ scalePool }),
      setOrdering: (ordering) => set({ ordering }),
      setTransitionUnit: (transitionUnit) => set({ transitionUnit }),
      setTransitionMeasures: (transitionMeasures) =>
        set({ transitionMeasures }),
      setTransitionBeats: (transitionBeats) => set({ transitionBeats }),
      setBpm: (bpm) => set({ bpm }),
      setTimeSignature: (timeSignature) => set({ timeSignature }),
      setMeasuresPerScale: (measuresPerScale) => set({ measuresPerScale }),
      setRepetitions: (repetitions) => set({ repetitions }),
      setRepeatIndefinitely: (repeatIndefinitely) =>
        set({ repeatIndefinitely }),
      setCountInMeasures: (countInMeasures) => set({ countInMeasures }),
      setEnharmonicPreference: (enharmonicPreference) =>
        set({ enharmonicPreference }),
      setDisplayMode: (displayMode) => set({ displayMode }),
      setVoiceAnnounce: (voiceAnnounce) => set({ voiceAnnounce }),
      setLoadedScaleDrillId: (loadedScaleDrillId) =>
        set({ loadedScaleDrillId }),
    }),
    {
      name: "practice-prodigy:scale-driller-config:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
