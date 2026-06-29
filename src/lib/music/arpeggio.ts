import type { Chord } from "./chord";
import {
  CHORD_INTERVALS,
  semitoneToMidi,
} from "./intervals";
import {
  isCustomPatternId,
  NOTE_DURATION_BEATS,
  notesToDegreeString,
  REST_LABEL,
  SEMITONE_LABELS,
  type CustomPattern,
  type NoteDuration,
} from "./custom-patterns";
import { useCustomPatternsLibrary } from "@/lib/state/custom-patterns-library";

/**
 * Arpeggio pattern generation.
 *
 * Phase 15: added descending built-ins + the "Start from" modifier.
 *
 * Built-in patterns are modeled as a list of chord-tone references
 * (one of 1/3/5/7 of whichever chord is current). Each reference can
 * carry an `octaveShift` so a pattern can encode both intra-octave
 * shapes (ascending 1-3-5-7) and crossing-octave shapes (descending
 * 8-7-5-3, where the "8" is root + 12 semitones).
 *
 * The Start-from modifier (root/3rd/5th/7th/random) rotates the chord-
 * tone array so the chosen tone lands on beat 1. Wrapped notes get an
 * octave shift to keep the pattern moving in its direction (+1 for
 * ascending, -1 for descending). The lit-up subtitle just shows the
 * chord-tone number; direction is communicated via audio + lit-up
 * timing.
 */

export const BUILT_IN_PATTERNS = [
  "7th-chords",
  "triads",
  "7th-chords-desc",
  "triads-desc",
] as const;
export type BuiltInPattern = (typeof BUILT_IN_PATTERNS)[number];

/** Back-compat alias — old callsites iterate this to render the */
/* built-in checkbox row. */
export const ARPEGGIO_PATTERNS = BUILT_IN_PATTERNS;

export type ArpeggioPattern = string;

export function isBuiltInPattern(id: string): id is BuiltInPattern {
  return (BUILT_IN_PATTERNS as readonly string[]).includes(id);
}

/**
 * Chord-tone index: 0 = root (1), 1 = third (3), 2 = fifth (5),
 * 3 = seventh (7). The engine resolves this to a semitone offset by
 * indexing into the current chord's CHORD_INTERVALS array, so the
 * built-in pattern auto-adapts: a "3" plays the major third over a
 * maj7 chord and a minor third over a m7 chord, etc.
 */
type ChordToneIndex = 0 | 1 | 2 | 3;

/** Built-in note position — either a chord-tone reference or a rest. */
type BuiltInNote =
  | {
      kind: "chordTone";
      index: ChordToneIndex;
      /** Octave shift from the chord's root octave. 0 = same octave; */
      /* +1 = up an octave; -1 = down an octave. Lets a pattern encode */
      /* "8" (root+octave) for descending shapes that start above the root. */
      octaveShift: number;
      duration: NoteDuration;
    }
  | { kind: "rest"; duration: NoteDuration };

type PatternDirection = "asc" | "desc";

type BuiltInPatternDef = {
  displayName: string;
  shortName: string;
  description: string;
  notes: BuiltInNote[];
  lengthInMeasures: number;
  /** Used by the Start-from rotation to keep wrapped notes in the */
  /* pattern's pitch direction. */
  direction: PatternDirection;
  /** Number of distinct chord-tone slots this pattern offers for */
  /* Start-from rotation. 4 for 7th-Chord patterns, 3 for Triads. */
  rotationCount: 3 | 4;
};

