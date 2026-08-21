"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryChip } from "@/components/practice/category-chip";
import { CategoryPicker } from "@/components/practice/category-picker";
import type { CategoryId } from "@/lib/practice/categories";
import {
  newRoutineItemId,
  type RoutineItem,
} from "@/lib/practice/routine-types";
import { TIME_SIGNATURES } from "@/lib/state/practice-config";
import { MODULE_DEFAULT_CATEGORY } from "@/lib/tracking/category-defaults";

/**
 * MetronomeItemComposer — Slice B.6 (Phase 106).
 *
 * Metronome routine items have no library reference — the user picks
 * BPM + time signature directly. Perfect for "click at 60 for 3
 * minutes" warmup items or "click at your target tempo for endurance"
 * finisher items.
 *
 * Fields:
 *   - Label (default: "Metronome — 60 bpm 4/4")
 *   - BPM (numeric, 40-240 clamp — matches standalone metronome range)
 *   - Time signature (dropdown reusing TIME_SIGNATURES from practice-config)
 *   - Category (default: "warmup" per MODULE_DEFAULT_CATEGORY)
 *   - Estimated minutes
 *
 * accentPattern is intentionally omitted from the composer — power
 * users can set it on the standalone metronome page. Adding it here
 * would inflate the form for a rarely-touched setting.
 */

const BPM_MIN = 40;
const BPM_MAX = 240;
const DEFAULT_BPM = 60;
const DEFAULT_BEATS_PER_MEASURE = 4;
const DEFAULT_BEAT_UNIT = 4;
const DEFAULT_MINUTES = 3;

export function MetronomeItemComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (item: RoutineItem) => void;
  onCancel: () => void;
}) {
  const [bpm, setBpm] = useState<number>(DEFAULT_BPM);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState<number>(
    DEFAULT_BEATS_PER_MEASURE,
  );
  const [beatUnit, setBeatUnit] = useState<number>(DEFAULT_BEAT_UNIT);
  const [minutes, setMinutes] = useState<number>(DEFAULT_MINUTES);
  const [category, setCategory] = useState<CategoryId>(
    MODULE_DEFAULT_CATEGORY.metronome,
  );
  // Label state: tracked separately so the auto-generated default
  // updates when bpm/ts changes UNLESS the user has customized it.
  const [label, setLabel] = useState<string>(
    `Metronome — ${DEFAULT_BPM} bpm ${DEFAULT_BEATS_PER_MEASURE}/${DEFAULT_BEAT_UNIT}`,
  );
  const [labelTouched, setLabelTouched] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerContainerRef = useRef<HTMLDivElement | null>(null);

  // Regenerate the auto label whenever bpm/ts changes and the user
  // hasn't manually edited the label.
  useEffect(() => {
    if (!labelTouched) {
      setLabel(`Metronome — ${bpm} bpm ${beatsPerMeasure}/${beatUnit}`);
    }
  }, [bpm, beatsPerMeasure, beatUnit, labelTouched]);

  // Click-outside for the category picker popover.
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
    const item: RoutineItem = {
      id: newRoutineItemId(),
      type: "metronome",
      bpm: Math.min(BPM_MAX, Math.max(BPM_MIN, bpm)),
      beatsPerMeasure,
      beatUnit,
      label: label.trim() || `Metronome — ${bpm} bpm ${beatsPerMeasure}/${beatUnit}`,
      category,
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
          onChange={(e) => {
            setLabel(e.target.value);
            setLabelTouched(true);
          }}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <span className="text-[11px] text-muted-foreground/70">
          Auto-updates from tempo + time signature until you edit it.
        </span>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Tempo (BPM)
          </span>
          <input
            type="number"
            min={BPM_MIN}
            max={BPM_MAX}
            step={1}
            value={bpm}
            onChange={(e) =>
              setBpm(Math.min(BPM_MAX, Math.max(BPM_MIN, Number(e.target.value) || DEFAULT_BPM)))
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Time signature
          </span>
          <select
            value={`${beatsPerMeasure}/${beatUnit}`}
            onChange={(e) => {
              const [num, den] = e.target.value.split("/").map(Number);
              if (num && den) {
                setBeatsPerMeasure(num);
                setBeatUnit(den);
              }
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            {TIME_SIGNATURES.map((ts) => {
              const value = `${ts.beatsPerMeasure}/${ts.beatUnit}`;
              return (
                <option key={value} value={value}>
                  {value}
                </option>
              );
            })}
          </select>
        </label>
      </div>

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
                  if (next !== undefined) setCategory(next);
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

      <p className="text-[11px] text-muted-foreground/70">
        Per-beat accents aren&rsquo;t set here — use the standalone
        Metronome page for custom accent patterns and add a Custom item
        with those instructions instead.
      </p>

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
