"use client";

import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CategoryChip } from "@/components/practice/category-chip";
import { getMethodology } from "@/lib/practice/methodologies";
import type { RoutineDraft } from "@/lib/ai/routine-parser";
import {
  ROUTINE_ITEM_TYPE_LABELS,
  totalEstimatedSeconds,
} from "@/lib/practice/routine-types";
import type { Routine } from "@/lib/practice/routine-types";
import { useRoutinesLibrary } from "@/lib/practice/routines-library";

/**
 * RoutineDraftCard — Slice F.5 + F.6 (Phase 142).
 *
 * Renders a RoutineDraft inline in the chat with:
 *
 *   - Header: name + methodology chip + total time
 *   - Item list preview (label / type / category / method / minutes)
 *   - "Why this?" transparency panel (F.6) if the AI provided one
 *   - "Save as routine" → creates via useRoutinesLibrary.saveRoutine
 *     with source="ai-coach" so provenance is tracked
 *   - "Discard" → local dismiss (draft stays in the chat log)
 *
 * Saved routines land in the user's library and open in the builder
 * so they can tweak before running.
 */
export function RoutineDraftCard({ draft }: { draft: RoutineDraft }) {
  const saveRoutine = useRoutinesLibrary((s) => s.saveRoutine);
  const [savedRoutine, setSavedRoutine] = useState<Routine | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const methodology = getMethodology(draft.methodologyId);
  const totalMins = Math.round(draft.estimatedTotalSeconds / 60);

  const handleSave = () => {
    const id = saveRoutine({
      name: draft.name,
      notes: draft.whyThis,
      items: draft.items,
      methodologyId: draft.methodologyId,
      source: "ai-coach",
    });
    // Look up the freshly saved routine so we can render the "Open"
    // link with a real id. saveRoutine returns the id synchronously.
    const routine = useRoutinesLibrary.getState().routines.find((r) => r.id === id);
    setSavedRoutine(routine ?? null);
  };

  if (savedRoutine) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/10 p-3">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
          Saved as <span className="font-medium">{savedRoutine.name}</span>.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/my-practice?tab=routines&routine=${savedRoutine.id}`}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open in builder
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <span className="font-mono text-[10px] text-muted-foreground">
            You can rename, reorder, or delete items before running it.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border-2 border-primary/40 bg-primary/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Draft from AI Coach
          </span>
          <h3 className="text-base font-semibold text-foreground">
            {draft.name}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {methodology && (
            <span
              className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-primary"
              title={methodology.summary}
            >
              {methodology.name}
            </span>
          )}
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            ~{totalMins} min · {draft.items.length} items
          </span>
        </div>
      </div>

      {draft.items.length > 0 && (
        <ol className="flex flex-col gap-1">
          {draft.items.map((item, idx) => {
            const itemMethod = getMethodology(item.methodologyId);
            const itemMins = Math.round(item.estimatedSeconds / 60);
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-xs"
              >
                <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground/70">
                  {idx + 1}.
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {item.label}
                </span>
                <CategoryChip categoryId={item.category} size="sm" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                  {ROUTINE_ITEM_TYPE_LABELS[item.type]}
                </span>
                {itemMethod && (
                  <span className="font-mono text-[9px] text-muted-foreground/80">
                    {itemMethod.name}
                  </span>
                )}
                <span className="font-mono text-[9px] text-muted-foreground/70 tabular-nums">
                  {itemMins}m
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {draft.whyThis && (
        <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-background/40 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Why this?
          </span>
          <p className="text-xs text-foreground/90 leading-relaxed">
            {draft.whyThis}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Discard
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={draft.items.length === 0}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Save as routine
        </button>
      </div>
    </div>
  );
}

// Warm-up import so a future refactor that stops rendering totals
// inline still compiles cleanly.
void totalEstimatedSeconds;
