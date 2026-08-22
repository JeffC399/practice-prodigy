import { BUILTIN_CATEGORIES, isBuiltinCategoryId } from "@/lib/practice/categories";
import type { CategoryId } from "@/lib/practice/categories";
import { getMethodology } from "@/lib/practice/methodologies";
import {
  newRoutineItemId,
  type MethodologyId,
  type RoutineItem,
} from "@/lib/practice/routine-types";
import { useDrillsLibrary } from "@/lib/state/drills-library";
import { useKeyDrillsLibrary } from "@/lib/key-sequencer/library-store";
import { useScaleDrillsLibrary } from "@/lib/scale-driller/library-store";
import { useSheetsLibrary } from "@/lib/state/sheets-library";
import { useSongsLibrary } from "@/lib/practice/songs-library";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * routine-parser — Slice F.5 (Phase 142).
 *
 * Extracts a structured RoutineDraft from an AI assistant message.
 * The system prompt (F.3) instructs the model to structure routine
 * drafts like:
 *
 *   ROUTINE: <name>
 *   METHODOLOGY: <methodology-id-or-none>
 *   TOTAL: ~<minutes> min
 *   ITEMS:
 *   1. <label> · <category> · <method-id-or-none> · ~<minutes> min
 *      <optional one-line instruction for custom items>
 *   2. ...
 *
 * Followed by a "Why this?" paragraph.
 *
 * ## Robustness
 *
 * Real assistant output is messy. The parser tolerates:
 *   - Extra prose before / after the routine block
 *   - Blank lines between items
 *   - Variations in the divider glyph (·, |, ,)
 *   - The methodology / method fields being "none", "n/a", "-", empty,
 *     or a real id (looked up against the built-ins)
 *   - Categories referenced by id OR by human label (Warmup → warmup)
 *
 * ## Validation
 *
 * - Unknown categories fall back to "technique" (safest bucket for
 *   music-adjacent items).
 * - Unknown methodology → undefined (silently dropped).
 * - Items with no explicit type become "custom" with the label
 *   copied to the instruction — so the routine still runs.
 *
 * F.10 (Active mode) will replace this with tool-call-based
 * routine construction, which is more reliable. For Passive mode
 * this is the pragmatic escape hatch that keeps a routine draft
 * usable even when the model formats slightly off-spec.
 */

export type RoutineDraft = {
  name: string;
  methodologyId?: MethodologyId;
  estimatedTotalSeconds: number;
  items: RoutineItem[];
  /**
   * The paragraph the model wrote AFTER the routine block. Slice F.6
   * renders this in the "Why this?" panel so the user sees the
   * reasoning inline with the draft.
   */
  whyThis?: string;
};

/**
 * Try to extract a RoutineDraft from `text`. Returns null when the
 * text has no recognizable ROUTINE: block.
 */
export function parseRoutineDraft(text: string): RoutineDraft | null {
  const start = text.search(/^ROUTINE:\s*/im);
  if (start === -1) return null;
  const block = text.slice(start);

  const name = firstMatch(block, /^ROUTINE:\s*(.+)$/im) ?? "AI-drafted routine";
  const methodologyRaw = firstMatch(block, /^METHODOLOGY:\s*(.+)$/im);
  const methodologyId = normalizeMethodology(methodologyRaw);
  const totalRaw = firstMatch(block, /^TOTAL:\s*[~≈]?\s*(\d+)/im);
  const declaredTotalSeconds = totalRaw
    ? parseInt(totalRaw, 10) * 60
    : 0;

  const itemsSection = block.match(/^ITEMS:\s*([\s\S]*)$/im)?.[1] ?? "";
  const { items, whyThis } = parseItemsSection(itemsSection);

  const summedSeconds = items.reduce(
    (acc, it) => acc + (it.estimatedSeconds || 0),
    0,
  );
  const estimatedTotalSeconds =
    summedSeconds > 0 ? summedSeconds : declaredTotalSeconds;

  return {
    name: name.trim(),
    methodologyId,
    estimatedTotalSeconds,
    items,
    whyThis,
  };
}

function firstMatch(source: string, re: RegExp): string | null {
  const m = source.match(re);
  return m ? m[1] : null;
}

function normalizeMethodology(raw: string | null): MethodologyId | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().toLowerCase();
  if (["none", "n/a", "na", "-", ""].includes(cleaned)) return undefined;
  const entry = getMethodology(cleaned);
  return entry ? cleaned : undefined;
}

/**
 * Walk the ITEMS section line-by-line. Recognized item lines start
 * with a leading number + delimiter (e.g. "1.", "2)"). Continuation
 * lines under an item become its instruction (for custom items).
 * Everything after the last item is treated as the "Why this?"
 * paragraph.
 */
