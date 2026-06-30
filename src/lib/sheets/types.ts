import type { Chord, PitchClass } from "@/lib/music/chord";

/**
 * Lead-sheet types.
 *
 * Phase 24a shipped chord-chart only. Phase 24b adds melody (notes +
 * rests) per measure, rendered via VexFlow. Phase 24c (this slice)
 * adds optional per-note lyric syllables with hyphen / underscore
 * continuation. Subsequent phases:
 *   24b.4: Cross-measure ties + slurs
 *   24d:  Form markings (repeats, endings, D.C., D.S., Coda, Segno)
 *   24e:  Share via URL-encoded JSON
 */

/** Scale / mode for the key indicator. */
export const SHEET_KEY_MODES = ["major", "minor"] as const;
export type SheetKeyMode = (typeof SHEET_KEY_MODES)[number];

/** Sheet-level time signature (single per piece in Basic Tier). */
export type SheetTimeSignature = {
  beatsPerMeasure: number;
  beatUnit: number;
};

/**
 * Note duration vocabulary for melody notes + rests. Maps directly
 * to VexFlow's duration strings ("w" / "h" / "q" / "8" / "16").
 * v0.1 of the melody slice ships these five durations + an optional
 * dotted modifier per note. Triplets / ties land in Phase 24b.2.
 */
export const MELODY_DURATIONS = ["w", "h", "q", "8", "16"] as const;
export type MelodyDuration = (typeof MELODY_DURATIONS)[number];

export const MELODY_DURATION_LABELS: Record<MelodyDuration, string> = {
  w: "Whole",
  h: "Half",
  q: "Quarter",
  "8": "Eighth",
  "16": "Sixteenth",
};

/**
 * Beat values per duration (quarter = 1 beat reference).
 * Multiply by 1.5 when `dotted` is true.
 */
export const MELODY_DURATION_BEATS: Record<MelodyDuration, number> = {
  w: 4,
  h: 2,
  q: 1,
  "8": 0.5,
  "16": 0.25,
};

/**
 * VexFlow-style key string. Letter + accidental + octave, e.g. "c/4",
 * "f#/5", "bb/3". Accidentals: "#" (sharp), "b" (flat), "n" (natural).
 * Octave 4 = middle C octave (so "c/4" = middle C, "a/4" = A above middle C).
 */
export type MelodyPitch = string;

/**
 * Phase 24c — a lyric syllable attached to a pitched note.
 *
 * `text` is the syllable as the user typed it. The renderer strips
 * any trailing continuation marker before drawing — the marker is
 * captured separately so the engraving can render the standard
 * convention (trailing dash for "love-", a horizontal line for
 * the melisma "ah_").
 *
 * Continuation semantics:
 *   - "none":       terminal syllable (default for single-word notes
 *                   and the last syllable of a hyphenated word).
 *   - "hyphen":     this syllable continues into the next pitched
 *                   note's syllable (e.g. "love" then "ly").
 *                   Rendered with a trailing dash.
 *   - "underscore": melisma — this syllable extends across the next
 *                   pitched note(s) until the next syllable or end
 *                   of melody. Rendered with a horizontal line.
 */
export type LyricSyllable = {
  text: string;
  continuation: "none" | "hyphen" | "underscore";
};

export type MelodyNote =
  | {
      kind: "note";
      pitch: MelodyPitch;
      duration: MelodyDuration;
      /** Dotted note: duration * 1.5. */
      dotted?: boolean;
      /**
       * Phase 24b.2: tie this note to the next note. v0.1 only renders
       * the tie when both notes are within the same measure. Cross-
       * measure ties land in Phase 24b.4 (multi-measure render
       * coordination required).
       */
      tieToNext?: boolean;
      /**
       * Phase 24b.2: tuplet group. Consecutive notes with the same
       * non-null group id form a tuplet (e.g. group "t1" with 3
       * notes = triplet). The renderer wraps them in a VexFlow
       * Tuplet automatically. v0.1 only supports triplets (groups of
       * 3); quintuplets / sextuplets land later.
       */
      tupletGroup?: string;
      /**
       * Phase 24c: optional lyric syllable attached to this note.
       * Only pitched notes carry lyrics — rests skip the cursor and
       * never hold a syllable. Tied "follower" notes (the second-
       * and-later notes of a tied chain) also skip the cursor and
       * inherit the previous note's syllable visually via the tie.
       */
      lyric?: LyricSyllable;
    }
  | {
      kind: "rest";
      duration: MelodyDuration;
      dotted?: boolean;
      tupletGroup?: string;
    };

/**
 * One measure of the sheet. Carries chords + an optional melody line.
 */
export type SheetMeasure = {
  /** Stable id for drag-reorder / animation. */
  id: string;
  /**
   * Chords played during this measure. v0.1 allows 1 or 2 chords per
   * measure (most common cases); the renderer splits the bar in half
   * for 2-chord measures. Future versions extend to N chords with
   * explicit beat positions.
   */
  chords: Chord[];
  /**
   * Optional melody line (Phase 24b). Empty array = no melody for
   * this measure (renderer draws an empty staff). Notes + rests
   * render in sequence; the renderer doesn't enforce total beat
   * count matching the time signature (user can author measures
   * that overflow or under-fill the bar — useful for pickups /
   * partial bars later).
   */
  melody?: MelodyNote[];
};

/**
 * Free-text style indicator. Common examples: "Medium Swing", "Bossa
 * Nova", "Ballad", "Funk", "Rock — Halftime". Free text by design
 * since the vocabulary is open-ended.
 */
export type SheetStyle = string;

export type Sheet = {
  id: string;
  /** Display title. */
  title: string;
  /** Composer name (often "Trad." or a band name). */
  composer?: string;
  /** Free-text style indicator. */
  style?: SheetStyle;
  /** Optional explicit tempo. */
  bpm?: number;
  /** Key signature: tonic + mode (e.g. "C major" or "F# minor"). */
  keyTonic: PitchClass;
  keyMode: SheetKeyMode;
  /** Time signature (single per piece). */
  timeSignature: SheetTimeSignature;
  /** Ordered list of measures. */
  measures: SheetMeasure[];
  createdAt: number;
  updatedAt: number;
  /** Last time the sheet was opened. */
  lastOpenedAt?: number;
};

export function newSheetId(): string {
  return `sheet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newMeasureId(): string {
  return `mes_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a fresh tuplet group id (Phase 24b.2). */
export function newTupletGroupId(): string {
  return `tup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Default sheet for the "new sheet" CTA. */
export function makeDefaultSheet(): Omit<Sheet, "id" | "createdAt" | "updatedAt"> {
  return {
    title: "Untitled lead sheet",
    composer: undefined,
    style: undefined,
    bpm: undefined,
    keyTonic: "C",
    keyMode: "major",
    timeSignature: { beatsPerMeasure: 4, beatUnit: 4 },
    // Start with 8 empty measures — common phrase length, easy to
    // extend or trim.
    measures: Array.from({ length: 8 }, () => ({
      id: newMeasureId(),
      chords: [],
      melody: [],
    })),
  };
}
