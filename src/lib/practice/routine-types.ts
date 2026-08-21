import type { CategoryId } from "./categories";

/**
 * Routine + RoutineItem types — Slice B.1 (Phase 101).
 *
 * The core data model for the My Practice module. Users build routines
 * as ordered sequences of RoutineItems; each item points at a saved
 * tool (drill, sheet, song) or embeds its own config (metronome, rest,
 * custom instructions). Routine execution walks the list and takes
 * over each drilling module's own screen with a "Routine: item 3 of 7"
 * chip so the module UX stays familiar.
 *
 * Authoritative shape lives in ROUTINE-DESIGN.md §12.3.
 *
 * ## Discriminated union
 *
 * `RoutineItem` is a discriminated union on `type`. Adding a new item
 * type (e.g. Chords when that module ships) means one new variant here
 * + a new composer component + a new launcher — no core changes to
 * the routine executor.
 *
 * ## Not yet in v1 UI (types included for future-proofing)
 *
 *   - "song" — Songs library ships in Slice C
 *   - "ear-training" — future module
 *
 * The composer skips these types in the item-type picker until each
 * module lands, but the union already knows about them so the executor
 * doesn't need type extension later.
 */

/**
 * Methodology id — resolves via Slice E's methodology library. Typed
 * here as a plain string alias to avoid a cross-slice dependency; the
 * v0.5 build plan §3.5 (Slice E) will provide the real union.
 */
export type MethodologyId = string;

/**
 * Provenance — how the routine came to exist. Drives per-source
 * behaviors (e.g. AI-generated routines get a "Made by AI" tag,
 * template-derived routines link back to the methodology entry).
 */
export type RoutineSource = "manual" | "ai-coach" | "template";

/** Every RoutineItem variant carries these fields. */
export type RoutineItemBase = {
  /** Stable id for drag-reorder + player state. */
  id: string;
  /** Free-text label shown in the item chip + executor chrome. */
  label: string;
  /**
   * The activity category this item practices. Feeds the session
   * tracker + reports rollups. Required — every item is categorized.
   */
  category: CategoryId;
  /**
   * User's estimate for how long they'll spend on this item. Used
   * for the "total routine time" pill in the builder + the item
   * time budget hint in the player. NOT enforced — drill items can
   * run longer than their estimate.
   */
  estimatedSeconds: number;
  /** Optional per-item notes shown in the composer + executor. */
  notes?: string;
  /**
   * v0.4 — Optional methodology reference. When set, this item is
   * being practiced using that method (Slow Practice, Chunking, etc.).
   * Slice B.13 wires the composer picker; Slice E provides the
   * methodology library. Undefined = no specific method.
   */
  methodologyId?: MethodologyId;
};

/**
 * All eight item variants. The `type` discriminant tells the executor
 * which launcher to invoke; the extra fields carry the tool reference
 * or embedded config the launcher needs.
 */
export type RoutineItem =
  | (RoutineItemBase & { type: "drill"; drillId: string })
  | (RoutineItemBase & { type: "key-drill"; keyDrillId: string })
  | (RoutineItemBase & { type: "scale-drill"; scaleDrillId: string })
  | (RoutineItemBase & {
      type: "metronome";
      bpm: number;
      beatsPerMeasure: number;
      beatUnit: number;
      /** Optional per-beat accent overrides (0 = silent, 1 = normal, 2 = accent). */
      accentPattern?: number[];
    })
  | (RoutineItemBase & { type: "leadsheet"; leadSheetId: string })
  // Future — types included so the executor + syncable JSON blob
  // don't need widening later. UI-side composer + launcher land with
  // their module.
  | (RoutineItemBase & { type: "song"; songId: string })
  | (RoutineItemBase & { type: "rest"; guidanceText?: string })
  | (RoutineItemBase & { type: "custom"; instruction: string })
  | (RoutineItemBase & { type: "ear-training"; setId: string });

export type RoutineItemType = RoutineItem["type"];

