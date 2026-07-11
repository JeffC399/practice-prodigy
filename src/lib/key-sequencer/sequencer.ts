import type { OrderingStrategy } from "@/lib/state/practice-config";
import type {
  KeyPitchClass,
  KeySequencerConfig,
  PromptRow,
  PromptRowOrdering,
} from "./types";

/**
 * Key Sequencer sequence generator — pure functional module.
 *
 * Given a config + a measure index, returns the "current step" state:
 * the current key + one word chosen per prompt row + whether this is
 * a rest measure. The setup-page live preview + the session page both
 * consume this so their output matches what actually plays back.
 *
 * Random strategies use a seeded RNG so a given sessionSeed produces
 * a stable playback (Start-Stop-Start doesn't reroll the whole run).
 */

/** Chromatic pitch classes indexed 0..11 (C=0). */
const CHROMATIC: KeyPitchClass[] = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];

/** Cycle of 5ths starting from C. */
const CYCLE_OF_5THS: KeyPitchClass[] = [
  "C", "F", "A#", "D#", "G#", "C#",
  "F#", "B", "E", "A", "D", "G",
];

const CYCLE_OF_4THS: KeyPitchClass[] = [...CYCLE_OF_5THS].reverse();

/** Compact seeded PRNG (mulberry32). Cheap + deterministic for a given seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Order a key pool according to the ordering strategy. For strategies
 * that produce a fixed cycle (chromatic, cycle of 5ths / 4ths), we
 * filter down to the user's pool but keep the strategy's order. For
 * "custom" we honor the pool exactly as provided.
 */
function orderKeyPool(
  pool: KeyPitchClass[],
  strategy: OrderingStrategy,
  rng: () => number,
): KeyPitchClass[] {
  switch (strategy) {
    case "custom":
      return [...pool];
    case "chromaticAsc":
      return CHROMATIC.filter((k) => pool.includes(k));
    case "chromaticDesc":
      return [...CHROMATIC].reverse().filter((k) => pool.includes(k));
    case "cycleOf5ths":
      return CYCLE_OF_5THS.filter((k) => pool.includes(k));
    case "cycleOf4ths":
      return CYCLE_OF_4THS.filter((k) => pool.includes(k));
    case "randomReplace":
    case "randomShuffleOnce":
    case "randomShuffleEachPass":
      return shuffleWith(pool, rng);
    default:
      return [...pool];
  }
}

/**
 * Order a row of prompt words according to its ordering. Prompt rows
 * only support the 4 "no-pitch-context" strategies.
 */
function orderPromptWords(
  words: string[],
  ordering: PromptRowOrdering,
  rng: () => number,
): string[] {
  switch (ordering) {
    case "custom":
      return [...words];
    case "randomReplace":
    case "randomShuffleOnce":
    case "randomShuffleEachPass":
      return shuffleWith(words, rng);
    default:
      return [...words];
  }
}

/** One measure of drill output. */
export type KeySequencerStep = {
  /**
   * True for prep/transition measures inserted between key changes
   * (see config.transitionMeasures). During these, the metronome
   * plays stick-click audio and the visual state shows "Get ready".
   * Legacy "rest measures" also surface as isRest=true; the audio /
   * visual treatment is identical.
   */
  isRest: boolean;
  key: KeyPitchClass | null;
  /** One word per prompt row, aligned to config.promptRows order. Empty when isRest. */
  rowWords: string[];
  /** Index into the current key-run (0..measuresPerKey-1). Used to detect "same key still". */
  measureInRun: number;
  /** Zero-based pass index (0, 1, 2, ...). Even at repeatIndefinitely = true. */
  passIndex: number;
  /**
   * Phase 46 — For prep/transition measures, the KEY of the next key
   * group (the "get ready for" key). Undefined on play measures.
   * Enables the Next preview to keep showing the upcoming key
   * during prep, and Now to show "Get ready" + preview key.
   */
  upcomingKey?: KeyPitchClass;
};

/**
 * Given a config, build the full sequence of measures. Bounded by
 * total = repetitions × (keys × (measuresPerKey + restMeasures)) OR
 * a soft cap when repeatIndefinitely.
 *
 * The result is an array of KeySequencerStep, one per measure. Cheap
 * to call on every render — pure function, no side effects, no I/O.
 */
