"use client";

import { Check, FolderTree, Plus, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  COLLECTION_COLOR_SWATCHES,
  useCollections,
  type CollectionMember,
} from "@/lib/practice/collections";

/**
 * CollectionsMembershipPicker — Slice I.3 (Phase 150) + polish pass.
 *
 * Popover for editing which collections a given library item belongs
 * to. Combines four things a user needs in this moment:
 *
 *   1. Search — filter existing collections as you type
 *   2. Toggle — click a row to add/remove membership
 *   3. Create — no match for the typed text? A "Create '<name>'" row
 *      appears at the bottom of the list
 *   4. Dress — the create flow offers optional emoji + color pickers
 *      so a new collection looks intentional from the moment it exists
 *
 * ## "Recent" section
 *
 * When there are more than 5 collections and no filter is active, the
 * top 3 by `updatedAt` are pinned under a "Recent" subheader — the
 * common case is "add another drill to the collection you were just
 * organizing", so the recency signal beats alphabetical here.
 *
 * ## Flash-on-add
 *
 * When a toggle-add lands, or when a fresh collection is created + the
 * drill joins it, we ring that row with the primary color for ~1s so
 * the user can visibly confirm the write happened.
 */

const RECENT_COUNT = 3;
const RECENT_THRESHOLD = 5; // only show "Recent" once the list is worth splitting

