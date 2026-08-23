import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  type Collection,
  type CollectionMember,
  type CollectionMemberType,
} from "./collections";

/**
 * collections-auto-suggest — Slice I.5 (Phase 152).
 *
 * Detects when the user has 2+ items whose names share a common
 * prefix, then offers a one-click "Group these under 'Foo'?" nudge.
 * Zero-config path for users who already name their drills with a
 * disciplined prefix pattern (e.g. "Learn the Fretboard (1&2)",
 * "Learn the Fretboard (3&4)").
 *
 * ## Detection heuristic
 *
 * Strip each name at its first `(` or ` - `, trim whitespace, and
 * group items by the resulting prefix (case-insensitive). Any prefix
 * with 2+ members AND >= 10 chars becomes a suggestion.
 *
 * ## Suppression
 *
 *   1. Items already in a shared collection are excluded — no point
 *      suggesting a grouping the user already did.
 *   2. Prefixes matching an existing collection's name are excluded
 *      too (they'd probably want to add to it, not create a dupe).
 *   3. Suggestions the user has dismissed live in localStorage and
 *      never re-surface unless the item set changes materially.
 */

/** Threshold below which two-item prefix matches don't produce a suggestion. */
const MIN_PREFIX_CHARS = 10;

export type AutoSuggestion = {
  /** Stable key used for dismissal — the prefix + member ids sorted. */
  key: string;
  /** The trimmed prefix (used as the auto-created collection name). */
  prefix: string;
  /** Member refs for every item sharing the prefix. */
  members: CollectionMember[];
};

/**
 * Detect all suggestions for a given module's items. Callers pass the
 * module's items + a name getter (Songs use `.title`, drills use
 * `.name`) so the helper stays module-agnostic.
 */
export function detectSuggestions<TItem extends { id: string }>(
  items: readonly TItem[],
  getName: (item: TItem) => string,
  memberType: CollectionMemberType,
  collections: readonly Collection[],
  dismissedKeys: ReadonlySet<string>,
): AutoSuggestion[] {
  // 1. Group items by trimmed prefix.
  const byPrefix = new Map<string, { display: string; items: TItem[] }>();
  for (const item of items) {
    const raw = getName(item);
    const prefix = trimToPrefix(raw);
    if (prefix.length < MIN_PREFIX_CHARS) continue;
    const key = prefix.toLowerCase();
    const entry = byPrefix.get(key);
    if (entry) {
      entry.items.push(item);
    } else {
      byPrefix.set(key, { display: prefix, items: [item] });
    }
  }

  // 2. Filter to prefixes with 2+ members.
  const suggestions: AutoSuggestion[] = [];
  for (const { display, items: group } of byPrefix.values()) {
    if (group.length < 2) continue;

    // 3. Skip if the prefix matches an existing collection name.
    const alreadyExists = collections.some(
      (c) => c.name.trim().toLowerCase() === display.toLowerCase(),
    );
    if (alreadyExists) continue;

    // 4. Skip if all items already share at least one collection.
    if (allShareACollection(group, collections, memberType)) continue;

    const members: CollectionMember[] = group.map((it) => ({
      type: memberType,
      id: it.id,
    }));

    const key = buildSuggestionKey(display, members);
    if (dismissedKeys.has(key)) continue;

    suggestions.push({ key, prefix: display, members });
  }

  // 5. Return most-populated suggestions first — a 5-item group is
  //    more compelling than a 2-item one.
  suggestions.sort((a, b) => b.members.length - a.members.length);
  return suggestions;
}

/**
 * Trim a name to its "prefix" — everything up to the first `(` or
 * ` - ` separator. Returns the trimmed prefix; empty if the raw name
 * starts with a separator.
 */
function trimToPrefix(raw: string): string {
  const trimmed = raw.trim();
  const parenIdx = trimmed.indexOf("(");
  const dashIdx = trimmed.indexOf(" - ");
  let cutIdx = -1;
  if (parenIdx >= 0 && dashIdx >= 0) cutIdx = Math.min(parenIdx, dashIdx);
  else if (parenIdx >= 0) cutIdx = parenIdx;
  else if (dashIdx >= 0) cutIdx = dashIdx;
  const raw2 = cutIdx >= 0 ? trimmed.slice(0, cutIdx) : trimmed;
  return raw2.trim();
}

/**
 * True iff every item in the group is already a member of at least
 * one common collection — i.e. the user has already grouped them.
 */
function allShareACollection<TItem extends { id: string }>(
  group: readonly TItem[],
  collections: readonly Collection[],
  memberType: CollectionMemberType,
): boolean {
  const groupIds = new Set(group.map((it) => it.id));
  return collections.some((c) => {
    const cIds = c.members
      .filter((m) => m.type === memberType)
      .map((m) => m.id);
    // Every item in the group must be in this collection.
    for (const id of groupIds) {
      if (!cIds.includes(id)) return false;
    }
    return true;
  });
}

/**
 * Stable key for dismissal — prefix + sorted member ids. Adding or
 * removing an item from the shared prefix produces a different key
 * so dismissing "Learn the Fretboard × 3" doesn't hide the future
 * "Learn the Fretboard × 5" suggestion after the user adds more.
 */
function buildSuggestionKey(
  prefix: string,
  members: readonly CollectionMember[],
): string {
  const ids = [...members].map((m) => m.id).sort().join(",");
  return `${prefix.toLowerCase()}::${ids}`;
}

// ────────────────────── Dismissed suggestions store

type DismissedStore = {
  dismissed: string[];
  dismiss: (key: string) => void;
  isDismissed: (key: string) => boolean;
  /** Test-only. */
  _reset: () => void;
};

export const useDismissedSuggestions = create<DismissedStore>()(
  persist(
    (set, get) => ({
      dismissed: [],
      dismiss: (key) => {
        set((state) => {
          if (state.dismissed.includes(key)) return state;
          return { dismissed: [...state.dismissed, key] };
        });
      },
      isDismissed: (key) => get().dismissed.includes(key),
      _reset: () => set({ dismissed: [] }),
    }),
    {
      name: "practice-prodigy:collections-suggest-dismissed:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
