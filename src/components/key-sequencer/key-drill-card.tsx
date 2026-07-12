"use client";

import { Copy, Pencil, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import type { KeyDrill } from "@/lib/key-sequencer/types";
import { ORDERING_STRATEGY_DISPLAY_NAMES } from "@/lib/state/practice-config";

/**
 * KeyDrillCard — one saved drill in the Key Sequencer library.
 *
 * Phase 48 — restructured to match the /sheets library card pattern:
 * clickable body (title + summary + notes) on top, action icons in a
 * dedicated footer bar with a border-t separator. On desktop the
 * footer icons are hidden until hover; on mobile they stay visible
 * (no hover state on touch). This eliminates the icon-overlap-title
 * problem visible when a drill had a long name.
 */

export function KeyDrillCard({
  drill,
  isEditing,
  onLaunch,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  drill: KeyDrill;
  isEditing: boolean;
  onLaunch: (drill: KeyDrill) => void;
  onEdit: (drill: KeyDrill) => void;
  onDuplicate: (drill: KeyDrill) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const c = drill.config;
  const summary = [
    `${c.keyPool.length} ${c.keyPool.length === 1 ? "key" : "keys"}`,
    `${c.promptRows.length} ${c.promptRows.length === 1 ? "row" : "rows"}`,
    `♩=${c.bpm}`,
    `${c.timeSignature.beatsPerMeasure}/${c.timeSignature.beatUnit}`,
    c.repeatIndefinitely
      ? "loop"
      : `${c.repetitions} pass${c.repetitions === 1 ? "" : "es"}`,
  ].join(" · ");

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border-2 bg-background/40 transition-all ${
        isEditing
          ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-md"
          : "border-border hover:border-primary/60 hover:bg-primary/5 hover:shadow-md"
      }`}
    >
      {isEditing && (
        <div className="absolute right-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary-foreground shadow">
          Editing
        </div>
      )}
      {/* Body — full clickable area launches the drill. */}
      <button
        type="button"
        onClick={() => onLaunch(drill)}
        className="flex flex-col gap-1.5 p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex-1 truncate font-medium text-foreground">
            {drill.name}
          </span>
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground">
          {summary}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {ORDERING_STRATEGY_DISPLAY_NAMES[c.keyOrdering]}
        </div>
        {drill.notes && (
          <div className="line-clamp-2 text-xs italic text-muted-foreground/80">
            {drill.notes}
          </div>
        )}
      </button>

      {/* Footer — action icons in a dedicated row. Hidden on desktop
          by default, revealed on group-hover OR when any child gets
          keyboard focus. Mobile keeps them visible since there's no
          hover state on touch. pointer-events toggle so hidden icons
          can't be accidentally tapped. */}
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
                onDelete(drill.id);
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
            <button
              type="button"
              onClick={() => onEdit(drill)}
              aria-label={`Edit drill ${drill.name}`}
              title="Edit"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(drill)}
              aria-label={`Duplicate drill ${drill.name}`}
              title="Duplicate"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete drill ${drill.name}`}
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
