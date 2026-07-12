import { SCALE_INTERVALS } from "@/lib/music/intervals";
import type { OrderingStrategy } from "@/lib/state/practice-config";
import {
  SCALE_DISPLAY_NAMES,
  type EnharmonicPreference,
  type ScaleDisplayMode,
  type ScaleInstance,
  type ScalePitchClass,
  type ScaleQuality,
} from "./types";

/**
 * Display helpers for the Scale Driller.
 *
 * The pitch-class table mirrors keyDisplay in Key Sequencer so a note
 * name rendered by either module reads identically (D♭ vs C♯ is the
 * user's enharmonic preference).
 *
 * Scale spelling: we walk SCALE_INTERVALS[quality] from the root and
 * pick sharps or flats note-by-note based on the same enharmonic
 * preference the drill's key display uses.
 */

const SHARP_LABELS: Record<ScalePitchClass, string> = {
  C: "C",
  "C#": "C♯",
  D: "D",
  "D#": "D♯",
  E: "E",
  F: "F",
  "F#": "F♯",
  G: "G",
  "G#": "G♯",
  A: "A",
  "A#": "A♯",
  B: "B",
};

const FLAT_LABELS: Record<ScalePitchClass, string> = {
  C: "C",
  "C#": "D♭",
  D: "D",
  "D#": "E♭",
  E: "E",
  F: "F",
  "F#": "G♭",
  G: "G",
  "G#": "A♭",
  A: "A",
  "A#": "B♭",
  B: "B",
};

const CHROMATIC_ORDER: ScalePitchClass[] = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];

/**
 * Whether to render sharps or flats for this drill. Same policy as the
 * Key Sequencer keyDisplay — "auto" prefers flats for jazz cycles /
 * random / custom, sharps for chromatic ascending. Kept in one place
 * so the drill's Now / Next scale names AND its scale-spelling read
 * consistent (no mixing sharps and flats in the same measure).
 */
function useSharps(
  pref: EnharmonicPreference,
  contextStrategy?: OrderingStrategy,
): boolean {
  if (pref === "sharps") return true;
  if (pref === "flats") return false;
  return contextStrategy === "chromaticAsc";
}

/**
 * Display one root note.
 */
export function rootDisplay(
  root: ScalePitchClass,
  pref: EnharmonicPreference,
  contextStrategy?: OrderingStrategy,
): string {
  return useSharps(pref, contextStrategy)
    ? SHARP_LABELS[root]
    : FLAT_LABELS[root];
}

/**
 * "D Dorian" — the big scale-instance label used on the drill screen.
 */
export function scaleInstanceDisplay(
  instance: ScaleInstance,
  pref: EnharmonicPreference,
  contextStrategy?: OrderingStrategy,
): string {
  return `${rootDisplay(instance.root, pref, contextStrategy)} ${SCALE_DISPLAY_NAMES[instance.quality]}`;
}

/**
 * Spelled notes for one scale instance, in the drill's enharmonic
 * mode. Returns e.g. ["D", "E", "F", "G", "A", "B", "C"] for D Dorian
 * with flats-preferred, or ["D", "E", "F", "G", "A", "B", "C"] for
 * D Dorian either way (since Dorian on D has no accidentals).
 *
 * NOTE — v1 uses semitone-first spelling: whichever chromatic
 * position lands on a scale tone gets rendered as its sharp/flat
 * enharmonic per the drill's preference. This is simpler than
 * enforcing "one note per letter name" (Ionian on D would need D E F♯
 * G A B C♯, but Locrian on D♯ starts getting hairy). For v1 the
 * pedagogy is "here are the notes, however you want to spell them";
 * a strict letter-name pass can land later if the user asks.
 */
export function scaleSpelling(
  instance: ScaleInstance,
  pref: EnharmonicPreference,
  contextStrategy?: OrderingStrategy,
): string[] {
  const intervals = SCALE_INTERVALS[instance.quality] ?? [];
  const rootIdx = CHROMATIC_ORDER.indexOf(instance.root);
  if (rootIdx < 0) return [];
  const sharps = useSharps(pref, contextStrategy);
  return intervals.map((semitone) => {
    const pc = CHROMATIC_ORDER[(rootIdx + semitone) % 12];
    return sharps ? SHARP_LABELS[pc] : FLAT_LABELS[pc];
  });
}

/**
 * Degree labels for one scale quality: "1 2 ♭3 4 5 6 ♭7" for Dorian,
 * "1 ♭3 4 ♭5 5 ♭7" for the Blues scale, etc.
 *
 * The 12-position table is the union of every alteration used by the
 * scales in SCALE_INTERVALS. Consistent with jazz-notation convention:
 * flats-when-appropriate for the natural-minor family, sharps for
 * lydian's #4 (rendered as ♯4 for clarity even though internally we
 * treat semitone 6 uniformly). We map each interval to its "friendly"
 * degree label so users reading "♭7" in Dorian match their theory
 * books.
 */
const SEMITONE_TO_DEGREE_MAJOR_KEY = [
  "1", "♭2", "2", "♭3", "3", "4",
  "♯4", "5", "♭6", "6", "♭7", "7",
];
const SEMITONE_TO_DEGREE_MINOR_KEY = [
  "1", "♭2", "2", "♭3", "3", "4",
  "♭5", "5", "♭6", "6", "♭7", "7",
];

const MINOR_QUALITIES: ReadonlySet<ScaleQuality> = new Set([
  "phrygian",
  "aeolian",
  "locrian",
  "minorPentatonic",
  "blues",
  "harmonicMinor",
  "melodicMinor",
]);

export function scaleDegrees(quality: ScaleQuality): string[] {
  const intervals = SCALE_INTERVALS[quality] ?? [];
  const table = MINOR_QUALITIES.has(quality)
    ? SEMITONE_TO_DEGREE_MINOR_KEY
    : SEMITONE_TO_DEGREE_MAJOR_KEY;
  return intervals.map((semitone) => table[semitone % 12]);
}

/**
 * Words used when reading a scale name aloud via TTS. "D♭ Dorian"
 * becomes "D flat dorian" so the browser TTS pronounces it correctly.
 */
export function scaleInstanceSpokenForm(
  instance: ScaleInstance,
  pref: EnharmonicPreference,
  contextStrategy?: OrderingStrategy,
): string {
  const label = scaleInstanceDisplay(instance, pref, contextStrategy);
  return label.replace(/♯/g, " sharp").replace(/♭/g, " flat");
}

/**
 * Content for the pane's secondary line — either notes or degrees per
 * the drill's displayMode. Returned as an array of tokens so the
 * consumer can space them however it wants (e.g. wider gaps between
 * degree tokens for readability).
 */
export function scaleSecondaryTokens(
  instance: ScaleInstance,
  displayMode: ScaleDisplayMode,
  pref: EnharmonicPreference,
  contextStrategy?: OrderingStrategy,
): string[] {
  if (displayMode === "degrees") return scaleDegrees(instance.quality);
  return scaleSpelling(instance, pref, contextStrategy);
}