const BUILT_IN_DEFS: Record<BuiltInPattern, BuiltInPatternDef> = {
  "7th-chords": {
    displayName: "7th Chords ascending (1-3-5-7)",
    shortName: "7th Chords ↑",
    description:
      "The foundational jazz arpeggio. Drills the four chord tones in order so each chord quality (maj7, m7, dom7, dim7) lands in your fingers as a distinct shape. Master this first.",
    notes: [
      { kind: "chordTone", index: 0, octaveShift: 0, duration: "quarter" },
      { kind: "chordTone", index: 1, octaveShift: 0, duration: "quarter" },
      { kind: "chordTone", index: 2, octaveShift: 0, duration: "quarter" },
      { kind: "chordTone", index: 3, octaveShift: 0, duration: "quarter" },
    ],
    lengthInMeasures: 1,
    direction: "asc",
    rotationCount: 4,
  },
  "7th-chords-desc": {
    displayName: "7th Chords descending (8-7-5-3)",
    shortName: "7th Chords ↓",
    description:
      "Builds fluency for descending lines — the direction most bassists are weakest in. Trains your ear to hear chord quality from the top down, which is how voice-leading actually moves.",
    notes: [
      // Octave-up root, then 7, 5, 3 descending.
      { kind: "chordTone", index: 0, octaveShift: 1, duration: "quarter" },
      { kind: "chordTone", index: 3, octaveShift: 0, duration: "quarter" },
      { kind: "chordTone", index: 2, octaveShift: 0, duration: "quarter" },
      { kind: "chordTone", index: 1, octaveShift: 0, duration: "quarter" },
    ],
    lengthInMeasures: 1,
    direction: "desc",
    rotationCount: 4,
  },
  triads: {
    displayName: "Triads ascending (1-3-5)",
    shortName: "Triads ↑",
    description:
      "The harmonic skeleton without the 7th — internalizes the basic chord shape in a rhythmic pattern (eighth + eighth + quarter, twice per 4/4 bar). Great for warming up or drilling new chord changes.",
    notes: [
      { kind: "chordTone", index: 0, octaveShift: 0, duration: "8th" },
      { kind: "chordTone", index: 1, octaveShift: 0, duration: "8th" },
      { kind: "chordTone", index: 2, octaveShift: 0, duration: "quarter" },
      { kind: "chordTone", index: 0, octaveShift: 0, duration: "8th" },
      { kind: "chordTone", index: 1, octaveShift: 0, duration: "8th" },
      { kind: "chordTone", index: 2, octaveShift: 0, duration: "quarter" },
    ],
    lengthInMeasures: 1,
    direction: "asc",
    rotationCount: 3,
  },
  "triads-desc": {
    displayName: "Triads descending (5-3-1)",
    shortName: "Triads ↓",
    description:
      "Triad shape from the top — 5-3-1 with eighth + eighth + quarter, twice per bar. Pair with ascending Triads for a complete grip on the chord shape in both directions.",
    notes: [
      { kind: "chordTone", index: 2, octaveShift: 0, duration: "8th" },
      { kind: "chordTone", index: 1, octaveShift: 0, duration: "8th" },
      { kind: "chordTone", index: 0, octaveShift: 0, duration: "quarter" },
      { kind: "chordTone", index: 2, octaveShift: 0, duration: "8th" },
      { kind: "chordTone", index: 1, octaveShift: 0, duration: "8th" },
      { kind: "chordTone", index: 0, octaveShift: 0, duration: "quarter" },
    ],
    lengthInMeasures: 1,
    direction: "desc",
    rotationCount: 3,
  },
};

/**
 * Resolve a built-in note to its absolute semitone offset for a given
 * chord. Returns null for rests. Triads (3-tone chords) auto-fall-back
 * to octave when asked for a 7th — keeps the "7th Chords" pattern
 * universally playable.
 */
function builtInNoteToSemitones(
  note: BuiltInNote,
  chord: Chord,
): number | null {
  if (note.kind === "rest") return null;
  const tones = CHORD_INTERVALS[chord.quality];
  const base = note.index < tones.length ? tones[note.index] : 12;
  return base + note.octaveShift * 12;
}

/* ---------------------------------------------------------------------- */
/* Start-from modifier                                                    */
/* ---------------------------------------------------------------------- */

export const PATTERN_START_FROM_OPTIONS = [
  "root",
  "3rd",
  "5th",
  "7th",
  "random",
] as const;
export type PatternStartFrom = (typeof PATTERN_START_FROM_OPTIONS)[number];

export const PATTERN_START_FROM_LABELS: Record<PatternStartFrom, string> = {
  root: "Root",
  "3rd": "3rd",
  "5th": "5th",
  "7th": "7th",
  random: "Random",
};

/** Map a Start-from value to its chord-tone index (root → 0, 3rd → 1, etc). */
function startFromToChordToneIndex(s: Exclude<PatternStartFrom, "random">): ChordToneIndex {
  switch (s) {
    case "root":
      return 0;
    case "3rd":
      return 1;
    case "5th":
      return 2;
    case "7th":
      return 3;
  }
}

const CONCRETE_START_FROMS = ["root", "3rd", "5th", "7th"] as const;
type ConcreteStartFrom = (typeof CONCRETE_START_FROMS)[number];

