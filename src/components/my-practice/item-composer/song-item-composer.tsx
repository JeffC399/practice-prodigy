"use client";

import { useMemo } from "react";
import { LibraryItemFields } from "./library-item-fields";
import { useSongsLibrary } from "@/lib/practice/songs-library";
import { MODULE_DEFAULT_CATEGORY } from "@/lib/tracking/category-defaults";
import {
  newRoutineItemId,
  type RoutineItem,
} from "@/lib/practice/routine-types";

/**
 * SongItemComposer — Slice C.4 (Phase 131).
 *
 * Thin wrapper around LibraryItemFields for song routine items. Songs
 * count as "my-practice" module practice per the session-tracker
 * category-defaults, so the default category leans on that entry
 * (Repertoire). Users can override per-item as usual.
 *
 * Ready-list gating in ItemPickerModal was updated in parallel; this
 * component just handles the composer form. On save, the resulting
 * item carries `type: "song"` + `songId` — Slice C.4 also wires the
 * take-over routing so launching a song item opens its linked lead
 * sheet (or renders inline when unlinked).
 */
export function SongItemComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (item: RoutineItem) => void;
  onCancel: () => void;
}) {
  const songs = useSongsLibrary((s) => s.songs);

  const library = useMemo(
    () =>
      songs.map((song) => ({
        id: song.id,
        // Include the artist inline in the dropdown label so users can
        // disambiguate "Autumn Leaves — Bill Evans" vs the standard.
        name:
          song.artist && song.artist.length > 0
            ? `${song.title} — ${song.artist}`
            : song.title,
        // Songs don't carry their own category, so fall through to the
        // module default. Users can override in the composer.
        category: undefined,
      })),
    [songs],
  );

  return (
    <LibraryItemFields
      library={library}
      emptyMessage="No songs yet. Add one on the Songs tab, then come back."
      moduleDefaultCategory={MODULE_DEFAULT_CATEGORY["my-practice"]}
      defaultEstimatedMinutes={10}
      onCancel={onCancel}
      onSubmit={({ pickedId, label, category, methodologyId, estimatedSeconds }) => {
        const item: RoutineItem = {
          id: newRoutineItemId(),
          type: "song",
          songId: pickedId,
          label,
          category,
          methodologyId,
          estimatedSeconds,
        };
        onSubmit(item);
      }}
    />
  );
}