function parseItemsSection(text: string): {
  items: RoutineItem[];
  whyThis?: string;
} {
  const lines = text.split(/\r?\n/);
  type Parsed = {
    label: string;
    category: string;
    method: string;
    minutes: number;
    continuation: string[];
  };
  const parsed: Parsed[] = [];
  const trailing: string[] = [];
  let mode: "items" | "trailing" = "items";

  const itemLineRe = /^\s*\d+[.)]\s*(.+)$/;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      // Blank line — if we already have items and hit two in a row,
      // switch to trailing mode.
      if (mode === "items" && parsed.length > 0) {
        // Look ahead? Keep it simple: any blank line ends items mode
        // if the next non-blank line doesn't look like an item.
        continue;
      }
      if (mode === "trailing") trailing.push("");
      continue;
    }
    const m = line.match(itemLineRe);
    if (m) {
      mode = "items";
      parsed.push(parseItemDeclaration(m[1]));
      continue;
    }
    // Not an item line
    if (mode === "items" && parsed.length > 0 && startsWithWhitespace(rawLine)) {
      // Indented continuation of the previous item
      parsed[parsed.length - 1].continuation.push(line.trim());
    } else {
      mode = "trailing";
      trailing.push(line.trim());
    }
  }

  const items = parsed
    .map((p) => hydrateItem(p))
    .filter((it): it is RoutineItem => it !== null);

  const whyThis = trailing.join(" ").trim() || undefined;

  return { items, whyThis };
}

function startsWithWhitespace(line: string): boolean {
  return /^\s/.test(line);
}

/**
 * Split "label · category · method · ~5 min" into its slots. The
 * divider is one of · | , between fields. Uses greedy last-field
 * matching for the minutes so the label can contain divider chars.
 */
function parseItemDeclaration(text: string): {
  label: string;
  category: string;
  method: string;
  minutes: number;
  continuation: string[];
} {
  const parts = text
    .split(/\s*[·|]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  // Expected 4 fields; be forgiving.
  const label = parts[0] ?? text.trim();
  const category = parts[1] ?? "technique";
  const method = parts[2] ?? "";
  const minutesField = parts[3] ?? parts[parts.length - 1] ?? "";
  const minutesMatch = minutesField.match(/(\d+)/);
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 5;
  return { label, category, method, minutes, continuation: [] };
}

function hydrateItem(parsed: {
  label: string;
  category: string;
  method: string;
  minutes: number;
  continuation: string[];
}): RoutineItem | null {
  const category = normalizeCategory(parsed.category);
  const methodologyId = normalizeMethodology(parsed.method);
  const estimatedSeconds = Math.max(30, parsed.minutes * 60);
  const label = parsed.label.trim() || "Untitled item";

  // Try to detect if the label / continuation references a real
  // library id from context; if not, fall back to a custom item.
  const detectedRef = detectLibraryReference(label, parsed.continuation);
  if (detectedRef) {
    const base = {
      id: newRoutineItemId(),
      label,
      category,
      methodologyId,
      estimatedSeconds,
    };
    switch (detectedRef.type) {
      case "drill":
        return { ...base, type: "drill", drillId: detectedRef.id };
      case "key-drill":
        return { ...base, type: "key-drill", keyDrillId: detectedRef.id };
      case "scale-drill":
        return { ...base, type: "scale-drill", scaleDrillId: detectedRef.id };
      case "song":
        return { ...base, type: "song", songId: detectedRef.id };
      case "leadsheet":
        return { ...base, type: "leadsheet", leadSheetId: detectedRef.id };
    }
  }

  // Fallback: custom item with the continuation as the instruction.
  const instruction =
    parsed.continuation.join(" ").trim() ||
    "Practice as described. Set your own reps or tempo target.";
  return {
    id: newRoutineItemId(),
    type: "custom",
    label,
    category,
    methodologyId,
    estimatedSeconds,
    instruction,
  };
}

/**
 * Look for `id:...` refs or exact-name matches against every library
 * store. Returns the first hit. Runs in O(items) across the ~4 libs;
 * fine for the ~10-item routine drafts the AI produces.
 */
function detectLibraryReference(
  label: string,
  continuation: string[],
): { type: "drill" | "key-drill" | "scale-drill" | "song" | "leadsheet"; id: string } | null {
  const searchText = [label, ...continuation].join(" ");
  const idMatch = searchText.match(/\bid:([\w:-]+)/);
  if (idMatch) {
    const id = idMatch[1];
    if (useDrillsLibrary.getState().drills.some((d) => d.id === id)) {
      return { type: "drill", id };
    }
    if (useKeyDrillsLibrary.getState().drills.some((d) => d.id === id)) {
      return { type: "key-drill", id };
    }
    if (useScaleDrillsLibrary.getState().drills.some((d) => d.id === id)) {
      return { type: "scale-drill", id };
    }
    if (useSongsLibrary.getState().songs.some((s) => s.id === id)) {
      return { type: "song", id };
    }
    if (useSheetsLibrary.getState().sheets.some((sh) => sh.id === id)) {
      return { type: "leadsheet", id };
    }
  }
  return null;
}

function normalizeCategory(raw: string): CategoryId {
  const cleaned = raw.trim().toLowerCase();
  if (isBuiltinCategoryId(cleaned)) return cleaned as CategoryId;
  // Try matching against built-in labels (e.g. "Warmup" → "warmup").
  const match = Object.values(BUILTIN_CATEGORIES).find(
    (c) => c.label.toLowerCase() === cleaned,
  );
  if (match) return match.id as CategoryId;
  // Try custom categories by id + label.
  const customs = useUserPrefs.getState().customCategories;
  const custom = customs.find(
    (c) =>
      c.id.toLowerCase() === cleaned ||
      c.label.toLowerCase() === cleaned,
  );
  if (custom) return custom.id as CategoryId;
  // Safe default.
  return "technique";
}
