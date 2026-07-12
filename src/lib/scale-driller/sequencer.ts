import type { OrderingStrategy } from "@/lib/state/practice-config";
import type {
  ScaleDrillConfig,
  ScaleInstance,
  ScalePitchClass,
} from "./types";

/**
 * Scale Driller sequence generator — pure functional module.
 *
 * Mirrors the Key Sequencer sequencer: given a config, emit an array
 * of per-measure steps. Each step is either a play measure (surfaces
 * one scale instance) or a prep/transition measure between scales.
 *
 * Random strategies use a seeded RNG so a given sessionSeed produces
 * stable playback (Start-Stop-Start doesn't reroll the whole run).
 */

const CHROMATIC: ScalePitchClass[] = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];

const CYCLE_OF_5THS: ScalePitchClass[] = [
  "C", "F", "A#", "D#", "G#", "C#",
  "F#", "B", "E", "A", "D", "G",
];

const CYCLE_OF_4THS: ScalePitchClass[] = [...CYCLE_OF_5THS].reverse();

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
 * Order the scale-instance pool according to the strategy. Cycles /
 * chromatic orderings sort by the pool's ROOT — quality-driven
 * ordering (e.g. "all Dorians together") is out of scope for v1;
 * Custom lets the user achieve any specific grouping they want.
 */
function orderScalePool(
  pool: ScaleInstance[],
  strategy: OrderingStrategy,
  rng: () => number,
): ScaleInstance[] {
  switch (strategy) {
    case "custom":
      return [...pool];
    case "chromaticAsc":
      return sortByRootOrder(pool, CHROMATIC);
    case "chromaticDesc":
      return sortByRootOrder(pool, [...CHROMATIC].reverse());
    case "cycleOf5ths":
      return sortByRootOrder(pool, CYCLE_OF_5THS);
    case "cycleOf4ths":
      return sortByRootOrder(pool, CYCLE_OF_4THS);
    case "randomReplace":
    case "randomShuffleOnce":
    case "randomShuffleEachPass":
      return shuffleWith(pool, rng);
    default:
      return [...pool];
  }
}

function sortByRootOrder(
  pool: ScaleInstance[],
  rootOrder: ScalePitchClass[],
): ScaleInstance[] {
  const rank = new Map<ScalePitchClass, number>();
  rootOrder.forEach((r, i) => rank.set(r, i));
  return [...pool].sort((a, b) => {
    const ra = rank.get(a.root) ?? 999;
    const rb = rank.get(b.root) ?? 999;
    return ra - rb;
  });
}

/** One measure of drill output. */
export type ScaleDrillStep = {
  /**
   * True for prep/transition measures inserted between scale changes.
   * Metronome plays stick-click audio; visual state shows "Get ready".
   */
  isRest: boolean;
  scale: ScaleInstance | null;
  measureInRun: number;
  passIndex: number;
  /** For prep measures: the scale coming up next. */
  upcomingScale?: ScaleInstance;
};

export function buildScaleSequence(
  config: ScaleDrillConfig,
  options?: {
    sessionSeed?: number;
    maxMeasures?: number;
  },
): ScaleDrillStep[] {
  const seed = options?.sessionSeed ?? 1;
  const pool = config.scalePool;
  if (pool.length === 0) return [];

  const rng = mulberry32(seed);
  const measuresPerScale = Math.max(1, config.measuresPerScale);

  const transitionUnit = config.transitionUnit ?? "measures";
  const transitionMeasures =
    transitionUnit === "measures"
      ? Math.max(0, config.transitionMeasures ?? 0)
      : 0;
  const transitionBeatsRounded =
    transitionUnit === "beats" && (config.transitionBeats ?? 0) > 0 ? 1 : 0;
  const restMeasures = transitionMeasures || transitionBeatsRounded;

  const repetitions = config.repeatIndefinitely
    ? 32
    : Math.max(1, config.repetitions);

  const initialOrder = orderScalePool(pool, config.ordering, rng);

  const steps: ScaleDrillStep[] = [];
  const maxMeasures =
    options?.maxMeasures ??
    repetitions * pool.length * (measuresPerScale + restMeasures) + 8;

  for (let pass = 0; pass < repetitions; pass++) {
    const order =
      pass === 0
        ? initialOrder
        : config.ordering === "randomShuffleEachPass"
          ? shuffleWith(pool, rng)
          : initialOrder;

    for (let idx = 0; idx < order.length; idx++) {
      const s = order[idx];
      for (let mi = 0; mi < measuresPerScale; mi++) {
        steps.push({
          isRest: false,
          scale: s,
          measureInRun: mi,
          passIndex: pass,
        });
        if (steps.length >= maxMeasures) return steps;
      }

      const isLastScaleOfLastPass =
        pass === repetitions - 1 && idx === order.length - 1;
      if (restMeasures > 0 && !isLastScaleOfLastPass) {
        let upcoming: ScaleInstance | undefined;
        if (idx + 1 < order.length) {
          upcoming = order[idx + 1];
        } else if (pass < repetitions - 1) {
          if (config.ordering !== "randomShuffleEachPass") {
            upcoming = initialOrder[0];
          }
        }
        for (let ri = 0; ri < restMeasures; ri++) {
          steps.push({
            isRest: true,
            scale: null,
            measureInRun: ri,
            passIndex: pass,
            upcomingScale: upcoming,
          });
          if (steps.length >= maxMeasures) return steps;
        }
      }
    }
  }

  return steps;
}
