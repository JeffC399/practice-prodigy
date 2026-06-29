/**
 * Custom-pattern types + shared labels.
 *
 * Phase 13 introduces user-authored patterns. Each `PatternNote` is an
 * absolute semitone offset from the chord root (0 = root, 12 = octave),
 * same model as the built-in patterns' internal representation. This
 * keeps the engine symmetric — built-ins and customs both reduce to a
 * list of semitone offsets fed to `semitoneToMidi`.
 *
 * The chord-tone label palette (`SEMITONE_LABELS`) is the canonical
 * naming used both by the editor's picker grid and the drill screen's
 * "degrees" subtitle.
 */

export type PatternNote = {
  /**
   * Semitone offset from the chord root, 0..12. v1 constrains to a
   * single octave (root through octave-up); higher extensions like
   * the 9th, 11th, 13th can land in a later slice.
   */
  semitones: number;
};

export type CustomPattern = {
  id: string;
  name: string;
  notes: PatternNote[];
  createdAt: number;
  updatedAt: number;
};

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

/** Max notes in a single custom pattern. 16 is enough for a bar of */
/* 16ths in 4/4 — plenty for v1 patterns. */
export const CUSTOM_PATTERN_MAX_NOTES = 16;

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
 * `[{semitones:0},{semitones:3},{semitones:7},{semitones:10}]` →
 * "1-♭3-5-♭7". Used for the drill-screen subtitle in degrees mode.
 */
export function notesToDegreeString(notes: PatternNote[]): string {
  return notes
    .map((n) => SEMITONE_LABELS[n.semitones] ?? "?")
    .join("-");
}
