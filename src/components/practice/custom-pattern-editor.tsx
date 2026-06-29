"use client";

import { Play, Plus, Square, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { previewPlayer } from "@/lib/audio/preview";
import type { Chord } from "@/lib/music/chord";
import { semitoneToMidi } from "@/lib/music/intervals";
import {
  CUSTOM_PATTERN_MAX_NOTES,
  notesToDegreeString,
  SEMITONE_ALT_LABELS,
  SEMITONE_LABELS,
  SEMITONE_MAX,
  type CustomPattern,
  type PatternNote,
} from "@/lib/music/custom-patterns";
import { useCustomPatternsLibrary } from "@/lib/state/custom-patterns-library";

const PREVIEW_BPM = 100;
const PREVIEW_ANCHOR_OCTAVE = 2;

/**
 * Custom pattern editor — modal for authoring user-defined arpeggio
 * patterns. Phase 13.
 *
 * UX shape: a name field, a row of chips showing the current note
 * sequence (each removable), and a 13-button picker grid (1 through 8
 * with the chromatic alterations) for appending notes. The editor
 * auditions the pattern over a sample C major chord so the user can
 * hear what they're building before saving.
 *
 * Notes are absolute semitone offsets from the chord root (per the
 * "Chord tones + scale tones" model the user chose in Phase 13 setup).
 * The engine plays exactly those offsets — no scale or chord-quality
 * remapping — so the pattern sounds the same shape over any chord.
 */

type EditorProps = {
  /** When provided, the editor opens in edit mode for that pattern. */
  editingId: string | null;
  onClose: () => void;
  /**
   * Called after a successful save. Receives the saved pattern's id —
   * the setup page uses this to auto-toggle the new pattern into the
   * pool so the user doesn't have to find it in the list themselves.
   */
  onSaved?: (patternId: string) => void;
};

/** Sample chord used for the in-editor preview. C major is universally */
/* recognizable + chord-quality-agnostic intervals sound clean over it. */
const PREVIEW_CHORD: Chord = { root: "C", quality: "maj" };

export function CustomPatternEditor({
  editingId,
  onClose,
  onSaved,
}: EditorProps) {
  const lib = useCustomPatternsLibrary();
  const existing = useMemo(
    () => (editingId ? lib.getById(editingId) : undefined),
    [editingId, lib],
  );

  // Local draft state — the user's edits don't touch the persisted
  // library until they click Save. Cancel discards.
  const [name, setName] = useState<string>(existing?.name ?? "");
  const [notes, setNotes] = useState<PatternNote[]>(
    existing?.notes ? [...existing.notes] : [],
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewIdRef = useRef(0);

  // No effect-based re-seed needed: the editor only mounts when
  // `editorState.open` is true, and the parent always closes the modal
  // before opening it for a different pattern (clicking the Pencil on
  // pattern B while editing A isn't reachable — the backdrop blocks
  // clicks). Initial state from useState above is enough.

  // Esc closes the modal — standard dialog behavior.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        previewPlayer.cancel();
        setIsPreviewing(false);
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Stop any preview audio when the modal unmounts.
  useEffect(() => {
    return () => {
      previewPlayer.cancel();
    };
  }, []);

  const isAtCapacity = notes.length >= CUSTOM_PATTERN_MAX_NOTES;
  const canSave = name.trim().length > 0 && notes.length > 0;

  function appendNote(semitones: number) {
    if (isAtCapacity) return;
    setNotes((prev) => [...prev, { semitones }]);
  }

  function removeNoteAt(idx: number) {
    setNotes((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearNotes() {
    setNotes([]);
  }

  function handleSave() {
    if (!canSave) return;
    if (existing) {
      lib.updatePattern(existing.id, {
        name: name.trim(),
        notes,
      });
      onSaved?.(existing.id);
    } else {
      const id = lib.createPattern({ name: name.trim(), notes });
      onSaved?.(id);
    }
    onClose();
  }

  function handleDelete(pattern: CustomPattern) {
    if (!confirm(`Delete custom pattern "${pattern.name}"?`)) return;
    lib.deletePattern(pattern.id);
    onClose();
  }

  async function handlePreview() {
    if (isPreviewing) {
      previewPlayer.cancel();
      setIsPreviewing(false);
      return;
    }
    if (notes.length === 0) return;
    const myId = ++previewIdRef.current;
    setIsPreviewing(true);
    // Mirror the engine's custom-pattern path inline so the editor
    // doesn't need to roundtrip through the persisted store for an
    // ephemeral preview. Built-ins would also work via generateArpeggio,
    // but we're previewing only the user's current draft.
    const midiNotes = notes.map((n) =>
      semitoneToMidi(PREVIEW_CHORD.root, PREVIEW_ANCHOR_OCTAVE, n.semitones),
    );
    await previewPlayer.playArpeggio(midiNotes, PREVIEW_BPM);
    const totalMs = (midiNotes.length * (60 / PREVIEW_BPM) + 0.4) * 1000;
    setTimeout(() => {
      if (previewIdRef.current === myId) setIsPreviewing(false);
    }, totalMs);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={existing ? "Edit custom pattern" : "New custom pattern"}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">
            {existing ? "Edit custom pattern" : "New custom pattern"}
          </h2>
          <button
            type="button"
            onClick={() => {
              previewPlayer.cancel();
              onClose();
            }}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary"
            aria-label="Close editor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-5">
          {/* Name field */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="custom-pattern-name"
              className="text-sm font-medium"
            >
              Pattern name
            </label>
            <input
              id="custom-pattern-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bebop b5"
              maxLength={48}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus={!existing}
            />
            <p className="text-[11px] text-muted-foreground">
              A short name so you can pick this out of the pattern list.
            </p>
          </div>

          {/* Note sequence chips */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Note sequence{" "}
                <span className="font-normal text-muted-foreground">
                  ({notes.length} / {CUSTOM_PATTERN_MAX_NOTES})
                </span>
              </span>
              {notes.length > 0 && (
                <button
                  type="button"
                  onClick={clearNotes}
                  className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            <div
              className={`min-h-[3.25rem] rounded-md border border-dashed border-border bg-background/30 p-3 ${
                notes.length === 0 ? "flex items-center justify-center" : ""
              }`}
            >
              {notes.length === 0 ? (
                <span className="text-xs italic text-muted-foreground">
                  Tap an interval below to add a note. They&rsquo;ll play in
                  order.
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {notes.map((n, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/40 pl-2.5 pr-1 py-0.5 text-sm font-medium text-primary"
                    >
                      <span className="font-mono">
                        {SEMITONE_LABELS[n.semitones]}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeNoteAt(idx)}
                        className="rounded-full p-0.5 hover:bg-primary/30 transition-colors"
                        aria-label={`Remove note ${idx + 1}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Each note is a semitone offset from the chord root. The
              engine plays exactly these offsets over whichever chord is
              up — so {notesToDegreeString([{ semitones: 0 }, { semitones: 3 }, { semitones: 7 }, { semitones: 10 }])}{" "}
              becomes C–E♭–G–B♭ over Cm7, or D–F–A–C over Dm7.
            </p>
          </div>

          {/* Interval picker grid */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Add interval</span>
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-13">
              {Array.from({ length: SEMITONE_MAX + 1 }, (_, semi) => {
                const label = SEMITONE_LABELS[semi];
                const alt = SEMITONE_ALT_LABELS[semi];
                return (
                  <button
                    key={semi}
                    type="button"
                    onClick={() => appendNote(semi)}
                    disabled={isAtCapacity}
                    className="group flex flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-background px-1 py-2 font-mono text-sm font-medium text-foreground hover:border-primary hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    aria-label={`Add ${label}${alt ? ` (${alt})` : ""}`}
                  >
                    <span>{label}</span>
                    <span className="text-[9px] text-muted-foreground group-hover:text-primary/70 min-h-[0.75em]">
                      {alt ?? ""}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Up to {CUSTOM_PATTERN_MAX_NOTES} notes per pattern. Range
              covers one octave from the root through the octave-up.
            </p>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 rounded-md border border-border bg-background/30 p-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={notes.length === 0}
              className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isPreviewing ? (
                <>
                  <Square className="h-4 w-4" aria-hidden="true" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Preview
                </>
              )}
            </button>
            <span className="text-xs text-muted-foreground">
              Auditions over a sample C major chord.
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          {existing ? (
            <button
              type="button"
              onClick={() => handleDelete(existing)}
              className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                previewPlayer.cancel();
                onClose();
              }}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              <Plus className="h-4 w-4" />
              {existing ? "Save changes" : "Create pattern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