/**
 * Pre-roll a per-measure Start-from sequence for the session. Non-
 * random returns the same value every measure; "random" rolls a new
 * value at the start of each measure (clamped to the pattern's
 * rotationCount when measure-by-measure pattern membership changes).
 *
 * If `lockFirstMeasureToRoot` is true and start-from is "random", the
 * FIRST measure of each chord-run starts on root and only subsequent
 * measures randomize. We approximate "first measure of each chord"
 * here by looking at the chordSequence's measure→chord mapping. v1
 * keeps this simple: chord-run boundaries aren't passed in, so the
 * "lock first" sub-option is reserved for a follow-up that wires
 * chord-run starts through. For now the option ships disabled in the
 * UI; the field exists in the config for forward-compatibility.
 */
export function buildStartFromForSession(
  startFrom: PatternStartFrom,
  totalMeasures: number,
  options: { lockFirstMeasureToRoot?: boolean } = {},
): ConcreteStartFrom[] {
  if (startFrom !== "random") {
    return Array.from({ length: totalMeasures }, () => startFrom);
  }
  // Random: roll one of root/3rd/5th/7th per measure. Clamping to the
  // pattern's actual rotation count happens at apply time (so e.g.
  // Triads ignore "7th" rolls by wrapping back to root).
  const out: ConcreteStartFrom[] = [];
  for (let i = 0; i < totalMeasures; i++) {
    if (i === 0 && options.lockFirstMeasureToRoot) {
      out.push("root");
    } else {
      out.push(
        CONCRETE_START_FROMS[
          Math.floor(Math.random() * CONCRETE_START_FROMS.length)
        ],
      );
    }
  }
  return out;
}

/**
 * Rotate a built-in pattern's notes so the requested chord tone lands
 * on beat 1. Wrapped notes get an octave shift to keep the pattern
 * moving in its direction.
 *
 * If the pattern doesn't support the requested chord tone (e.g.
 * Triads asked for the 7th), we wrap the index modulo rotationCount
 * — so "7th" on Triads silently falls back to "root" (index 3 mod 3 = 0).
 */
function rotateBuiltInPattern(
  def: BuiltInPatternDef,
  startFromChordTone: ChordToneIndex,
): BuiltInNote[] {
  // Clamp the requested chord-tone index to the pattern's rotation count.
  // Triads (rotationCount = 3) wrap "7th" (index 3) back to root.
  const effectiveStart = (startFromChordTone %
    def.rotationCount) as ChordToneIndex;
  if (effectiveStart === 0) return def.notes; // no rotation

  // Find the first position in the notes array that uses this chord tone.
  // For built-in defs, each chord-tone index appears with octaveShift=0 at
  // its canonical position (ascending) or with a known shift (descending).
  let rotatePoint = -1;
  for (let i = 0; i < def.notes.length; i++) {
    const n = def.notes[i];
    if (n.kind === "chordTone" && n.index === effectiveStart) {
      rotatePoint = i;
      break;
    }
  }
  if (rotatePoint <= 0) return def.notes;

  const directionShift = def.direction === "asc" ? 1 : -1;
  const rotated: BuiltInNote[] = [];
  for (let i = 0; i < def.notes.length; i++) {
    const srcIdx = (rotatePoint + i) % def.notes.length;
    const wrapped = rotatePoint + i >= def.notes.length;
    const src = def.notes[srcIdx];
    if (src.kind === "rest") {
      rotated.push(src);
      continue;
    }
    rotated.push({
      ...src,
      octaveShift: src.octaveShift + (wrapped ? directionShift : 0),
    });
  }
  return rotated;
}

/** ResolvedNote = the per-position output the engine + subtitle consume. */
export type ResolvedNote =
  | {
      kind: "note";
      /** Display label for the lit-up subtitle (e.g. "1", "♭3", "—"). */
      label: string;
      /** Absolute semitone offset from the chord root. */
      semitones: number;
      duration: NoteDuration;
    }
  | { kind: "rest"; label: string; duration: NoteDuration };

/**
 * Resolve a pattern (built-in or custom) over a chord into a flat list
 * of per-position notes. Both the audio engine and the subtitle render
 * consume this — single representation, no divergence.
 *
 * `startFromIdx` (0..3 mapping to root/3rd/5th/7th) rotates chord-tone
 * built-ins. Custom patterns ignore the modifier — they use absolute
 * semitone offsets, so "Start from 3rd" has no clean meaning for them.
 */
