"use client";

import { HelpCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  BUILTIN_METHODOLOGIES,
  getMethodology,
  getPerItemMethodologies,
  getPerRoutineMethodologies,
  type MethodologyEntry,
} from "@/lib/practice/methodologies";
import type { MethodologyId } from "@/lib/practice/routine-types";
import {
  suggestMethodologyForItems,
  type SuggestItemInput,
} from "@/lib/ai/suggest-methodology";

/**
 * MethodologyPicker — Slice B.13 (Phase 113), + AI-suggest in F.7.
 *
 * Tiny dropdown for choosing a methodology on a RoutineItem or a
 * Routine. Uses a native `<select>` for now — short list (8 entries),
 * no search, matches the visual weight of the neighbouring category /
 * minutes controls in the composer.
 *
 * ## Scope filter
 *
 *   scope="per-item"    → 5 item-level + Deliberate Practice
 *   scope="per-routine" → 3 routine-level + Deliberate Practice
 *   scope omitted       → all 8
 *
 * ## AI suggest ("?" button)
 *
 * When the caller passes `suggestContext={{label, category, type}}`,
 * a small "?" button appears next to the dropdown. Clicking fires a
 * one-item POST to /api/ai/suggest-methodology and fills the picker
 * with the AI's pick. Silently no-ops on error — the user can still
 * pick manually.
 */
export function MethodologyPicker({
  value,
  onChange,
  scope,
  label = "Methodology",
  hint,
  id,
  suggestContext,
}: {
  value: MethodologyId | undefined;
  onChange: (next: MethodologyId | undefined) => void;
  scope?: "per-item" | "per-routine";
  label?: string;
  hint?: string;
  id?: string;
  /**
   * When set, the picker shows a "?" AI-suggest button. The picker
   * doesn't know its item's label/category/type on its own, so the
   * composer passes them in when it wants the affordance.
   */
  suggestContext?: {
    itemId?: string;
    label: string;
    category: string;
    type: string;
  };
}) {
  const entries: MethodologyEntry[] =
    scope === "per-item"
      ? getPerItemMethodologies()
      : scope === "per-routine"
        ? getPerRoutineMethodologies()
        : BUILTIN_METHODOLOGIES;

  const currentEntry = getMethodology(value);
  const showOutOfScope =
    currentEntry !== null && !entries.some((e) => e.id === currentEntry.id);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const handleSuggest = async () => {
    if (!suggestContext) return;
    setSuggesting(true);
    setSuggestError(null);
    const input: SuggestItemInput = {
      itemId: suggestContext.itemId ?? "picker",
      label: suggestContext.label,
      category: suggestContext.category,
      type: suggestContext.type,
      existingMethodology: value ?? null,
    };
    try {
      const suggestions = await suggestMethodologyForItems([input]);
      if (!suggestions || suggestions.length === 0) {
        setSuggestError("No suggestion returned. Try picking manually.");
      } else {
        onChange(suggestions[0].methodologyId ?? undefined);
      }
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </label>
        {suggestContext && (
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting}
            title="Ask AI Coach for a suggestion"
            aria-label="Ask AI Coach for a methodology suggestion"
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggesting ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <HelpCircle className="h-3 w-3" aria-hidden="true" />
            )}
            AI
          </button>
        )}
      </div>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        title={currentEntry?.summary}
      >
        <option value="">&mdash; None</option>
        {showOutOfScope && currentEntry && (
          <option value={currentEntry.id}>
            {currentEntry.name} (out of scope)
          </option>
        )}
        {entries.map((m) => (
          <option key={m.id} value={m.id} title={m.summary}>
            {m.name}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-muted-foreground/70">
        {suggestError ??
          hint ??
          currentEntry?.summary ??
          "Optional. How you'll approach this activity."}
      </span>
    </div>
  );
}
