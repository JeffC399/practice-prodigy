/**
 * Custom-pattern types + shared labels.
 *
 * Phase 14 extended the data model with rhythmic information:
 *  - each note carries an explicit `duration`
 *  - notes can be rests (silence) via the `kind: "rest"` discriminator
 *  - patterns carry a `lengthInMeasures` so multi-bar phrases are first-class
 *
 * Phase 13 introduced the engine with absolute semitone offsets from the
 * chord root (per the "Chord tones + scale tones" model). That stays the
 * same; we're just layering rhythm on top.
 */

/**
 * Note duration vocabulary. Stored as an enum (not raw beat counts) so
 * the editor's picker can render musical labels and the migration code
 * has a closed set of values to validate.
 *
 * Beat values assume a "quarter = 1 beat" convention regardless of the
 * drill's time-signature denominator. This matches how musicians talk
 * about durations ("an eighth note is half a beat") and avoids tying
 * pattern timing to the drill's beatUnit.
 */
export const NOTE_DURATIONS = [
  "16th",
  "8th",
  "dotted8th",
  "quarter",
  "dottedQuarter",
  "half",
  "dottedHalf",
  "whole",
] as const;

export type NoteDuration = (typeof NOTE_DURATIONS)[number];

export const NOTE_DURATION_BEATS: Record<NoteDuration, number> = {
  "16th": 0.25,
  "8th": 0.5,
  "dotted8th": 0.75,
  "quarter": 1,
  "dottedQuarter": 1.5,
  "half": 2,
  "dottedHalf": 3,
  "whole": 4,
};

export const NOTE_DURATION_LABELS: Record<NoteDuration, string> = {
  "16th": "16th",
  "8th": "8th",
  "dotted8th": "8th.",
  "quarter": "qtr",
  "dottedQuarter": "qtr.",
  "half": "half",
  "dottedHalf": "half.",
  "whole": "whole",
};

/** Default duration assigned to a freshly-tapped note in the editor. */
export const DEFAULT_NOTE_DURATION: NoteDuration = "quarter";

/**
 * A single pattern position. Discriminated union: a "note" carries an
 * absolute semitone offset from the chord root (0..12) and a duration;
 * a "rest" carries only a duration (silence for that many beats).
 */
export type PatternNote =
  | { kind: "note"; semitones: number; duration: NoteDuration }
  | { kind: "rest"; duration: NoteDuration };

export type CustomPattern = {
  id: string;
  name: string;
  notes: PatternNote[];
  /**
   * Pattern length in measures (1, 2, or 4 for v1). The lit-up subtitle
   * highlights one full pattern per `lengthInMeasures` of drill time.
   * If the sum of note durations doesn't equal lengthInMeasures × beatsPerMeasure,
   * the engine still uses lengthInMeasures as the loop boundary -- shorter
   * patterns leave trailing silence, longer patterns get clipped.
   */
  lengthInMeasures: number;
  createdAt: number;
  updatedAt: number;
};

/** Allowed values for the editor's length picker. v1 sticks to powers of 2. */
export const CUSTOM_PATTERN_LENGTHS = [1, 2, 4] as const;
export type CustomPatternLength = (typeof CUSTOM_PATTERN_LENGTHS)[number];

/**
 * Display label per semitone offset, 0..12. Jazz idiom (♭5 over ♯4,
 * ♭6 over ♯5) — these are the labels musicians use when talking about
 * altered chord extensions. The picker grid renders these as buttons;
 * the drill subtitle renders them lit-up on the beat.
 */
export const SEMITONE_LABELS: readonly string[] = [
  "1", // 0  — root
  "♭2", // 1
  "2", // 2
  "♭3", // 3
  "3", // 4
  "4", // 5
  "♭5", // 6
  "5", // 7
  "♭6", // 8
  "6", // 9
  "♭7", // 10
  "7", // 11
  "8", // 12 — octave
];

/**
 * Secondary annotation shown beneath each picker button (the enharmonic
 * spelling). Lets bassists fluent in either idiom recognize the
 * interval — ♭5 and ♯4 are the same pitch, but a transcribed phrase
 * might use either.
 */
export const SEMITONE_ALT_LABELS: readonly (string | null)[] = [
  null, // 1
  "♯1", // ♭2
  null, // 2
  "♯2", // ♭3
  null, // 3
  null, // 4
  "♯4", // ♭5
  null, // 5
  "♯5", // ♭6
  null, // 6
  "♯6", // ♭7
  null, // 7
  "oct", // 8
];

/** v1 range: root through octave-up, inclusive. */
export const SEMITONE_MIN = 0;
export const SEMITONE_MAX = 12;

/** Rest glyph used in the editor chip + subtitle display. */
export const REST_LABEL = "—";

/** Max notes (including rests) in a single custom pattern. */
export const CUSTOM_PATTERN_MAX_NOTES = 32;

/** Pattern IDs are prefixed so we can route built-ins vs. customs. */
const CUSTOM_PATTERN_ID_PREFIX = "custom_";

export function isCustomPatternId(id: string): boolean {
  return id.startsWith(CUSTOM_PATTERN_ID_PREFIX);
}

export function newCustomPatternId(): string {
  return `${CUSTOM_PATTERN_ID_PREFIX}${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Render a list of PatternNotes as a dash-joined degree string, e.g.
 * `[note 0, note 3, note 7, note 10]` → "1-♭3-5-♭7". Rests render as
 * the rest glyph. Used for the drill-screen subtitle in degrees mode.
 */
export function notesToDegreeString(notes: PatternNote[]): string {
  return notes
    .map((n) => {
      if (n.kind === "rest") return REST_LABEL;
      return SEMITONE_LABELS[n.semitones] ?? "?";
    })
    .join("-");
}

/** Total beat length of a pattern (sum of note durations). */
export function totalBeatLength(notes: PatternNote[]): number {
  return notes.reduce((acc, n) => acc + NOTE_DURATION_BEATS[n.duration], 0);
}
