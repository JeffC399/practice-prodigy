import type { Chord, PitchClass } from "./chord";
import { PITCH_CLASS_TO_SEMITONE } from "./intervals";
import type {
  OrderingStrategy,
  TimeSignature,
  TransitionUnit,
} from "@/lib/state/practice-config";

/**
 * Sequence playback — given a chord pool + drill config, produce the
 * full beat-by-beat playback list.
 *
 * Each entry is one beat of metronome time, tagged with which Chord is
 * "in scope" and what KIND of beat it is:
 *   - "play"       — the user is expected to play the arpeggio
 *   - "transition" — inter-chord prep, the chord shown is the UPCOMING
 *                    chord, the user uses these beats to find the new
 *                    root before they have to play.
 *
 * The chord-per-measure assignments come from the ordering strategy
 * (one of 8 per PROJECT-DESIGN.md §4.4). Random strategies re-roll
 * each call, so the drill screen regenerates the sequence on every
 * Start for fresh sampling.
 */

export type SequenceBeat = {
  chord: Chord;
  kind: "play" | "transition";
};

export type SequenceConfig = {
  pool: Chord[];
  orderingStrategy: OrderingStrategy;
  drillMeasures: number;
  repetitions: number;
  repeatIndefinitely: boolean;
  /** Used to expand each play measure into beatsPerMeasure beats. */
  timeSignature: TimeSignature;
  transitionUnit: TransitionUnit;
  transitionCount: number;
};

/**
 * Cap on the number of MEASURES we pre-generate when the user selects
 * "Loop until stopped." Functionally infinite for any normal session
 * (multi-hours at typical tempos / meters).
 */
export const INDEFINITE_MEASURE_BUFFER = 4096;

/**
 * Produce the full beat-per-tick sequence for a drill. Drill screen
 * regenerates this on every Start so random strategies re-roll cleanly.
 */
export function generateSequence(config: SequenceConfig): SequenceBeat[] {
  if (config.pool.length === 0) {
    throw new Error("generateSequence: empty chord pool");
  }

  const playChords = buildPlayChords(config);
  const beatsPerMeasure = config.timeSignature.beatsPerMeasure;
  const transitionBeats =
    config.transitionCount > 0
      ? config.transitionUnit === "measures"
        ? config.transitionCount * beatsPerMeasure
        : config.transitionCount
      : 0;

  const result: SequenceBeat[] = [];
  let prevChord: Chord | null = null;
  for (const chord of playChords) {
    if (
      transitionBeats > 0 &&
      prevChord !== null &&
      !chordsEqual(prevChord, chord)
    ) {
      for (let b = 0; b < transitionBeats; b++) {
        result.push({ chord, kind: "transition" });
      }
    }
    for (let b = 0; b < beatsPerMeasure; b++) {
      result.push({ chord, kind: "play" });
    }
    prevChord = chord;
  }
  return result;
}

/**
 * Build the per-measure play assignments (one Chord per play measure)
 * according to the ordering strategy. Length = drillMeasures ×
 * effective-reps. Doesn't know about transitions — that's the caller's
 * job to interleave.
 */
function buildPlayChords(config: SequenceConfig): Chord[] {
  const effectiveReps = config.repeatIndefinitely
    ? Math.max(1, Math.ceil(INDEFINITE_MEASURE_BUFFER / config.drillMeasures))
    : config.repetitions;

  // Some strategies need a one-shot computation reused across reps.
  let shuffledOnce: Chord[] | null = null;
  if (config.orderingStrategy === "randomShuffleOnce") {
    shuffledOnce = shuffle(config.pool);
  }

  const result: Chord[] = [];
  for (let r = 0; r < effectiveReps; r++) {
    const repChords = chordsForRep(config, shuffledOnce);
    result.push(...repChords);
  }
  return result;
}

/**
 * Produce the play-chord assignments for ONE repetition (length =
 * drillMeasures), applying the ordering strategy.
 */
