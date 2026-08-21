"use client";

import { Copy, ListChecks, Play, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CategoryTimeBar } from "@/components/my-practice/category-time-bar";
import { CategoryChip } from "@/components/practice/category-chip";
import {
  categoryTimeBreakdown,
  routineCategories,
  useRoutinesLibrary,
} from "@/lib/practice/routines-library";
import {
  totalEstimatedSeconds,
  type Routine,
} from "@/lib/practice/routine-types";

/**
 * RoutineCard — Slice B.3 (Phase 103).
 *
 * One saved routine rendered as a tile in the Routines tab. Mirrors
 * the visual language of KeyDrillCard so the two libraries feel like
 * siblings: bordered rounded tile with a body + hover-revealed action
 * icons in the footer. Adds a small category-chip row derived from
 * the items' categories.
 *
 * Phase 103 ships inline name + notes editing on the card so users
 * can rename immediately after Build. Item-list editing / add-item /
 * reorder ship in later phases (B.4 → B.7).
 *
 * ## Actions
 *
 *   - Launch: disabled until the routine executor lands in Slice B.9.
 *     Included in the footer so the affordance is discoverable now;
 *     tooltip explains "Coming in B.9".
 *   - Duplicate: clones the routine with " (copy)" suffix.
 *   - Delete: two-click confirm (matches drill-card pattern).
 *
 * Name and notes auto-save on blur (click outside) or Enter on name.
 * Same pattern as the KS editing badge from Phase 99.
 */

export function RoutineCard({
  routine,
  onOpen,
}: {
  routine: Routine;
  /**
   * Phase 104 — When set, an "Open" affordance on the card navigates
   * the user into the routine builder. Card still supports inline
   * name/notes editing without navigation.
   */
  onOpen?: (id: string) => void;
}) {
  const lib = useRoutinesLibrary();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const itemCount = routine.items.length;
  const totalSec = totalEstimatedSeconds(routine);
  const categories = routineCategories(routine);
  const timeBreakdown = useMemo(
    () => categoryTimeBreakdown(routine),
    [routine],
  );
  // Only show the mini time bar when at least ONE category has real
  // time — a bar of all zeros would just render nothing anyway.
  const hasEstimatedTime = timeBreakdown.some((s) => s.seconds > 0);

  const summaryParts: string[] = [
    `${itemCount} ${itemCount === 1 ? "item" : "items"}`,
  ];
  if (totalSec > 0) {
    summaryParts.push(formatDuration(totalSec));
  }
  if (routine.lastRunAt) {
    summaryParts.push(`last run ${formatRelative(routine.lastRunAt)}`);
  }
  const summary = summaryParts.join(" · ");

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border-2 border-border bg-background/40 transition-all hover:border-primary/60 hover:bg-primary/5 hover:shadow-md">
      {/* Body — name (editable), summary line, notes (editable), category chips. */}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <ListChecks
            className="h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <input
            key={`${routine.id}-name`}
            type="text"
            defaultValue={routine.name}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== routine.name) {
                lib.updateRoutineMeta(routine.id, { name: next });
              } else if (!next) {
                e.target.value = routine.name;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Routine name"
            className="flex-1 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-base font-medium text-foreground focus:border-border/60 focus:bg-background/60 focus:outline-none"
          />
        </div>
        <div className="pl-6 truncate font-mono text-xs text-muted-foreground">
          {summary}
        </div>
        {hasEstimatedTime && (
          <div className="pl-6">
            <CategoryTimeBar
              slices={timeBreakdown}
              showLegend={false}
              barHeight={2}
            />
          </div>
        )}
        {categories.length > 0 && (
          <div className="pl-6 flex flex-wrap gap-1">
            {categories.map((catId) => (
              <CategoryChip key={catId} categoryId={catId} size="sm" />
            ))}
          </div>
        )}
        <textarea
          key={`${routine.id}-notes`}
          defaultValue={routine.notes ?? ""}
          onBlur={(e) => {
            const next = e.target.value.trim().slice(0, 300);
            if (next !== (routine.notes ?? "")) {
              lib.updateRoutineMeta(routine.id, { notes: next });
            }
          }}
          placeholder="Add notes (optional)…"
          rows={1}
          className="ml-6 resize-none rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs text-muted-foreground focus:border-border/60 focus:bg-background/60 focus:outline-none focus:text-foreground"
        />
      </div>

      {/* Footer — Launch (disabled until B.9) + Duplicate + Delete.
          Hover-revealed on desktop (matches KeyDrillCard); always
          visible on mobile since touch has no hover. */}
      <div className="flex items-center justify-end gap-1 border-t border-border/60 bg-background/30 px-3 py-2 opacity-100 transition-opacity md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto">
        {confirmingDelete ? (
          <>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Cancel delete"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                lib.deleteRoutine(routine.id);
                setConfirmingDelete(false);
              }}
              className="inline-flex h-7 items-center justify-center rounded-md bg-destructive px-2 text-[11px] font-medium text-destructive-foreground transition-opacity hover:opacity-90"
              aria-label="Confirm delete"
            >
              Confirm
            </button>
          </>
        ) : (
          <>
            {onOpen && (
              <button
                type="button"
                onClick={() => onOpen(routine.id)}
                aria-label={`Open routine ${routine.name} in the builder`}
                title="Open in builder"
                className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
              >
                Open
              </button>
            )}
            <button
              type="button"
              disabled
              title="Routine player ships in B.9."
              aria-label="Launch routine (coming in B.9)"
              className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground/50 cursor-not-allowed"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Launch
            </button>
            <button
              type="button"
              onClick={() => lib.duplicateRoutine(routine.id)}
              aria-label={`Duplicate routine ${routine.name}`}
              title="Duplicate"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete routine ${routine.name}`}
              title="Delete"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Format an ms-epoch as a coarse "X min ago" / "yesterday" / "MMM D" tag. */
function formatRelative(ms: number): string {
  const now = Date.now();
  const diffMin = Math.round((now - ms) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Format seconds as "12 min" / "1h 15m" — matches the builder's chip. */
function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins - hrs * 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}
