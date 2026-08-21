import type { CategoryId } from "./categories";
import type { MethodologyId } from "./routine-types";

/**
 * Methodology library — Slice B.13 (Phase 113).
 *
 * Built-in list of the 8 well-regarded practice methodologies. Full
 * article bodies + templates + AI-integration land in Slice E's
 * methodology library UI; this file ships the minimum needed to
 * populate composer dropdowns in Slices B.13 / B.13.5.
 *
 * Source of truth for the list, scope, and smart-default mapping:
 * ROUTINE-DESIGN.md §7.3.
 */

/**
 * Where the methodology can be attached (per ROUTINE-DESIGN.md §7.5):
 *   - "per-item":    only on individual RoutineItems. About HOW to
 *                    execute one activity (Slow Practice, Chunking).
 *   - "per-routine": only on the routine's top-level methodologyId.
 *                    About how items relate over time (Interleaved,
 *                    Pomodoro, Spaced Repetition).
 *   - "either":      valid at both scopes (Deliberate Practice).
 *
 * Composer dropdowns filter by scope automatically.
 */
export type MethodologyScope = "per-item" | "per-routine" | "either";

export type MethodologyEntry = {
  id: MethodologyId;
  /** Short user-facing name. Matches the dropdown label. */
  name: string;
  /** One-line description shown in the dropdown option's title tooltip. */
  summary: string;
  scope: MethodologyScope;
};

/**
 * The 8 built-in methodologies. Order chosen so the most commonly
 * picked ones sit near the top (Slow Practice + Chunking together
 * cover most technique + repertoire items).
 */
export const BUILTIN_METHODOLOGIES: MethodologyEntry[] = [
  {
    id: "slow-practice",
    name: "Slow Practice",
    summary:
      "Deliberate under-tempo work to solidify accuracy before speed.",
    scope: "per-item",
  },
  {
    id: "chunking",
    name: "Chunking",
    summary:
      "Break the piece into small learnable units; master each, then assemble.",
    scope: "per-item",
  },
  {
    id: "deliberate-practice",
    name: "Deliberate Practice",
    summary:
      "Focused, effortful work on specific weaknesses with immediate feedback.",
    scope: "either",
  },
  {
    id: "slow-loop",
    name: "Slow Loop",
    summary: "Surgical repetition of one lick or passage until it locks in.",
    scope: "per-item",
  },
  {
    id: "mental-practice",
    name: "Mental Practice",
    summary:
      "Executing the material without the instrument — visualization / audiation.",
    scope: "per-item",
  },
  {
    id: "interleaved-practice",
    name: "Interleaved Practice",
    summary:
      "Mix multiple skills within a session — slower to feel productive, better retention.",
    scope: "per-routine",
  },
  {
    id: "pomodoro",
    name: "Pomodoro",
    summary: "25-minute focus blocks separated by 5-minute rests.",
    scope: "per-routine",
  },
  {
    id: "spaced-repetition",
    name: "Spaced Repetition",
    summary:
      "Revisit material at increasing intervals to lock in long-term memory.",
    scope: "per-routine",
  },
];

const BY_ID = new Map(BUILTIN_METHODOLOGIES.map((m) => [m.id, m]));

/** Resolve a methodology id to its display meta. Null when unknown. */
export function getMethodology(
  id: MethodologyId | undefined,
): MethodologyEntry | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

/** Methodologies allowed on an individual RoutineItem (per-item + either). */
export function getPerItemMethodologies(): MethodologyEntry[] {
  return BUILTIN_METHODOLOGIES.filter(
    (m) => m.scope === "per-item" || m.scope === "either",
  );
}

/** Methodologies allowed at the routine level (per-routine + either). */
export function getPerRoutineMethodologies(): MethodologyEntry[] {
  return BUILTIN_METHODOLOGIES.filter(
    (m) => m.scope === "per-routine" || m.scope === "either",
  );
}

/**
 * Smart default methodology for a category (per-item scope). Returns
 * undefined for categories where no default is opinionated (Warmup,
 * Improvisation, etc.) — the composer's dropdown just starts on "—".
 *
 * Source: ROUTINE-DESIGN.md §7.3 table.
 */
export function defaultMethodologyForCategory(
  categoryId: CategoryId,
): MethodologyId | undefined {
  switch (categoryId) {
    case "technique":
      return "slow-practice";
    case "repertoire":
      return "chunking";
    case "transcription":
      return "chunking";
    case "recording-listening":
      return "mental-practice";
    // No default — user picks or leaves blank:
    case "warmup":
    case "ear-training":
    case "sight-reading":
    case "theory":
    case "improvisation":
    case "cool-down":
    default:
      return undefined;
  }
}
