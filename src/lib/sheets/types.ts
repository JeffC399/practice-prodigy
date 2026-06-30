import type { Chord, PitchClass } from "@/lib/music/chord";

/**
 * Lead-sheet types — Phase 24a MVP scope: chord-chart-only.
 *
 * No melody, no lyrics, no form markings yet. Each Sheet has metadata
 * + an ordered list of measures, each measure carrying chord(s) for
 * that bar. Reuses the existing Chord type so chord-vocabulary
 * features (notation styles, chord-to-scale mapping) work for free.
 *
 * Future phases (per LEAD-SHEET-DESIGN.md):
 *   24b: VexFlow melody engraving
 *   24c: Lyrics
 *   24d: Form markings (repeats, endings, D.C., D.S., Coda, Segno)
 *   24e: Share via URL-encoded JSON
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
 * One measure of the sheet. Carries 1..N chords (e.g. "two chords per
 * bar" is common in jazz). When empty, the measure renders as "N.C."
 * (no chord) or just blank depending on the display mode.
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
    })),
  };
}
