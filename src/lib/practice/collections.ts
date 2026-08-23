import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Collections — Slice I.1 (Phase 148).
 *
 * A Collection is a named, colored, optionally-emojified group that
 * can contain members from ANY of the drilling / repertoire libraries:
 *
 *   - Bass Arpeggios drills          (type: "drill")
 *   - Key Sequencer drills           (type: "key-drill")
 *   - Scale Driller drills           (type: "scale-drill")
 *   - Lead sheets                    (type: "leadsheet")
 *   - Songs                          (type: "song")
 *
 * Members are stored as `{ type, id }` refs — the actual drill / sheet
 * / song rows live in their own tables. Deleting a drill orphans the
 * ref (the collection just skips it when rendering). Adding a drill
 * doesn't require touching this table.
 *
 * ## Not a hierarchy
 *
 * Deliberate: no nested collections. Flat, many-to-many. A drill can
 * belong to zero, one, or several collections. This avoids the
 * "which folder does this go in?" decision fatigue that folder
 * hierarchies impose.
 *
 * ## Cloud sync
 *
 * Persisted locally via Zustand persist; synced to Supabase via the
 * standard SyncAdapter pattern. 10th cloud-synced entity. Migration
 * 0009 provisions the `collections` table.
 */

/**
 * Member-type discriminator. Matches the libraries the app has today.
 * When a new drilling module ships, add its type here + the store's
 * validation function accepts new refs of that shape automatically.
 */
export type CollectionMemberType =
  | "drill"
  | "key-drill"
  | "scale-drill"
  | "leadsheet"
  | "song";

export type CollectionMember = {
  type: CollectionMemberType;
  id: string;
};

/**
 * A short palette users pick from for the collection swatch. Matches
 * the built-in category color vocabulary so collections + categories
 * feel visually related. Users can also leave color unset (defaults
 * to a neutral zinc).
 */
export const COLLECTION_COLOR_SWATCHES: readonly string[] = [
  "#f59e0b", // amber
  "#fb923c", // orange
  "#f472b6", // pink
  "#a78bfa", // violet
  "#818cf8", // indigo
  "#38bdf8", // sky
  "#22d3ee", // cyan
  "#4ade80", // green
  "#84cc16", // lime
  "#71717a", // zinc — neutral default
] as const;

export type Collection = {
  /** Stable client-generated text id in the standard prefix format. */
  id: string;
  /** User-authored name (required). */
  name: string;
  /** Optional free-text description shown on the card + edit modal. */
  description?: string;
  /**
   * Optional emoji. Kept as a plain unicode string (Postgres stores
   * it fine; UI renders it directly).
   */
  emoji?: string;
  /** Optional swatch color (hex). Defaults to zinc when unset. */
  color?: string;
  /**
   * Members — the drilling / repertoire library refs that belong to
   * this collection. Order is preserved (drag-reorder ships in a
   * later phase); iteration order is insertion order.
   */
  members: CollectionMember[];
  /** ms epoch — first save. */
  createdAt: number;
  /** ms epoch — bumped on any mutation. LWW anchor for sync. */
  updatedAt: number;
};

