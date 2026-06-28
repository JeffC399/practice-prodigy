import type { Chord } from "./chord";
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
 *                    root before they have to play. (Configured via
 *                    transitionUnit + transitionCount in PracticeConfig.)
 *
 * Drilling is structured as repetitions × drill-length (measures);
 * each play measure expands to beatsPerMeasure play beats. Between
 * consecutive different chords, transitionBeats of "transition" kind
 * are inserted so the user has prep time.
 *
 * For deterministic strategies the pool cycles in order. For
 * randomizeChords=true we sample fresh on every repetition (the user
 * explicitly chose that semantic over "sample once and replay"). The
 * other 6 ordering strategies are stubbed to defer to "custom"; only
 * this module changes when they're implemented.
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
  randomizeChords: boolean;
  /** Used to expand each play measure into beatsPerMeasure beats. */
  timeSignature: TimeSignature;
  transitionUnit: TransitionUnit;
  transitionCount: number;
};

/**
 * Cap on the number of MEASURES we pre-generate when the user selects
 * "Loop until stopped." Functionally infinite for any normal session
 * (multi-hours at typical tempos / meters). Note this is a MEASURE
 * cap — the beat count of the generated sequence will be larger.
 */
export const INDEFINITE_MEASURE_BUFFER = 4096;

/**
 * Produce the full beat-per-tick sequence for a drill. The drill
 * screen regenerates this on every Start so randomized drills get
 * fresh sampling each session.
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
    // Insert transition BEFORE this chord — only on actual chord
    // changes (skips when the same chord repeats), and never before
    // the very first chord (the engine-level count-in covers that
    // initial prep window).
    if (
      transitionBeats > 0 &&
      prevChord !== null &&
      !chordsEqual(prevChord, chord)
    ) {
      for (let b = 0; b < transitionBeats; b++) {
        result.push({ chord, kind: "transition" });
      }
    }
    // Each play measure expands to beatsPerMeasure play beats.
    for (let b = 0; b < beatsPerMeasure; b++) {
      result.push({ chord, kind: "play" });
    }
    prevChord = chord;
  }
  return result;
}

/**
 * Build the per-measure play assignments (one Chord per measure of
 * actual playing). Length = drillMeasures × effective-reps. Doesn't
 * know about transitions — that's the caller's job to interleave.
 */
function buildPlayChords(config: SequenceConfig): Chord[] {
  const effectiveReps = config.repeatIndefinitely
    ? Math.max(1, Math.ceil(INDEFINITE_MEASURE_BUFFER / config.drillMeasures))
    : config.repetitions;
  const result: Chord[] = [];
  for (let r = 0; r < effectiveReps; r++) {
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

function chordsEqual(a: Chord, b: Chord): boolean {
  return a.root === b.root && a.quality === b.quality;
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
