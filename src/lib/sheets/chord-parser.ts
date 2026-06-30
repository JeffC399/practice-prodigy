import {
  PITCH_CLASSES,
  type Chord,
  type ChordQuality,
  type PitchClass,
} from "@/lib/music/chord";

/**
 * Phase 25.2 — chord text parser.
 *
 * Maps a chord string like "Cmaj7" / "Bm7b5" / "D7alt" / "C/E" to a
 * structured Chord + optional slash-chord bass. Returns null when the
 * text doesn't parse to a recognized chord.
 *
 * Accepted root forms:
 *   Letter A-G, optional accidental (# / ♯ / b / ♭).
 *   Case-insensitive on the letter, but "B" / "b" disambiguation
 *   prefers root capitalization (b alone is a flat, not B-minor).
 *
 * Accepted quality forms (each maps to one of the 20 ChordQualities):
 *   ""           → maj
 *   "M" / "maj"  → maj
 *   "m" / "-" / "min"           → min
 *   "+" / "aug"  → aug
 *   "°" / "dim"  → dim7 (the rendered "dim" is dim7 here for jazz)
 *   "°7" / "dim7"   → dim7
 *   "ø" / "ø7" / "m7b5" / "min7b5" / "halfdim" / "halfdim7" → halfDim7
 *   "7"           → dom7
 *   "M7" / "maj7" → maj7
 *   "m7" / "-7" / "min7" → min7
 *   "sus" / "sus4" → sus4
 *   "sus2"       → sus2
 *   "7sus4" / "7sus"  → 7sus4
 *   "M9" / "maj9"     → maj9
 *   "m9" / "min9"     → min9
 *   "9"               → dom9
 *   "13"              → dom13
 *   "7b9"             → dom7b9
 *   "7#9" / "7sharp9" → dom7sharp9
 *   "7alt" / "alt"    → dom7alt
 *   "7b5"             → dom7b5
 *   "7#5" / "7sharp5" → dom7sharp5
 *
 * Slash chord:
 *   "C/E" → Chord{ root: C, quality: maj } with bass: "E".
 */

export type ParsedChord = {
  chord: Chord;
  bass?: PitchClass;
};