export function newCollectionId(): string {
  return `coll_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export type SaveCollectionInput = {
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
  members?: CollectionMember[];
};

type CollectionsStore = {
  collections: Collection[];

  /** Create a fresh collection. Returns the new id. */
  saveCollection: (input: SaveCollectionInput) => string;

  /**
   * Partial-update a collection's metadata. Empty name silently snaps
   * back to the existing name (no accidental blanking).
   */
  updateCollection: (
    id: string,
    patch: Partial<
      Pick<Collection, "name" | "description" | "emoji" | "color">
    >,
  ) => void;

  /**
   * Add a member ref to a collection. No-op when the member is already
   * in the collection (dedupe by {type, id}). No-op when the
   * collection doesn't exist.
   */
  addMember: (collectionId: string, member: CollectionMember) => void;

  /** Remove a member ref. No-op when absent. */
  removeMember: (collectionId: string, member: CollectionMember) => void;

  /**
   * Set the exact members list wholesale. Used by drag-reorder + the
   * membership editor modal.
   */
  setMembers: (collectionId: string, members: CollectionMember[]) => void;

  /** Hard-delete a collection. Members are unaffected. */
  deleteCollection: (id: string) => void;

  /** Test-only. */
  _reset: () => void;
};

export const useCollections = create<CollectionsStore>()(
  persist(
    (set) => ({
      collections: [],

      saveCollection: ({
        name,
        description,
        emoji,
        color,
        members = [],
      }) => {
        const id = newCollectionId();
        const now = Date.now();
        const collection: Collection = {
          id,
          name: name.trim() || "Untitled collection",
          description: normalizeOptional(description),
          emoji: normalizeOptional(emoji),
          color: normalizeOptional(color),
          members: dedupeMembers(members),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ collections: [...s.collections, collection] }));
        return id;
      },

      updateCollection: (id, patch) =>
        set((state) => ({
          collections: state.collections.map((c) => {
            if (c.id !== id) return c;
            const next: Collection = { ...c, updatedAt: Date.now() };
            if (patch.name !== undefined) {
              const trimmed = patch.name.trim();
              if (trimmed) next.name = trimmed;
            }
            for (const key of ["description", "emoji", "color"] as const) {
              if (key in patch) {
                next[key] = normalizeOptional(patch[key] as string | undefined);
              }
            }
            return next;
          }),
        })),

      addMember: (collectionId, member) =>
        set((state) => ({
          collections: state.collections.map((c) => {
            if (c.id !== collectionId) return c;
            if (isMemberIn(c.members, member)) return c;
            return {
              ...c,
              members: [...c.members, member],
              updatedAt: Date.now(),
            };
          }),
        })),

      removeMember: (collectionId, member) =>
        set((state) => ({
          collections: state.collections.map((c) => {
            if (c.id !== collectionId) return c;
            if (!isMemberIn(c.members, member)) return c;
            return {
              ...c,
              members: c.members.filter(
                (m) => !(m.type === member.type && m.id === member.id),
              ),
              updatedAt: Date.now(),
            };
          }),
        })),

      setMembers: (collectionId, members) =>
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId
              ? { ...c, members: dedupeMembers(members), updatedAt: Date.now() }
              : c,
          ),
        })),

      deleteCollection: (id) =>
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== id),
        })),

      _reset: () => set({ collections: [] }),
    }),
    {
      name: "practice-prodigy:collections:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/** Trim + convert empty string to undefined so persisted rows stay lean. */
function normalizeOptional(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function isMemberIn(
  members: readonly CollectionMember[],
  m: CollectionMember,
): boolean {
  return members.some((x) => x.type === m.type && x.id === m.id);
}

function dedupeMembers(
  members: readonly CollectionMember[],
): CollectionMember[] {
  const seen = new Set<string>();
  const out: CollectionMember[] = [];
  for (const m of members) {
    const key = `${m.type}:${m.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

/**
 * Read helper — resolve a collection by id. Null when unknown.
 */
export function getCollectionById(id: string): Collection | null {
  return useCollections.getState().collections.find((c) => c.id === id) ?? null;
}

/**
 * Read helper — return every collection that contains the given
 * library item, in insertion order. Used by drill / sheet / song
 * cards to show "in these collections" chips.
 */
export function collectionsContaining(
  member: CollectionMember,
): Collection[] {
  return useCollections
    .getState()
    .collections.filter((c) => isMemberIn(c.members, member));
}

// ────────────────────── Collection → routine conversion (Slice I.6)

import { newRoutineItemId, type RoutineItem } from "./routine-types";
import { useDrillsLibrary } from "@/lib/state/drills-library";
import { useKeyDrillsLibrary } from "@/lib/key-sequencer/library-store";
import { useScaleDrillsLibrary } from "@/lib/scale-driller/library-store";
import { useSheetsLibrary } from "@/lib/state/sheets-library";
import { useSongsLibrary } from "./songs-library";
import { SHIPPED_DRILLS } from "@/lib/data/shipped-drills";
import { MODULE_DEFAULT_CATEGORY } from "@/lib/tracking/category-defaults";
import type { CategoryId } from "./categories";

/**
 * Slice I.6 (Phase 153) — Convert a collection's members into fresh
 * `RoutineItem`s so the collection can be launched as a routine.
 *
 * Each member ref is resolved against the corresponding library
 * store. Members that reference deleted items (dangling refs) are
 * silently dropped so a stale collection still produces a runnable
 * routine.
 *
 * Every item gets:
 *   - Fresh routine-item id (never reuses the source id)
 *   - Label from the source item's name / title
 *   - Category from the source (falling back to the module default)
 *   - Default estimatedSeconds of 5 minutes (the routine builder can
 *     tweak these before the user launches)
 */
export function collectionToRoutineItems(
  collection: Collection,
): RoutineItem[] {
  const out: RoutineItem[] = [];
  for (const member of collection.members) {
    const item = resolveMember(member);
    if (item) out.push(item);
  }
  return out;
}

const DEFAULT_SECONDS = 300;

function resolveMember(member: CollectionMember): RoutineItem | null {
  const baseId = newRoutineItemId();
  switch (member.type) {
    case "drill": {
      const drill =
        useDrillsLibrary
          .getState()
          .drills.find((d) => d.id === member.id) ??
        SHIPPED_DRILLS.find((d) => d.id === member.id);
      if (!drill) return null;
      return {
        id: baseId,
        type: "drill",
        drillId: member.id,
        label: drill.name,
        category:
          (drill.category as CategoryId | undefined) ??
          MODULE_DEFAULT_CATEGORY.arpeggios,
        estimatedSeconds: DEFAULT_SECONDS,
      };
    }
    case "key-drill": {
      const drill = useKeyDrillsLibrary
        .getState()
        .drills.find((d) => d.id === member.id);
      if (!drill) return null;
      return {
        id: baseId,
        type: "key-drill",
        keyDrillId: member.id,
        label: drill.name,
        category:
          (drill.category as CategoryId | undefined) ??
          MODULE_DEFAULT_CATEGORY["key-sequencer"],
        estimatedSeconds: DEFAULT_SECONDS,
      };
    }
    case "scale-drill": {
      const drill = useScaleDrillsLibrary
        .getState()
        .drills.find((d) => d.id === member.id);
      if (!drill) return null;
      return {
        id: baseId,
        type: "scale-drill",
        scaleDrillId: member.id,
        label: drill.name,
        category:
          (drill.category as CategoryId | undefined) ??
          MODULE_DEFAULT_CATEGORY["scale-driller"],
        estimatedSeconds: DEFAULT_SECONDS,
      };
    }
    case "leadsheet": {
      const sheet = useSheetsLibrary
        .getState()
        .sheets.find((s) => s.id === member.id);
      if (!sheet) return null;
      return {
        id: baseId,
        type: "leadsheet",
        leadSheetId: member.id,
        label: sheet.title || "Untitled sheet",
        category:
          (sheet.category as CategoryId | undefined) ??
          MODULE_DEFAULT_CATEGORY["lsb-playback"],
        estimatedSeconds: DEFAULT_SECONDS,
      };
    }
    case "song": {
      const song = useSongsLibrary
        .getState()
        .songs.find((s) => s.id === member.id);
      if (!song) return null;
      return {
        id: baseId,
        type: "song",
        songId: member.id,
        label: song.title,
        // Songs don't carry their own category; fall back to the
        // my-practice module default (Repertoire).
        category: MODULE_DEFAULT_CATEGORY["my-practice"],
        estimatedSeconds: DEFAULT_SECONDS * 2, // Songs default to ~10min.
      };
    }
  }
}
