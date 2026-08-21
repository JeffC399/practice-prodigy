"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { LevelPickerPopover } from "./level-picker-popover";
import { CategoryChip } from "@/components/practice/category-chip";
import {
  BUILTIN_CATEGORY_LIST,
  type CategoryId,
} from "@/lib/practice/categories";
import {
  PROFICIENCY_LEVEL_DESCRIPTORS,
  formatLevel,
  levelDelta,
  type ProficiencyLevel,
} from "@/lib/practice/proficiency";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * LevelsPanel — Slice D.7 (Phase 124).
 *
 * Two-part panel:
 *
 *   1. Per-category chip grid — one row per built-in category (+
 *      any custom categories the user has added). Each row shows:
 *        - CategoryChip (color + name)
 *        - Current level (or "Not rated" as a subtle CTA)
 *        - Target level, when set, with a gap indicator
 *        - Click → LevelPickerPopover to set/change
 *
 *   2. Recent progressions — last 3 entries from `levelHistory`, only
 *      rendered when there are any (skipped for fresh users).
 *
 * ## Why this is also the entry point
 *
 * The full Profile tab (Slice E/F) will host a richer level manager.
 * Until it ships, users have no other place to set proficiency, so
 * this panel doubles as the editor via inline popovers. The Reports
 * surface is the natural place to encounter your levels — you see
 * them next to the time you actually spent per category.
 *
 * Deferred to Slice E: recent-vibe-check trend per category. The
 * data model persists vibes per RoutineExecution but not as a
 * long-lived per-category log, so surfacing trends needs a separate
 * aggregator over routine executions in cloud sync (v2).
 */
export function LevelsPanel() {
  const proficiency = useUserPrefs((s) => s.proficiency);
  const levelHistory = useUserPrefs((s) => s.levelHistory);
  const customCategories = useUserPrefs((s) => s.customCategories);
  const setCategoryLevel = useUserPrefs((s) => s.setCategoryLevel);
  const setCategoryTarget = useUserPrefs((s) => s.setCategoryTarget);

  const [openCatId, setOpenCatId] = useState<CategoryId | null>(null);

  const categories = useMemo<CategoryId[]>(() => {
    const builtin = BUILTIN_CATEGORY_LIST.map((c) => c.id as CategoryId);
    const custom = customCategories.map((c) => c.id as CategoryId);
    return [...builtin, ...custom];
  }, [customCategories]);

  const recentChanges = useMemo(() => {
    // Newest first — levelHistory is append-only, so a copy + sort
    // by `at` DESC is safe.
    const copy = [...levelHistory];
    copy.sort((a, b) => b.at - a.at);
    return copy.slice(0, 3);
  }, [levelHistory]);

  const ratedCount = Object.keys(proficiency).length;

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/40 px-4 py-3">
      <header className="flex flex-col gap-0.5">
        <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Levels &amp; progression
        </h3>
        <p className="text-[11px] text-muted-foreground/70">
          Self-rated proficiency per category. Level 1 = Exploring →
          Level 5 = Teaching. N/A hides the category from AI Coach.
          {ratedCount === 0 &&
            " Tap any category to rate it — takes 10 seconds."}
        </p>
      </header>

      <ul className="flex flex-col gap-1">
        {categories.map((catId) => {
          const entry = proficiency[catId];
          const current = entry?.current;
          const target = entry?.target;
          const open = openCatId === catId;
          return (
            <li key={catId} className="relative">
              <button
                type="button"
                onClick={() => setOpenCatId(open ? null : catId)}
                aria-expanded={open}
                className={`flex w-full items-center gap-3 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                  open
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/60 bg-background/40 hover:border-primary/40"
                }`}
              >
                <CategoryChip categoryId={catId} size="sm" />
                <LevelSummary current={current} target={target} />
                <ChevronRight
                  className={`ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform ${
                    open ? "rotate-90" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>
              {open && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 sm:right-auto sm:w-auto">
                  <LevelPickerPopover
                    current={current}
                    target={target}
                    onSetCurrent={(next) => setCategoryLevel(catId, next)}
                    onSetTarget={(next) => setCategoryTarget(catId, next)}
                    onDismiss={() => setOpenCatId(null)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {recentChanges.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border/40 pt-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
            Recent progressions
          </span>
          <ul className="flex flex-col gap-0.5">
            {recentChanges.map((c, i) => (
              <li
                key={`${c.categoryId}-${c.at}-${i}`}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <CategoryChip categoryId={c.categoryId} size="sm" />
                <span className="font-mono tabular-nums text-foreground">
                  {formatOneLevel(c.from)} → {formatOneLevel(c.to)}
                </span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
                  {formatRelative(c.at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function LevelSummary({
  current,
  target,
}: {
  current: ProficiencyLevel | undefined;
  target: 1 | 2 | 3 | 4 | 5 | undefined;
}) {
  if (current === undefined) {
    return (
      <span className="font-mono text-[11px] italic text-muted-foreground/70">
        Not rated — tap to set
      </span>
    );
  }
  if (current === "n/a") {
    return (
      <span className="font-mono text-[11px] text-muted-foreground">
        Not applicable
      </span>
    );
  }
  const delta =
    target !== undefined ? levelDelta(current, target) : null;
  return (
    <div className="flex flex-wrap items-baseline gap-1.5 font-mono text-[11px]">
      <span className="text-foreground tabular-nums">Level {current}</span>
      <span className="text-muted-foreground/70">
        · {PROFICIENCY_LEVEL_DESCRIPTORS[current]}
      </span>
      {target !== undefined && (
        <span className="ml-1 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 tabular-nums text-muted-foreground">
          target L{target}
          {delta !== null && delta !== 0 && (
            <span
              className={
                delta > 0 ? "ml-1 text-primary" : "ml-1 text-muted-foreground/60"
              }
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/** Compact level label: "Level 3" or "N/A". */
function formatOneLevel(lv: ProficiencyLevel): string {
  return lv === "n/a" ? "N/A" : `Level ${lv}`;
}

/** Very brief relative time — "today", "2d ago", "3w ago". */
function formatRelative(at: number, now: number = Date.now()): string {
  const diffMs = now - at;
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return "today";
  const days = Math.floor(diffMs / day);
  if (days < 14) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