export function resolvePatternForChord(
  pattern: ArpeggioPattern,
  chord: Chord,
  startFromIdx: ChordToneIndex = 0,
): { notes: ResolvedNote[]; lengthInMeasures: number } {
  if (isCustomPatternId(pattern)) {
    const cp = lookupCustom(pattern);
    if (!cp) return { notes: [], lengthInMeasures: 1 };
    const notes: ResolvedNote[] = cp.notes.map((n): ResolvedNote => {
      if (n.kind === "rest") {
        return { kind: "rest", label: REST_LABEL, duration: n.duration };
      }
      return {
        kind: "note",
        label: SEMITONE_LABELS[n.semitones] ?? "?",
        semitones: n.semitones,
        duration: n.duration,
      };
    });
    return { notes, lengthInMeasures: cp.lengthInMeasures };
  }
  if (isBuiltInPattern(pattern)) {
    const def = BUILT_IN_DEFS[pattern];
    const rotatedNotes = rotateBuiltInPattern(def, startFromIdx);
    const notes: ResolvedNote[] = rotatedNotes.map((n): ResolvedNote => {
      if (n.kind === "rest") {
        return { kind: "rest", label: REST_LABEL, duration: n.duration };
      }
      const semitones = builtInNoteToSemitones(n, chord) ?? 0;
      // Built-in labels are just chord-tone numbers ("1/3/5/7"); the
      // octaveShift renders as "8" only when the label slot is the
      // root one octave up — keeps the subtitle pedagogical.
      let label: string;
      if (n.index === 0 && n.octaveShift > 0) {
        label = "8";
      } else {
        label = BUILT_IN_LABELS[n.index];
      }
      return { kind: "note", label, semitones, duration: n.duration };
    });
    return { notes, lengthInMeasures: def.lengthInMeasures };
  }
  return { notes: [], lengthInMeasures: 1 };
}

/** Resolve a Start-from string to its chord-tone index for the engine. */
export function startFromIndexFor(
  startFrom: Exclude<PatternStartFrom, "random">,
): ChordToneIndex {
  return startFromToChordToneIndex(startFrom);
}

