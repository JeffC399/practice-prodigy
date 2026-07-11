import type {
  EnharmonicPreference,
  KeyPitchClass,
} from "./types";
import type { OrderingStrategy } from "@/lib/state/practice-config";

/**
 * Display helpers for the Key Sequencer.
 *
 * The enharmonic preference tells the app whether to show sharps
 * (C♯ / D♯ / F♯ / G♯ / A♯) or flats (D♭ / E♭ / G♭ / A♭ / B♭).
 * "auto" is context-aware: prefers flats for jazz-idiom cycles
 * (5ths / 4ths / cycle-of-5ths order) and sharps for chromatic
 * ascending.
 */

const SHARP_LABELS: Record<KeyPitchClass, string> = {
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

const FLAT_LABELS: Record<KeyPitchClass, string> = {
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

export function keyDisplay(
  k: KeyPitchClass,
  pref: EnharmonicPreference,
  contextStrategy?: OrderingStrategy,
): string {
  if (pref === "sharps") return SHARP_LABELS[k];
  if (pref === "flats") return FLAT_LABELS[k];
  // auto — context-aware:
  //   chromatic ascending → sharps
  //   chromatic descending → flats
  //   cycles / custom / random → flats (jazz idiom)
  if (contextStrategy === "chromaticAsc") return SHARP_LABELS[k];
  return FLAT_LABELS[k];
}

/**
 * Format a key for the TTS utterance. Uses spoken form ("A flat"
 * instead of "A♭") so the browser TTS pronounces it correctly.
 */
export function keySpokenForm(
  k: KeyPitchClass,
  pref: EnharmonicPreference,
  contextStrategy?: OrderingStrategy,
): string {
  const disp = keyDisplay(k, pref, contextStrategy);
  return disp.replace(/♯/g, " sharp").replace(/♭/g, " flat");
}
