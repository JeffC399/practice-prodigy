"use client";

import { ChevronDown, Tag } from "lucide-react";
import {
  BUILTIN_CATEGORIES,
  resolveCategoryMeta,
  type CategoryId,
} from "@/lib/practice/categories";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * CategoryChip — Slice A.10 (Phase 91).
 *
 * Compact colored pill representing a category on a library card. If
 * `categoryId` is set, shows the category's color swatch + label; if
 * unset, shows a subtle "Category" placeholder inviting the user to
 * pick one.
 *
 * ## Design
 *
 * - Uses OKLCH-like hex color from BUILTIN_CATEGORIES or the user's
 *   customCategories entry. Renders a small circular swatch inside
 *   the pill (color language is the primary category cue in Reports
 *   too).
 * - "Unset" state uses a Tag icon + muted styling to feel optional.
 * - Purely presentational — the parent wires up a picker via `onClick`
 *   or renders it in a popover / edit dialog. This component just
 *   shows the current state.
 *
 * ## Fallback for unknown ids
 *
 * If the id references a custom category that was deleted, resolver
 * returns null. In that case the chip renders "Uncategorized" with
 * neutral styling — never crashes, never silently drops the data.
 */

type CategoryChipProps = {
  categoryId?: CategoryId;
  /** Made the chip clickable. Omit for read-only chips. */
  onClick?: () => void;
  /** Compact chip variant for dense card headers. */
  size?: "sm" | "md";
};

export function CategoryChip({
  categoryId,
  onClick,
  size = "md",
}: CategoryChipProps) {
  const customCategories = useUserPrefs((s) => s.customCategories);
  const meta = categoryId
    ? resolveCategoryMeta(categoryId, customCategories)
    : null;

  const sizeClasses =
    size === "sm"
      ? "gap-1 px-1.5 py-0.5 text-[10px]"
      : "gap-1.5 px-2 py-1 text-xs";
  const swatchSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  const dropdownIconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  const isInteractive = typeof onClick === "function";
  const Comp: "button" | "span" = isInteractive ? "button" : "span";
  const buttonProps = isInteractive
    ? {
        type: "button" as const,
        onClick,
        "aria-label": meta
          ? `Category: ${meta.label}. Click to change.`
          : "Set category",
      }
    : {};

  // Unset state — invite user to pick.
  if (!categoryId || !meta) {
    return (
      <Comp
        {...buttonProps}
        className={`inline-flex items-center rounded-full border border-dashed border-border/70 bg-transparent font-medium text-muted-foreground/80 transition-colors ${sizeClasses} ${
          isInteractive
            ? "hover:border-primary/50 hover:bg-background/50 hover:text-foreground cursor-pointer"
            : ""
        }`}
      >
        <Tag className={swatchSize} aria-hidden="true" />
        <span>
          {categoryId
            ? "Uncategorized"
            : isInteractive
              ? "Set category"
              : "None"}
        </span>
        {isInteractive && (
          <ChevronDown className={dropdownIconSize} aria-hidden="true" />
        )}
      </Comp>
    );
  }

  return (
    <Comp
      {...buttonProps}
      className={`inline-flex items-center rounded-full border border-border/60 bg-background/60 font-medium text-foreground transition-colors ${sizeClasses} ${
        isInteractive
          ? "hover:border-border hover:bg-background cursor-pointer"
          : ""
      }`}
      title={
        // description exists on both CategoryMeta (built-in) + CustomCategory
        (meta as { description?: string }).description ?? undefined
      }
    >
      <span
        className={`inline-block rounded-full ${swatchSize}`}
        style={{ backgroundColor: meta.color }}
        aria-hidden="true"
      />
      <span>{meta.label}</span>
      {isInteractive && (
        <ChevronDown
          className={`text-muted-foreground ${dropdownIconSize}`}
          aria-hidden="true"
        />
      )}
    </Comp>
  );
}

/** Convenience: resolve a category id's display color (or a neutral fallback). */
export function useCategoryColor(categoryId?: CategoryId): string {
  const customCategories = useUserPrefs((s) => s.customCategories);
  if (!categoryId) return "#71717a"; // neutral zinc-500
  const meta = resolveCategoryMeta(categoryId, customCategories);
  if (meta) return meta.color;
  return "#71717a";
}

// Re-export for callers building custom UI without importing categories.ts
export { BUILTIN_CATEGORIES };
