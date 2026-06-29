"use client";

import { Pause, Play, Plus, Square, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { previewPlayer } from "@/lib/audio/preview";
import type { Chord } from "@/lib/music/chord";
import { semitoneToMidi } from "@/lib/music/intervals";
import {
  CUSTOM_PATTERN_MAX_NOTES,
  DEFAULT_NOTE_DURATION,
  NOTE_DURATION_BEATS,
  NOTE_DURATION_LABELS,
  NOTE_DURATIONS,
  REST_LABEL,
  SEMITONE_ALT_LABELS,
  SEMITONE_LABELS,
  SEMITONE_MAX,
  totalBeatLength,
  type CustomPattern,
  type NoteDuration,
  type PatternNote,
} from "@/lib/music/custom-patterns";
import { useCustomPatternsLibrary } from "@/lib/state/custom-patterns-library";

/**
 * Custom pattern editor — modal for authoring user-defined arpeggio
 * patterns. Phase 13 introduced absolute-semitone notes; Phase 14 adds
 * per-note durations + rests.
 *
 * UX shape:
 *  - Name field
 *  - Chip list of the current sequence (each chip shows note label +
 *    duration; clicking the chip's duration cycles through values)
 *  - Picker row: 13 chord-tone buttons + a Rest button + a "next-note
 *    duration" selector that controls what duration newly-tapped notes
 *    are stamped with
 *  - In-editor preview that auditions the draft over a C major chord,
 *    respecting the chosen rhythm
 *
 * v1 constraint: patterns are exactly 1 measure long. Multi-measure
 * patterns (length = 2 / 4) are a documented follow-up in IDEAS.md.
 */

const PREVIEW_BPM = 100;
const PREVIEW_ANCHOR_OCTAVE = 2;
const FIXED_LENGTH_IN_MEASURES = 1;

type EditorProps = {
  editingId: string | null;
  onClose: () => void;
  onSaved?: (patternId: string) => void;
};

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

  const [name, setName] = useState<string>(existing?.name ?? "");
  const [notes, setNotes] = useState<PatternNote[]>(
    existing?.notes ? [...existing.notes] : [],
  );
  const [nextDuration, setNextDuration] = useState<NoteDuration>(
    DEFAULT_NOTE_DURATION,
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewIdRef = useRef(0);

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

  useEffect(() => {
    return () => {
      previewPlayer.cancel();
    };
  }, []);

  const isAtCapacity = notes.length >= CUSTOM_PATTERN_MAX_NOTES;
  const canSave = name.trim().length > 0 && notes.length > 0;
  const totalBeats = totalBeatLength(notes);

  function appendNote(semitones: number) {
    if (isAtCapacity) return;
    setNotes((prev) => [
      ...prev,
      { kind: "note", semitones, duration: nextDuration },
    ]);
  }

  function appendRest() {
    if (isAtCapacity) return;
    setNotes((prev) => [...prev, { kind: "rest", duration: nextDuration }]);
  }

  function removeNoteAt(idx: number) {
    setNotes((prev) => prev.filter((_, i) => i !== idx));
  }

  function cycleNoteDuration(idx: number) {
    setNotes((prev) =>
      prev.map((n, i) => {
        if (i !== idx) return n;
        const currentIdx = NOTE_DURATIONS.indexOf(n.duration);
        const next = NOTE_DURATIONS[(currentIdx + 1) % NOTE_DURATIONS.length];
        return { ...n, duration: next };
      }),
    );
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
        lengthInMeasures: FIXED_LENGTH_IN_MEASURES,
      });
      onSaved?.(existing.id);
    } else {
      const id = lib.createPattern({
        name: name.trim(),
        notes,
        lengthInMeasures: FIXED_LENGTH_IN_MEASURES,
      });
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
    // Preview mirrors the engine's note + rest handling. Rests aren't
    // played; pitched notes are scheduled at PREVIEW_BPM with their
    // own durations (so the preview sounds like what'll play in the
    // drill, not just a flat "one note per beat" stream).
    await playRhythmPreview(notes, myId, () => {
      if (previewIdRef.current === myId) setIsPreviewing(false);
    });
  }

  // Visual measure-fit indicator. 1-measure patterns should sum to 4
  // beats (in 4/4); anything more spills past the bar, anything less
  // leaves trailing silence. Color the readout accordingly.
  const beatBudget = 4;
  const beatStatus =
    Math.abs(totalBeats - beatBudget) < 1e-6
      ? "perfect"
      : totalBeats > beatBudget
        ? "over"
        : "under";

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
                  Tap an interval (or Rest) below to add a note. They&rsquo;ll
                  play in order. Click the duration on any chip to change it.
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {notes.map((n, idx) => {
                    const isRest = n.kind === "rest";
                    const label = isRest
                      ? REST_LABEL
                      : SEMITONE_LABELS[n.semitones];
                    return (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-sm font-medium ${
                          isRest
                            ? "bg-muted/30 border-border text-muted-foreground"
                            : "bg-primary/15 border-primary/40 text-primary"
                        }`}
                      >
                        <span className="font-mono">{label}</span>
                        <button
                          type="button"
                          onClick={() => cycleNoteDuration(idx)}
                          className="rounded-full bg-background/40 border border-border px-1.5 py-0 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                          aria-label={`Change duration (currently ${n.duration})`}
                          title="Click to cycle duration"
                        >
                          {NOTE_DURATION_LABELS[n.duration]}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeNoteAt(idx)}
                          className="rounded-full p-0.5 hover:bg-primary/30 transition-colors"
                          aria-label={`Remove note ${idx + 1}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                Total length:{" "}
                <span
                  className={`font-mono font-medium ${
                    beatStatus === "perfect"
                      ? "text-primary"
                      : beatStatus === "over"
                        ? "text-destructive"
                        : "text-foreground"
                  }`}
                >
                  {totalBeats.toFixed(2)} beats
                </span>{" "}
                {beatStatus === "perfect" && <span>· fits 1 measure of 4/4</span>}
                {beatStatus === "under" && (
                  <span>· trailing silence to bar end</span>
                )}
                {beatStatus === "over" && (
                  <span>· will clip at bar end</span>
                )}
              </span>
              <span className="text-muted-foreground">
                Default new-note duration:{" "}
                <select
                  value={nextDuration}
                  onChange={(e) =>
                    setNextDuration(e.target.value as NoteDuration)
                  }
                  className="rounded border border-border bg-background px-1 py-0 text-[11px] font-mono ml-1"
                  aria-label="Default duration for newly-added notes"
                >
                  {NOTE_DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {NOTE_DURATION_LABELS[d]}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </div>

          {/* Interval picker grid */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Add interval</span>
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-14">
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
              {/* Rest button. Visually distinct (muted, dashed) so it
                  reads as "silence" not "another pitched note." */}
              <button
                type="button"
                onClick={appendRest}
                disabled={isAtCapacity}
                className="group flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border bg-muted/20 px-1 py-2 font-mono text-sm font-medium text-muted-foreground hover:border-primary/60 hover:text-foreground hover:bg-muted/40 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                aria-label="Add a rest"
              >
                <Pause className="h-3.5 w-3.5" />
                <span className="text-[9px] min-h-[0.75em]">rest</span>
              </button>
            </div>
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
              Auditions over a sample C major chord at{" "}
              <span className="font-mono">{PREVIEW_BPM}</span> BPM with the
              rhythm you&rsquo;ve set.
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

/**
 * Play a rhythm-aware preview of the in-progress draft. Builds a list
 * of events with explicit startBeat + durationBeats and hands them to
 * previewPlayer.playRhythm — which schedules each event at the right
 * transport position and sustains it for its full duration. Rests
 * advance the clock without scheduling audio.
 */
async function playRhythmPreview(
  notes: PatternNote[],
  myId: number,
  onComplete: () => void,
) {
  if (notes.length === 0) {
    onComplete();
    return;
  }
  const events: Array<{
    midi: number | null;
    startBeat: number;
    durationBeats: number;
  }> = [];
  let cursor = 0;
  for (const n of notes) {
    const dur = NOTE_DURATION_BEATS[n.duration];
    if (n.kind === "rest") {
      events.push({ midi: null, startBeat: cursor, durationBeats: dur });
    } else {
      events.push({
        midi: semitoneToMidi(
          PREVIEW_CHORD.root,
          PREVIEW_ANCHOR_OCTAVE,
          n.semitones,
        ),
        startBeat: cursor,
        durationBeats: dur,
      });
    }
    cursor += dur;
  }
  await previewPlayer.playRhythm(events, PREVIEW_BPM);
  const totalBeats = cursor;
  const totalMs = (totalBeats * (60 / PREVIEW_BPM) + 0.4) * 1000;
  setTimeout(onComplete, totalMs);
  void myId;
}
