import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_KEY_SEQUENCER_CONFIG,
  type KeySequencerConfig,
  type PromptRow,
} from "./types";

/**
 * Live Key Sequencer config — the setup screen writes here; the
 * session screen reads. Parallels usePracticeConfig (Bass Arpeggios).
 *
 * Kept as a separate store from the drill library so the setup /
 * session pipeline stays clean: load a KeyDrill → its config becomes
 * the live config. Save-as-drill takes a snapshot of the live config
 * into the library.
 *
 * Persisted so a browser refresh mid-setup doesn't lose the user's
 * work-in-progress.
 */

type KeySequencerConfigStore = KeySequencerConfig & {
  /** Bulk load — used when a saved drill is loaded from the library. */
  loadConfig: (config: KeySequencerConfig) => void;
  /** Reset to defaults. */
  reset: () => void;

  // Per-field setters.
  setKeyPool: (keyPool: KeySequencerConfig["keyPool"]) => void;
  setKeyOrdering: (o: KeySequencerConfig["keyOrdering"]) => void;
  setPromptRows: (rows: PromptRow[]) => void;
  addPromptRow: (row: PromptRow) => void;
  updatePromptRow: (id: string, patch: Partial<PromptRow>) => void;
  removePromptRow: (id: string) => void;
  setRestMeasuresBetweenKeys: (n: number) => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (ts: KeySequencerConfig["timeSignature"]) => void;
  setMeasuresPerKey: (n: number) => void;
  setRepetitions: (n: number) => void;
  setRepeatIndefinitely: (v: boolean) => void;
  setCountInMeasures: (n: number) => void;
  setEnharmonicPreference: (
    p: KeySequencerConfig["enharmonicPreference"],
  ) => void;
  setVoiceAnnounce: (v: KeySequencerConfig["voiceAnnounce"]) => void;
  setLoadedKeyDrillId: (id: string | undefined) => void;
};

export const useKeySequencerConfig = create<KeySequencerConfigStore>()(
  persist(
    (set) => ({
      ...DEFAULT_KEY_SEQUENCER_CONFIG,
      loadConfig: (config) => set({ ...config }),
      reset: () => set({ ...DEFAULT_KEY_SEQUENCER_CONFIG }),
      setKeyPool: (keyPool) => set({ keyPool }),
      setKeyOrdering: (keyOrdering) => set({ keyOrdering }),
      setPromptRows: (promptRows) => set({ promptRows }),
      addPromptRow: (row) =>
        set((s) => ({ promptRows: [...s.promptRows, row] })),
      updatePromptRow: (id, patch) =>
        set((s) => ({
          promptRows: s.promptRows.map((r) =>
            r.id === id ? { ...r, ...patch } : r,
          ),
        })),
      removePromptRow: (id) =>
        set((s) => ({
          promptRows: s.promptRows.filter((r) => r.id !== id),
        })),
      setRestMeasuresBetweenKeys: (restMeasuresBetweenKeys) =>
        set({ restMeasuresBetweenKeys }),
      setBpm: (bpm) => set({ bpm }),
      setTimeSignature: (timeSignature) => set({ timeSignature }),
      setMeasuresPerKey: (measuresPerKey) => set({ measuresPerKey }),
      setRepetitions: (repetitions) => set({ repetitions }),
      setRepeatIndefinitely: (repeatIndefinitely) =>
        set({ repeatIndefinitely }),
      setCountInMeasures: (countInMeasures) => set({ countInMeasures }),
      setEnharmonicPreference: (enharmonicPreference) =>
        set({ enharmonicPreference }),
      setVoiceAnnounce: (voiceAnnounce) => set({ voiceAnnounce }),
      setLoadedKeyDrillId: (loadedKeyDrillId) => set({ loadedKeyDrillId }),
    }),
    {
      name: "practice-prodigy:key-sequencer-config:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
