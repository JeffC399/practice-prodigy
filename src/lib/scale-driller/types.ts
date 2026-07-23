/**
 * Scale Driller — types (Phase 62).
 *
 * Practice Prodigy's third drilling module. Sits alongside Arpeggios
 * and Key Sequencer with the same substrate: metronome-timed pool
 * cycling, ordering strategies, count-in, prep windows, session
 * settings. The unit of drill here is a "scale instance" — one root
 * (pitch class) paired with one scale quality (Major, Dorian,
 * Pentatonic, ...). The user builds a POOL of scale instances by
 * picking N scales × M keys; each measure surfaces one combo.
 *
 * Design intent (locked 2026-07-12):
 *   • Instrument-neutral, silent + metronome only (same as Key
 *     Sequencer). Your instrument is whatever you're holding.
 *   • Display mode is per-drill: notes ("D E F G A B C") or degrees
 *     ("1 2 ♭3 4 5 6 ♭7"). Users pick what serves their pedagogy.
 *   • The scale vocabulary comes from SCALE_INTERVALS in
 *     src/lib/music/intervals.ts so Arpeggios + Scale Driller share
 *     one canonical table (change once, both modules benefit).
 */

import type {
  OrderingStrategy,
  TimeSignature,
} from "@/lib/state/practice-config";
import type { PitchClass } from "@/lib/music/chord";

export type ScalePitchClass = PitchClass;

/**
 * The scale qualities the user can pick in v1. These map to keys in
 * SCALE_INTERVALS. Ordered by pedagogical familiarity so the UI
 * naturally suggests common picks first.
 */
export const SCALE_QUALITIES = [
  "ionian",
  "dorian",
  "phrygian",
  "lydian",
  "mixolydian",
  "aeolian",
  "locrian",
  "majorPentatonic",
  "minorPentatonic",
  "blues",
  "harmonicMinor",
  "melodicMinor",
  "wholeTone",
  "diminished",
  "chromatic",
] as const;
export type ScaleQuality = (typeof SCALE_QUALITIES)[number];

/**
 * User-facing scale names. Kept alongside the ids so display is a
 * single-table lookup — no free-floating "Major"/"Ionian" strings
 * scattered across components.
 */
export const SCALE_DISPLAY_NAMES: Record<ScaleQuality, string> = {
  ionian: "Major",
  dorian: "Dorian",
  phrygian: "Phrygian",
  lydian: "Lydian",
  mixolydian: "Mixolydian",
  aeolian: "Minor",
  locrian: "Locrian",
  majorPentatonic: "Major Pentatonic",
  minorPentatonic: "Minor Pentatonic",
  blues: "Blues",
  harmonicMinor: "Harmonic Minor",
  melodicMinor: "Melodic Minor",
  wholeTone: "Whole Tone",
  diminished: "Diminished (W-H)",
  chromatic: "Chromatic",
};

/**
 * Phase 66 — Visual groupings for the setup-page Scales checkbox
 * grid. Purely a display convention (the sequencer and store don't
 * consume it), but pedagogically important: putting Church modes
 * together, Pentatonic + Blues together, etc. teaches the user
 * "here's where each scale lives in the family tree." Also drives
 * the quick-preset chips ("Select all Church modes" etc.).
 */
export const SCALE_GROUPS: Array<{
  label: string;
  /** Slug used by quick-preset chip ids so URL-share codes are stable. */
  slug: string;
  qualities: ScaleQuality[];
}> = [
  {
    label: "Church modes",
    slug: "church",
    qualities: [
      "ionian",
      "dorian",
      "phrygian",
      "lydian",
      "mixolydian",
      "aeolian",
      "locrian",
    ],
  },
  {
    label: "Pentatonic & Blues",
    slug: "pentatonic",
    qualities: ["majorPentatonic", "minorPentatonic", "blues"],
  },
  {
    label: "Jazz tension",
    slug: "jazz-tension",
    qualities: ["harmonicMinor", "melodicMinor"],
  },
  {
    label: "Symmetric & Chromatic",
    slug: "symmetric",
    qualities: ["wholeTone", "diminished", "chromatic"],
  },
];

/**
 * Short label used on compact chips + summary lines (setup page). Full
 * names shine on the drill screen; compact labels keep pool summaries
 * readable when many scales are selected.
 */
export const SCALE_SHORT_LABELS: Record<ScaleQuality, string> = {
  ionian: "Maj",
  dorian: "Dor",
  phrygian: "Phr",
  lydian: "Lyd",
  mixolydian: "Mix",
  aeolian: "Min",
  locrian: "Loc",
  majorPentatonic: "Maj Pent",
  minorPentatonic: "Min Pent",
  blues: "Blues",
  harmonicMinor: "Harm Min",
  melodicMinor: "Mel Min",
  wholeTone: "Whole",
  diminished: "Dim",
  chromatic: "Chrom",
};

