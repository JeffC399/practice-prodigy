"use client";

import type { MethodologyId, RoutineItem } from "@/lib/practice/routine-types";
import { useAiCoachConfig } from "./ai-config";

/**
 * suggest-methodology client — Slice F.7 + F.8 (Phase 143).
 *
 * Wraps the /api/ai/suggest-methodology endpoint with a small typed
 * client so the RoutineBuilder + MethodologyPicker "?" button don't
 * duplicate fetch plumbing.
 *
 * ## Model
 *
 * Uses Haiku by default (see server route) — cheap, fast, plenty
 * good for a small structured task. If the user picked Sonnet /
 * Opus in Settings we still honor that; the server just enforces
 * the Gateway allow-list.
 */

export type SuggestItemInput = {
  itemId: string;
  label: string;
  category: string;
  type: string;
  existingMethodology?: string | null;
};

export type SuggestItemOutput = {
  itemId: string;
  methodologyId: MethodologyId | null;
  confidence: "high" | "medium" | "low" | null;
};

/**
 * Ask the AI for a methodology per item. Returns null when the
 * request fails — callers should render a small error state rather
 * than throwing. BYOK key + model are pulled from useAiCoachConfig
 * so the same user prefs power every AI feature.
 */
export async function suggestMethodologyForItems(
  items: readonly SuggestItemInput[],
): Promise<SuggestItemOutput[] | null> {
  const state = useAiCoachConfig.getState();
  try {
    const res = await fetch("/api/ai/suggest-methodology", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items,
        // Server has its own DEFAULT_MODEL; only send model when
        // the user picked something specific so we don't override
        // the endpoint's Haiku default with Sonnet unnecessarily.
        model: state.model === "anthropic/claude-sonnet-4-6" ? undefined : state.model,
        byokKey: state.byokKey || undefined,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { suggestions: SuggestItemOutput[] };
    return data.suggestions;
  } catch {
    return null;
  }
}

/**
 * Convenience — shape a RoutineItem into the SuggestItemInput shape
 * for the endpoint. Keeps the field names + serialization consistent
 * between the per-item picker call and the bulk builder call.
 */
export function inputFromRoutineItem(item: RoutineItem): SuggestItemInput {
  return {
    itemId: item.id,
    label: item.label,
    category: item.category,
    type: item.type,
    existingMethodology: item.methodologyId ?? null,
  };
}
