"use client";

import { Music, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SongCard } from "./song-card";
import { SongFormModal } from "./song-form-modal";
import {
  SONG_STATUS_LABELS,
  SONG_STATUS_ORDER,
  songsInDefaultOrder,
  useSongsLibrary,
  type Song,
  type SongStatus,
} from "@/lib/practice/songs-library";

/**
 * SongsTab — Slice C.2 (Phase 129).
 *
 * The Songs pane inside /my-practice. Renders a filterable + sortable
 * grid of SongCards.
 *
 * ## Filters
 *
 *   - Status: All / Learning / Polishing / Performance-ready / Retired.
 *     Default is "Active" — everything except Retired — since retired
 *     songs are set-aside by definition. Users can flip to "All" to
 *     see the full library including retired.
 *   - Search: case-insensitive substring match across title + artist.
 *
 * ## Sort
 *
 *   - Recently practiced (default) — most-recent lastPracticedAt first,
 *     then updated-at, retired always last.
 *   - Alphabetical — by title.
 *   - Most practiced — by totalPracticeSeconds desc.
 *
 * ## Add song
 *
 * The "+ Add song" button creates a blank song titled "New song" and
 * scrolls to it — same fast-capture pattern RoutineCard uses. Users
 * rename inline. Phase C.3 wires an "Edit" affordance that opens a
 * full-metadata form (artist / key / genre / notes / target date).
 */

type StatusFilter = "active" | "all" | SongStatus;
type SortMode = "recent" | "alpha" | "most-practiced";

export function SongsTab() {
  const songs = useSongsLibrary((s) => s.songs);
  const saveSong = useSongsLibrary((s) => s.saveSong);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterAndSort(songs, statusFilter, sortMode, search),
    [songs, statusFilter, sortMode, search],
  );

  const isEmpty = songs.length === 0;

  const handleAdd = () => {
    const id = saveSong({ title: "New song" });
    // Open the fuller form modal immediately so the user can flesh
    // out the metadata (artist / key / status / linked sheet) rather
    // than being left staring at a placeholder title.
    setEditingId(id);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (isEmpty) {
    return (
      <>
        <section className="flex flex-col gap-6">
          <TabHeader onAdd={handleAdd} />
          <EmptyState onAdd={handleAdd} />
        </section>
        {editingId && (
          <SongFormModal
            songId={editingId}
            onClose={() => setEditingId(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-4">
        <TabHeader onAdd={handleAdd} />

        <div className="flex flex-wrap items-center gap-3">
          <StatusFilterTabs value={statusFilter} onChange={setStatusFilter} />
          <SortMenu value={sortMode} onChange={setSortMode} />
          <SearchBox value={search} onChange={setSearch} />
        </div>

        {filtered.length === 0 ? (
          <FilteredEmptyState
            onClear={() => {
              setStatusFilter("active");
              setSearch("");
            }}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((song) => (
              <li key={song.id}>
                <SongCard song={song} onEdit={setEditingId} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {editingId && (
        <SongFormModal
          songId={editingId}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  );
}

function TabHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Songs</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The pieces you&rsquo;re learning, polishing, or maintaining. Add
          them to routines to log per-song practice time.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add song
      </button>
    </header>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-background/20 px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Music className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-sm text-foreground">No songs saved yet.</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Track the pieces you&rsquo;re actively working on. Link a song
          to a lead sheet, add it as a routine item, and per-song
          practice time rolls up in Reports.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add your first song
      </button>
    </div>
  );
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-background/20 px-6 py-8 text-center">
      <p className="text-sm text-foreground">No songs match these filters.</p>
      <button
        type="button"
        onClick={onClear}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        Clear filters
      </button>
    </div>
  );
}

function StatusFilterTabs({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  const options: { id: StatusFilter; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "all", label: "All" },
    ...SONG_STATUS_ORDER.map((s) => ({
      id: s,
      label: SONG_STATUS_LABELS[s],
    })),
  ];
  return (
    <div
      role="tablist"
      aria-label="Song status filter"
      className="flex flex-wrap gap-1 rounded-md border border-border/60 bg-background/40 p-1"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              active
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SortMenu({
  value,
  onChange,
}: {
  value: SortMode;
  onChange: (v: SortMode) => void;
}) {
  return (
    <label className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
      Sort
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortMode)}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
      >
        <option value="recent">Recently practiced</option>
        <option value="alpha">Alphabetical</option>
        <option value="most-practiced">Most practiced</option>
      </select>
    </label>
  );
}

function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-1 min-w-40 items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
      <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search title or artist"
        className="w-full bg-transparent text-xs focus:outline-none"
      />
    </label>
  );
}

function filterAndSort(
  songs: readonly Song[],
  statusFilter: StatusFilter,
  sortMode: SortMode,
  search: string,
): Song[] {
  const q = search.trim().toLowerCase();
  const filtered = songs.filter((s) => {
    if (statusFilter === "active" && s.status === "retired") return false;
    if (
      statusFilter !== "active" &&
      statusFilter !== "all" &&
      s.status !== statusFilter
    ) {
      return false;
    }
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      (s.artist?.toLowerCase().includes(q) ?? false)
    );
  });

  if (sortMode === "recent") return songsInDefaultOrder(filtered);
  if (sortMode === "alpha") {
    return [...filtered].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
  }
  // "most-practiced"
  return [...filtered].sort(
    (a, b) => b.totalPracticeSeconds - a.totalPracticeSeconds,
  );
}