/** Labels for chord-tone references in built-in patterns. */
const BUILT_IN_LABELS: Record<ChordToneIndex, string> = {
  0: "1",
  1: "3",
  2: "5",
  3: "7",
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

/* ---------------------------------------------------------------------- */
/* Label / metadata resolvers                                              */
/* ---------------------------------------------------------------------- */

/** Long display name. */
export function getPatternDisplayName(pattern: ArpeggioPattern): string {
  if (isBuiltInPattern(pattern)) return BUILT_IN_DEFS[pattern].displayName;
  const cp = lookupCustom(pattern);
  if (!cp) return "Deleted pattern";
  return `${cp.name} (${notesToDegreeString(cp.notes)})`;
}

/** Short label for dense surfaces. */
export function getPatternShortName(pattern: ArpeggioPattern): string {
  if (isBuiltInPattern(pattern)) return BUILT_IN_DEFS[pattern].shortName;
  const cp = lookupCustom(pattern);
  return cp?.name ?? "Deleted";
}

/** Tooltip / description copy. */
export function getPatternDescription(pattern: ArpeggioPattern): string {
  if (isBuiltInPattern(pattern)) return BUILT_IN_DEFS[pattern].description;
  const cp = lookupCustom(pattern);
  if (!cp) return "This custom pattern has been deleted.";
  return `Custom pattern: ${notesToDegreeString(cp.notes)}.`;
}

/** Degree-string subtitle. Resolved against a sample chord at the */
/* default startFrom (root). Used for static labels (e.g. setup-screen */
/* tile subtitles), not for the lit-up drill subtitle which resolves */
/* dynamically per measure. */
export function getPatternDegrees(pattern: ArpeggioPattern): string {
  if (isBuiltInPattern(pattern)) {
    const resolved = resolvePatternForChord(pattern, {
      root: "C",
      quality: "maj7",
    });
    return resolved.notes.map((n) => n.label).join("-");
  }
  const cp = lookupCustom(pattern);
  return cp ? notesToDegreeString(cp.notes) : "—";
}

/** Note count. */
export function getPatternNoteCount(pattern: ArpeggioPattern): number {
  if (isBuiltInPattern(pattern)) return BUILT_IN_DEFS[pattern].notes.length;
  const cp = lookupCustom(pattern);
  return cp?.notes.length ?? 0;
}

/** Length in measures the pattern spans. */
export function getPatternLengthInMeasures(pattern: ArpeggioPattern): number {
  if (isBuiltInPattern(pattern))
    return BUILT_IN_DEFS[pattern].lengthInMeasures;
  const cp = lookupCustom(pattern);
  return cp?.lengthInMeasures ?? 1;
}

/** True iff the pattern responds to the Start-from modifier (chord-tone built-ins only). */
export function patternSupportsStartFrom(pattern: ArpeggioPattern): boolean {
  return isBuiltInPattern(pattern);
}

/**
 * Split a pattern's degree string into per-note segments — used by the
 * drill-screen subtitle to render each digit independently for the
 * lit-up animation. Each segment carries the duration so the highlight
 * scheduler can step through them in time.
 *
 * `startFromIdx` rotates chord-tone built-ins; customs ignore it.
 */
export function parsePatternDegrees(
  pattern: ArpeggioPattern,
  startFromIdx: ChordToneIndex = 0,
): Array<{ idx: number; label: string; durationBeats: number }> {
  const resolved = resolvePatternForChord(
    pattern,
    { root: "C", quality: "maj7" },
    startFromIdx,
  );
  return resolved.notes.map((n, idx) => ({
    idx,
    label: n.label,
    durationBeats: NOTE_DURATION_BEATS[n.duration],
  }));
}

/**
 * Anchor the chord's root at octave 2 — sits comfortably in the middle
 * of a 4-string bass's range (E1–G4, with E2–C4 being the meat).
 */
const ANCHOR_OCTAVE = 2;

/**
 * Generate the MIDI note sequence for a chord + pattern combination.
 * Rests emit no MIDI event (filtered out). Both built-ins and customs
 * funnel through `resolvePatternForChord` so the engine is symmetric.
 */
export function generateArpeggio(
  chord: Chord,
  pattern: ArpeggioPattern,
  startFromIdx: ChordToneIndex = 0,
): number[] {
  const { notes } = resolvePatternForChord(chord ? pattern : pattern, chord, startFromIdx);
  return notes
    .filter((n): n is Extract<ResolvedNote, { kind: "note" }> => n.kind === "note")
    .map((n) =>
      semitoneToMidi(chord.root, ANCHOR_OCTAVE, n.semitones),
    );
}

/* ---------------------------------------------------------------------- */
/* Legacy IDs — preserved as references for the practice-config migration. */
/* ---------------------------------------------------------------------- */
export const LEGACY_BUILT_IN_PATTERN_IDS = [
  "scale-tones",
  "arp-7ths",
  "triads-with-lt",
  "descending",
] as const;

export function remapLegacyPatternId(id: string): BuiltInPattern {
  if (id === "triads-with-lt") return "triads";
  if (id === "descending") return "7th-chords-desc";
  return "7th-chords";
}

/* ---------------------------------------------------------------------- */
/* Back-compat record-style exports                                        */
/* ---------------------------------------------------------------------- */
export const ARPEGGIO_PATTERN_DISPLAY_NAMES: Record<BuiltInPattern, string> = {
  "7th-chords": BUILT_IN_DEFS["7th-chords"].displayName,
  triads: BUILT_IN_DEFS.triads.displayName,
  "7th-chords-desc": BUILT_IN_DEFS["7th-chords-desc"].displayName,
  "triads-desc": BUILT_IN_DEFS["triads-desc"].displayName,
};
export const ARPEGGIO_PATTERN_SHORT_NAMES: Record<BuiltInPattern, string> = {
  "7th-chords": BUILT_IN_DEFS["7th-chords"].shortName,
  triads: BUILT_IN_DEFS.triads.shortName,
  "7th-chords-desc": BUILT_IN_DEFS["7th-chords-desc"].shortName,
  "triads-desc": BUILT_IN_DEFS["triads-desc"].shortName,
};
export const ARPEGGIO_PATTERN_DESCRIPTIONS: Record<BuiltInPattern, string> = {
  "7th-chords": BUILT_IN_DEFS["7th-chords"].description,
  triads: BUILT_IN_DEFS.triads.description,
  "7th-chords-desc": BUILT_IN_DEFS["7th-chords-desc"].description,
  "triads-desc": BUILT_IN_DEFS["triads-desc"].description,
};