/**
 * The eight item variants ordered as they appear in the item-type
 * picker. Rest is last because it's the fallback for "I don't want a
 * tool, I want a break." Song / ear-training rendered as disabled +
 * "Coming soon" until their modules land.
 */
export const ROUTINE_ITEM_TYPES: readonly RoutineItemType[] = [
  "drill",
  "key-drill",
  "scale-drill",
  "metronome",
  "leadsheet",
  "song",
  "ear-training",
  "custom",
  "rest",
] as const;

/** Human-readable labels for the item-type picker + item chips. */
export const ROUTINE_ITEM_TYPE_LABELS: Record<RoutineItemType, string> = {
  drill: "Bass Arpeggios drill",
  "key-drill": "Key Sequencer drill",
  "scale-drill": "Scale Driller drill",
  metronome: "Metronome",
  leadsheet: "Lead Sheet",
  song: "Song (Slice C)",
  "ear-training": "Ear Training (future)",
  custom: "Custom activity",
  rest: "Rest",
};

/** One-line explanation shown in the item-type picker on hover / press. */
export const ROUTINE_ITEM_TYPE_DESCRIPTIONS: Record<RoutineItemType, string> = {
  drill: "Play a saved Bass Arpeggios drill.",
  "key-drill": "Play a saved Key Sequencer drill.",
  "scale-drill": "Play a saved Scale Driller drill.",
  metronome: "Bare metronome at a chosen tempo + meter.",
  leadsheet: "Play back a saved lead sheet.",
  song: "Work on a saved song. Ships in Slice C.",
  "ear-training": "Ear training set. Future module.",
  custom: "Free-form activity — any instruction you type.",
  rest: "A silent break with optional guidance text.",
};

/**
 * A saved routine — the top-level entity in the routines library.
 * Persisted locally via Zustand + synced to cloud via the standard
 * SyncAdapter pattern (see src/lib/sync/adapters/routines.ts).
 */
export type Routine = {
  /** Stable client-generated text id (`routine_${base36}_${suffix}`). */
  id: string;
  /** User-authored name. Displayed in the routine card + player chrome. */
  name: string;
  /** Optional free-text notes shown in the composer + card. */
  notes?: string;
  /** Ordered list; drag-reorder in the builder mutates this array. */
  items: RoutineItem[];
  /** ms epoch when the routine was first saved. */
  createdAt: number;
  /** ms epoch — bumped on any mutation. LWW anchor for sync. */
  updatedAt: number;
  /**
   * ms epoch of the most recent full or partial execution. Drives
   * the "Recently used" sort on the routines tab. Undefined =
   * never run yet.
   */
  lastRunAt?: number;
  /**
   * v0.5 — Routine-level (structural) methodology. Only methodologies
   * scoped "per-routine" or "either" can go here. See ROUTINE-DESIGN.md
   * §7.5. Undefined = no structural method chosen. Slice B.13.5 wires
   * the builder picker.
   */
  methodologyId?: MethodologyId;
  /** How was this routine created? */
  source: RoutineSource;
  /**
   * Provenance reference matching `source`:
   *   - template → methodology entry id
   *   - ai-coach → conversation id
   *   - manual   → undefined
   */
  sourceRef?: string;
  /**
   * Future — teacher-mode authoring. When teacher assigns a routine to
   * students, authorId is the teacher and assigneeIds are the students.
   * Not surfaced in v1 UI but the field is in the type so future
   * migrations don't have to widen it.
   */
  authorId?: string;
  assigneeIds?: string[];
};

/** Generate a fresh routine id in the standard prefix format. */
export function newRoutineId(): string {
  return `routine_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Generate a fresh routine-item id in the standard prefix format. */
export function newRoutineItemId(): string {
  return `ritem_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Sum estimatedSeconds across all items in a routine — used by the
 * builder's live "total time" chip and the routine card's summary.
 * Missing / zero estimates count as zero.
 */
export function totalEstimatedSeconds(routine: Routine): number {
  let sum = 0;
  for (const item of routine.items) {
    if (item.estimatedSeconds > 0) sum += item.estimatedSeconds;
  }
  return sum;
}