/**
 * Music-themed emoji quick-picks for the create flow. Order matters —
 * more universal / instrument-neutral picks first so any user finds
 * something serviceable in the first row.
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

export function CollectionsMembershipPicker({
  member,
  onDismiss,
  ignoreRef,
}: {
  member: CollectionMember;
  onDismiss: () => void;
  ignoreRef?: React.RefObject<HTMLElement | null>;
}) {
  const collections = useCollections((s) => s.collections);
  const addMember = useCollections((s) => s.addMember);
  const removeMember = useCollections((s) => s.removeMember);
  const saveCollection = useCollections((s) => s.saveCollection);

  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<null | {
    name: string;
    emoji?: string;
    color?: string;
  }>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus the search/create input every time the picker opens.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (ignoreRef?.current?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onDismiss, ignoreRef]);

  // Clear flash rings after ~1s so the user gets one clear "yes this
  // happened" pulse without lingering visual noise.
  useEffect(() => {
    if (flashIds.size === 0) return;
    const t = window.setTimeout(() => setFlashIds(new Set()), 1000);
    return () => window.clearTimeout(t);
  }, [flashIds]);

  const isMemberIn = (id: string) =>
    collections
      .find((c) => c.id === id)
      ?.members.some((m) => m.type === member.type && m.id === member.id) ??
    false;

  const q = query.trim().toLowerCase();
  const hasQuery = q.length > 0;
  const exactMatch = useMemo(
    () =>
      collections.find(
        (c) => c.name.trim().toLowerCase() === q,
      ),
    [collections, q],
  );

  // Filter + section. When no query, split into Recent + All if we're
  // over the threshold. When query is active, flat matches (still
  // alphabetical for stable order).
  const { recent, browseList, filtered } = useMemo(() => {
    const alpha = [...collections].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    if (hasQuery) {
      const matches = alpha.filter((c) => c.name.toLowerCase().includes(q));
      return { recent: [], browseList: [], filtered: matches };
    }
    if (collections.length > RECENT_THRESHOLD) {
      const byRecency = [...collections].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      const recentTop = byRecency.slice(0, RECENT_COUNT);
      const recentIds = new Set(recentTop.map((c) => c.id));
      const rest = alpha.filter((c) => !recentIds.has(c.id));
      return { recent: recentTop, browseList: rest, filtered: [] };
    }
    return { recent: [], browseList: alpha, filtered: [] };
  }, [collections, hasQuery, q]);

  const flash = (id: string) => {
    setFlashIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const toggle = (id: string) => {
    if (isMemberIn(id)) {
      removeMember(id, member);
    } else {
      addMember(id, member);
      flash(id);
    }
  };

  const startCreate = (name: string) => {
    setCreating({ name, emoji: undefined, color: undefined });
  };

  const commitCreate = () => {
    if (!creating) return;
    const name = creating.name.trim();
    if (!name) return;
    const id = saveCollection({
      name,
      emoji: creating.emoji,
      color: creating.color,
      members: [member],
    });
    flash(id);
    setCreating(null);
    setQuery("");
    // Keep focus in the input in case the user wants to add more.
    inputRef.current?.focus();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!hasQuery) return;
    if (exactMatch) {
      // Enter on an exact match = toggle membership (fastest path).
      toggle(exactMatch.id);
      setQuery("");
      return;
    }
    startCreate(query.trim());
  };

  const renderRow = (c: (typeof collections)[number], keyPrefix = "") => {
    const checked = isMemberIn(c.id);
    const isFlashing = flashIds.has(c.id);
    return (
      <li key={`${keyPrefix}${c.id}`}>
        <button
          type="button"
          onClick={() => toggle(c.id)}
          className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-all ${
            checked
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          } ${isFlashing ? "ring-2 ring-primary" : ""}`}
        >
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
            style={{
              backgroundColor: checked ? "var(--primary)" : "transparent",
              borderColor: checked ? "var(--primary)" : "var(--border)",
            }}
            aria-hidden="true"
          >
            {checked && (
              <Check
                className="h-2.5 w-2.5 text-primary-foreground"
                aria-hidden="true"
              />
            )}
          </span>
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
        </button>
      </li>
    );
  };

  const showCreateRow =
    hasQuery && !exactMatch && !creating;
  const listEmpty =
    !creating &&
    !hasQuery &&
    collections.length === 0;

  return (
    <div
      ref={ref}
      className="z-30 flex w-64 flex-col gap-2 rounded-md border border-border bg-background/95 p-2.5 shadow-lg backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Add to collections
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

      {/* Search + create input. Doubles as the search field and the
          new-collection name field — Linear/Notion pattern. */}
      {!creating && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={
              collections.length === 0
                ? "Name your first collection…"
                : "Search or create…"
            }
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
          />
        </div>
      )}

      {listEmpty && (
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="flex flex-col items-center gap-1 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-3 text-center transition-colors hover:border-primary/60 hover:bg-primary/10"
        >
          <FolderTree
            className="h-4 w-4 text-primary"
            aria-hidden="true"
          />
          <span className="text-[11px] font-medium text-foreground">
            Create your first collection
          </span>
          <span className="text-[10px] text-muted-foreground">
            Type a name above — this drill will be added to it.
          </span>
        </button>
      )}

      {/* Browse mode — Recent (if applicable) + main list. */}
      {!creating && !listEmpty && (
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {recent.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                Recent
              </span>
              <ul className="flex flex-col gap-0.5">
                {recent.map((c) => renderRow(c, "r-"))}
              </ul>
            </div>
          )}
          {(browseList.length > 0 || filtered.length > 0) && (
            <div className="flex flex-col gap-1">
              {recent.length > 0 && (
                <span className="px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                  All
                </span>
              )}
              <ul className="flex flex-col gap-0.5">
                {(hasQuery ? filtered : browseList).map((c) => renderRow(c))}
              </ul>
            </div>
          )}
          {hasQuery && filtered.length === 0 && (
            <p className="px-1 text-[11px] italic text-muted-foreground">
              No collection called &ldquo;{query}&rdquo; yet.
            </p>
          )}
        </div>
      )}

      {/* "Create '<name>'" call-to-action — appears when the query
          doesn't match any existing collection. Fastest way for a user
          who's about to organize on the fly. */}
      {showCreateRow && (
        <button
          type="button"
          onClick={() => startCreate(query.trim())}
          className="flex items-center gap-2 rounded-md border border-dashed border-primary/50 bg-primary/5 px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:border-primary/70 hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span className="flex-1 truncate">
            Create{" "}
            <span className="font-medium">&ldquo;{query.trim()}&rdquo;</span>
          </span>
        </button>
      )}

      {/* Create mode — inline "dress it up" form with emoji + color. */}
      {creating && (
        <div className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
              New collection
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
  );
}
