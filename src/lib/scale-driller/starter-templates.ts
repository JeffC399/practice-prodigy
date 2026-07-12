import type { ScaleDrillConfig, ScaleInstance } from "./types";

/**
 * Starter ScaleDrill templates seeded on first install.
 *
 * Purpose: show new users the composability potential of the scale +
 * key pool before they invest in authoring their own. Each starter
 * exercises a different pedagogy so scanning the library teaches
 * "here's what this module can do."
 *
 * Seeded as regular user-owned ScaleDrills so users can edit,
 * duplicate, delete, or ignore them freely.
 */

const ALL_KEYS = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
] as const;

const BASE: Pick<
  ScaleDrillConfig,
  "timeSignature" | "countInMeasures" | "repeatIndefinitely"
> = {
  timeSignature: { beatsPerMeasure: 4, beatUnit: 4 },
  countInMeasures: 1,
  repeatIndefinitely: false,
};

/**
 * Cross-product helper — every key × every provided quality.
 */
function forEveryKey(
  qualities: ScaleDrillConfig["scalePool"][number]["quality"][],
): ScaleInstance[] {
  const out: ScaleInstance[] = [];
  for (const root of ALL_KEYS) {
    for (const quality of qualities) {
      out.push({ root, quality });
    }
  }
  return out;
}

type StarterTemplate = {
  name: string;
  notes: string;
  config: ScaleDrillConfig;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Major scales in all 12 keys",
    notes: "Cycle of 5ths — the fundamental scale warmup.",
    config: {
      ...BASE,
      scalePool: forEveryKey(["ionian"]),
      ordering: "cycleOf5ths",
      transitionUnit: "measures",
      transitionMeasures: 1,
      transitionBeats: 0,
      bpm: 80,
      measuresPerScale: 2,
      repetitions: 1,
      enharmonicPreference: "auto",
      displayMode: "notes",
    },
  },
  {
    name: "Minor pentatonic — 12 keys",
    notes: "Rock / blues / pop workhorse. Cycle of 5ths, 2 bars each.",
    config: {
      ...BASE,
      scalePool: forEveryKey(["minorPentatonic"]),
      ordering: "cycleOf5ths",
      transitionUnit: "measures",
      transitionMeasures: 1,
      transitionBeats: 0,
      bpm: 90,
      measuresPerScale: 2,
      repetitions: 1,
      enharmonicPreference: "auto",
      displayMode: "notes",
    },
  },
  {
    name: "All 7 modes on C",
    notes:
      "Ionian → Dorian → Phrygian → Lydian → Mixolydian → Aeolian → Locrian. All rooted on C so the interval changes are the only variable.",
    config: {
      ...BASE,
      scalePool: [
        { root: "C", quality: "ionian" },
        { root: "C", quality: "dorian" },
        { root: "C", quality: "phrygian" },
        { root: "C", quality: "lydian" },
        { root: "C", quality: "mixolydian" },
        { root: "C", quality: "aeolian" },
        { root: "C", quality: "locrian" },
      ],
      ordering: "custom",
      transitionUnit: "measures",
      transitionMeasures: 1,
      transitionBeats: 0,
      bpm: 80,
      measuresPerScale: 4,
      repetitions: 1,
      enharmonicPreference: "flats",
      displayMode: "degrees",
    },
  },
  {
    name: "Jazz minor family — mel min in 12 keys",
    notes:
      "Melodic minor across all 12 keys. Bread-and-butter jazz vocabulary.",
    config: {
      ...BASE,
      scalePool: forEveryKey(["melodicMinor"]),
      ordering: "cycleOf5ths",
      transitionUnit: "measures",
      transitionMeasures: 1,
      transitionBeats: 0,
      bpm: 90,
      measuresPerScale: 2,
      repetitions: 1,
      enharmonicPreference: "flats",
      displayMode: "notes",
    },
  },
  {
    name: "Random modes — mental juggling",
    notes:
      "All 7 modes × 12 keys, random shuffle each rep. Expert-mode test of your fluency.",
    config: {
      ...BASE,
      scalePool: forEveryKey([
        "ionian",
        "dorian",
        "phrygian",
        "lydian",
        "mixolydian",
        "aeolian",
        "locrian",
      ]),
      ordering: "randomShuffleEachPass",
      transitionUnit: "measures",
      transitionMeasures: 1,
      transitionBeats: 0,
      bpm: 90,
      measuresPerScale: 2,
      repetitions: 2,
      repeatIndefinitely: true,
      enharmonicPreference: "auto",
      displayMode: "notes",
    },
  },
  {
    name: "Blues in all 12 keys",
    notes:
      "The classic. Blues scale (1 ♭3 4 ♭5 5 ♭7) in every key. Cycle of 4ths.",
    config: {
      ...BASE,
      scalePool: forEveryKey(["blues"]),
      ordering: "cycleOf4ths",
      transitionUnit: "measures",
      transitionMeasures: 1,
      transitionBeats: 0,
      bpm: 100,
      measuresPerScale: 2,
      repetitions: 1,
      enharmonicPreference: "auto",
      displayMode: "notes",
    },
  },
];
