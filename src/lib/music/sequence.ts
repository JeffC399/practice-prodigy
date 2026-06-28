import type { Chord } from "./chord";
import type { OrderingStrategy } from "@/lib/state/practice-config";

/**
 * Sequence playback — given a chord pool + drill config, produce the
 * full ordered list of chords to play, one entry per measure.
 *
 * Drilling is structured as repetitions × drill-length:
 *   total measures = repetitions × drillMeasures
 *
 * For deterministic strategies the pool cycles in order. For
 * randomizeChords=true we sample fresh on every repetition (the user
 * explicitly chose that semantic over "sample once and replay" — gives
 * maximum variety from a candidate vocabulary). Sampling is without
 * replacement up to pool size; if drillMeasures > pool size, the
 * shuffled pool loops to fill.
 *
 * v1 ships all 8 strategies as a stable enum; this slice implements
 * "custom" + the randomizeChords path. The other deterministic
 * strategies will replace the order-deterministic branch without
 * changing this module's public API.
 */

export type SequenceConfig = {
  pool: Chord[];
  orderingStrategy: OrderingStrategy;
  drillMeasures: number;
  repetitions: number;
  randomizeChords: boolean;
};

/**
 * Produce the full chord-per-measure sequence for a drill. Returns an
 * array of length `drillMeasures × repetitions`. The drill screen
 * regenerates this on every Start so randomized drills get fresh
 * sampling each session.
 */
export function generateSequence(config: SequenceConfig): Chord[] {
  if (config.pool.length === 0) {
    throw new Error("generateSequence: empty chord pool");
  }
  const result: Chord[] = [];
  for (let r = 0; r < config.repetitions; r++) {
    if (config.randomizeChords) {
      result.push(...sampleForRep(config.pool, config.drillMeasures));
    } else {
      // Deterministic — cycle through the pool in order.
      for (let m = 0; m < config.drillMeasures; m++) {
        result.push(config.pool[m % config.pool.length]);
      }
    }
  }
  return result;
}

/**
 * One rep's worth of chords: shuffle the pool, take up to
 * drillMeasures of them. If the pool is smaller than the drill length,
 * loop the shuffled order to fill — better than padding with the same
 * chord, since the user gets a more varied (if repeated) sequence.
 */
function sampleForRep(pool: Chord[], drillMeasures: number): Chord[] {
  const shuffled = shuffle(pool);
  const result: Chord[] = [];
  while (result.length < drillMeasures) {
    const remaining = drillMeasures - result.length;
    result.push(...shuffled.slice(0, remaining));
  }
  return result;
}

/** Fisher–Yates shuffle — unbiased, in place on a copy. */
function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
