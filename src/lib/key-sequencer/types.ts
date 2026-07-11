/**
 * Key Sequencer — types (Phase 45.0).
 *
 * The Key Sequencer is Practice Prodigy's second drilling module.
 * Instead of specific chords, users pick a pool of KEYS + layer 0-3
 * PROMPT ROWS of free-text words on top. Each measure surfaces the
 * current key plus one word from each prompt row. Composability from
 * a small text substrate — 22 pieces of text can generate hundreds of
 * unique drill combinations.
 *
 * Audio is intentionally silent + metronome only (locked 2026-07-11).
 * Truly instrument-neutral: pianist / guitarist / vocalist / any.
 *
 * See KEY-SEQUENCER-DESIGN.md for the full design pass.
 */

import type {
  OrderingStrategy,
  TimeSignature,
} from "@/lib/state/practice-config";
import type { PitchClass } from "@/lib/music/chord";

export type KeyPitchClass = PitchClass;

/**
 * Prompt-row ordering — narrower than OrderingStrategy because free-
 * text prompts have no pitch class / cycle position, so the chromatic
 * / cycle-of-5ths / cycle-of-4ths strategies don't apply.
 */
export const PROMPT_ROW_ORDERINGS = [
  "custom",
  "randomReplace",
  "randomShuffleOnce",
  "randomShuffleEachPass",
] as const;
export type PromptRowOrdering = (typeof PROMPT_ROW_ORDERINGS)[number];

export const PROMPT_ROW_ORDERING_DISPLAY_NAMES: Record<
  PromptRowOrdering,
  string
> = {
  custom: "Cycle (in order)",
  randomReplace: "Random with replacement",
  randomShuffleOnce: "Random shuffled (once)",
  randomShuffleEachPass: "Random shuffled (each rep)",
};

/**
 * One row of user-authored prompts. Users type any free text they
 * want — the app doesn't validate against music theory. "Play upside
 * down," "Backwards," "Left hand only" are all legal words.
 */
export type PromptRow = {
  /** Stable id for drag-reorder / animation. */
  id: string;
  /** Optional row label — "Quality", "Pattern", "Direction", etc. */
  label?: string;
  /** Free-text words, one per line in the UI. Max 24 chars each. */
  words: string[];
  ordering: PromptRowOrdering;
};

/** Cap on words per row + row max prompted length (per design §11). */
export const KEY_SEQUENCER_MAX_ROWS = 3;
export const KEY_SEQUENCER_MAX_WORD_LENGTH = 24;
export const KEY_SEQUENCER_MAX_WORDS_PER_ROW = 32;

/**
 * Enharmonic display preference. "auto" cycles context-aware — flats
 * for cycle-of-5ths / cycle-of-4ths order, sharps for chromatic
 * ascending, flats for chromatic descending, user-typed for custom.
 */
export const ENHARMONIC_PREFERENCES = ["auto", "sharps", "flats"] as const;
export type EnharmonicPreference = (typeof ENHARMONIC_PREFERENCES)[number];

/**
 * Voice-announcement template — how the utterance is composed.
 *
 *   "key-then-rows": "A-flat. Minor seventh. Ascending."
 *   "key-only":      "A-flat."
 */
export const VOICE_ANNOUNCE_TEMPLATES = ["key-then-rows", "key-only"] as const;
export type VoiceAnnounceTemplate = (typeof VOICE_ANNOUNCE_TEMPLATES)[number];

export type VoiceAnnounce = {
  enabled: boolean;
  /** How many beats before the next measure the utterance fires. Default 2. */
  leadBeats: number;
  /** Speech rate multiplier (0.5 – 2.0). Default 1.0. */
  rate: number;
  /** Utterance format. */
  template: VoiceAnnounceTemplate;
};

/**
 * Full config for one Key Sequencer session. Mirrors the shape of
 * PracticeConfig (Bass Arpeggios) where it makes sense, so shared
 * substrate — metronome, count-in, layouts — plugs in cleanly.
 */
export type KeySequencerConfig = {
  /** 1..12 keys drawn from the 12 pitch classes. */
  keyPool: KeyPitchClass[];
  keyOrdering: OrderingStrategy;

  /** 0..KEY_SEQUENCER_MAX_ROWS prompt rows. */
  promptRows: PromptRow[];

  /**
   * @deprecated Superseded by transitionUnit / transitionMeasures /
   * transitionBeats. Kept in the type for existing user data; the
   * default config no longer sets it and the sequencer / UI both use
   * the new prep-between-keys system. Free to remove after a v2
   * migration.
   */
  restMeasuresBetweenKeys: number;

  /**
   * Phase 46 — Prep between keys. Mirrors the Bass Arpeggios
   * "transition" system: inserted BETWEEN key groups, played with
   * stick-click audio + "Get ready" visual state so users get an
   * unambiguous heads-up before the next key starts.
   */
  transitionUnit?: "measures" | "beats";
  transitionMeasures?: number; // 0..4
  transitionBeats?: number;    // 0..16

  /** Standard drill config shared with Bass Arpeggios substrate. */
  bpm: number;
  timeSignature: TimeSignature;
  /** How many measures a single key surfaces before advancing. */
  measuresPerKey: number;
  /** Passes through the pool. Ignored when repeatIndefinitely = true. */
  repetitions: number;
  repeatIndefinitely: boolean;
  countInMeasures: number;

  enharmonicPreference?: EnharmonicPreference;
  voiceAnnounce?: VoiceAnnounce;

  /**
   * Phase 45.4 — When the config was loaded from a saved KeyDrill,
   * this is that drill's id. Drives the "Editing: X" badge on the
   * setup page and enables Save-changes (overwrite) semantics.
   * Undefined = ad-hoc setup with no saved drill backing it.
   */
  loadedKeyDrillId?: string;
};

/** Saved drill in the user's Key Sequencer library. */
export type KeyDrill = {
  id: string;
  name: string;
  notes?: string;
  config: KeySequencerConfig;
  createdAt: number;
  updatedAt: number;
  lastLoadedAt?: number;
  /**
   * Phase 46 — Flag on drills that came from STARTER_TEMPLATES so the
   * setup page can split "Your drills" (user-owned) from "Templates"
   * (starter-owned, collapsible). Duplicating a starter deliberately
   * strips this flag so the copy becomes a user drill.
   */
  isStarter?: boolean;
};

/** Fresh drill id generator. */
export function newKeyDrillId(): string {
  return `keydrill_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Fresh prompt-row id generator. */
export function newPromptRowId(): string {
  return `prow_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/**
 * Default config for a fresh Key Sequencer session. Deliberately
 * minimal: all 12 keys in cycle-of-5ths order, no prompt rows, a
 * comfortable practice tempo. Users add prompt rows on top of this
 * as they define what they want to practice.
 */
export const DEFAULT_KEY_SEQUENCER_CONFIG: KeySequencerConfig = {
  keyPool: ["C", "F", "A#", "D#", "G#", "C#", "F#", "B", "E", "A", "D", "G"],
  keyOrdering: "cycleOf5ths",
  promptRows: [],
  restMeasuresBetweenKeys: 0,
  transitionUnit: "measures",
  transitionMeasures: 0,
  transitionBeats: 0,
  bpm: 90,
  timeSignature: { beatsPerMeasure: 4, beatUnit: 4 },
  measuresPerKey: 2,
  repetitions: 2,
  repeatIndefinitely: false,
  countInMeasures: 1,
  enharmonicPreference: "auto",
};
