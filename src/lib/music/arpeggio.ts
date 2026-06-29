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
 * Phase 14 collapsed the four chord-shape patterns (Scale Tones, Arp
 * 7ths, Triads-with-LT, Descending) down to two chord-adaptive patterns
 * with explicit per-note rhythms:
 *
 *   - "7th Chords" — 1-3-5-7 of whatever chord is up, even quarters.
 *     Triads (no 7th in their chord tones) fall back to 1-3-5-octave.
 *   - "Triads"     — 1-3-5 of whatever chord is up, 8th+8th+quarter.
 *                    Each triad takes half a 4/4 measure, so the
 *                    pattern plays twice through a 4/4 bar.
 *
 * The dropped patterns ("Scale Tones" lives in the future Scales module;
 * Triads-with-LT and Descending become user-creatable custom patterns
 * now that the editor supports rhythm).
 *
 * Each built-in is internally represented as a `BuiltInPatternDef` —
 * the same `PatternNote[]` shape custom patterns use, just labeled
 * `kind: "chordTone"` instead of `"note"` so the engine can pull the
 * right interval from the current chord at play time. This keeps the
 * subtitle / engine / scheduling pipeline symmetric for built-ins vs.
 * customs (one path to maintain instead of two).
 *
 * Custom patterns and built-ins share the `ArpeggioPattern = string`
 * type. Built-in IDs live in `BUILT_IN_PATTERNS`; custom IDs are
 * prefixed `custom_` (see custom-patterns.ts).
 */

export const BUILT_IN_PATTERNS = ["7th-chords", "triads"] as const;
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
  | { kind: "chordTone"; index: ChordToneIndex; duration: NoteDuration }
  | { kind: "octave"; duration: NoteDuration }
  | { kind: "rest"; duration: NoteDuration };

type BuiltInPatternDef = {
  displayName: string;
  shortName: string;
  description: string;
  notes: BuiltInNote[];
  lengthInMeasures: number;
};

