import type { Chord } from "@/lib/music/chord";
import {
  DEFAULT_PRACTICE_CONFIG,
  type PracticeConfig,
} from "@/lib/state/practice-config";
import type { Drill } from "@/lib/state/drills-library";

/**
 * Built-in seed drills. These ship in code (not localStorage), so:
 *   - Every install starts with them available in Quick Start.
 *   - They can't be deleted (UI hides the delete affordance for any
 *     drill whose id is in SHIPPED_DRILL_IDS).
 *   - The Edit pencil opens them for tweaking, but Save changes is
 *     disabled — Save as new is the only commit path so the user
 *     ends up with their own customized copy.
 *
 * Genre tag is informational only for now (substrate for future
 * filtering — see IDEAS.md). Difficulty/instrument tags are similar
 * post-v1 polish items.
 */

export type Genre = "jazz" | "blues" | "pop" | "rock" | "general";

/** Build a chord literal — keeps the data tables below readable. */
const c = (root: Chord["root"], quality: Chord["quality"]): Chord => ({
  root,
  quality,
});

/**
 * Compose a full PracticeConfig from a partial override + sensible
 * shipped-drill defaults. Always generates chordPoolIds to match
 * pool length so loaded drills don't trigger the regenerate path in
 * the store's loadConfig.
 */
function buildConfig(
  drillId: string,
  pool: Chord[],
  overrides: Partial<PracticeConfig> = {},
): PracticeConfig {
  return {
    ...DEFAULT_PRACTICE_CONFIG,
    chordPool: pool,
    chordPoolIds: pool.map((_, i) => `${drillId}:slot-${i}`),
    ...overrides,
  };
}

/** ii-V-I progressions through all 12 keys in the cycle of 5ths. */
const II_V_I_12_KEYS: Chord[] = [
  // Key of C
  c("D", "min7"),
  c("G", "dom7"),
  c("C", "maj7"),
  // Key of F
  c("G", "min7"),
  c("C", "dom7"),
  c("F", "maj7"),
  // Key of Bb (A#)
  c("C", "min7"),
  c("F", "dom7"),
  c("A#", "maj7"),
  // Key of Eb (D#)
  c("F", "min7"),
  c("A#", "dom7"),
  c("D#", "maj7"),
  // Key of Ab (G#)
  c("A#", "min7"),
  c("D#", "dom7"),
  c("G#", "maj7"),
  // Key of Db (C#)
  c("D#", "min7"),
  c("G#", "dom7"),
  c("C#", "maj7"),
  // Key of Gb (F#)
  c("G#", "min7"),
  c("C#", "dom7"),
  c("F#", "maj7"),
  // Key of B
  c("C#", "min7"),
  c("F#", "dom7"),
  c("B", "maj7"),
  // Key of E
  c("F#", "min7"),
  c("B", "dom7"),
  c("E", "maj7"),
  // Key of A
  c("B", "min7"),
  c("E", "dom7"),
  c("A", "maj7"),
  // Key of D
  c("E", "min7"),
  c("A", "dom7"),
  c("D", "maj7"),
  // Key of G
  c("A", "min7"),
  c("D", "dom7"),
  c("G", "maj7"),
];

/** Every root with a given quality. Used by "All X in 12 keys" drills. */
function allTwelveKeys(quality: Chord["quality"]): Chord[] {
  return [
    c("C", quality),
    c("C#", quality),
    c("D", quality),
    c("D#", quality),
    c("E", quality),
    c("F", quality),
    c("F#", quality),
    c("G", quality),
    c("G#", quality),
    c("A", quality),
    c("A#", quality),
    c("B", quality),
  ];
}

const DIATONIC_7THS_IN_C: Chord[] = [
  c("C", "maj7"),
  c("D", "min7"),
  c("E", "min7"),
  c("F", "maj7"),
  c("G", "dom7"),
  c("A", "min7"),
  c("B", "halfDim7"),
];

/** Daily-warm-up pool: all 12 roots × 4 common 7th qualities. */
const COMMON_7THS_12_KEYS: Chord[] = (
  ["maj7", "min7", "dom7", "dim7"] as const
).flatMap(allTwelveKeys);

/** Standard 12-bar blues in F (one chord per bar, jazz-blues form). */
const TWELVE_BAR_BLUES_F: Chord[] = [
  c("F", "dom7"),
  c("A#", "dom7"),
  c("F", "dom7"),
  c("F", "dom7"),
  c("A#", "dom7"),
  c("A#", "dom7"),
  c("F", "dom7"),
  c("D", "dom7"),
  c("G", "min7"),
  c("C", "dom7"),
  c("F", "dom7"),
  c("C", "dom7"),
];

/** Axis progression (I-V-vi-IV) in C — every pop song. */
const AXIS_IN_C: Chord[] = [
  c("C", "maj"),
  c("G", "maj"),
  c("A", "min"),
  c("F", "maj"),
];

/** Rock I-IV-V in C. */
const ROCK_I_IV_V_IN_C: Chord[] = [
  c("C", "maj"),
  c("F", "maj"),
  c("G", "maj"),
];

export type ShippedDrill = Drill & { genre: Genre };

const NOW = 0; // shipped drills have a stable createdAt of 0

