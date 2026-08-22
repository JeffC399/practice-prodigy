"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryChip } from "@/components/practice/category-chip";
import { CategoryPicker } from "@/components/practice/category-picker";
import { MethodologyPicker } from "@/components/my-practice/methodology-picker";
import type { CategoryId } from "@/lib/practice/categories";
import { defaultMethodologyForCategory } from "@/lib/practice/methodologies";
import {
  newRoutineItemId,
  type MethodologyId,
  type RoutineItem,
} from "@/lib/practice/routine-types";

/**
 * CustomItemComposer — Slice B.6 (Phase 106).
 *
 * Free-form activity — the escape hatch for anything the built-in
 * types don't cover. "Sing the melody without your instrument."
 * "Record yourself playing X and listen back." "Slow practice with
 * eyes closed." The instruction text is shown prominently to the
 * user during routine execution.
 *
 * Fields:
 *   - Label (required — 1-line name shown in the item list)
 *   - Instruction (multiline free text — the actual guidance)
 *   - Category (default: "technique" as a neutral catch-all)
 *   - Estimated minutes
 */

const DEFAULT_CATEGORY: CategoryId = "technique";
const DEFAULT_MINUTES = 5;

export function CustomItemComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (item: RoutineItem) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState<string>("");
  const [instruction, setInstruction] = useState<string>("");
  const [category, setCategory] = useState<CategoryId>(DEFAULT_CATEGORY);
  const [methodologyId, setMethodologyId] = useState<MethodologyId | undefined>(
    () => defaultMethodologyForCategory(DEFAULT_CATEGORY),
  );
  const [methodologyTouched, setMethodologyTouched] = useState(false);
  const [minutes, setMinutes] = useState<number>(DEFAULT_MINUTES);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!pickerContainerRef.current?.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  const canSubmit = label.trim().length > 0 && instruction.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const item: RoutineItem = {
      id: newRoutineItemId(),
      type: "custom",
      instruction: instruction.trim(),
      label: label.trim(),
      category,
      methodologyId,
      estimatedSeconds: Math.max(0, Math.round(minutes * 60)),
    };
    onSubmit(item);
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Label
        </span>
        <input
          autoFocus
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Sing the melody · Record + listen back"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Instruction
        </span>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="What should you do? Any detail helps — the player shows this text on-screen while you practice."
          rows={4}
          className="resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div ref={pickerContainerRef} className="relative flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Category
          </span>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-primary/50"
          >
            <CategoryChip categoryId={category} />
            <span className="text-xs text-muted-foreground">Change</span>
          </button>
          {pickerOpen && (
            <div className="absolute left-0 top-full z-10 mt-1">
              <CategoryPicker
                value={category}
                onChange={(next) => {
                  if (next !== undefined) {
                    setCategory(next);
                    if (!methodologyTouched) {
                      setMethodologyId(defaultMethodologyForCategory(next));
                    }
                  }
                  setPickerOpen(false);
                }}
                onDismiss={() => setPickerOpen(false)}
              />
            </div>
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Estimated minutes
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value) || 0)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </label>
      </div>

      <MethodologyPicker
        value={methodologyId}
        onChange={(next) => {
          setMethodologyId(next);
          setMethodologyTouched(true);
        }}
        scope="per-item"
        hint="How you'll practice this. Suggested from the category — override anytime."
        suggestContext={{ label, category, type: "custom" }}
      />

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add to routine
        </button>
      </div>
    </div>
  );
}
