"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  COLLECTION_COLOR_SWATCHES,
  useCollections,
} from "@/lib/practice/collections";

/**
 * CollectionFormModal — Slice I.2 (Phase 149).
 *
 * Create + edit modal for Collections. Fields:
 *
 *   - Name (required)
 *   - Emoji (optional — plain unicode)
 *   - Color swatch (optional — pick from 10 presets, or leave neutral)
 *   - Description (optional — one-liner explaining the collection)
 *
 * Membership editing is a separate concern (Phase 150 will ship the
 * per-card editor + a bulk "Add drills to this collection" pane on
 * the collection detail page). This modal only touches metadata so
 * quick renames + color changes stay fast.
 */
export function CollectionFormModal({
  collectionId,
  onClose,
}: {
  /**
   * When set, edits the existing collection with that id. When null,
   * the modal is in "create new" mode.
   */
  collectionId: string | null;
  onClose: () => void;
}) {
  const existing = useCollections((s) =>
    collectionId ? s.collections.find((c) => c.id === collectionId) : null,
  );
  const saveCollection = useCollections((s) => s.saveCollection);
  const updateCollection = useCollections((s) => s.updateCollection);

  const [name, setName] = useState(existing?.name ?? "");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "");
  const [color, setColor] = useState<string | undefined>(existing?.color);
  const [description, setDescription] = useState(existing?.description ?? "");

  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    if (existing) {
      updateCollection(existing.id, {
        name: name.trim(),
        emoji,
        color,
        description,
      });
    } else {
      saveCollection({
        name: name.trim(),
        emoji,
        color,
        description,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close collection editor"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-form-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-lg border-2 border-border bg-background p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span
              id="collection-form-title"
              className="font-mono text-[10px] uppercase tracking-wider text-primary"
            >
              {existing ? "Edit collection" : "New collection"}
            </span>
            <h2 className="text-lg font-semibold text-foreground">
              {existing?.name || "Untitled collection"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Name<span className="text-primary"> *</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Learn the Fretboard"
              autoFocus
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-[auto_1fr] items-center gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Emoji
              </span>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                placeholder="🎸"
                className="w-16 rounded-md border border-border bg-background px-3 py-2 text-center text-lg focus:border-primary focus:outline-none"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Color
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setColor(undefined)}
                  aria-label="Clear color"
                  aria-pressed={color === undefined}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] transition-transform ${
                    color === undefined
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                  title="No color"
                >
                  —
                </button>
                {COLLECTION_COLOR_SWATCHES.map((hex) => {
                  const active = color === hex;
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setColor(hex)}
                      aria-label={`Color ${hex}`}
                      aria-pressed={active}
                      style={{ backgroundColor: hex }}
                      className={`h-6 w-6 rounded-full border transition-transform ${
                        active
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-border/60 hover:border-primary/40"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Description (optional)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this collection for? A season? A project? A tune?"
              rows={3}
              className="resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {existing ? "Save changes" : "Create collection"}
          </button>
        </div>
      </div>
    </div>
  );
}
