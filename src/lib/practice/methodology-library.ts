import {
  METHODOLOGY_ARTICLES,
  METHODOLOGY_TEMPLATES,
  type MethodologyArticle,
  type MethodologyTemplate,
} from "./methodology-content.generated";
import { getMethodology, type MethodologyEntry } from "./methodologies";
import {
  newRoutineItemId,
  type RoutineItem,
  type RoutineItemType,
} from "./routine-types";
import type { CategoryId } from "./categories";

/**
 * Methodology library — Slice E.1 (Phase 135).
 *
 * Runtime accessors over the code-generated methodology content.
 * The heavy lifting (loading .md files + parsing frontmatter +
 * loading .json templates) happens at build time in scripts/
 * generate-methodology-content.mjs; this module wraps that with
 * ergonomic lookup helpers.
 *
 * ## Data flow
 *
 *   src/content/methodology/*.md   ─┐
 *                                    ├─→ generator ─→ .generated.ts
 *   src/content/templates/*.json   ─┘
 *
 *   .generated.ts ──→ this module ──→ UI (Slice E.2+)
 *
 * ## What lives where
 *
 * - `methodologies.ts` (Slice B.13) — the small typed entry used by
 *   the composer picker. Just id / name / summary / scope.
 * - This module — the full pedagogy surface: article body, linked
 *   templates, category recommendations.
 * - `methodology-content.generated.ts` — build-time content dump.
 *   Never edited by hand.
 *
 * Article ids MATCH methodology ids (`slow-practice`, `chunking`,
 * etc.) so the same id keys the picker + the article + the routine's
 * `methodologyId` field.
 */

export type { MethodologyArticle, MethodologyTemplate };

/** All methodology articles in the sort-order they were generated. */
export function listMethodologyArticles(): readonly MethodologyArticle[] {
  return METHODOLOGY_ARTICLES;
}

/** All template routines. */
export function listMethodologyTemplates(): readonly MethodologyTemplate[] {
  return METHODOLOGY_TEMPLATES;
}

/** Find an article by methodology id. Null when unknown. */
export function getMethodologyArticle(
  id: string,
): MethodologyArticle | null {
  return METHODOLOGY_ARTICLES.find((a) => a.id === id) ?? null;
}

/** Find a template routine by id. Null when unknown. */
export function getMethodologyTemplate(
  id: string,
): MethodologyTemplate | null {
  return METHODOLOGY_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Merge the picker-level `MethodologyEntry` (id / name / summary /
 * scope) with the article + templates for the same id. Returns null
 * when the id doesn't correspond to a real methodology.
 *
 * Used by the tab list card to render one row that carries both the
 * short summary + a "read article" affordance + the template-count
 * pill.
 */
export type MethodologyBundle = {
  entry: MethodologyEntry;
  article: MethodologyArticle | null;
  templates: MethodologyTemplate[];
};

export function getMethodologyBundle(id: string): MethodologyBundle | null {
  const entry = getMethodology(id);
  if (!entry) return null;
  const article = getMethodologyArticle(id);
  const templates = article
    ? article.templates
        .map((tid) => getMethodologyTemplate(tid))
        .filter((t): t is MethodologyTemplate => t !== null)
    : [];
  return { entry, article, templates };
}

/**
 * List every methodology bundle in picker order (matches
 * BUILTIN_METHODOLOGIES). Skips methodologies that have no article
 * yet — safety net in case Slice E ever ships before content does.
 */
export function listMethodologyBundles(): MethodologyBundle[] {
  const out: MethodologyBundle[] = [];
  for (const article of METHODOLOGY_ARTICLES) {
    const bundle = getMethodologyBundle(article.id);
    if (bundle) out.push(bundle);
  }
  return out;
}

/**
 * Slice E.6 (Phase 137) — Convert a template's loose item shape
 * (as loaded from JSON) into `RoutineItem` variants with freshly
 * minted ids. The template author is expected to match the
 * RoutineItem discriminated union; unknown types get dropped
 * (defensive against typos or future variants that ship before
 * templates catch up).
 *
 * Returns just the items array + suggested routine name — the
 * caller (usually the /my-practice page) is responsible for calling
 * `useRoutinesLibrary.saveRoutine` with `source: "template"` and
 * `sourceRef: template.methodologyId` so provenance is recorded.
 */
export function templateToRoutineItems(
  template: MethodologyTemplate,
): RoutineItem[] {
  const out: RoutineItem[] = [];
  for (const raw of template.items) {
    const converted = convertTemplateItem(raw);
    if (converted) out.push(converted);
  }
  return out;
}

const SUPPORTED_TYPES: readonly RoutineItemType[] = [
  "drill",
  "key-drill",
  "scale-drill",
  "metronome",
  "leadsheet",
  "song",
  "custom",
  "rest",
];

function convertTemplateItem(
  raw: MethodologyTemplate["items"][number],
): RoutineItem | null {
  if (!SUPPORTED_TYPES.includes(raw.type as RoutineItemType)) return null;
  const base = {
    id: newRoutineItemId(),
    label: raw.label,
    category: raw.category as CategoryId,
    estimatedSeconds: raw.estimatedSeconds,
    methodologyId: raw.methodologyId,
  };
  switch (raw.type as RoutineItemType) {
    case "drill":
      if (!raw.drillId) return null;
      return { ...base, type: "drill", drillId: raw.drillId };
    case "key-drill":
      if (!raw.keyDrillId) return null;
      return { ...base, type: "key-drill", keyDrillId: raw.keyDrillId };
    case "scale-drill":
      if (!raw.scaleDrillId) return null;
      return { ...base, type: "scale-drill", scaleDrillId: raw.scaleDrillId };
    case "metronome":
      return {
        ...base,
        type: "metronome",
        bpm: raw.bpm ?? 60,
        beatsPerMeasure: raw.beatsPerMeasure ?? 4,
        beatUnit: raw.beatUnit ?? 4,
      };
    case "leadsheet":
      if (!raw.leadSheetId) return null;
      return { ...base, type: "leadsheet", leadSheetId: raw.leadSheetId };
    case "song":
      if (!raw.songId) return null;
      return { ...base, type: "song", songId: raw.songId };
    case "custom":
      return {
        ...base,
        type: "custom",
        instruction: raw.instruction ?? "",
      };
    case "rest":
      return {
        ...base,
        type: "rest",
        guidanceText: raw.guidanceText,
      };
    case "ear-training":
      return null; // Ear training module hasn't shipped yet.
  }
}
