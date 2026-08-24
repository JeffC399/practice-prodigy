"use client";

import { Sparkles, X } from "lucide-react";
import { useMemo } from "react";
import {
  useCollections,
  type CollectionMemberType,
} from "@/lib/practice/collections";
import {
  detectSuggestions,
  useDismissedSuggestions,
} from "@/lib/practice/collections-auto-suggest";

/**
 * CollectionsAutoSuggestBanner — Slice I.5 (Phase 152).
 *
 * Renders a subtle nudge banner ABOVE the library grid when the
 * detector finds 2+ items sharing a name prefix that aren't already
 * grouped. One-click confirm creates a new collection auto-named
 * from the prefix and drops all matching items in. Dismiss hides
 * this specific suggestion forever (unless the item set changes).
 *
 * Shows at most ONE suggestion at a time — the most-populated one —
 * so users aren't overwhelmed by a stack of nudges. If they accept
 * or dismiss it, the next suggestion (if any) surfaces on next render.
 */
export function CollectionsAutoSuggestBanner<TItem extends { id: string }>({
  items,
  getName,
  memberType,
}: {
  items: readonly TItem[];
  getName: (item: TItem) => string;
  memberType: CollectionMemberType;
}) {
  const collections = useCollections((s) => s.collections);
  const saveCollection = useCollections((s) => s.saveCollection);
  const dismissed = useDismissedSuggestions((s) => s.dismissed);
  const dismiss = useDismissedSuggestions((s) => s.dismiss);

  const suggestions = useMemo(
    () =>
      detectSuggestions(
        items,
        getName,
        memberType,
        collections,
        new Set(dismissed),
      ),
    [items, getName, memberType, collections, dismissed],
  );

  const top = suggestions[0];
  if (!top) return null;

  const accept = () => {
    saveCollection({
      name: top.prefix,
      members: top.members,
    });
    // No need to dismiss — the created collection will exclude this
    // suggestion on the next detect pass (allShareACollection guard).
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm text-foreground">
          {top.members.length} items start with{" "}
          <span className="font-medium">&ldquo;{top.prefix}&rdquo;</span>.
          Group them?
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
          Creates a &ldquo;{top.prefix}&rdquo; collection with all{" "}
          {top.members.length} added.
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => dismiss(top.key)}
          aria-label="Dismiss suggestion"
          title="Not now — hide this suggestion"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          Not now
        </button>
        <button
          type="button"
          onClick={accept}
          className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Group them
        </button>
      </div>
    </div>
  );
}
