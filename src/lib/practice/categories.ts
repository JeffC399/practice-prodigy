/**
 * Practice categories — Slice A.6 (Phase 86).
 *
 * The 10 built-in activity categories every practice session gets
 * tagged with. Users can layer their own custom categories on top
 * (stored in useUserPrefs.customCategories per Slice E).
 *
 * Full design in ROUTINE-DESIGN.md §4. Categories are the user's
 * mental model ("today I want to work on Repertoire"); reports
 * aggregate by category; the AI Coach uses them to weight routines.
 *
 * ## Id shape
 *
 * CategoryId is a plain `string` rather than a literal union. Reasons:
 *   - Custom categories are user-picked names (already stringy)
 *   - The `data jsonb` column stores them naturally
 *   - The 10 built-ins are exposed as a typed `const` array for
 *     exhaustive iteration + type-safe lookups
 *
 * Use `isBuiltinCategoryId()` when you need to distinguish built-in
 * vs custom (e.g. to look up display metadata).
 */

export type CategoryId = string;

/** The 10 built-in category ids. Ordered by conventional flow of a session. */
export const BUILTIN_CATEGORY_IDS = [
  "warmup",
  "technique",
  "repertoire",
  "ear-training",
  "sight-reading",
  "theory",
  "improvisation",
  "transcription",
  "recording-listening",
  "cool-down",
] as const;

export type BuiltinCategoryId = (typeof BUILTIN_CATEGORY_IDS)[number];

export function isBuiltinCategoryId(id: string): id is BuiltinCategoryId {
  return (BUILTIN_CATEGORY_IDS as readonly string[]).includes(id);
}

/**
 * Per-category display metadata. Icons come from Lucide (mapped in
 * the UI layer to avoid pulling the icon lib into a data-only file).
 * Colors are OKLCH hex-ish approximations chosen for legibility in
 * dark mode + pie-chart differentiation.
 */
export type CategoryMeta = {
  id: BuiltinCategoryId;
  label: string;
  /** One-line explanation shown in the category picker + tooltips. */
  description: string;
  /** Tailwind-friendly hex accent for chips + charts. */
  color: string;
};

export const BUILTIN_CATEGORIES: Record<BuiltinCategoryId, CategoryMeta> = {
  warmup: {
    id: "warmup",
    label: "Warmup",
    description: "Physical / mental prep, low-intensity technique.",
    color: "#f59e0b", // amber
  },
  technique: {
    id: "technique",
    label: "Technique",
    description: "Scales, arpeggios, exercises, drills.",
    color: "#6366f1", // indigo
  },
  repertoire: {
    id: "repertoire",
    label: "Repertoire",
    description: "Learning + polishing specific pieces.",
    color: "#10b981", // emerald
  },
  "ear-training": {
    id: "ear-training",
    label: "Ear Training",
    description: "Intervals, chords, melodic / rhythmic dictation.",
    color: "#f43f5e", // rose
  },
  "sight-reading": {
    id: "sight-reading",
    label: "Sight Reading",
    description: "Reading unfamiliar material.",
    color: "#8b5cf6", // violet
  },
  theory: {
    id: "theory",
    label: "Theory",
    description: "Study, analysis, chart-building.",
    color: "#3b82f6", // blue
  },
  improvisation: {
    id: "improvisation",
    label: "Improvisation",
    description: "Jamming, soloing over changes.",
    color: "#ef4444", // red
  },
  transcription: {
    id: "transcription",
    label: "Transcription",
    description: "Learning music by ear.",
    color: "#14b8a6", // teal
  },
  "recording-listening": {
    id: "recording-listening",
    label: "Recording / Listening",
    description: "Self-recording, active listening study.",
    color: "#a855f7", // purple
  },
  "cool-down": {
    id: "cool-down",
    label: "Cool-down",
    description: "Stretch, wind-down, reflection.",
    color: "#84cc16", // lime
  },
};

/** Ordered list of built-in category meta, for iteration in UI. */
export const BUILTIN_CATEGORY_LIST: CategoryMeta[] =
  BUILTIN_CATEGORY_IDS.map((id) => BUILTIN_CATEGORIES[id]);
