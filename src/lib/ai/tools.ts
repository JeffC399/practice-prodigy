import { z } from "zod";

/**
 * ai/tools — Slice F.10 (Phase 157).
 *
 * Tool schemas the AI Coach can call in Active mode. Each tool is
 * ADDITIVE for MVP — the model can propose creating a new item, but
 * cannot yet edit or delete anything. Every tool call requires the
 * user to confirm before the client dispatches the mutation.
 *
 * ## Shared design
 *
 * - Schemas are Zod so both the server (validates tool input at
 *   generation time) and the client (validates before dispatch) can
 *   trust the shape.
 * - Names use `propose_` prefix to reinforce that these are
 *   proposals, not fait accompli. The confirmation card wording
 *   matches ("The AI proposes creating this song. Add to library?").
 * - Every tool returns a plain object; the server never executes the
 *   mutation itself — that happens client-side after the user
 *   confirms, so mutations run against the user's local Zustand
 *   stores like every other user action.
 *
 * ## Tools shipped
 *
 *   - propose_song       — add a song to the repertoire
 *   - propose_collection — create a new cross-module collection
 *   - propose_routine    — create a new routine (replaces Passive-mode
 *                          parser for reliability; parser still
 *                          catches drafts when Active mode is off)
 *
 * Skip for MVP:
 *   - edit_routine / edit_song — mutations need more careful UX
 *   - delete_*                 — deletes are risky w/o versioning
 *   - propose_drill            — module-specific config shapes are
 *                                complex; defer until we have shared
 *                                shape helpers
 */

export const proposeSongInputSchema = z.object({
  title: z.string().min(1).describe("The song title. Required."),
  artist: z
    .string()
    .optional()
    .describe("Artist / composer credit if known."),
  songKey: z
    .string()
    .optional()
    .describe("Musical key (e.g. 'C major', 'Bb', 'modal on D')."),
  timeSignature: z
    .string()
    .optional()
    .describe("Time signature (e.g. '4/4', '3/4', 'mixed')."),
  genre: z
    .string()
    .optional()
    .describe("Genre tag (e.g. 'jazz standard', 'blues')."),
  status: z
    .enum(["learning", "polishing", "performance-ready", "retired"])
    .optional()
    .describe(
      "Learning arc status. Defaults to 'learning' for new pieces.",
    ),
  personalNotes: z
    .string()
    .optional()
    .describe(
      "Free-text notes about the piece (focus areas, tricky sections).",
    ),
  targetPerformanceDate: z
    .string()
    .optional()
    .describe("Target date as YYYY-MM-DD if the user set a goal."),
});
export type ProposeSongInput = z.infer<typeof proposeSongInputSchema>;

export const proposeCollectionInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe(
      "Collection name. Required. Should describe what unifies the members (e.g. 'Learn the Fretboard', 'Blues Vocabulary').",
    ),
  emoji: z
    .string()
    .max(4)
    .optional()
    .describe("Optional emoji to visually anchor the collection."),
  color: z
    .string()
    .optional()
    .describe(
      "Optional hex color (e.g. '#f59e0b'). Only used when suggested from a fixed palette.",
    ),
  description: z
    .string()
    .optional()
    .describe("Optional one-line explanation of the collection's purpose."),
});
export type ProposeCollectionInput = z.infer<typeof proposeCollectionInputSchema>;

/**
 * Loose item schema mirroring the plan's Passive-mode draft format.
 * The client's routine-parser (Slice F.5) already knows how to
 * hydrate this shape into RoutineItem variants + validate refs
 * against the library, so we reuse it end-to-end.
 */
const proposeRoutineItemSchema = z.object({
  type: z
    .enum([
      "drill",
      "key-drill",
      "scale-drill",
      "metronome",
      "leadsheet",
      "song",
      "custom",
      "rest",
    ])
    .describe("The item type variant."),
  label: z.string().describe("Human-readable label shown in the routine."),
  category: z
    .string()
    .describe(
      "Category id (e.g. 'technique', 'warmup'). Must be one of the 10 built-in categories or a custom category the user already defined.",
    ),
  estimatedSeconds: z
    .number()
    .int()
    .positive()
    .describe("Rough duration in seconds. 5min = 300."),
  methodologyId: z
    .string()
    .optional()
    .describe(
      "Methodology id if applicable (slow-practice / chunking / etc.).",
    ),
  // Type-specific fields — all optional because the schema is a
  // superset. The parser + client validate that the correct field is
  // set for the declared type before dispatching.
  drillId: z.string().optional(),
  keyDrillId: z.string().optional(),
  scaleDrillId: z.string().optional(),
  leadSheetId: z.string().optional(),
  songId: z.string().optional(),
  instruction: z.string().optional(),
  guidanceText: z.string().optional(),
  bpm: z.number().optional(),
  beatsPerMeasure: z.number().optional(),
  beatUnit: z.number().optional(),
});

export const proposeRoutineInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("Routine name. Required. Concise + descriptive."),
  notes: z
    .string()
    .optional()
    .describe(
      "One-paragraph explanation of the routine's arc. Used as the 'Why this?' panel.",
    ),
  methodologyId: z
    .string()
    .optional()
    .describe(
      "Structural methodology id (interleaved-practice / pomodoro / spaced-repetition / deliberate-practice). Omit for routines without a top-level method.",
    ),
  items: z
    .array(proposeRoutineItemSchema)
    .min(1)
    .describe("Ordered items."),
});
export type ProposeRoutineInput = z.infer<typeof proposeRoutineInputSchema>;

/**
 * The full tool set exposed to the model in Active mode. Keys are the
 * exact tool names the model calls; the AI SDK v7 wires the object
 * into `streamText({ tools })` on the server route.
 */
export const activeModeToolInputSchemas = {
  propose_song: proposeSongInputSchema,
  propose_collection: proposeCollectionInputSchema,
  propose_routine: proposeRoutineInputSchema,
} as const;

export type ActiveModeToolName = keyof typeof activeModeToolInputSchemas;
