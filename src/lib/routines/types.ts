import type { MetronomeSound } from "@/lib/audio/standalone-metronome";

/**
 * Cross-module RoutineItem interface.
 *
 * The composition layer that turns Practice Prodigy from "a collection
 * of tools" into "a platform musicians actually use." See
 * [ROUTINE-DESIGN.md](../../../ROUTINE-DESIGN.md) for the full design.
 *
 * v0.1 ships two RoutineItem types (drill + metronome). Each new
 * module adds a new variant to the discriminated union below. The
 * discriminated-over-polymorphic choice gives us exhaustive type
 * narrowing, loose coupling between modules, and forward-compat for
 * adding modules without touching existing code.
 *
 * Per the design doc, each module that opts in owes four small
 * exports: Type variant (here) + Launcher + Composer + Renderer.
 * Phase 22 (My Practice v0.1) wires up the Launcher/Composer/Renderer
 * interfaces; this file establishes the data shape.
 */

type RoutineItemBase = {
  /** Stable id within the routine. */
  id: string;
  /** Display label shown in the routine list + during execution. */
  label: string;
  /**
   * Estimated duration in seconds. Used for planning + execution
   * progress display. Not a hard limit — users can spend more or less
   * time on any item.
   */
  estimatedSeconds: number;
  /** Optional per-item user note ("focus on left-hand independence"). */
  notes?: string;
};

/**
 * Drill RoutineItem — references a saved drill in the user's
 * drills-library. If the referenced drill is missing (deleted), the
 * routine player surfaces a clear "missing drill" state and offers
 * skip / re-target.
 */
export type DrillRoutineItem = RoutineItemBase & {
  type: "drill";
  drillId: string;
};

/**
 * Metronome RoutineItem — a metronome session at a specific BPM /
 * meter / duration. The polyrhythm + ramp + drop fields are optional
 * so simple "just play 80 BPM for 5 minutes" items stay simple.
 */
export type MetronomeRoutineItem = RoutineItemBase & {
  type: "metronome";
  bpm: number;
  beatsPerMeasure: number;
  beatUnit: number;
  subdivisionsPerBeat: 1 | 2 | 3 | 4;
  sound: MetronomeSound;
  /** Optional polyrhythm secondary pulse. */
  polyrhythm?: {
    hitsPerMeasure: number;
    sound: MetronomeSound;
  };
  /** Optional tempo ramp. */
  tempoRamp?: {
    startBpm: number;
    endBpm: number;
    overMeasures: number;
  };
};

/**
 * Tuner RoutineItem — a tuning check step. Typically very short
 * (30–60 seconds) at the start of a routine to confirm the
 * instrument is in tune before playing.
 */
export type TunerRoutineItem = RoutineItemBase & {
  type: "tuner";
  /** Optional A4 reference Hz to load (defaults to user's last setting). */
  referenceA4?: number;
};

/**
 * Lead Sheet RoutineItem — references a saved lead sheet from the
 * sheets-library. The routine player navigates to the sheet's view
 * page and the user plays through it for the estimated duration.
 */
export type SheetRoutineItem = RoutineItemBase & {
  type: "sheet";
  sheetId: string;
  /** Optional repetition count (play through N times). */
  repetitions?: number;
};

/**
 * The full discriminated union. Add new module variants here as they
 * ship. Adding a variant is a non-breaking change — existing code
 * paths that switch on `type` get a TypeScript exhaustiveness warning
 * to remind the author.
 */
export type RoutineItem =
  | DrillRoutineItem
  | MetronomeRoutineItem
  | TunerRoutineItem
  | SheetRoutineItem;

/** Type guard for narrowing. */
export function isMetronomeItem(item: RoutineItem): item is MetronomeRoutineItem {
  return item.type === "metronome";
}

export function isDrillItem(item: RoutineItem): item is DrillRoutineItem {
  return item.type === "drill";
}

export function isTunerItem(item: RoutineItem): item is TunerRoutineItem {
  return item.type === "tuner";
}

export function isSheetItem(item: RoutineItem): item is SheetRoutineItem {
  return item.type === "sheet";
}

/**
 * A complete routine — named list of items that can be played end-to-end.
 */
export type Routine = {
  id: string;
  name: string;
  notes?: string;
  items: RoutineItem[];
  createdAt: number;
  updatedAt: number;
  /** Last time the user launched this routine. Drives Quick-Start sort. */
  lastRunAt?: number;

  /* --- Forward-compat fields for teacher mode (v2+). Nullable in v0.1. --- */
  /** Optional: who created this routine. */
  authorId?: string;
  /** Optional: who this routine is assigned to (teacher-mode). */
  assigneeIds?: string[];
  /** Optional: due date for assigned routines. */
  dueAt?: number;
};

/**
 * One specific run of a routine. v0.1 persists at most one active
 * execution at a time (no history); v0.2+ adds history + stats.
 */
export type RoutineExecution = {
  routineId: string;
  startedAt: number;
  endedAt?: number;
  itemStates: Array<{
    itemId: string;
    status: "pending" | "active" | "completed" | "skipped";
    finishedAt?: number;
    actualSeconds?: number;
  }>;
  /** Forward-compat: free-text reflection (teacher-mode submissions). */
  reflection?: string;
};

/** Convenience: total estimated time across all items in a routine. */
export function totalEstimatedSeconds(routine: Routine): number {
  return routine.items.reduce((acc, item) => acc + item.estimatedSeconds, 0);
}

/** Generate a stable item id. */
export function newRoutineItemId(): string {
  return `ri_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
