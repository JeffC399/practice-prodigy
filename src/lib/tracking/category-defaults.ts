import type { CategoryId } from "@/lib/practice/categories";
import type { PracticeModule } from "@/lib/practice/types";

/**
 * Per-module default category assignment — Slice A.6 (Phase 86).
 *
 * When a user drills a saved tool that has its own category, that
 * override wins (Slice A.9 lands the per-item override UI). For
 * everything else, this map decides which category the practice
 * time gets attributed to.
 *
 * Source of truth: ROUTINE-DESIGN.md §5.2.
 */
export const MODULE_DEFAULT_CATEGORY: Record<PracticeModule, CategoryId> = {
  arpeggios: "technique",
  "key-sequencer": "technique",
  "scale-driller": "technique",
  metronome: "warmup",
  "lsb-playback": "repertoire",
  // Routine execution assigns per-item categories (Slice B); the
  // module-level default is a rarely-hit fallback for a routine
  // item that somehow has no category set. Technique is a sensible
  // catch-all for that edge case.
  "my-practice": "technique",
};