const ROOT_REGEX = /^([A-Ga-g])([#b♯♭]?)/;

function normalizeAccidental(acc: string): "" | "#" | "b" {
  if (acc === "#" || acc === "♯") return "#";
  if (acc === "b" || acc === "♭") return "b";
  return "";
}

function pitchClassFromText(letter: string, accidental: string): PitchClass | null {
  const upper = letter.toUpperCase();
  const acc = normalizeAccidental(accidental);
  if (acc === "") {
    const candidate = upper as PitchClass;
    if ((PITCH_CLASSES as readonly string[]).includes(candidate)) {
      return candidate;
    }
    return null;
  }
  if (acc === "#") {
    const candidate = `${upper}#` as PitchClass;
    if ((PITCH_CLASSES as readonly string[]).includes(candidate)) {
      return candidate;
    }
    // E# / B# don't exist as enums; fall back to enharmonic.
    if (upper === "E") return "F";
    if (upper === "B") return "C";
    return null;
  }
  // acc === "b" (flat) — convert to sharp enharmonic since our pitch
  // vocabulary is sharp-named.
  const FLAT_TO_SHARP: Record<string, PitchClass> = {
    C: "B",
    D: "C#",
    E: "D#",
    F: "E",
    G: "F#",
    A: "G#",
    B: "A#",
  };
  return FLAT_TO_SHARP[upper] ?? null;
}

// Ordered longest-first so multi-char qualities are matched before
// their shorter prefixes (e.g. "maj7" matched before "maj").
const QUALITY_MATCHERS: Array<{ pattern: string; quality: ChordQuality }> = [
  // 13 / 11 / 9 extensions
  { pattern: "maj13", quality: "dom13" }, // safety alias
  { pattern: "13", quality: "dom13" },
  { pattern: "maj9", quality: "maj9" },
  { pattern: "M9", quality: "maj9" },
  { pattern: "min9", quality: "min9" },
  { pattern: "m9", quality: "min9" },
  { pattern: "-9", quality: "min9" },
  { pattern: "9", quality: "dom9" },
  // 7th alterations
  { pattern: "7alt", quality: "dom7alt" },
  { pattern: "alt", quality: "dom7alt" },
  { pattern: "7b9", quality: "dom7b9" },
  { pattern: "7#9", quality: "dom7sharp9" },
  { pattern: "7sharp9", quality: "dom7sharp9" },
  { pattern: "7b5", quality: "dom7b5" },
  { pattern: "7#5", quality: "dom7sharp5" },
  { pattern: "7sharp5", quality: "dom7sharp5" },
  // Sus
  { pattern: "7sus4", quality: "7sus4" },
  { pattern: "7sus", quality: "7sus4" },
  { pattern: "sus4", quality: "sus4" },
  { pattern: "sus2", quality: "sus2" },
  { pattern: "sus", quality: "sus4" },
  // Half-dim
  { pattern: "halfdim7", quality: "halfDim7" },
  { pattern: "halfdim", quality: "halfDim7" },
  { pattern: "ø7", quality: "halfDim7" },
  { pattern: "ø", quality: "halfDim7" },
  { pattern: "m7b5", quality: "halfDim7" },
  { pattern: "min7b5", quality: "halfDim7" },
  // Dim
  { pattern: "dim7", quality: "dim7" },
  { pattern: "°7", quality: "dim7" },
  { pattern: "dim", quality: "dim7" }, // jazz convention: bare "dim" → dim7
  { pattern: "°", quality: "dim7" },
  // Major 7
  { pattern: "maj7", quality: "maj7" },
  { pattern: "M7", quality: "maj7" },
  { pattern: "Δ7", quality: "maj7" },
  { pattern: "Δ", quality: "maj7" },
  // Minor 7
  { pattern: "min7", quality: "min7" },
  { pattern: "m7", quality: "min7" },
  { pattern: "-7", quality: "min7" },
  // Dominant 7
  { pattern: "7", quality: "dom7" },
  // Augmented
  { pattern: "aug", quality: "aug" },
  { pattern: "+", quality: "aug" },
  // Major (longer aliases first)
  { pattern: "maj", quality: "maj" },
  { pattern: "M", quality: "maj" },
  // Minor (lowercase-m or "-" or "min")
  { pattern: "min", quality: "min" },
  { pattern: "-", quality: "min" },
  { pattern: "m", quality: "min" },
];

function matchQuality(remainder: string): ChordQuality | null {
  for (const { pattern, quality } of QUALITY_MATCHERS) {
    if (remainder === pattern) return quality;
  }
  return null;
}

/**
 * Parse a chord text string. Returns null on unrecognized input.
 *
 * Handles slash chords by splitting on "/" first.
 */
export function parseChordText(input: string): ParsedChord | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // Slash chord: split on "/" — left side is the chord, right side is
  // the bass pitch class.
  let mainText = trimmed;
  let bass: PitchClass | undefined = undefined;
  const slashIdx = trimmed.indexOf("/");
  if (slashIdx >= 0) {
    mainText = trimmed.slice(0, slashIdx).trim();
    const bassText = trimmed.slice(slashIdx + 1).trim();
    const bassMatch = bassText.match(ROOT_REGEX);
    if (!bassMatch) return null;
    const bassPc = pitchClassFromText(bassMatch[1], bassMatch[2]);
    if (!bassPc) return null;
    bass = bassPc;
  }

  // Root.
  const rootMatch = mainText.match(ROOT_REGEX);
  if (!rootMatch) return null;
  const root = pitchClassFromText(rootMatch[1], rootMatch[2]);
  if (!root) return null;
  const remainder = mainText.slice(rootMatch[0].length);

  // Quality. Empty remainder = bare major triad.
  let quality: ChordQuality;
  if (remainder.length === 0) {
    quality = "maj";
  } else {
    const matched = matchQuality(remainder);
    if (matched === null) return null;
    quality = matched;
  }

  return { chord: { root, quality }, bass };
}

/**
 * Suggest a small set of likely chord completions for an in-progress
 * text input. Used by the chord-entry autocomplete dropdown.
 *
 * Returns up to `limit` suggestions, prioritizing:
 *   1. Exact match (if any)
 *   2. Common qualities at the typed root
 *   3. Recently-used chords (passed in via the `recent` parameter)
 */
export function suggestChords(
  input: string,
  recent: string[] = [],
  limit = 8,
): string[] {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return recent.slice(0, limit);
  }

  const rootMatch = trimmed.match(ROOT_REGEX);
  if (!rootMatch) return [];
  const rootText = rootMatch[0]; // e.g. "C", "Bb", "F#"

  // Common chord-quality suffixes for a Real Book vocabulary.
  const COMMON_SUFFIXES = [
    "",
    "maj7",
    "m7",
    "7",
    "m",
    "sus4",
    "dim7",
    "m7b5",
    "9",
    "13",
    "7alt",
    "6",
    "M7",
  ];
  const startsWith = trimmed.toLowerCase();
  const candidates: string[] = [];
  // Always include exact match if it parses.
  if (parseChordText(trimmed) !== null) candidates.push(trimmed);
  // Build candidate set: root + common suffix.
  for (const sfx of COMMON_SUFFIXES) {
    const candidate = `${rootText}${sfx}`;
    if (candidate.toLowerCase().startsWith(startsWith)) {
      if (parseChordText(candidate) !== null) candidates.push(candidate);
    }
  }
  // Pull in recently-used that startsWith.
  for (const r of recent) {
    if (r.toLowerCase().startsWith(startsWith)) {
      candidates.push(r);
    }
  }
  // Dedupe + cap.
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of candidates) {
    if (seen.has(c)) continue;
    seen.add(c);
    result.push(c);
    if (result.length >= limit) break;
  }
  return result;
}
