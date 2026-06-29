import type { Chord, ChordQuality, PitchClass } from "./chord";

/**
 * Chord-symbol rendering for Practice Prodigy.
 *
 * Four user-selectable notation styles ship in v1 (PROJECT-DESIGN.md §4.2),
 * wired through the standard cascade. The rendering layer is intentionally
 * pluggable — adding a fifth style (e.g. Roman numeral / Nashville) is a
 * new suffix table + a new dispatch arm.
 */

export const CHORD_NOTATION_STYLES = [
  "jazz-minus",
  "lowercase-m",
  "plain-ascii",
  "shorthand",
  "long-form",
] as const;

export type ChordNotationStyle = (typeof CHORD_NOTATION_STYLES)[number];

/**
 * Example chord in each style — chosen so the four styles read
 * VISIBLY different in the dropdown. Earlier versions used `Am7`
 * across the board, which renders identically in lowercase-m and
 * plain-ASCII (they only diverge on unicode flats/sharps and on
 * major-7 spelling). B♭m7♭5 / Bbm7b5 vs B−7 vs B minor 7 makes the
 * distinction obvious at a glance.
 */
export const NOTATION_STYLE_DISPLAY_NAMES: Record<ChordNotationStyle, string> =
  {
    "jazz-minus": "Jazz (B−7)",
    "lowercase-m": "Jazz lowercase-m (B♭m7♭5)",
    "plain-ascii": "Plain ASCII (Bbm7b5)",
    "shorthand": "Shorthand (B min 7)",
    "long-form": "Long form (B minor 7)",
  };

/** Suffix tables — one row per quality, one column per style. */
const JAZZ_MINUS_SUFFIX: Record<ChordQuality, string> = {
  maj: "",
  min: "−",
  aug: "+",
  dom7: "7",
  min7: "−7",
  maj7: "maj7",
  halfDim7: "ø7",
  dim7: "°7",
  sus2: "sus2",
  sus4: "sus4",
  "7sus4": "7sus4",
  maj9: "maj9",
  min9: "−9",
  dom9: "9",
  dom13: "13",
  dom7b9: "7♭9",
  dom7sharp9: "7♯9",
  dom7alt: "7alt",
  dom7b5: "7♭5",
  dom7sharp5: "7♯5",
};

const LOWERCASE_M_SUFFIX: Record<ChordQuality, string> = {
  maj: "",
  min: "m",
  aug: "aug",
  dom7: "7",
  min7: "m7",
  maj7: "maj7",
  halfDim7: "m7♭5",
  dim7: "dim7",
  sus2: "sus2",
  sus4: "sus4",
  "7sus4": "7sus4",
  maj9: "maj9",
  min9: "m9",
  dom9: "9",
  dom13: "13",
  dom7b9: "7♭9",
  dom7sharp9: "7♯9",
  dom7alt: "7alt",
  dom7b5: "7♭5",
  dom7sharp5: "7♯5",
};

const PLAIN_ASCII_SUFFIX: Record<ChordQuality, string> = {
  maj: "",
  min: "m",
  aug: "aug",
  dom7: "7",
  min7: "m7",
  maj7: "M7",
  halfDim7: "m7b5",
  dim7: "dim7",
  sus2: "sus2",
  sus4: "sus4",
  "7sus4": "7sus4",
  maj9: "M9",
  min9: "m9",
  dom9: "9",
  dom13: "13",
  dom7b9: "7b9",
  dom7sharp9: "7#9",
  dom7alt: "7alt",
  dom7b5: "7b5",
  dom7sharp5: "7#5",
};

/**
 * Shorthand: abbreviated long-form. Reads like spoken English minus
 * the long words — "C min 7" instead of "C minor 7". Slots between
 * Lowercase-m (very compact, runs together) and Long form (verbose
 * full words). The Real Book and many pedagogy texts use this style.
 * Spaces separate the root from the quality so the reader can scan
 * "C - min - 7" at a glance.
 */
const SHORTHAND_SUFFIX: Record<ChordQuality, string> = {
  maj: "",
  min: " min",
  aug: " aug",
  dom7: " dom 7",
  min7: " min 7",
  maj7: " maj 7",
  halfDim7: " half-dim 7",
  dim7: " dim 7",
  sus2: " sus 2",
  sus4: " sus 4",
  "7sus4": " dom 7 sus 4",
  maj9: " maj 9",
  min9: " min 9",
  dom9: " dom 9",
  dom13: " dom 13",
  dom7b9: " dom 7♭9",
  dom7sharp9: " dom 7♯9",
  dom7alt: " dom 7 alt",
  dom7b5: " dom 7♭5",
  dom7sharp5: " dom 7♯5",
};

/**
 * Long-form: a leading space separates root from quality words (the root
 * renders as "C", not "Cmajor"), but extension digits attach to the
 * preceding word for jazz convention ("major 7", not "major7").
 */
const LONG_FORM_SUFFIX: Record<ChordQuality, string> = {
  maj: " major",
  min: " minor",
  aug: " augmented",
  dom7: " dominant 7",
  min7: " minor 7",
  maj7: " major 7",
  halfDim7: " half-diminished 7",
  dim7: " diminished 7",
  sus2: " suspended 2",
  sus4: " suspended 4",
  "7sus4": " dominant 7 suspended 4",
  maj9: " major 9",
  min9: " minor 9",
  dom9: " dominant 9",
  dom13: " dominant 13",
  dom7b9: " dominant 7♭9",
  dom7sharp9: " dominant 7♯9",
  dom7alt: " dominant 7 altered",
  dom7b5: " dominant 7♭5",
  dom7sharp5: " dominant 7♯5",
};

/** Plain ASCII keeps the raw `#`; all other styles prefer the Unicode `♯`. */
function renderRoot(root: PitchClass, style: ChordNotationStyle): string {
  if (style === "plain-ascii") return root;
  return root.replace("#", "♯");
}

export function renderChord(chord: Chord, style: ChordNotationStyle): string {
  const root = renderRoot(chord.root, style);
  switch (style) {
    case "jazz-minus":
      return `${root}${JAZZ_MINUS_SUFFIX[chord.quality]}`;
    case "lowercase-m":
      return `${root}${LOWERCASE_M_SUFFIX[chord.quality]}`;
    case "plain-ascii":
      return `${root}${PLAIN_ASCII_SUFFIX[chord.quality]}`;
    case "shorthand":
      return `${root}${SHORTHAND_SUFFIX[chord.quality]}`;
    case "long-form":
      return `${root}${LONG_FORM_SUFFIX[chord.quality]}`;
  }
}
