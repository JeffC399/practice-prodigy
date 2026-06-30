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
 * Phase 25.2 — chord at a specific beat position within a measure.
 *
 * Replaces the flat `Chord[]` model (which capped at 1-2 chords per
 * measure with an implicit downbeat / half-bar split). Per-beat
 * positioning lets users author real jazz harmonies (every beat = a
 * different chord) and matches standard engraving / Sibelius / Dorico
 * conventions.
 */
export type ChordBeat = {
  chord: Chord;
  /** 1-indexed beat position within the measure (1 = downbeat). */
  beat: number;
  /** Optional slash-chord bass override (e.g. C/E → bass: "E"). */
  bass?: PitchClass;
};

/**
 * Phase 28 — form-marking instruction text rendered above the staff
 * (above the chord band). One per measure.
 */
export const SHEET_INSTRUCTIONS = [
  "dc-al-fine",
  "ds-al-coda",
  "to-coda",
  "fine",
] as const;
export type SheetInstruction = (typeof SHEET_INSTRUCTIONS)[number];

export const INSTRUCTION_LABELS: Record<SheetInstruction, string> = {
  "dc-al-fine": "D.C. al Fine",
  "ds-al-coda": "D.S. al Coda",
  "to-coda": "To Coda",
  fine: "Fine",
};

/** Visual mark symbols (Coda 𝄌 / Segno 𝄋). Placed above a measure. */
export const SHEET_MARKS = ["coda", "segno"] as const;
export type SheetMark = (typeof SHEET_MARKS)[number];

export const MARK_LABELS: Record<SheetMark, string> = {
  coda: "Coda",
  segno: "Segno",
};

/**
 * One measure of the sheet. Carries chords + an optional melody line.
 */
export type SheetMeasure = {
  /** Stable id for drag-reorder / animation. */
  id: string;
  /**
   * Phase 25.2: per-beat chord positions. Each ChordBeat carries the
   * chord and the 1-indexed beat it starts on. Multiple chords per
   * measure with explicit beats supports full jazz harmonic vocabulary.
   * Sorted by beat at render time.
   */
  chords: ChordBeat[];
  /**
   * Optional melody line (Phase 24b). Empty array = no melody for
   * this measure (renderer draws an empty staff). Notes + rests
   * render in sequence; the renderer doesn't enforce total beat
   * count matching the time signature (user can author measures
   * that overflow or under-fill the bar — useful for pickups /
   * partial bars later).
   */
  melody?: MelodyNote[];
  /** Phase 28: 𝄆 at the start of this measure. */
  repeatStart?: boolean;
  /** Phase 28: 𝄇 at the end of this measure. */
  repeatEnd?: boolean;
  /**
   * Phase 28: volta bracket number. Each measure that's part of a
   * "1st ending" carries volta: 1; "2nd ending" carries volta: 2. The
   * renderer draws a single bracket spanning the contiguous run.
   */
  volta?: number;
  /** Phase 28: instruction text above the staff. */
  instruction?: SheetInstruction;
  /** Phase 28: visual mark (Coda or Segno) above the staff. */
  mark?: SheetMark;
  /**
   * Phase 28: section label rendered above the first measure of a
   * section (e.g. "A", "Verse", "Chorus", "Bridge", custom).
   */
  sectionLabel?: string;
};

/**
 * Free-text style indicator. Common examples: "Medium Swing", "Bossa
 * Nova", "Ballad", "Funk", "Rock — Halftime". Free text by design
 * since the vocabulary is open-ended.
 */
export type SheetStyle = string;

/**
 * Phase 25.0.2 — visual font style for the lead sheet.
 *
 *   - "standard":    classic serif engraving (Georgia / Times New Roman).
 *                    Cleanest, most legible. Default.
 *   - "handwritten": Real-Book / iReal-Pro style handwritten block-print
 *                    via Patrick Hand. Adds personality + jazz authenticity.
 *
 * Per-sheet (not per-user) — the font is part of the chart's aesthetic
 * and travels with the sheet when shared.
 */
export const SHEET_FONT_STYLES = ["standard", "handwritten"] as const;
export type SheetFontStyle = (typeof SHEET_FONT_STYLES)[number];

/**
 * Phase 27.1 — instrument voices for live audio playback. Per-sheet
 * because the pairing is part of the chart's identity (bossa wants
 * guitar + flute; jazz wants piano + sax; rock wants electric guitar
 * + voice). Strings via smplr's sample library; "synth" keeps the
 * original Tone.js synth voice as a fast / low-bandwidth fallback.
 */
export const CHORD_VOICES = [
  "piano",
  "epiano",
  "guitar",
  "vibes",
  "strings",
  "synth",
] as const;
export type ChordVoice = (typeof CHORD_VOICES)[number];

export const MELODY_VOICES = [
  "piano",
  "voice",
  "sax",
  "flute",
  "strings",
  "guitar",
  "synth",
] as const;
export type MelodyVoice = (typeof MELODY_VOICES)[number];

export const CHORD_VOICE_LABELS: Record<ChordVoice, string> = {
  piano: "Acoustic Piano",
  epiano: "Electric Piano",
  guitar: "Acoustic Guitar",
  vibes: "Vibraphone",
  strings: "Strings",
  synth: "Synth",
};

export const MELODY_VOICE_LABELS: Record<MelodyVoice, string> = {
  piano: "Acoustic Piano",
  voice: "Voice (Aah)",
  sax: "Saxophone",
  flute: "Flute",
  strings: "Strings",
  guitar: "Acoustic Guitar",
  synth: "Synth",
};

/**
 * Phase 27.1 — per-voice mixer state. Volume is in dB (0 = unity,
 * -inf to ~+6). Muted overrides volume.
 */
export type SheetMixer = {
  chordVolume: number;
  chordMuted: boolean;
  melodyVolume: number;
  melodyMuted: boolean;
};

export const DEFAULT_SHEET_MIXER: SheetMixer = {
  chordVolume: -4,
  chordMuted: false,
  melodyVolume: 0,
  melodyMuted: false,
};

export type Sheet = {
  id: string;
  /** Display title. */
  title: string;
  /** Composer name (often "Trad." or a band name). */
  composer?: string;
  /**
   * Phase 27.1.2 — Lyricist credit. When composer + lyricist are both
   * set and distinct, the renderer shows "Music by ___" / "Words by ___"
   * stacked. When they're the same person, it shows "Music and Lyrics
   * by ___". When only one is set, plain name.
   */
  lyricist?: string;
  /**
   * Phase 27.1.3 — Arranger credit. Renders as "arr. by ___" below the
   * composer / lyricist credit. Common on jazz charts.
   */
  arranger?: string;
  /**
   * Phase 27.1.3 — Source attribution. Renders as a small italic
   * subtitle below the title (e.g. "from the musical Carousel" or
   * "from the album Kind of Blue").
   */
  source?: string;
  /**
   * Phase 27.1.3 — Copyright line. Renders small at the bottom-right
   * of the title block (e.g. "© 2026 Smith Music Co.").
   */
  copyright?: string;
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
  /** Phase 25.0.2: visual font style. Defaults to "standard". */
  fontStyle?: SheetFontStyle;
  /** Phase 27.1: instrument voice for chord comping during playback. */
  chordVoice?: ChordVoice;
  /** Phase 27.1: instrument voice for melody during playback. */
  melodyVoice?: MelodyVoice;
  /** Phase 27.1: per-voice mixer state (volume + mute). */
  mixer?: SheetMixer;
  /** Phase 27.1b: schedule 1 measure of count-in clicks before playback. */
  countIn?: boolean;
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
