import type { Chord, ChordQuality, PitchClass } from "./chord";

/**
 * Chord-symbol rendering for Practice Prodigy.
 *
 * v1 will ship four user-selectable notation styles (jazz-minus, lowercase-m
 * jazz, plain ASCII, long form) wired through the standard cascade. This
 * module is intentionally pluggable — adding a fifth style (e.g. Roman
 * numeral / Nashville) is a new function + a new entry in the dispatch map.
 *
 * Current slice (B1) ships ONLY jazz-minus. The other three styles are
 * stubbed to defer cleanly to jazz-minus until the renderer expansion slice.
 */

export const CHORD_NOTATION_STYLES = [
  "jazz-minus",
  "lowercase-m",
  "plain-ascii",
  "long-form",
] as const;

export type ChordNotationStyle = (typeof CHORD_NOTATION_STYLES)[number];

export const NOTATION_STYLE_DISPLAY_NAMES: Record<ChordNotationStyle, string> =
  {
    "jazz-minus": "Jazz (A−7)",
    "lowercase-m": "Jazz lowercase-m (Am7)",
    "plain-ascii": "Plain ASCII (Am7)",
    "long-form": "Long form (A minor 7)",
  };

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

/** Display sharps with the Unicode sharp symbol for visual cleanliness. */
function prettyRoot(root: PitchClass): string {
  return root.replace("#", "♯");
}

export function renderJazzMinus(chord: Chord): string {
  return `${prettyRoot(chord.root)}${JAZZ_MINUS_SUFFIX[chord.quality]}`;
}

/**
 * Pluggable dispatch. Styles other than jazz-minus currently route through
 * `renderJazzMinus` — the B2 slice will implement them properly. Doing it
 * this way means the rest of the app (setup form, drill screen, future
 * sequence views) can already call `renderChord(chord, style)` against the
 * stable API; only this file changes when the additional styles land.
 */
export function renderChord(chord: Chord, style: ChordNotationStyle): string {
  switch (style) {
    case "jazz-minus":
      return renderJazzMinus(chord);
    case "lowercase-m":
    case "plain-ascii":
    case "long-form":
      // TODO(slice B2): implement these three styles.
      return renderJazzMinus(chord);
  }
}