const BUILT_IN_DEFS: Record<BuiltInPattern, BuiltInPatternDef> = {
  "7th-chords": {
    displayName: "7th Chords (1-3-5-7)",
    shortName: "7th Chords",
    description:
      "Adapts to each chord — plays 1-3-5-7 of whatever's up. Maj7 plays the major-7th sound, m7 plays minor-7th, dim7 plays diminished-7th, etc. Triads fall back to 1-3-5-octave. Even quarters.",
    notes: [
      { kind: "chordTone", index: 0, duration: "quarter" },
      { kind: "chordTone", index: 1, duration: "quarter" },
      { kind: "chordTone", index: 2, duration: "quarter" },
      { kind: "chordTone", index: 3, duration: "quarter" },
    ],
    lengthInMeasures: 1,
  },
  triads: {
    displayName: "Triads (1-3-5, 8-8-qtr × 2)",
    shortName: "Triads",
    description:
      "Adapts to each chord — plays 1-3-5 of whatever's up. Each triad is 8th + 8th + quarter (half a 4/4 measure), so the pattern plays twice per measure in 4/4. Maj plays major triad, min plays minor triad, etc.",
    notes: [
      { kind: "chordTone", index: 0, duration: "8th" },
      { kind: "chordTone", index: 1, duration: "8th" },
      { kind: "chordTone", index: 2, duration: "quarter" },
      { kind: "chordTone", index: 0, duration: "8th" },
      { kind: "chordTone", index: 1, duration: "8th" },
      { kind: "chordTone", index: 2, duration: "quarter" },
    ],
    lengthInMeasures: 1,
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
  if (note.kind === "octave") return 12;
  // chordTone path
  const tones = CHORD_INTERVALS[chord.quality];
  if (note.index < tones.length) return tones[note.index];
  // Chord doesn't have that tone (e.g. triad asked for a 7th). Fall
  // back to the octave — keeps the pattern playable without surprise
  // dissonance.
  return 12;
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
 */
export function resolvePatternForChord(
  pattern: ArpeggioPattern,
  chord: Chord,
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
    const notes: ResolvedNote[] = def.notes.map((n): ResolvedNote => {
      if (n.kind === "rest") {
        return { kind: "rest", label: REST_LABEL, duration: n.duration };
      }
      const semitones = builtInNoteToSemitones(n, chord) ?? 0;
      const label =
        n.kind === "chordTone"
          ? // Use the chord-tone "1/3/5/7" labels for built-ins (the
            // pedagogical concept the user is drilling), not the
            // semitone-offset label (e.g. ♭3) which would expose the
            // chord-quality math under the hood.
            BUILT_IN_LABELS[n.index]
          : SEMITONE_LABELS[semitones] ?? "?";
      return { kind: "note", label, semitones, duration: n.duration };
    });
    return { notes, lengthInMeasures: def.lengthInMeasures };
  }
  return { notes: [], lengthInMeasures: 1 };
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

/** Degree-string subtitle. */
export function getPatternDegrees(pattern: ArpeggioPattern): string {
  if (isBuiltInPattern(pattern)) {
    // Use a sample maj7 chord just to get labels — built-in labels are
    // chord-quality-agnostic ("1", "3", "5", "7"), so the chord here
    // doesn't actually affect the output.
    const resolved = resolvePatternForChord(pattern, {
      root: "C",
      quality: "maj7",
    });
    return resolved.notes.map((n) => n.label).join("-");
  }
  const cp = lookupCustom(pattern);
  return cp ? notesToDegreeString(cp.notes) : "—";
}

/** Note count — used by the subtitle highlight scheduler. */
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

/**
 * Split a pattern's degree string into per-note segments — used by the
 * drill-screen subtitle to render each digit independently for the
 * lit-up animation. Each segment carries the duration so the highlight
 * scheduler can step through them in time. Built-ins are resolved
 * against a sample chord (the labels are chord-quality-agnostic for
 * built-ins; for customs the labels are the literal semitone labels).
 */
export function parsePatternDegrees(
  pattern: ArpeggioPattern,
): Array<{ idx: number; label: string; durationBeats: number }> {
  const resolved = resolvePatternForChord(pattern, {
    root: "C",
    quality: "maj7",
  });
  return resolved.notes.map((n, idx) => ({
    idx,
    label: n.label,
    durationBeats: NOTE_DURATION_BEATS[n.duration],
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
 * Rests emit no MIDI event (filtered out). Both built-ins and customs
 * funnel through `resolvePatternForChord` so the engine is symmetric.
 *
 * NOTE: For the preview button + audio scheduling, this returns ONLY
 * the pitched notes (rests are filtered). If you need the full
 * rhythmic structure (including rests for visual timing), call
 * `resolvePatternForChord` directly.
 */
export function generateArpeggio(
  chord: Chord,
  pattern: ArpeggioPattern,
): number[] {
  const { notes } = resolvePatternForChord(pattern, chord);
  return notes
    .filter((n): n is Extract<ResolvedNote, { kind: "note" }> => n.kind === "note")
    .map((n) =>
      semitoneToMidi(chord.root, ANCHOR_OCTAVE, n.semitones),
    );
}

/* ---------------------------------------------------------------------- */
/* Legacy IDs — preserved as references for the practice-config migration. */
/* ---------------------------------------------------------------------- */
/* Old built-in IDs that the v10→v11 migration remaps to the new set.    */
/* Once a few weeks pass and no one's loading pre-Phase-14 drills, these */
/* can be retired.                                                       */
export const LEGACY_BUILT_IN_PATTERN_IDS = [
  "scale-tones",
  "arp-7ths",
  "triads-with-lt",
  "descending",
] as const;

export function remapLegacyPatternId(id: string): BuiltInPattern {
  // arp-7ths and triads-with-lt are the closest analogues. Scale-tones
  // and descending have no equivalent in the new built-in set, so they
  // also fall back to 7th-chords (closest "warm-up" feel).
  if (id === "triads-with-lt") return "triads";
  return "7th-chords";
}

/* ---------------------------------------------------------------------- */
/* Back-compat record-style exports                                        */
/* ---------------------------------------------------------------------- */
/* Old code used `ARPEGGIO_PATTERN_DISPLAY_NAMES[p]` (record indexing).  */
/* The resolver functions above are the preferred API. These aliases     */
/* keep old indexing on the new built-in IDs working until callsites     */
/* migrate.                                                              */
export const ARPEGGIO_PATTERN_DISPLAY_NAMES: Record<BuiltInPattern, string> = {
  "7th-chords": BUILT_IN_DEFS["7th-chords"].displayName,
  triads: BUILT_IN_DEFS.triads.displayName,
};
export const ARPEGGIO_PATTERN_SHORT_NAMES: Record<BuiltInPattern, string> = {
  "7th-chords": BUILT_IN_DEFS["7th-chords"].shortName,
  triads: BUILT_IN_DEFS.triads.shortName,
};
export const ARPEGGIO_PATTERN_DESCRIPTIONS: Record<BuiltInPattern, string> = {
  "7th-chords": BUILT_IN_DEFS["7th-chords"].description,
  triads: BUILT_IN_DEFS.triads.description,
};
