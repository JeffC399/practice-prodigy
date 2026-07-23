"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  BUILTIN_CATEGORY_LIST,
  resolveCategoryMeta,
  type CategoryId,
} from "@/lib/practice/categories";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * CategoryPicker — Slice A.10 (Phase 91).
 *
 * The list-of-choices UI that CategoryChip reveals on click and that
 * edit dialogs render inline. Renders:
 *
 *   [× Clear (use module default)]
 *   ─────────
 *   ● Warmup            — Physical / mental prep
 *   ● Technique         — Scales, arpeggios, exercises
 *   ● Repertoire        — Learning + polishing specific pieces
 *   … 7 more built-ins …
 *   ─────────
 *   ● My warmup blend   — (user custom)
 *   ● Chart study       — (user custom)
 *
 * Selecting a row calls `onChange(id)`. Selecting Clear calls
 * `onChange(undefined)`. Highlights the currently-selected id.
 *
 * ## Two container modes
 *
 * - **Popover** (default): rendered inside a positioned <div> so the
 *   parent can absolute-position it as a dropdown. Includes an
 *   internal Escape / click-outside handler when `onDismiss` is set.
 * - **Inline**: for edit dialogs / settings pages that give it a
 *   dedicated section. Just render the picker without onDismiss and
 *   position naturally.
 */

type CategoryPickerProps = {
  value?: CategoryId;
  onChange: (next: CategoryId | undefined) => void;
  /** When set, the picker installs Esc + click-outside listeners. */
  onDismiss?: () => void;
  /** Optional header shown above the list (e.g. "Change category"). */
  heading?: string;
};

export function CategoryPicker({
  value,
  onChange,
  onDismiss,
  heading,
}: CategoryPickerProps) {
  const customCategories = useUserPrefs((s) => s.customCategories);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onDismiss) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  const currentMeta = value
    ? resolveCategoryMeta(value, customCategories)
    : null;

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Practice category"
      className="flex w-64 flex-col gap-0.5 rounded-md border border-border bg-card p-1.5 shadow-lg"
    >
      {heading && (
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {heading}
        </div>
      )}

      <PickerRow
        icon={<X className="h-3.5 w-3.5" aria-hidden="true" />}
        label="Clear (use module default)"
        selected={!value}
        onClick={() => onChange(undefined)}
        muted
      />

      <div className="my-1 h-px bg-border/50" role="separator" />

      {BUILTIN_CATEGORY_LIST.map((meta) => (
        <PickerRow
          key={meta.id}
          swatchColor={meta.color}
          label={meta.label}
          description={meta.description}
          selected={value === meta.id}
          onClick={() => onChange(meta.id)}
        />
      ))}

      {customCategories.length > 0 && (
        <>
          <div className="my-1 h-px bg-border/50" role="separator" />
          <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Your categories
          </div>
          {customCategories.map((cat) => (
            <PickerRow
              key={cat.id}
              swatchColor={cat.color}
              label={cat.label}
              description={cat.description}
              selected={value === cat.id}
              onClick={() => onChange(cat.id)}
            />
          ))}
        </>
      )}

      {/* Render "Uncategorized" fallback when value points at a deleted
          custom category — makes the picker still show what state the
          entity is in even after cleanup. */}
      {value && !currentMeta && (
        <>
          <div className="my-1 h-px bg-border/50" role="separator" />
          <div className="px-2 py-1 text-[10px] text-muted-foreground italic">
            Currently set to a deleted custom category.
          </div>
        </>
      )}
    </div>
  );
}

type PickerRowProps = {
  swatchColor?: string;
  icon?: React.ReactNode;
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  muted?: boolean;
};

function PickerRow({
  swatchColor,
  icon,
  label,
  description,
  selected,
  onClick,
  muted,
}: PickerRowProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-background/60 ${
        muted ? "text-muted-foreground" : "text-foreground"
      }`}
      title={description}
    >
      {swatchColor ? (
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: swatchColor }}
          aria-hidden="true"
        />
      ) : (
        <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {selected && (
        <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      )}
    </button>
  );
}
