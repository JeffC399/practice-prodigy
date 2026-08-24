"use client";

import { FolderTree, Plus, X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  COLLECTION_COLOR_SWATCHES,
  useCollections,
  type CollectionMember,
  type CollectionMemberType,
} from "@/lib/practice/collections";

/**
 * BulkAddToCollectionMenu — Slice I polish.
 *
 * Sibling to the per-drill `CollectionsMembershipPicker`, but focused
 * on the "I've selected N drills, add them all to one collection"
 * flow. Different from the per-drill picker in three ways:
 *
 *   1. Single-select destination — user picks ONE collection, we add
 *      every selected member id to it.
 *   2. No per-row toggle — clicking a row commits and dismisses.
 *   3. Optional inline create with emoji + color, same as the
 *      per-drill picker (so bulk-created collections feel intentional).
 *
 * Positioning: portaled to the body with fixed coords under the
 * trigger button, same technique as CollectionsMembershipPicker so
 * card `overflow-hidden` never clips this.
 */

const EMOJI_QUICK_PICKS = [
  "🎵",
  "🎶",
  "🎸",
  "🎹",
  "🥁",
  "🎼",
  "🎤",
  "⭐",
] as const;

export function BulkAddToCollectionMenu({
  triggerRef,
  memberType,
  selectedIds,
  onDismiss,
  onCommitted,
}: {
  triggerRef: React.RefObject<HTMLElement | null>;
  memberType: CollectionMemberType;
  selectedIds: readonly string[];
  onDismiss: () => void;
  /** Called after the add succeeds so the parent can exit select mode. */
  onCommitted: () => void;
}) {
  const collections = useCollections((s) => s.collections);
  const addMember = useCollections((s) => s.addMember);
  const saveCollection = useCollections((s) => s.saveCollection);

  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<null | {
    name: string;
    emoji?: string;
    color?: string;
  }>(null);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onDismiss();
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
  }, [onDismiss, triggerRef]);

  // Same positioning trick as CollectionsChip — portal + fixed +
  // recompute on scroll/resize so we escape overflow-hidden clipping
  // and always sit under the trigger.
  useLayoutEffect(() => {
    const POPOVER_WIDTH = 288; // w-72
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      // Prefer opening DOWNWARD unless we're near the viewport bottom,
      // in which case flip upward so the popover stays visible.
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < 300;
      const top = openUp ? Math.max(8, r.top - 8 - 320) : r.bottom + 4;
      const leftUnclamped = r.right - POPOVER_WIDTH;
      const left = Math.max(
        8,
        Math.min(window.innerWidth - POPOVER_WIDTH - 8, leftUnclamped),
      );
      setCoords({ top, left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [triggerRef]);

  const q = query.trim().toLowerCase();
  const hasQuery = q.length > 0;
  const exactMatch = useMemo(
    () => collections.find((c) => c.name.trim().toLowerCase() === q),
    [collections, q],
  );

  const sorted = useMemo(() => {
    const alpha = [...collections].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    if (!hasQuery) return alpha;
    return alpha.filter((c) => c.name.toLowerCase().includes(q));
  }, [collections, hasQuery, q]);

  const addToCollectionId = (id: string) => {
    for (const itemId of selectedIds) {
      const member: CollectionMember = { type: memberType, id: itemId };
      addMember(id, member);
    }
    onCommitted();
    onDismiss();
  };

  const startCreate = (name: string) => {
    setCreating({ name });
  };

  const commitCreate = () => {
    if (!creating) return;
    const name = creating.name.trim();
    if (!name) return;
    const members: CollectionMember[] = selectedIds.map((id) => ({
      type: memberType,
      id,
    }));
    saveCollection({
      name,
      emoji: creating.emoji,
      color: creating.color,
      members,
    });
    onCommitted();
    onDismiss();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!hasQuery) return;
    if (exactMatch) {
      addToCollectionId(exactMatch.id);
      return;
    }
    startCreate(query.trim());
  };

  if (!mounted || !coords) return null;

  const showCreateRow = hasQuery && !exactMatch && !creating;
  const n = selectedIds.length;

  return createPortal(
    <div className="fixed z-50" style={{ top: coords.top, left: coords.left }}>
      <div
        ref={ref}
        className="flex w-72 flex-col gap-2 rounded-md border border-border bg-background/95 p-3 shadow-2xl backdrop-blur"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Add {n} {n === 1 ? "drill" : "drills"} to…
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>

        {!creating && (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={
              collections.length === 0
                ? "Name a new collection…"
                : "Pick a collection or type to create…"
            }
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
          />
        )}

        {!creating && sorted.length > 0 && (
          <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {sorted.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => addToCollectionId(c.id)}
                  className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-left text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                >
                  {c.emoji ? (
                    <span
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-xs"
                      aria-hidden="true"
                    >
                      {c.emoji}
                    </span>
                  ) : (
                    <FolderTree
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: c.color ?? "currentColor" }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="flex-1 truncate text-xs">{c.name}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                    {c.members.length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!creating && hasQuery && sorted.length === 0 && !exactMatch && (
          <p className="px-1 text-[11px] italic text-muted-foreground">
            No collection called &ldquo;{query}&rdquo; yet.
          </p>
        )}

        {showCreateRow && (
          <button
            type="button"
            onClick={() => startCreate(query.trim())}
            className="flex items-center gap-2 rounded-md border border-dashed border-primary/50 bg-primary/5 px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:border-primary/70 hover:bg-primary/10"
          >
            <Plus className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="flex-1 truncate">
              Create{" "}
              <span className="font-medium">
                &ldquo;{query.trim()}&rdquo;
              </span>{" "}
              with {n} {n === 1 ? "drill" : "drills"}
            </span>
          </button>
        )}

        {creating && (
          <div className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
                New collection with {n} {n === 1 ? "drill" : "drills"}
              </span>
              <input
                type="text"
                value={creating.name}
                onChange={(e) =>
                  setCreating((prev) =>
                    prev ? { ...prev, name: e.target.value } : prev,
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitCreate();
                  }
                }}
                autoFocus
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
                Emoji <span className="normal-case">(optional)</span>
              </span>
              <div className="flex flex-wrap gap-1">
                {EMOJI_QUICK_PICKS.map((e) => {
                  const active = creating.emoji === e;
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() =>
                        setCreating((prev) =>
                          prev
                            ? { ...prev, emoji: active ? undefined : e }
                            : prev,
                        )
                      }
                      className={`flex h-6 w-6 items-center justify-center rounded-md border text-sm transition-colors ${
                        active
                          ? "border-primary bg-primary/20"
                          : "border-border/60 bg-background/60 hover:border-primary/50"
                      }`}
                      aria-pressed={active}
                      aria-label={`Emoji ${e}`}
                    >
                      <span aria-hidden="true">{e}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
                Color <span className="normal-case">(optional)</span>
              </span>
              <div className="flex flex-wrap gap-1">
                {COLLECTION_COLOR_SWATCHES.map((c) => {
                  const active = creating.color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setCreating((prev) =>
                          prev
                            ? { ...prev, color: active ? undefined : c }
                            : prev,
                        )
                      }
                      className={`h-5 w-5 rounded-full border transition-transform ${
                        active
                          ? "border-primary scale-110"
                          : "border-border/60 hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                      aria-pressed={active}
                      aria-label={`Color ${c}`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-1 pt-1">
              <button
                type="button"
                onClick={() => setCreating(null)}
                className="rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitCreate}
                disabled={creating.name.trim().length === 0}
                className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create + add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
