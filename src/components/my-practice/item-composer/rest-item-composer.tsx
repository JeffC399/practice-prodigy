"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryChip } from "@/components/practice/category-chip";
import { CategoryPicker } from "@/components/practice/category-picker";
import { MethodologyPicker } from "@/components/my-practice/methodology-picker";
import type { CategoryId } from "@/lib/practice/categories";
import {
  newRoutineItemId,
  type MethodologyId,
  type RoutineItem,
} from "@/lib/practice/routine-types";

/**
 * RestItemComposer — Slice B.6 (Phase 106).
 *
 * A silent break with optional guidance. Rests are how you build
 * ergonomic routines — "5 min stretch between technique work and
 * repertoire," "1 min breather," etc. During the routine executor's
 * run, a rest item pauses the audio and displays the guidance text
 * (or a default "Rest" screen).
 *
 * Fields:
 *   - Label (default: "Rest")
 *   - Duration in minutes (required — rests are timed, unlike other
 *     items whose estimate is aspirational)
 *   - Guidance text (optional — "Stretch left forearm" / "Deep
 *     breathing" / "Reflect on what worked")
 *   - Category (default: "cool-down" — rests naturally fit there;
 *     user can pick "warmup" for pre-drill breathers)
 */

const DEFAULT_CATEGORY: CategoryId = "cool-down";
const DEFAULT_MINUTES = 2;

export function RestItemComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (item: RoutineItem) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState<string>("Rest");
  const [minutes, setMinutes] = useState<number>(DEFAULT_MINUTES);
  const [guidance, setGuidance] = useState<string>("");
  const [category, setCategory] = useState<CategoryId>(DEFAULT_CATEGORY);
  // Rests rarely have a methodology, so default to undefined — user can
  // still tag one (e.g. Mental Practice for a visualization rest).
  const [methodologyId, setMethodologyId] = useState<MethodologyId | undefined>(
    undefined,
  );
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

  const submit = () => {
    const trimmedGuidance = guidance.trim();
    const item: RoutineItem = {
      id: newRoutineItemId(),
      type: "rest",
      guidanceText: trimmedGuidance || undefined,
      label: label.trim() || "Rest",
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
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Duration (minutes)
        </span>
        <input
          autoFocus
          type="number"
          min={0}
          step={1}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value) || 0)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <span className="text-[11px] text-muted-foreground/70">
          Rests are timed — the player counts down.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Guidance (optional)
        </span>
        <textarea
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          placeholder="e.g. Stretch left forearm · Deep breathing · Sip water · Reflect on what worked"
          rows={3}
          className="resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <span className="text-[11px] text-muted-foreground/70">
          Shown on-screen during the rest. Blank = generic &ldquo;Rest&rdquo; screen.
        </span>
      </label>

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
                if (next !== undefined) setCategory(next);
                setPickerOpen(false);
              }}
              onDismiss={() => setPickerOpen(false)}
            />
          </div>
        )}
        <span className="text-[11px] text-muted-foreground/70">
          Defaults to Cool-down; try Warmup for pre-drill breathers.
        </span>
      </div>

      <MethodologyPicker
        value={methodologyId}
        onChange={setMethodologyId}
        scope="per-item"
        hint="Usually blank for rests. Try Mental Practice for a visualization break."
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
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Add to routine
        </button>
      </div>
    </div>
  );
}
