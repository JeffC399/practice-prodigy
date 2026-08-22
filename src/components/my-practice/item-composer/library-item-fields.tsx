"use client";

import { CategoryChip } from "@/components/practice/category-chip";
import { CategoryPicker } from "@/components/practice/category-picker";
import { MethodologyPicker } from "@/components/my-practice/methodology-picker";
import {
  BUILTIN_CATEGORY_LIST,
  type CategoryId,
} from "@/lib/practice/categories";
import { defaultMethodologyForCategory } from "@/lib/practice/methodologies";
import type { MethodologyId } from "@/lib/practice/routine-types";
import { useEffect, useRef, useState } from "react";

/**
 * LibraryItemFields — Slice B.5 (Phase 105), + methodology in B.13.
 *
 * The shared form used by all four "pick a saved thing from library"
 * composers (drill / key-drill / scale-drill / leadsheet). Each per-type
 * composer wraps this and constructs the type-specific RoutineItem on
 * Save.
 *
 * ## Fields
 *
 *   1. Library picker: dropdown of `{id, name}` items. Autofocuses on
 *      mount so keyboard flow is fast.
 *   2. Label: pre-filled from the picked item's name; user can override.
 *   3. Category: click-to-open picker popover (reuses CategoryPicker
 *      from Phase 91). Defaults to the picked item's own category (or
 *      the caller's module default when the item has none).
 *   4. Methodology (Slice B.13): per-item picker, seeded via
 *      `defaultMethodologyForCategory(category)` so switching category
 *      re-suggests (until the user touches it manually).
 *   5. Estimated minutes: numeric input; ~5 min is the sensible default
 *      for a drilling item (average practice slot).
 *
 * Called via `onSubmit({ pickedId, label, category, methodologyId,
 * estimatedSeconds })`. Parent constructs the discriminated-union
 * RoutineItem.
 */

export type LibraryItemFieldsSubmit = {
  /** id of the picked library item — parent maps to the type-specific field. */
  pickedId: string;
  label: string;
  category: CategoryId;
  methodologyId: MethodologyId | undefined;
  estimatedSeconds: number;
};

type LibraryChoice = { id: string; name: string; category?: CategoryId };

export function LibraryItemFields({
  library,
  emptyMessage,
  moduleDefaultCategory,
  defaultEstimatedMinutes = 5,
  itemType,
  onSubmit,
  onCancel,
}: {
  /** All pickable items from the module's library, in preferred order. */
  library: readonly LibraryChoice[];
  /** Shown when library is empty; usually points at the module's setup page. */
  emptyMessage: string;
  moduleDefaultCategory: CategoryId;
  defaultEstimatedMinutes?: number;
  /**
   * Slice F.7 (Phase 143) — Passed to the AI-suggest picker so the
   * server can bias its recommendation based on the item type
   * (drill / leadsheet / etc.). Optional so existing callers keep
   * working; without it, the "?" button is hidden.
   */
  itemType?: string;
  onSubmit: (fields: LibraryItemFieldsSubmit) => void;
  onCancel: () => void;
}) {
  const [pickedId, setPickedId] = useState<string>(library[0]?.id ?? "");
  const [label, setLabel] = useState<string>(library[0]?.name ?? "");
  const initialCategory: CategoryId =
    library[0]?.category ?? moduleDefaultCategory;
  const [category, setCategory] = useState<CategoryId>(initialCategory);
  const [methodologyId, setMethodologyId] = useState<MethodologyId | undefined>(
    () => defaultMethodologyForCategory(initialCategory),
  );
  /** Tracks whether the user has manually touched methodology. Once true,
   *  we stop auto-suggesting on category changes. */
  const [methodologyTouched, setMethodologyTouched] = useState(false);
  const [minutes, setMinutes] = useState<number>(defaultEstimatedMinutes);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerContainerRef = useRef<HTMLDivElement | null>(null);

  // When the picked item changes, snap the label + category defaults
  // to the newly-picked item's values (unless the user has already
  // customized them). Simple heuristic: if label still matches the
  // PREVIOUS pick's name, treat it as untouched and update.
  const prevPickIdRef = useRef<string>(pickedId);
  useEffect(() => {
    if (pickedId === prevPickIdRef.current) return;
    const prevPick = library.find((l) => l.id === prevPickIdRef.current);
    const nextPick = library.find((l) => l.id === pickedId);
    if (nextPick) {
      if (label === (prevPick?.name ?? "")) {
        setLabel(nextPick.name);
      }
      // Category always follows the picked item (or module default).
      const nextCategory = nextPick.category ?? moduleDefaultCategory;
      setCategory(nextCategory);
      // Re-seed methodology from the new category (unless user touched).
      if (!methodologyTouched) {
        setMethodologyId(defaultMethodologyForCategory(nextCategory));
      }
    }
    prevPickIdRef.current = pickedId;
  }, [pickedId, library, label, moduleDefaultCategory, methodologyTouched]);

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
    if (!pickedId) return;
    onSubmit({
      pickedId,
      label: label.trim() || library.find((l) => l.id === pickedId)?.name || "Untitled",
      category,
      methodologyId,
      estimatedSeconds: Math.max(0, Math.round(minutes * 60)),
    });
  };

  if (library.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-4 py-6 text-sm text-muted-foreground text-center">
          {emptyMessage}
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Library picker */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Pick from your library
        </span>
        <select
          autoFocus
          value={pickedId}
          onChange={(e) => setPickedId(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        >
          {library.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      {/* Label */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Label
        </span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Item label"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <span className="text-[11px] text-muted-foreground/70">
          Shown in the routine builder and player. Defaults to the
          drill&rsquo;s name; override for anything more specific.
        </span>
      </label>

      {/* Category + estimated minutes side-by-side on desktop */}
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
                  // "None" clears back to module default — items always
                  // have a required category, unlike the entity-level
                  // per-item picker which allows undefined.
                  if (next !== undefined) {
                    setCategory(next);
                    // Re-seed methodology when category changes (unless
                    // user has manually touched it).
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
          <span className="text-[11px] text-muted-foreground/70">
            Where practice time attributes in Reports.
          </span>
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
          <span className="text-[11px] text-muted-foreground/70">
            For total-time estimates. Not enforced during practice.
          </span>
        </label>
      </div>

      {/* Methodology (per-item scope) */}
      <MethodologyPicker
        value={methodologyId}
        onChange={(next) => {
          setMethodologyId(next);
          setMethodologyTouched(true);
        }}
        scope="per-item"
        hint="How you'll practice this. Suggested from the category — override anytime."
        suggestContext={
          itemType
            ? {
                label,
                category,
                type: itemType,
              }
            : undefined
        }
      />

      {/* Actions */}
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
          disabled={!pickedId}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add to routine
        </button>
      </div>
    </div>
  );
}

// Warm up the built-in categories import so tree-shaking doesn't
// drop it if a future refactor stops using CategoryChip inline. Also
// makes the file self-contained for callers that just want the list.
void BUILTIN_CATEGORY_LIST;
