import type { Chord } from "./chord";
import {
  CHORD_DEFAULT_SCALE,
  CHORD_INTERVALS,
  SCALE_INTERVALS,
  semitoneToMidi,
} from "./intervals";
import {
  isCustomPatternId,
  notesToDegreeString,
  SEMITONE_LABELS,
  type CustomPattern,
} from "./custom-patterns";
import { useCustomPatternsLibrary } from "@/lib/state/custom-patterns-library";

/**
 * Arpeggio pattern generation.
 *
 * Phase 13 widened `ArpeggioPattern` from a closed union of built-in
 * IDs to plain `string` so user-authored custom patterns (id prefix
 * `custom_`) flow through every code path that touched the old union.
 * The four built-ins are still listed in `BUILT_IN_PATTERNS` for the
 * checkbox grid and lookup tables; the helper functions below resolve
 * either built-in or custom IDs at call time.
 *
 * Octave/register is auto-selected to keep notes in a comfortable
 * middle bass range (root anchored at octave 2 → typical notes around
 * E2–C4).
 */

export const BUILT_IN_PATTERNS = [
  "scale-tones",
  "arp-7ths",
  "triads-with-lt",
  "descending",
] as const;

export type BuiltInPattern = (typeof BUILT_IN_PATTERNS)[number];

/**
 * Backwards-compatible alias. Pre-Phase-13 callers iterated over
 * `ARPEGGIO_PATTERNS` to render the built-in checkbox row — that
 * surface still wants only built-ins, so this constant stays scoped
 * to the four built-ins. Use the custom-patterns library to enumerate
 * user patterns separately.
 */
export const ARPEGGIO_PATTERNS = BUILT_IN_PATTERNS;

/**
 * A pattern id — either one of the four built-ins or a custom-pattern
 * id (which lives in the custom-patterns Zustand store). Resolvers
 * below take any string and dispatch.
 */
export type ArpeggioPattern = string;

export function isBuiltInPattern(id: string): id is BuiltInPattern {
  return (BUILT_IN_PATTERNS as readonly string[]).includes(id);
}

const BUILT_IN_DISPLAY_NAMES: Record<BuiltInPattern, string> = {
  "scale-tones": "Scale Tones (1–2–3–4–5–6–7–8)",
  "arp-7ths": "Arpeggiated 7ths (1–3–5–7)",
  "triads-with-lt": "Triads with Leading Tones (1–3–5–LT)",
  descending: "Descending (8–7–5–3)",
};

const BUILT_IN_SHORT_NAMES: Record<BuiltInPattern, string> = {
  "scale-tones": "Scale Tones",
  "arp-7ths": "Arp 7ths",
  "triads-with-lt": "Triads + LT",
  descending: "Descending",
};

const BUILT_IN_DESCRIPTIONS: Record<BuiltInPattern, string> = {
  "scale-tones":
    "Eight notes ascending one octave through the chord's scale.",
  "arp-7ths":
    "Four chord tones (1-3-5-7). Triads default to 1-3-5-8 (octave).",
  "triads-with-lt":
    "Four notes: triad + leading tone (half-step below the next chord's root). Single-chord drills fall back to 1-3-5-8.",
  descending:
    "Four notes descending: octave, scale's 7th, chord's 5th, chord's 3rd.",
};

const BUILT_IN_DEGREES: Record<BuiltInPattern, string> = {
  "scale-tones": "1-2-3-4-5-6-7-8",
  "arp-7ths": "1-3-5-7",
  "triads-with-lt": "1-3-5-LT",
  descending: "8-7-5-3",
};

const BUILT_IN_NOTE_COUNT: Record<BuiltInPattern, number> = {
  "scale-tones": 8,
  "arp-7ths": 4,
  "triads-with-lt": 4,
  descending: 4,
};

/**
 * Look up a custom pattern from the persisted store. Returns undefined
 * if the id doesn't resolve — caller should treat as a missing-pattern
 * sentinel (deleted custom pattern that's still referenced by a saved
 * drill). Non-React safe: uses Zustand's `getState()`.
 */
function lookupCustom(id: string): CustomPattern | undefined {
  if (!isCustomPatternId(id)) return undefined;
  return useCustomPatternsLibrary.getState().getById(id);
}

/**
 * Long display name for a pattern. Built-ins return the full
 * parenthesized degree-string form; customs return the user-chosen
 * name followed by their interval-string in parentheses.
 */
export function getPatternDisplayName(pattern: ArpeggioPattern): string {
  if (isBuiltInPattern(pattern)) return BUILT_IN_DISPLAY_NAMES[pattern];
  const cp = lookupCustom(pattern);
  if (!cp) return "Deleted pattern";
  return `${cp.name} (${notesToDegreeString(cp.notes)})`;
}

/** Short label for dense surfaces (drill header, Quick-Start card meta). */
export function getPatternShortName(pattern: ArpeggioPattern): string {
  if (isBuiltInPattern(pattern)) return BUILT_IN_SHORT_NAMES[pattern];
  const cp = lookupCustom(pattern);
  return cp?.name ?? "Deleted";
}

/** Tooltip / description copy. Customs synthesize one from their interval list. */
export function getPatternDescription(pattern: ArpeggioPattern): string {
  if (isBuiltInPattern(pattern)) return BUILT_IN_DESCRIPTIONS[pattern];
  const cp = lookupCustom(pattern);
  if (!cp) return "This custom pattern has been deleted.";
  return `Custom pattern: ${notesToDegreeString(cp.notes)}.`;
}