export function buildKeySequence(
  config: KeySequencerConfig,
  options?: {
    sessionSeed?: number;
    /** Cap emitted measures. Defaults to sensible number based on config. */
    maxMeasures?: number;
  },
): KeySequencerStep[] {
  const seed = options?.sessionSeed ?? 1;
  const pool = config.keyPool;
  if (pool.length === 0) return [];

  const rng = mulberry32(seed);
  const keyOrdering = config.keyOrdering;
  const measuresPerKey = Math.max(1, config.measuresPerKey);
  // Phase 46 — new prep system supersedes restMeasuresBetweenKeys.
  // Only when both new fields are unset AND the legacy field is set do
  // we fall back to it; that gives existing user data a graceful path.
  const transitionUnit = config.transitionUnit ?? "measures";
  const transitionMeasures =
    transitionUnit === "measures"
      ? Math.max(0, config.transitionMeasures ?? 0)
      : 0;
  // We only emit full-measure prep steps in this MVP. transitionBeats
  // is stored + surfaced in the UI so the future beat-mode refactor
  // has substrate, but for now the sequencer treats "beats" mode as
  // rounded to the nearest measure (min 1 when beats > 0).
  const transitionBeatsRounded =
    transitionUnit === "beats" && (config.transitionBeats ?? 0) > 0 ? 1 : 0;
  const restMeasures =
    transitionMeasures || transitionBeatsRounded
      ? transitionMeasures || transitionBeatsRounded
      : Math.max(0, config.restMeasuresBetweenKeys ?? 0);
  const repetitions = config.repeatIndefinitely
    ? 32 // preview cap; the actual session engine will re-buffer for indefinite
    : Math.max(1, config.repetitions);

  // Pre-build the row RNGs so each row has its own seeded stream (avoids
  // rows all landing on the same "random" word each measure when they
  // share the top-level rng).
  const rowRngs = config.promptRows.map((_, i) => mulberry32(seed + 0x1000 + i));

  // For shuffleOnce: one shuffled order used for every pass.
  // For shuffleEachPass: re-shuffle at the start of each pass.
  // Precompute the pass-0 ordering.
  const initialKeyOrder = orderKeyPool(pool, keyOrdering, rng);

  // Per-row initial word orderings (for shuffleOnce / custom modes).
  const initialWordOrders = config.promptRows.map((row, i) =>
    orderPromptWords(row.words, row.ordering, rowRngs[i]),
  );

  // Emit measures.
  const steps: KeySequencerStep[] = [];
  const maxMeasures =
    options?.maxMeasures ??
    repetitions * pool.length * (measuresPerKey + restMeasures) + 8;

  for (let pass = 0; pass < repetitions; pass++) {
    // Per-pass key order.
    const keyOrder =
      pass === 0
        ? initialKeyOrder
        : keyOrdering === "randomShuffleEachPass"
          ? shuffleWith(pool, rng)
          : initialKeyOrder;

    // Per-pass word orders per row.
    const wordOrdersThisPass = config.promptRows.map((row, i) => {
      if (pass === 0) return initialWordOrders[i];
      if (row.ordering === "randomShuffleEachPass") {
        return shuffleWith(row.words, rowRngs[i]);
      }
      return initialWordOrders[i];
    });

    let keyPositionInPass = 0;
    for (const k of keyOrder) {
      for (let mi = 0; mi < measuresPerKey; mi++) {
        // Pick one word per row.
        const rowWords = config.promptRows.map((row, ri) => {
          if (row.words.length === 0) return "";
          if (row.ordering === "randomReplace") {
            return row.words[Math.floor(rowRngs[ri]() * row.words.length)];
          }
          const seq = wordOrdersThisPass[ri];
          const globalIdx = pass * pool.length * measuresPerKey +
            keyPositionInPass * measuresPerKey +
            mi;
          return seq[globalIdx % seq.length];
        });

        steps.push({
          isRest: false,
          key: k,
          rowWords,
          measureInRun: mi,
          passIndex: pass,
        });

        if (steps.length >= maxMeasures) return steps;
      }

      // Rest / prep measures between keys (skip after the very last
      // key of the very last pass so the drill ends cleanly).
      const isLastKeyOfLastPass =
        pass === repetitions - 1 && k === keyOrder[keyOrder.length - 1];
      if (restMeasures > 0 && !isLastKeyOfLastPass) {
        // Determine which key is coming up so the "Get ready" preview
        // can name it. If this is the last key of THIS pass but not
        // the last pass, upcoming is the first key of the NEXT pass.
        const isLastKeyOfPass = k === keyOrder[keyOrder.length - 1];
        let upcoming: KeyPitchClass | undefined;
        if (!isLastKeyOfPass) {
          upcoming = keyOrder[keyPositionInPass + 1];
        } else if (pass < repetitions - 1) {
          // Peek at first key of next pass. shuffleEachPass re-shuffles,
          // so we can only guarantee an accurate upcoming key when NOT
          // shuffling per pass; otherwise leave undefined.
          if (keyOrdering !== "randomShuffleEachPass") {
            upcoming = initialKeyOrder[0];
          }
        }
        for (let ri = 0; ri < restMeasures; ri++) {
          steps.push({
            isRest: true,
            key: null,
            rowWords: config.promptRows.map(() => ""),
            measureInRun: ri,
            passIndex: pass,
            upcomingKey: upcoming,
          });
          if (steps.length >= maxMeasures) return steps;
        }
      }

      keyPositionInPass++;
    }
  }

  return steps;
}
