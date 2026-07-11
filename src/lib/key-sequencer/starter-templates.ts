import type { KeySequencerConfig, PromptRow } from "./types";
import { newPromptRowId } from "./types";

/**
 * Starter KeyDrill templates seeded on first install.
 *
 * Purpose: show new users the composability potential of key + prompt
 * rows before they invest in authoring their own. Every template
 * exercises a different combinatorial pattern so scanning the library
 * teaches "here's what this module can do."
 *
 * These are NOT immutable shipped drills like Bass Arpeggios has —
 * they're seeded as regular user-owned KeyDrills so users can edit,
 * duplicate, delete, or ignore them freely.
 *
 * Seeding runs exactly once per install (guarded by hasSeededStarters
 * in the library store). Re-seeding on schema changes would need a
 * bumped seed version.
 */

const ALL_KEYS = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
] as const;

const FLAT_KEYS: KeySequencerConfig["keyPool"] = [
  "F", "A#", "D#", "G#", "C#",
];

const BASE: Pick<
  KeySequencerConfig,
  "timeSignature" | "countInMeasures" | "repeatIndefinitely"
> = {
  timeSignature: { beatsPerMeasure: 4, beatUnit: 4 },
  countInMeasures: 1,
  repeatIndefinitely: false,
};

function row(
  label: string,
  words: string[],
  ordering: PromptRow["ordering"] = "custom",
): PromptRow {
  return {
    id: newPromptRowId(),
    label,
    words,
    ordering,
  };
}

/** One starter — name + notes + full config. */
type StarterTemplate = {
  name: string;
  notes: string;
  config: KeySequencerConfig;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Bare-bones warmup",
    notes:
      "12 keys, cycle of 5ths, no prompts. Tonic recognition. The simplest possible drill.",
    config: {
      ...BASE,
      keyPool: [...ALL_KEYS],
      keyOrdering: "cycleOf5ths",
      promptRows: [],
      restMeasuresBetweenKeys: 0,
      bpm: 80,
      measuresPerKey: 2,
      repetitions: 2,
    },
  },
  {
    name: "Chord-quality mixer",
    notes:
      "All 12 keys random, one 7th chord quality per measure. Intermediate jazz vocabulary drill.",
    config: {
      ...BASE,
      keyPool: [...ALL_KEYS],
      keyOrdering: "randomReplace",
      promptRows: [row("Quality", ["Maj7", "Min7", "Dom7", "Dim7"], "custom")],
      restMeasuresBetweenKeys: 0,
      bpm: 100,
      measuresPerKey: 2,
      repetitions: 3,
    },
  },
  {
    name: "Modes practice",
    notes:
      "Flat keys, the 7 modes cycle, ascending and descending. Methodical modal workout.",
    config: {
      ...BASE,
      keyPool: FLAT_KEYS,
      keyOrdering: "cycleOf5ths",
      promptRows: [
        row(
          "Mode",
          [
            "Ionian",
            "Dorian",
            "Phrygian",
            "Lydian",
            "Mixolydian",
            "Aeolian",
            "Locrian",
          ],
          "custom",
        ),
        row("Direction", ["Ascending", "Descending"], "custom"),
      ],
      restMeasuresBetweenKeys: 0,
      bpm: 90,
      measuresPerKey: 2,
      repetitions: 2,
    },
  },
  {
    name: "Scale-shape workout",
    notes:
      "All 12 keys random, four common scale types random. Rock / blues / pop crossover practice.",
    config: {
      ...BASE,
      keyPool: [...ALL_KEYS],
      keyOrdering: "randomReplace",
      promptRows: [
        row(
          "Scale",
          ["Major", "Minor", "Blues", "Pentatonic"],
          "randomReplace",
        ),
      ],
      restMeasuresBetweenKeys: 0,
      bpm: 110,
      measuresPerKey: 2,
      repetitions: 3,
    },
  },
  {
    name: "Voice-first ear training",
    notes:
      "All 12 keys shuffled, sing a specific scale degree, with 2 rest measures between keys to prep.",
    config: {
      ...BASE,
      keyPool: [...ALL_KEYS],
      keyOrdering: "randomShuffleOnce",
      promptRows: [
        row(
          "Sing",
          ["sing tonic", "sing 3rd", "sing 5th", "sing 7th"],
          "randomReplace",
        ),
      ],
      restMeasuresBetweenKeys: 2,
      bpm: 70,
      measuresPerKey: 2,
      repetitions: 2,
    },
  },
  {
    name: "Three-row jazz workout",
    notes:
      "All 12 keys random shuffled, quality × pattern × direction. The full 384-combination drill.",
    config: {
      ...BASE,
      keyPool: [...ALL_KEYS],
      keyOrdering: "randomShuffleEachPass",
      promptRows: [
        row("Quality", ["Maj7", "Min7", "Dom7", "Dim7"], "randomReplace"),
        row(
          "Pattern",
          ["Scale Tones", "Arpeggiated 7th", "Triad w/ LT"],
          "custom",
        ),
        row("Direction", ["Ascending", "Descending"], "custom"),
      ],
      restMeasuresBetweenKeys: 0,
      bpm: 100,
      measuresPerKey: 2,
      repetitions: 3,
    },
  },
  {
    name: "Left-hand-only piano",
    notes:
      "5 keys cycle, LH independence: chord voicing, walking bass, shell voicing. Pianists.",
    config: {
      ...BASE,
      keyPool: ["C", "F", "G", "D", "A"],
      keyOrdering: "cycleOf5ths",
      promptRows: [
        row(
          "LH pattern",
          ["Chord voicing", "Walking bass", "Shell voicing"],
          "custom",
        ),
      ],
      restMeasuresBetweenKeys: 0,
      bpm: 90,
      measuresPerKey: 4,
      repetitions: 2,
    },
  },
];
