"use client";

import { ArrowLeft, Eye, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CHORD_QUALITIES,
  PITCH_CLASSES,
  PITCH_CLASS_DISPLAY_NAMES,
  QUALITY_DISPLAY_NAMES,
  type Chord,
  type ChordQuality,
  type PitchClass,
} from "@/lib/music/chord";
import { renderChord } from "@/lib/music/render-chord";
import {
  newMeasureId,
  SHEET_KEY_MODES,
  type SheetKeyMode,
} from "@/lib/sheets/types";
import { useSheetsLibrary } from "@/lib/state/sheets-library";
import { useUserPrefs } from "@/lib/state/user-prefs";
import { TIME_SIGNATURES } from "@/lib/state/practice-config";

/**
 * /sheets/[id]/edit — chord-chart editor (Phase 24a MVP).
 *
 * Edits all meta fields + the measure-by-measure chord grid. Each
 * measure shows a "+ chord" affordance until it has a chord, then
 * a chord chip with click-to-edit (root + quality picker pops up).
 * Add measure / delete measure / drag-reorder are first-class.
 *
 * Save semantics: every field edit writes through the store
 * (debounced not needed at this scale — Zustand sets are cheap +
 * the persisted localStorage write is synchronous but small). No
 * "save" button.
 */
export default function SheetEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const sheet = useSheetsLibrary((s) => s.sheets.find((x) => x.id === id));
  const updateSheet = useSheetsLibrary((s) => s.updateSheet);
  const markSheetOpened = useSheetsLibrary((s) => s.markSheetOpened);
  const notationStyle = useUserPrefs((s) => s.notationDefault);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  useEffect(() => {
    if (id && mounted) markSheetOpened(id);
  }, [id, mounted, markSheetOpened]);

  // Local editing state for the chord picker pop-up.
  const [editingChord, setEditingChord] = useState<{
    measureIdx: number;
    chordIdx: number;
  } | null>(null);

  if (!mounted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Loading sheet…
        </div>
      </main>
    );
  }

  if (!sheet) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">Sheet not found.</p>
          <Link
            href="/sheets"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to library
          </Link>
        </div>
      </main>
    );
  }

  const updateMeta = <K extends keyof typeof sheet>(
    key: K,
    value: (typeof sheet)[K],
  ) => {
    updateSheet(id, { [key]: value } as Partial<typeof sheet>);
  };

  const addMeasure = () => {
    updateSheet(id, {
      measures: [...sheet.measures, { id: newMeasureId(), chords: [] }],
    });
  };

  const deleteMeasure = (measureIdx: number) => {
    if (sheet.measures.length <= 1) return;
    updateSheet(id, {
      measures: sheet.measures.filter((_, i) => i !== measureIdx),
    });
  };

  const addChordToMeasure = (measureIdx: number, chord: Chord) => {
    const next = sheet.measures.map((m, i) => {
      if (i !== measureIdx) return m;
      // Cap at 2 chords per measure for v0.1 (matches the renderer's
      // split-the-bar-in-half assumption).
      if (m.chords.length >= 2) return m;
      return { ...m, chords: [...m.chords, chord] };
    });
    updateSheet(id, { measures: next });
  };

  const updateChordInMeasure = (
    measureIdx: number,
    chordIdx: number,
    chord: Chord,
  ) => {
    const next = sheet.measures.map((m, i) => {
      if (i !== measureIdx) return m;
      return {
        ...m,
        chords: m.chords.map((c, ci) => (ci === chordIdx ? chord : c)),
      };
    });
    updateSheet(id, { measures: next });
  };

  const removeChordFromMeasure = (measureIdx: number, chordIdx: number) => {
    const next = sheet.measures.map((m, i) => {
      if (i !== measureIdx) return m;
      return { ...m, chords: m.chords.filter((_, ci) => ci !== chordIdx) };
    });
    updateSheet(id, { measures: next });
  };

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        {/* Header: back link + view-mode link */}
        <div className="flex items-center justify-between">
          <Link
            href="/sheets"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All sheets
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/sheets/${id}`}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:border-primary/40 transition-colors"
            >
              <Eye className="h-4 w-4" />
              View / print
            </Link>
          </div>
        </div>

        {/* Title + meta */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-5">
          <input
            type="text"
            value={sheet.title}
            onChange={(e) => updateMeta("title", e.target.value)}
            className="bg-transparent text-2xl font-semibold tracking-tight focus:outline-none"
            placeholder="Untitled lead sheet"
            aria-label="Sheet title"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              Composer
              <input
                type="text"
                value={sheet.composer ?? ""}
                onChange={(e) =>
                  updateMeta("composer", e.target.value || undefined)
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="e.g. Charlie Parker"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Style
              <input
                type="text"
                value={sheet.style ?? ""}
                onChange={(e) =>
                  updateMeta("style", e.target.value || undefined)
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="e.g. Medium Swing"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Tempo (BPM, optional)
              <input
                type="number"
                value={sheet.bpm ?? ""}
                onChange={(e) =>
                  updateMeta(
                    "bpm",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm w-24"
                placeholder="—"
                min={30}
                max={300}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Key
              <div className="flex items-center gap-1.5">
                <select
                  value={sheet.keyTonic}
                  onChange={(e) =>
                    updateMeta("keyTonic", e.target.value as PitchClass)
                  }
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {PITCH_CLASSES.map((p) => (
                    <option key={p} value={p}>
                      {PITCH_CLASS_DISPLAY_NAMES[p]}
                    </option>
                  ))}
                </select>
                <select
                  value={sheet.keyMode}
                  onChange={(e) =>
                    updateMeta("keyMode", e.target.value as SheetKeyMode)
                  }
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {SHEET_KEY_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              Time signature
              <select
                value={`${sheet.timeSignature.beatsPerMeasure}/${sheet.timeSignature.beatUnit}`}
                onChange={(e) => {
                  const [b, u] = e.target.value.split("/").map(Number);
                  updateMeta("timeSignature", {
                    beatsPerMeasure: b,
                    beatUnit: u,
                  });
                }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm w-32"
              >
                {TIME_SIGNATURES.map((ts) => (
                  <option
                    key={`${ts.beatsPerMeasure}/${ts.beatUnit}`}
                    value={`${ts.beatsPerMeasure}/${ts.beatUnit}`}
                  >
                    {ts.beatsPerMeasure}/{ts.beatUnit}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Measures */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Measures ({sheet.measures.length})
            </h2>
            <button
              type="button"
              onClick={addMeasure}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add measure
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {sheet.measures.map((measure, mIdx) => (
              <div
                key={measure.id}
                className="group relative flex min-h-[5rem] flex-col gap-1 rounded-md border border-border bg-card/40 p-2 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {mIdx + 1}
                  </span>
                  {sheet.measures.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteMeasure(mIdx)}
                      className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      aria-label={`Delete measure ${mIdx + 1}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-1">
                  {measure.chords.length === 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        addChordToMeasure(mIdx, {
                          root: sheet.keyTonic,
                          quality: sheet.keyMode === "major" ? "maj7" : "min7",
                        })
                      }
                      className="flex flex-1 items-center justify-center rounded border border-dashed border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      aria-label="Add chord"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  ) : (
                    measure.chords.map((chord, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() =>
                          setEditingChord({
                            measureIdx: mIdx,
                            chordIdx: cIdx,
                          })
                        }
                        className="flex items-center gap-0.5 rounded bg-primary/15 px-1.5 py-1 font-mono text-sm font-medium text-primary hover:bg-primary/25 transition-colors"
                      >
                        {renderChord(chord, notationStyle)}
                      </button>
                    ))
                  )}
                  {measure.chords.length === 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        addChordToMeasure(mIdx, {
                          root: sheet.keyTonic,
                          quality: "maj7",
                        })
                      }
                      className="rounded border border-dashed border-border/40 px-1.5 py-1 text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      aria-label="Add second chord to measure"
                      title="Add a second chord (split bar)"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Chord picker pop-up */}
        {editingChord && (
          <ChordPickerModal
            initial={
              sheet.measures[editingChord.measureIdx].chords[
                editingChord.chordIdx
              ]
            }
            onClose={() => setEditingChord(null)}
            onSave={(chord) => {
              updateChordInMeasure(
                editingChord.measureIdx,
                editingChord.chordIdx,
                chord,
              );
              setEditingChord(null);
            }}
            onDelete={() => {
              removeChordFromMeasure(
                editingChord.measureIdx,
                editingChord.chordIdx,
              );
              setEditingChord(null);
            }}
          />
        )}

        <button
          type="button"
          onClick={() => router.push("/sheets")}
          className="self-start text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to library
        </button>
      </div>
    </main>
  );
}

function ChordPickerModal({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Chord;
  onClose: () => void;
  onSave: (chord: Chord) => void;
  onDelete: () => void;
}) {
  const [root, setRoot] = useState<PitchClass>(initial.root);
  const [quality, setQuality] = useState<ChordQuality>(initial.quality);
  const notationStyle = useUserPrefs((s) => s.notationDefault);
  const preview = useMemo(
    () => renderChord({ root, quality }, notationStyle),
    [root, quality, notationStyle],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit chord</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex justify-center rounded-md border border-border bg-background/30 py-3 font-mono text-4xl font-semibold text-primary">
            {preview}
          </div>
          <label className="flex flex-col gap-1 text-xs">
            Root
            <select
              value={root}
              onChange={(e) => setRoot(e.target.value as PitchClass)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {PITCH_CLASSES.map((p) => (
                <option key={p} value={p}>
                  {PITCH_CLASS_DISPLAY_NAMES[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Quality
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as ChordQuality)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {CHORD_QUALITIES.map((q) => (
                <option key={q} value={q}>
                  {QUALITY_DISPLAY_NAMES[q]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave({ root, quality })}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