function chordsForRep(
  config: SequenceConfig,
  shuffledOnce: Chord[] | null,
): Chord[] {
  const { pool, orderingStrategy, drillMeasures } = config;
  switch (orderingStrategy) {
    case "custom":
      return cycleThrough(pool, drillMeasures);
    case "chromaticAsc":
      return cycleThrough(sortChromatic(pool, "asc"), drillMeasures);
    case "chromaticDesc":
      return cycleThrough(sortChromatic(pool, "desc"), drillMeasures);
    case "cycleOf5ths":
      // Cycle of 5ths descending (= cycle of 4ths ascending) —
      // the canonical jazz drill direction (C → F → Bb → ...).
      return cycleThrough(
        sortByCycleOfFifths(pool, "descending"),
        drillMeasures,
      );
    case "cycleOf4ths":
      // Other direction (C → G → D → ...).
      return cycleThrough(
        sortByCycleOfFifths(pool, "ascending"),
        drillMeasures,
      );
    case "randomReplace": {
      const out: Chord[] = [];
      for (let m = 0; m < drillMeasures; m++) {
        out.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      return out;
    }
    case "randomShuffleOnce":
      // shuffledOnce is set once per session in buildPlayChords; every
      // rep here re-uses that same shuffle.
      return cycleThrough(shuffledOnce ?? pool, drillMeasures);
    case "randomShuffleEachPass":
      return sampleForRep(pool, drillMeasures);
  }
}

/**
 * Find the next chord that DIFFERS from the chord at the given beat
 * index, used to drive the NEXT preview on the drill screen.
 * Returns null if no different chord remains in the sequence.
 */
export function findNextDifferentChord(
  sequence: SequenceBeat[],
  fromIndex: number,
): Chord | null {
  if (fromIndex >= sequence.length) return null;
  const startChord = sequence[fromIndex]?.chord;
  if (!startChord) return null;
  for (let i = fromIndex + 1; i < sequence.length; i++) {
    if (!chordsEqual(sequence[i].chord, startChord)) return sequence[i].chord;
  }
  return null;
}

// --------------------------------------------------------------------
// Strategy helpers
// --------------------------------------------------------------------

function chordsEqual(a: Chord, b: Chord): boolean {
  return a.root === b.root && a.quality === b.quality;
}

/** Take `count` chords from an ordered pool, wrapping around at pool end. */
function cycleThrough(pool: Chord[], count: number): Chord[] {
  if (pool.length === 0) return [];
  const out: Chord[] = [];
  for (let i = 0; i < count; i++) out.push(pool[i % pool.length]);
  return out;
}

/**
 * Re-sort the pool chromatically, anchored to the FIRST pool chord —
 * so the user's first chord stays first and the rest follow in
 * chromatic order from there. Wraps around at the octave.
 */
function sortChromatic(
  pool: Chord[],
  direction: "asc" | "desc",
): Chord[] {
  if (pool.length === 0) return [];
  const anchor = PITCH_CLASS_TO_SEMITONE[pool[0].root];
  return [...pool].sort((a, b) => {
    const da = cyclicDistance(
      PITCH_CLASS_TO_SEMITONE[a.root],
      anchor,
      direction,
    );
    const db = cyclicDistance(
      PITCH_CLASS_TO_SEMITONE[b.root],
      anchor,
      direction,
    );
    return da - db;
  });
}

/**
 * Cycle-of-5ths position table — descending fifths order (the
 * canonical jazz drill direction): C, F, Bb, Eb, Ab, Db, Gb, B, E, A,
 * D, G. "Descending" cycle = step DOWN a perfect 5th each time
 * (equivalently, UP a perfect 4th).
 */
const CYCLE_OF_FIFTHS_DESC_POSITION: Record<PitchClass, number> = {
  C: 0,
  F: 1,
  "A#": 2,
  "D#": 3,
  "G#": 4,
  "C#": 5,
  "F#": 6,
  B: 7,
  E: 8,
  A: 9,
  D: 10,
  G: 11,
};

/**
 * Re-sort the pool by cycle-of-fifths position, anchored to the first
 * pool chord. "descending" walks the canonical jazz cycle (ii-V-I
 * friendly: Dm7 G7 Cmaj7 stays in that order); "ascending" walks the
 * opposite direction (C → G → D → A).
 */
function sortByCycleOfFifths(
  pool: Chord[],
  direction: "ascending" | "descending",
): Chord[] {
  if (pool.length === 0) return [];
  const anchor = CYCLE_OF_FIFTHS_DESC_POSITION[pool[0].root];
  return [...pool].sort((a, b) => {
    const da = cyclicDistance(
      CYCLE_OF_FIFTHS_DESC_POSITION[a.root],
      anchor,
      direction === "descending" ? "asc" : "desc",
    );
    const db = cyclicDistance(
      CYCLE_OF_FIFTHS_DESC_POSITION[b.root],
      anchor,
      direction === "descending" ? "asc" : "desc",
    );
    return da - db;
  });
}

/** Cyclic distance from anchor to position, 0..11. */
function cyclicDistance(
  position: number,
  anchor: number,
  direction: "asc" | "desc",
): number {
  return direction === "asc"
    ? mod(position - anchor, 12)
    : mod(anchor - position, 12);
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * One rep's worth of chords: shuffle the pool, take up to drillMeasures.
 * Pool smaller than drill length → shuffled order loops to fill.
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
