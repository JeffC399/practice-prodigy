/**
 * Core chord data model for Practice Prodigy.
 *
 * A chord is the combination of a root pitch class and a quality. This module
 * defines the v1 vocabulary (Tier D per PROJECT-DESIGN.md §4.2) and the
 * display-name maps used by setup-screen pickers. Symbol rendering lives in
 * its own `render-chord` module so that adding notation styles (jazz-minus,
 * lowercase-m, plain ASCII, long form, Roman numeral...) is purely additive.
 */

export const PITCH_CLASSES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export type PitchClass = (typeof PITCH_CLASSES)[number];

/**
 * Tier D chord vocabulary — 20 qualities covering triads, 7ths, sus chords,
 * 9th/13th extensions, and altered dominants. Locked in PROJECT-DESIGN.md §4.2.
 */
export const CHORD_QUALITIES = [
  "maj",
  "min",
  "aug",
  "dom7",
  "min7",
  "maj7",
  "halfDim7",
  "dim7",
  "sus2",
  "sus4",
  "7sus4",
  "maj9",
  "min9",
  "dom9",
  "dom13",
  "dom7b9",
  "dom7sharp9",
  "dom7alt",
  "dom7b5",
  "dom7sharp5",
] as const;

export type ChordQuality = (typeof CHORD_QUALITIES)[number];

export type Chord = {
  root: PitchClass;
  quality: ChordQuality;
};

/**
 * Human-readable names used in the quality picker. These are the labels the
 * user picks from — distinct from how the chord is *rendered* on the practice
 * screen, which is controlled by the configurable notation style (see
 * `render-chord.ts`).
 */
export const QUALITY_DISPLAY_NAMES: Record<ChordQuality, string> = {
  maj: "Major",
  min: "Minor",
  aug: "Augmented",
  dom7: "Dominant 7",
  min7: "Minor 7",
  maj7: "Major 7",
  halfDim7: "Half-Diminished (ø7)",
  dim7: "Diminished 7 (°7)",
  sus2: "Suspended 2",
  sus4: "Suspended 4",
  "7sus4": "7sus4",
  maj9: "Major 9",
  min9: "Minor 9",
  dom9: "Dominant 9",
  dom13: "Dominant 13",
  dom7b9: "Dominant 7♭9",
  dom7sharp9: "Dominant 7♯9",
  dom7alt: "Dominant 7alt",
  dom7b5: "Dominant 7♭5",
  dom7sharp5: "Dominant 7♯5",
};

/**
 * Display labels for pitch classes. Sharps are shown with the Unicode sharp
 * sign (♯) rather than the ASCII "#" so the picker reads cleanly. The
 * underlying value stays as the ASCII form (`C#` etc.) for storage / sharing.
 */
export const PITCH_CLASS_DISPLAY_NAMES: Record<PitchClass, string> = {
  C: "C",
  "C#": "C♯ / D♭",
  D: "D",
  "D#": "D♯ / E♭",
  E: "E",
  F: "F",
  "F#": "F♯ / G♭",
  G: "G",
  "G#": "G♯ / A♭",
  A: "A",
  "A#": "A♯ / B♭",
  B: "B",
};