/** Degree-string subtitle (e.g. "1-3-5-7"). */
export function getPatternDegrees(pattern: ArpeggioPattern): string {
  if (isBuiltInPattern(pattern)) return BUILT_IN_DEGREES[pattern];
  const cp = lookupCustom(pattern);
  return cp ? notesToDegreeString(cp.notes) : "—";
}

/**
 * Note count — drives sub-beat highlight timing on the drill screen
 * (notes-per-measure / beats-per-measure = notes-per-beat).
 */
export function getPatternNoteCount(pattern: ArpeggioPattern): number {
  if (isBuiltInPattern(pattern)) return BUILT_IN_NOTE_COUNT[pattern];
  const cp = lookupCustom(pattern);
  return cp?.notes.length ?? 0;
}

/**
 * Split a pattern's degree string into per-note segments — used by the
 * drill-screen subtitle to render each digit independently for the
 * lit-up animation. Multi-character "notes" like `LT` count as 1
 * segment; the dashes between segments are not included in the result.
 *
 * Custom patterns split on their internal notes array (one segment per
 * PatternNote), so each label can be highlighted with full precision —
 * no parsing ambiguity from glyphs like `♭3` (which would otherwise
 * confuse a naive string split).
 */
export function parsePatternDegrees(
  pattern: ArpeggioPattern,
): Array<{ idx: number; label: string }> {
  if (isBuiltInPattern(pattern)) {
    return BUILT_IN_DEGREES[pattern]
      .split("-")
      .map((label, idx) => ({ idx, label }));
  }
  const cp = lookupCustom(pattern);
  if (!cp) return [];
  return cp.notes.map((n, idx) => ({
    idx,
    label: SEMITONE_LABELS[n.semitones] ?? "?",
  }));
}

/**
 * Anchor the chord's root at octave 2 — sits comfortably in the middle
 * of a 4-string bass's range (E1–G4, with E2–C4 being the meat). Pattern
 * notes ascend or descend from there per the pattern definition.
 */
const ANCHOR_OCTAVE = 2;

/**
 * Generate the MIDI note sequence for a chord + pattern combination.
 * Built-ins use their hard-coded interval math; customs play exactly
 * the semitone offsets the user picked, regardless of chord quality.
 */
export function generateArpeggio(
  chord: Chord,
  pattern: ArpeggioPattern,
): number[] {
  // Custom path first — short-circuits the chord/scale lookups since
  // custom patterns use absolute semitones, not scale-relative degrees.
  if (isCustomPatternId(pattern)) {
    const cp = lookupCustom(pattern);
    if (!cp) return [];
    return cp.notes.map((n) =>
      semitoneToMidi(chord.root, ANCHOR_OCTAVE, n.semitones),
    );
  }

  const builtIn = pattern as BuiltInPattern;
  const chordTones = CHORD_INTERVALS[chord.quality];
  const scaleName = CHORD_DEFAULT_SCALE[chord.quality];
  const scaleTones = SCALE_INTERVALS[scaleName];

  switch (builtIn) {
    case "scale-tones": {
      // 1, 2, 3, 4, 5, 6, 7, 8(=octave). Take the 7 scale tones, append 12.
      const offsets = [...scaleTones, 12];
      return offsets.map((o) =>
        semitoneToMidi(chord.root, ANCHOR_OCTAVE, o),
      );
    }

    case "arp-7ths": {
      // For chords with a 7th, play 1-3-5-7. For triads (no 7th in chord
      // tones), play 1-3-5-8 (octave) per §4.3 default.
      const hasSeventh = chordTones.length >= 4;
      const offsets = hasSeventh
        ? chordTones.slice(0, 4)
        : [...chordTones.slice(0, 3), 12];
      return offsets.map((o) =>
        semitoneToMidi(chord.root, ANCHOR_OCTAVE, o),
      );
    }

    case "triads-with-lt": {
      // Single-chord context → no "next chord" to derive LT from, so fall
      // back to 1-3-5-8 per §4.3. Multi-chord sequences will replace the
      // final note with the half-step-below-next-root LT.
      const offsets = [...chordTones.slice(0, 3), 12];
      return offsets.map((o) =>
        semitoneToMidi(chord.root, ANCHOR_OCTAVE, o),
      );
    }

    case "descending": {
      // 8 (octave), 7 (scale's 7th degree), 5 (chord's 5th), 3 (chord's 3rd).
      const scaleSeventh = scaleTones[6] ?? 11;
      const chordFifth = chordTones[2] ?? 7;
      const chordThird = chordTones[1] ?? 4;
      const offsets = [12, scaleSeventh, chordFifth, chordThird];
      return offsets.map((o) =>
        semitoneToMidi(chord.root, ANCHOR_OCTAVE, o),
      );
    }
  }
  return [];
}

/* ---------------------------------------------------------------------- */
/* Back-compat record-style exports                                        */
/* ---------------------------------------------------------------------- */
/* Old code used `ARPEGGIO_PATTERN_DISPLAY_NAMES[p]` (record indexing) for
 * built-ins. Those callsites are getting migrated to the resolver
 * functions above, but until every site is updated these aliases keep
 * the old shape working for built-in IDs. Custom IDs go via the
 * resolver functions only — record indexing on a custom id is
 * intentionally undefined here. */
export const ARPEGGIO_PATTERN_DISPLAY_NAMES = BUILT_IN_DISPLAY_NAMES;
export const ARPEGGIO_PATTERN_SHORT_NAMES = BUILT_IN_SHORT_NAMES;
export const ARPEGGIO_PATTERN_DESCRIPTIONS = BUILT_IN_DESCRIPTIONS;
export const ARPEGGIO_PATTERN_DEGREES = BUILT_IN_DEGREES;
export const ARPEGGIO_PATTERN_NOTE_COUNT = BUILT_IN_NOTE_COUNT;