/**
 * How the Now / Next panes render the scale's contents below the big
 * name. Persisted per-drill so different drills can favor different
 * pedagogies.
 *   notes   — "D E F G A B C"  (letter names in the drill's enharmonic mode)
 *   degrees — "1 2 ♭3 4 5 6 ♭7" (interval recipe from the root)
 */
export const SCALE_DISPLAY_MODES = ["notes", "degrees"] as const;
export type ScaleDisplayMode = (typeof SCALE_DISPLAY_MODES)[number];

export const SCALE_DISPLAY_MODE_LABELS: Record<ScaleDisplayMode, string> = {
  notes: "Notes (D E F G ...)",
  degrees: "Degrees (1 2 ♭3 4 ...)",
};

export const SCALE_DISPLAY_MODE_DESCRIPTIONS: Record<ScaleDisplayMode, string> = {
  notes:
    "Spell each scale in letter names. Best for drilling actual finger patterns / note names by rote.",
  degrees:
    "Show the interval recipe (1, 2, ♭3, ...) instead of letter names. Best for theory-first practice — you translate the recipe onto your instrument.",
};

/**
 * Enharmonic display preference. "auto" cycles context-aware — flats
 * for cycle-of-5ths / cycle-of-4ths order, sharps for chromatic
 * ascending, flats otherwise. Shared with Key Sequencer.
 */
export const ENHARMONIC_PREFERENCES = ["auto", "sharps", "flats"] as const;
export type EnharmonicPreference = (typeof ENHARMONIC_PREFERENCES)[number];

/**
 * One entry in the user's scale pool. Root + quality make up a full
 * "scale instance" — e.g. `{ root: "D", quality: "dorian" }` = D Dorian.
 */
export type ScaleInstance = {
  root: ScalePitchClass;
  quality: ScaleQuality;
};

/** Voice-announcement template — mirrors Key Sequencer's shape. */
export const VOICE_ANNOUNCE_TEMPLATES = ["full", "name-only"] as const;
export type VoiceAnnounceTemplate = (typeof VOICE_ANNOUNCE_TEMPLATES)[number];

export type VoiceAnnounce = {
  enabled: boolean;
  leadBeats: number;
  rate: number;
  template: VoiceAnnounceTemplate;
};

/**
 * Full config for a Scale Driller session. Mirrors KeySequencerConfig
 * where semantics overlap so the shared substrate (metronome hook,
 * count-in, transitions, ordering strategies) plugs in cleanly.
 */
export type ScaleDrillConfig = {
  /** Pool of scale instances the user cycles through. */
  scalePool: ScaleInstance[];
  /** Ordering strategy for the scale-instance pool. */
  ordering: OrderingStrategy;

  /**
   * Prep between scale changes — same mechanism as Key Sequencer's
   * transitionMeasures / transitionBeats. Stick-click audio + "Get
   * ready" visual state during prep.
   */
  transitionUnit?: "measures" | "beats";
  transitionMeasures?: number; // 0..4
  transitionBeats?: number;    // 0..16

  /** Standard drill config shared with the other modules. */
  bpm: number;
  timeSignature: TimeSignature;
  /** How many measures a single scale instance surfaces before advancing. */
  measuresPerScale: number;
  repetitions: number;
  repeatIndefinitely: boolean;
  countInMeasures: number;

  enharmonicPreference?: EnharmonicPreference;
  /** notes vs degrees. Defaults to "notes" for beginners. */
  displayMode: ScaleDisplayMode;

  voiceAnnounce?: VoiceAnnounce;

  /**
   * When the config was loaded from a saved ScaleDrill, this is that
   * drill's id. Drives the "Editing: X" badge on the setup page.
   */
  loadedScaleDrillId?: string;
};

/** Saved drill in the user's Scale Driller library. */
export type ScaleDrill = {
  id: string;
  name: string;
  notes?: string;
  config: ScaleDrillConfig;
  createdAt: number;
  updatedAt: number;
  lastLoadedAt?: number;
  /** True when the drill came from STARTER_TEMPLATES (built-in library). */
  isStarter?: boolean;
  /**
   * Slice A.10 (Phase 90) — Per-drill category override for the
   * session tracker. See KeyDrill.category for details.
   */
  category?: string;
};

/** Fresh drill id generator. */
export function newScaleDrillId(): string {
  return `scaledrill_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Fresh-slate defaults — no scales selected so the setup page reads
 * as a blank canvas when the user lands with no drill loaded.
 * Comfortable practice tempo, 4/4, 2 measures per scale, 2 passes,
 * 1-measure count-in — same numeric feel as Key Sequencer's defaults.
 */
export const DEFAULT_SCALE_DRILL_CONFIG: ScaleDrillConfig = {
  scalePool: [],
  ordering: "custom",
  transitionUnit: "measures",
  transitionMeasures: 0,
  transitionBeats: 0,
  bpm: 90,
  timeSignature: { beatsPerMeasure: 4, beatUnit: 4 },
  measuresPerScale: 2,
  repetitions: 2,
  repeatIndefinitely: false,
  countInMeasures: 1,
  enharmonicPreference: "auto",
  displayMode: "notes",
};