export const SHIPPED_DRILLS: ShippedDrill[] = [
  {
    id: "shipped:ii-V-I-12-keys",
    name: "ii-V-I in 12 keys",
    notes: "Cycle of 5ths through all 12 major keys. The canonical jazz drill.",
    genre: "jazz",
    createdAt: NOW,
    updatedAt: NOW,
    config: buildConfig("shipped:ii-V-I-12-keys", II_V_I_12_KEYS, {
      orderingStrategy: "custom",
      drillMeasures: 36,
      repetitions: 1,
      bpm: 90,
      arpeggioPattern: "arp-7ths",
    }),
  },
  {
    id: "shipped:all-maj7",
    name: "All maj7 in 12 keys",
    notes: "Drill major-7 voicing across the cycle. Random each rep.",
    genre: "jazz",
    createdAt: NOW,
    updatedAt: NOW,
    config: buildConfig("shipped:all-maj7", allTwelveKeys("maj7"), {
      orderingStrategy: "randomShuffleEachPass",
      drillMeasures: 12,
      repetitions: 4,
      bpm: 90,
      arpeggioPattern: "arp-7ths",
    }),
  },
  {
    id: "shipped:all-min7",
    name: "All m7 in 12 keys",
    notes: "Minor-7 vocabulary across the cycle. Random each rep.",
    genre: "jazz",
    createdAt: NOW,
    updatedAt: NOW,
    config: buildConfig("shipped:all-min7", allTwelveKeys("min7"), {
      orderingStrategy: "randomShuffleEachPass",
      drillMeasures: 12,
      repetitions: 4,
      bpm: 90,
      arpeggioPattern: "arp-7ths",
    }),
  },
  {
    id: "shipped:all-dom7",
    name: "All dom7 in 12 keys",
    notes: "Dominant-7 vocabulary across the cycle. Random each rep.",
    genre: "jazz",
    createdAt: NOW,
    updatedAt: NOW,
    config: buildConfig("shipped:all-dom7", allTwelveKeys("dom7"), {
      orderingStrategy: "randomShuffleEachPass",
      drillMeasures: 12,
      repetitions: 4,
      bpm: 90,
      arpeggioPattern: "arp-7ths",
    }),
  },
  {
    id: "shipped:cycle-of-5ths-dom7",
    name: "Cycle of 5ths (dom7)",
    notes:
      "Dominant-7 chords walked through the cycle in order. Trains the ear for cycle motion.",
    genre: "jazz",
    createdAt: NOW,
    updatedAt: NOW,
    config: buildConfig(
      "shipped:cycle-of-5ths-dom7",
      allTwelveKeys("dom7"),
      {
        orderingStrategy: "cycleOf5ths",
        drillMeasures: 12,
        repetitions: 4,
        bpm: 90,
        arpeggioPattern: "arp-7ths",
      },
    ),
  },
  {
    id: "shipped:diatonic-7ths-c",
    name: "Diatonic 7ths in C",
    notes:
      "All 7th chords from the C major scale, in order. Builds key familiarity.",
    genre: "jazz",
    createdAt: NOW,
    updatedAt: NOW,
    config: buildConfig("shipped:diatonic-7ths-c", DIATONIC_7THS_IN_C, {
      orderingStrategy: "custom",
      drillMeasures: 7,
      repetitions: 4,
      bpm: 90,
      arpeggioPattern: "arp-7ths",
    }),
  },
  {
    id: "shipped:daily-warmup",
    name: "Daily warm-up",
    notes:
      "All 48 common 7ths (maj7 / m7 / dom7 / dim7 × 12 keys). Random each rep, loops until you stop.",
    genre: "jazz",
    createdAt: NOW,
    updatedAt: NOW,
    config: buildConfig("shipped:daily-warmup", COMMON_7THS_12_KEYS, {
      orderingStrategy: "randomShuffleEachPass",
      drillMeasures: 8,
      repetitions: 1,
      repeatIndefinitely: true,
      bpm: 90,
      arpeggioPattern: "arp-7ths",
    }),
  },
  {
    id: "shipped:12-bar-blues-f",
    name: "12-bar Blues in F",
    notes:
      "Standard 12-bar blues form in F (jazz-blues changes). 1 chord per bar.",
    genre: "blues",
    createdAt: NOW,
    updatedAt: NOW,
    config: buildConfig("shipped:12-bar-blues-f", TWELVE_BAR_BLUES_F, {
      orderingStrategy: "custom",
      drillMeasures: 12,
      repetitions: 4,
      bpm: 80,
      arpeggioPattern: "arp-7ths",
    }),
  },
  {
    id: "shipped:axis-c",
    name: "Axis progression in C (I-V-vi-IV)",
    notes:
      "The Axis of Awesome progression — half the pop songs ever written. C-G-Am-F.",
    genre: "pop",
    createdAt: NOW,
    updatedAt: NOW,
    config: buildConfig("shipped:axis-c", AXIS_IN_C, {
      orderingStrategy: "custom",
      drillMeasures: 4,
      repetitions: 1,
      repeatIndefinitely: true,
      bpm: 100,
      arpeggioPattern: "arp-7ths",
    }),
  },
  {
    id: "shipped:rock-i-iv-v-c",
    name: "Rock: I-IV-V in C",
    notes:
      "C-F-G triads — three-chord rock and roll. Edit the pool to transpose to your key, or duplicate and rebuild.",
    genre: "rock",
    createdAt: NOW,
    updatedAt: NOW,
    config: buildConfig("shipped:rock-i-iv-v-c", ROCK_I_IV_V_IN_C, {
      orderingStrategy: "custom",
      drillMeasures: 3,
      repetitions: 1,
      repeatIndefinitely: true,
      bpm: 120,
      arpeggioPattern: "arp-7ths",
    }),
  },
];

/** Fast lookup for "is this drill id a shipped drill?" */
export const SHIPPED_DRILL_IDS: ReadonlySet<string> = new Set(
  SHIPPED_DRILLS.map((d) => d.id),
);

export function isShippedDrill(id: string): boolean {
  return SHIPPED_DRILL_IDS.has(id);
}
