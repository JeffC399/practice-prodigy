"use client";

import { useEffect, useRef } from "react";
import {
  PROFICIENCY_LEVEL_DESCRIPTIONS,
  PROFICIENCY_LEVEL_DESCRIPTORS,
  formatLevel,
  type ProficiencyLevel,
} from "@/lib/practice/proficiency";

/**
 * LevelPickerPopover — Slice D.7 (Phase 124).
 *
 * Small popover used by the Levels & progression panel to let the
 * user set (or update) their proficiency for a single category
 * inline. Two rows:
 *
 *   1. Current — 6 buttons (Level 1..5 + N/A) with the current pick
 *      highlighted.
 *   2. Target  — 6 buttons (Level 1..5 + Clear) for the aspiration.
 *      Hidden when current === "n/a" (target is meaningless there).
 *
 * The panel handles positioning + click-outside dismissal; this
 * component is just the content grid.
 */
export function LevelPickerPopover({
  current,
  target,
  onSetCurrent,
  onSetTarget,
  onDismiss,
}: {
  current: ProficiencyLevel | undefined;
  target: 1 | 2 | 3 | 4 | 5 | undefined;
  onSetCurrent: (next: ProficiencyLevel) => void;
  onSetTarget: (next: 1 | 2 | 3 | 4 | 5 | undefined) => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onDismiss]);

  const showTarget = current !== "n/a";

  return (
    <div
      ref={ref}
      className="z-20 flex w-72 flex-col gap-3 rounded-md border border-border bg-background/95 p-3 shadow-lg backdrop-blur"
    >
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Current level
        </span>
        <div className="grid grid-cols-6 gap-1">
          {([1, 2, 3, 4, 5, "n/a"] as ProficiencyLevel[]).map((lv) => {
            const active = current === lv;
            return (
              <button
                key={String(lv)}
                type="button"
                onClick={() => onSetCurrent(lv)}
                title={
                  lv === "n/a"
                    ? PROFICIENCY_LEVEL_DESCRIPTIONS["n/a"]
                    : formatLevel(lv)
                }
                aria-pressed={active}
                className={`rounded-md border px-1.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/25 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {lv === "n/a" ? "N/A" : lv}
              </button>
            );
          })}
        </div>
        {current !== undefined && (
          <p className="text-[10px] text-muted-foreground/80 leading-snug">
            {current === "n/a"
              ? PROFICIENCY_LEVEL_DESCRIPTIONS["n/a"]
              : `${PROFICIENCY_LEVEL_DESCRIPTORS[current]} — ${PROFICIENCY_LEVEL_DESCRIPTIONS[current]}`}
          </p>
        )}
      </div>

      {showTarget && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Target (optional)
          </span>
          <div className="grid grid-cols-6 gap-1">
            {([1, 2, 3, 4, 5] as const).map((lv) => {
              const active = target === lv;
              return (
                <button
                  key={lv}
                  type="button"
                  onClick={() => onSetTarget(lv)}
                  title={formatLevel(lv)}
                  aria-pressed={active}
                  className={`rounded-md border px-1.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary/25 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {lv}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onSetTarget(undefined)}
              title="Clear target"
              disabled={target === undefined}
              className="rounded-md border border-border bg-background px-1.5 py-1 font-mono text-[10px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/70 leading-snug">
            Pure aspiration — the app never enforces it. AI Coach uses
            the gap to bias routines toward weak spots.
          </p>
        </div>
      )}
    </div>
  );
}
