"use client";

import { Copy, Pencil, Play, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { KeyDrill } from "@/lib/key-sequencer/types";
import { ORDERING_STRATEGY_DISPLAY_NAMES } from "@/lib/state/practice-config";

/**
 * KeyDrillCard — one saved drill in the Key Sequencer library.
 *
 * Card is clickable end-to-end to LAUNCH the drill. Edit / duplicate
 * / delete icons overlay in the top-right corner (revealed on hover
 * on desktop, always-visible on touch — same pattern as the /sheets
 * library cards).
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
      className={`group relative rounded-lg border bg-background/40 transition-colors ${
        isEditing
          ? "border-primary/60 bg-primary/5"
          : "border-border hover:border-primary/60 hover:bg-primary/5"
      }`}
    >
      <button
        type="button"
        onClick={() => onLaunch(drill)}
        className="block w-full p-3 text-left"
      >
        <div className="flex items-center gap-2 pr-24">
          <Play className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex-1 truncate font-medium text-foreground">
            {drill.name}
          </span>
        </div>
        <div className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
          {summary}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {ORDERING_STRATEGY_DISPLAY_NAMES[c.keyOrdering]}
        </div>
        {drill.notes && (
          <div className="mt-1.5 line-clamp-2 text-xs italic text-muted-foreground/80">
            {drill.notes}
          </div>
        )}
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-1">
        {confirmingDelete ? (
          <>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-sm border border-border bg-background px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(drill.id);
                setConfirmingDelete(false);
              }}
              className="rounded-sm border border-destructive/60 bg-destructive/15 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-destructive transition-colors hover:bg-destructive/25"
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onEdit(drill)}
              aria-label={`Edit drill ${drill.name}`}
              title="Edit"
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/50 transition-colors hover:bg-border/60 hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(drill)}
              aria-label={`Duplicate drill ${drill.name}`}
              title="Duplicate"
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/50 transition-colors hover:bg-border/60 hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete drill ${drill.name}`}
              title="Delete"
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
