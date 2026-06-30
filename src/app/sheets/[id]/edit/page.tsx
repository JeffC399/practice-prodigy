"use client";

import {
  ArrowLeft,
  Eye,
  Music,
  MousePointerClick,
  Play,
  Plus,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  MELODY_DURATIONS,
  MELODY_DURATION_LABELS,
  newMeasureId,
  newTupletGroupId,
  SHEET_FONT_STYLES,
  SHEET_KEY_MODES,
  type MelodyDuration,
  type MelodyNote,
  type SheetKeyMode,
} from "@/lib/sheets/types";
import { MelodyStaff } from "@/components/sheets/melody-staff";
import {
  SheetSurface,
  type SheetSurfaceLayout,
} from "@/components/sheets/sheet-surface";
import { LyricOverlay } from "@/components/sheets/lyric-overlay";
import { MelodyEntryOverlay } from "@/components/sheets/melody-entry-overlay";
import {
  ChordEntryOverlay,
  type ChordCursor,
} from "@/components/sheets/chord-entry-overlay";
import {
  parseChordText,
  suggestChords,
} from "@/lib/sheets/chord-parser";
import {
  firstLyricPosition,
  formatLyricForInput,
  getLyricAt,
  nextLyricPosition,
  parseLyricInput,
  prevLyricPosition,
  setLyricAt,
  type LyricCursor,
} from "@/lib/sheets/lyric-cursor";
import {
  appendMelodyNote,
  buildPitchedNote,
  buildRestNote,
} from "@/lib/sheets/melody-entry";
import { sheetPlayback } from "@/lib/audio/sheet-playback";
import {
  advanceCaret,
  caretAtEndOfMeasure,
  durationToBeats,
  letterToPitch,
  nudgeLastNoteInMeasure,
  retreatCaret,
  type MelodyCaret,
} from "@/lib/sheets/melody-caret";
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
  const undoSheet = useSheetsLibrary((s) => s.undo);
  const redoSheet = useSheetsLibrary((s) => s.redo);
  const canUndo = useSheetsLibrary(
    (s) => (s.undoStacks[id]?.length ?? 0) > 0,
  );
  const canRedo = useSheetsLibrary(
    (s) => (s.redoStacks[id]?.length ?? 0) > 0,
  );
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
  // Per-measure melody editor pop-up.
  const [editingMelodyIdx, setEditingMelodyIdx] = useState<number | null>(
    null,
  );
  // Phase 24c / 25 — Editor mode state. Mutually exclusive interactive
  // modes that take over the live Preview. "none" = static preview;
  // "lyrics" = click-on-note typing flow; "click-entry" = click-on-staff
  // melody authoring (Phase 25.0 — Dorico-style sequential snap-entry).
  // The SheetSurface emits layout (per-note positions + per-measure
  // rects) whenever any interactive mode is on.
  const [editorMode, setEditorMode] = useState<
    "none" | "lyrics" | "click-entry" | "chord-entry"
  >("none");
  // Phase 25.2 — Chord entry mode state.
  const [chordCursor, setChordCursor] = useState<ChordCursor | null>(null);
  const [chordDraft, setChordDraft] = useState("");
  const [recentChords, setRecentChords] = useState<string[]>([]);
  // Phase 27 — Live audio playback state.
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => {
    // Stop any in-flight playback when leaving the editor.
    return () => {
      sheetPlayback.cancel();
    };
  }, []);
  const [lyricCursor, setLyricCursor] = useState<LyricCursor | null>(null);
  const [lyricDraft, setLyricDraft] = useState("");
  const [surfaceLayout, setSurfaceLayout] =
    useState<SheetSurfaceLayout | null>(null);
  const handleLayout = useCallback((layout: SheetSurfaceLayout) => {
    setSurfaceLayout(layout);
  }, []);
  // Phase 25.0 — Side-panel state for click-on-staff melody entry.
  const [entryDuration, setEntryDuration] = useState<MelodyDuration>("q");
  const [entryDotted, setEntryDotted] = useState(false);
  const [entryRest, setEntryRest] = useState(false);
  // Phase 25.1 — Caret state. Null when click-entry is off or no
  // measure has been selected yet. The visible caret line in the
  // overlay reads from this; keyboard handlers advance / retreat /
  // place notes at this position.
  const [caret, setCaret] = useState<MelodyCaret | null>(null);
  // Phase 24c — Lyric overlay click positions: pitched notes that are
  // NOT tied followers. Computed here (above the early returns) so the
  // useMemo hook order stays stable across renders.
  const eligibleLyricPositions = useMemo(() => {
    if (!sheet || !surfaceLayout) return [];
    return surfaceLayout.positions.filter((p) => {
      if (!p.isPitched) return false;
      const melody = sheet.measures[p.measureIdx]?.melody ?? [];
      const note = melody[p.noteIdx];
      if (!note || note.kind !== "note") return false;
      if (p.noteIdx === 0) return true;
      const prev = melody[p.noteIdx - 1];
      if (
        prev &&
        prev.kind === "note" &&
        prev.tieToNext === true &&
        prev.pitch === note.pitch
      ) {
        return false;
      }
      return true;
    });
  }, [surfaceLayout, sheet]);

  /**
   * Phase 26 — Global undo / redo keyboard shortcuts. Active whenever
   * the editor is mounted (independent of editorMode) so a misclick
   * during ANY authoring flow can be undone.
   *
   *   Cmd/Ctrl+Z          → undo
   *   Cmd/Ctrl+Shift+Z    → redo (Mac convention)
   *   Cmd/Ctrl+Y          → redo (Windows convention)
   *
   * Skipped when focus is in an INPUT / TEXTAREA / contenteditable so
   * users can still use native text-field undo/redo while editing the
   * title, composer, or chord-entry text input.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const isUndo = e.key === "z" && !e.shiftKey;
      const isRedo =
        (e.key === "z" && e.shiftKey) || e.key === "y";
      if (isRedo) {
        e.preventDefault();
        useSheetsLibrary.getState().redo(id);
      } else if (isUndo) {
        e.preventDefault();
        useSheetsLibrary.getState().undo(id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);

  /**
   * Phase 25.1 — Keyboard handler bound to window while click-entry
   * mode is active. Covers the Dorico-style shortcuts:
   *   - A–G: place note at caret pitch + advance
   *   - R:   place rest at caret + advance
   *   - ↑/↓: nudge LAST placed note pitch by one staff step
   *   - ←/→: retreat / advance caret by current rhythm value
   *   - 1/2/3/4/5: change rhythm value (whole/half/quarter/8th/16th)
   *   - .:   toggle dotted
   *   - Esc: exit click-entry mode
   *
   * Ignores keys when focus is in an input / textarea so the meta
   * field text inputs don't lose their typing. Reads sheet state via
   * the store's getState() inside the handler so the closure stays
   * current without forcing a re-bind on every keystroke.
   */
  useEffect(() => {
    if (editorMode !== "click-entry") return;
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const fresh = useSheetsLibrary
        .getState()
        .sheets.find((s) => s.id === id);
      if (!fresh) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setEditorMode("none");
        setCaret(null);
        return;
      }
      if (/^[a-gA-G]$/.test(e.key)) {
        e.preventDefault();
        if (!caret) return;
        const pitch = letterToPitch(e.key.toLowerCase(), caret.octave);
        const note = entryRest
          ? buildRestNote(entryDuration, entryDotted)
          : buildPitchedNote(pitch, entryDuration, entryDotted);
        const measures = appendMelodyNote(
          fresh,
          caret.measureIdx,
          note,
        );
        updateSheet(id, { measures });
        const beats = durationToBeats(entryDuration, entryDotted);
        const fresher = useSheetsLibrary
          .getState()
          .sheets.find((s) => s.id === id);
        if (fresher) setCaret(advanceCaret(caret, beats, fresher));
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        if (!caret) return;
        const restNote = buildRestNote(entryDuration, entryDotted);
        const measures = appendMelodyNote(
          fresh,
          caret.measureIdx,
          restNote,
        );
        updateSheet(id, { measures });
        const beats = durationToBeats(entryDuration, entryDotted);
        const fresher = useSheetsLibrary
          .getState()
          .sheets.find((s) => s.id === id);
        if (fresher) setCaret(advanceCaret(caret, beats, fresher));
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        if (!caret) return;
        const dir = e.key === "ArrowUp" ? 1 : -1;
        const measures = nudgeLastNoteInMeasure(
          fresh,
          caret.measureIdx,
          dir,
        );
        if (measures) updateSheet(id, { measures });
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if (!caret) return;
        const beats = durationToBeats(entryDuration, entryDotted);
        setCaret(
          e.key === "ArrowRight"
            ? advanceCaret(caret, beats, fresh)
            : retreatCaret(caret, beats, fresh),
        );
        return;
      }
      const rhythmMap: Record<string, MelodyDuration> = {
        "1": "w",
        "2": "h",
        "3": "q",
        "4": "8",
        "5": "16",
      };
      if (rhythmMap[e.key]) {
        e.preventDefault();
        setEntryDuration(rhythmMap[e.key]);
        return;
      }
      if (e.key === ".") {
        e.preventDefault();
        setEntryDotted((d) => !d);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    editorMode,
    caret,
    entryDuration,
    entryDotted,
    entryRest,
    sheet,
    id,
    updateSheet,
  ]);

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

  /**
   * Phase 25.2 — chord helpers updated for the ChordBeat model.
   * Existing chord-chip UI keeps working: first chord lands on beat 1,
   * second on the half-bar. The new ChordEntryOverlay lets users
   * choose any beat directly.
   */
  const addChordToMeasure = (measureIdx: number, chord: Chord) => {
    const next = sheet.measures.map((m, i) => {
      if (i !== measureIdx) return m;
      if (m.chords.length >= 2) return m;
      const beatsPerMeasure = sheet.timeSignature.beatsPerMeasure;
      const halfBarBeat = Math.floor(beatsPerMeasure / 2) + 1;
      const beat = m.chords.length === 0 ? 1 : halfBarBeat;
      return { ...m, chords: [...m.chords, { chord, beat }] };
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
        chords: m.chords.map((c, ci) =>
          ci === chordIdx ? { ...c, chord } : c,
        ),
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

  /**
   * Phase 25.2 — Chord-entry mode helpers.
   *
   * Lifecycle:
   *   enter → cursor lands on measure 0 beat 1, draft loads existing
   *     chord text if there is one.
   *   click hit region → commit current draft (if dirty), move cursor
   *     to clicked beat, load that beat's existing chord into draft.
   *   commit-advance / commit-retreat (Tab / Shift+Tab / Enter) →
   *     parse + write current draft, then advance / retreat to the
   *     next / previous beat.
   *   exit → commit current draft + clear state.
   */

  /** Find the ChordBeat at a given measure + beat, or null. */
  const chordAtBeat = (measureIdx: number, beat: number) => {
    const m = sheet.measures[measureIdx];
    if (!m) return null;
    return m.chords.find((cb) => cb.beat === beat) ?? null;
  };

  /** Format a ChordBeat back to text for the input draft. */
  const chordToText = (
    cb: { chord: Chord; bass?: PitchClass } | null,
  ): string => {
    if (!cb) return "";
    const base = renderChord(cb.chord, notationStyle);
    return cb.bass ? `${base}/${cb.bass}` : base;
  };

  /** Commit the current draft to the cursor's beat. Empty draft removes
   *  any existing chord at that beat. */
  const commitChordDraftAt = (cursor: ChordCursor, draft: string) => {
    const trimmed = draft.trim();
    const existing = chordAtBeat(cursor.measureIdx, cursor.beat);
    if (trimmed.length === 0) {
      // Empty: remove existing if any.
      if (existing) {
        const next = sheet.measures.map((m, i) =>
          i === cursor.measureIdx
            ? { ...m, chords: m.chords.filter((cb) => cb.beat !== cursor.beat) }
            : m,
        );
        updateSheet(id, { measures: next });
      }
      return;
    }
    const parsed = parseChordText(trimmed);
    if (!parsed) return; // unparseable — leave existing intact
    const newCb = parsed.bass
      ? { chord: parsed.chord, beat: cursor.beat, bass: parsed.bass }
      : { chord: parsed.chord, beat: cursor.beat };
    const next = sheet.measures.map((m, i) => {
      if (i !== cursor.measureIdx) return m;
      const existingIdx = m.chords.findIndex((cb) => cb.beat === cursor.beat);
      if (existingIdx >= 0) {
        return {
          ...m,
          chords: m.chords.map((cb, ci) =>
            ci === existingIdx ? newCb : cb,
          ),
        };
      }
      return { ...m, chords: [...m.chords, newCb] };
    });
    updateSheet(id, { measures: next });
    // Track recently-used chord text.
    setRecentChords((prev) => {
      const filtered = prev.filter((c) => c !== trimmed);
      return [trimmed, ...filtered].slice(0, 12);
    });
  };

  const enterChordMode = () => {
    setEditorMode("chord-entry");
    const initialCursor: ChordCursor = { measureIdx: 0, beat: 1 };
    setChordCursor(initialCursor);
    const existing = chordAtBeat(0, 1);
    setChordDraft(chordToText(existing));
  };

  const exitChordMode = () => {
    if (chordCursor) commitChordDraftAt(chordCursor, chordDraft);
    setEditorMode("none");
    setChordCursor(null);
    setChordDraft("");
  };

  const moveChordCursorTo = (next: ChordCursor) => {
    if (chordCursor) commitChordDraftAt(chordCursor, chordDraft);
    setChordCursor(next);
    // Read freshest from store after potential write.
    const fresh = useSheetsLibrary
      .getState()
      .sheets.find((s) => s.id === id);
    const existing = fresh
      ? fresh.measures[next.measureIdx]?.chords.find(
          (cb) => cb.beat === next.beat,
        )
      : null;
    setChordDraft(chordToText(existing ?? null));
  };

  const advanceChordCursor = (current: ChordCursor): ChordCursor | null => {
    const beatsPerMeasure = sheet.timeSignature.beatsPerMeasure;
    let nextBeat = current.beat + 1;
    let nextMeasure = current.measureIdx;
    if (nextBeat > beatsPerMeasure) {
      nextBeat = 1;
      nextMeasure += 1;
      if (nextMeasure >= sheet.measures.length) return null;
    }
    return { measureIdx: nextMeasure, beat: nextBeat };
  };

  const retreatChordCursor = (current: ChordCursor): ChordCursor | null => {
    const beatsPerMeasure = sheet.timeSignature.beatsPerMeasure;
    let prevBeat = current.beat - 1;
    let prevMeasure = current.measureIdx;
    if (prevBeat < 1) {
      prevMeasure -= 1;
      if (prevMeasure < 0) return null;
      prevBeat = beatsPerMeasure;
    }
    return { measureIdx: prevMeasure, beat: prevBeat };
  };

  const onChordCommitAdvance = () => {
    if (!chordCursor) return;
    commitChordDraftAt(chordCursor, chordDraft);
    const next = advanceChordCursor(chordCursor);
    if (!next) {
      setEditorMode("none");
      setChordCursor(null);
      setChordDraft("");
      return;
    }
    setChordCursor(next);
    const fresh = useSheetsLibrary
      .getState()
      .sheets.find((s) => s.id === id);
    const existing = fresh
      ? fresh.measures[next.measureIdx]?.chords.find(
          (cb) => cb.beat === next.beat,
        )
      : null;
    setChordDraft(chordToText(existing ?? null));
  };

  const onChordCommitRetreat = () => {
    if (!chordCursor) return;
    commitChordDraftAt(chordCursor, chordDraft);
    const prev = retreatChordCursor(chordCursor);
    if (!prev) return;
    setChordCursor(prev);
    const fresh = useSheetsLibrary
      .getState()
      .sheets.find((s) => s.id === id);
    const existing = fresh
      ? fresh.measures[prev.measureIdx]?.chords.find(
          (cb) => cb.beat === prev.beat,
        )
      : null;
    setChordDraft(chordToText(existing ?? null));
  };

  /**
   * Phase 25.2.1 — click-outside closes the autocomplete + input.
   * Commits the current draft to the cursor's beat, then clears the
   * cursor so the input/dropdown unmount. Stays in chord-entry mode
   * so the hit regions remain available for the next edit.
   */
  const onChordClickOutside = () => {
    if (chordCursor) commitChordDraftAt(chordCursor, chordDraft);
    setChordCursor(null);
    setChordDraft("");
  };

  const onChordPickSuggestion = (text: string) => {
    setChordDraft(text);
    if (chordCursor) {
      // Commit immediately + advance to mimic "click a suggestion to lock in."
      commitChordDraftAt(chordCursor, text);
      const next = advanceChordCursor(chordCursor);
      if (next) {
        setChordCursor(next);
        const fresh = useSheetsLibrary
          .getState()
          .sheets.find((s) => s.id === id);
        const existing = fresh
          ? fresh.measures[next.measureIdx]?.chords.find(
              (cb) => cb.beat === next.beat,
            )
          : null;
        setChordDraft(chordToText(existing ?? null));
      } else {
        setEditorMode("none");
        setChordCursor(null);
        setChordDraft("");
      }
    }
  };

  const updateMeasureMelody = (measureIdx: number, melody: MelodyNote[]) => {
    const next = sheet.measures.map((m, i) =>
      i === measureIdx ? { ...m, melody } : m,
    );
    updateSheet(id, { measures: next });
  };

  // Phase 24c — Lyric editing helpers.
  /**
   * Commit the current draft to the note at `cursor` (or clear if
   * the draft is empty). Returns true if a write happened.
   */
  const commitDraftAt = (cursor: LyricCursor, draft: string): boolean => {
    const parsed = parseLyricInput(draft);
    const existing = getLyricAt(sheet, cursor);
    const same =
      (parsed === null && existing === undefined) ||
      (parsed !== null &&
        existing !== undefined &&
        parsed.text === existing.text &&
        parsed.continuation === existing.continuation);
    if (same) return false;
    const measures = setLyricAt(sheet, cursor, parsed);
    updateSheet(id, { measures });
    return true;
  };

  const enterLyricMode = () => {
    const first = firstLyricPosition(sheet);
    if (!first) {
      // No pitched notes — nothing to lyric-edit. Still flip mode on so
      // the overlay shows the (empty) state; user-facing helper text
      // covers this case.
      setEditorMode("lyrics");
      setLyricCursor(null);
      setLyricDraft("");
      return;
    }
    setEditorMode("lyrics");
    setLyricCursor(first);
    const existing = getLyricAt(sheet, first);
    setLyricDraft(existing ? formatLyricForInput(existing) : "");
  };

  const exitLyricMode = () => {
    if (lyricCursor) commitDraftAt(lyricCursor, lyricDraft);
    setEditorMode("none");
    setLyricCursor(null);
    setLyricDraft("");
  };

  // Phase 25.0 / 25.1 — Click-on-staff + keyboard melody entry handlers.
  const enterClickEntryMode = () => {
    setEditorMode("click-entry");
    // Phase 25.1: caret lands on measure 0 by default; user can click
    // another measure to re-anchor. Octave 4 = middle-C octave.
    setCaret(caretAtEndOfMeasure(sheet, 0, 4));
  };
  const exitClickEntryMode = () => {
    setEditorMode("none");
    setCaret(null);
  };

  /**
   * Phase 25.1 — Place a note at the caret + advance the caret. Pure
   * function over (sheet, caret, side-panel state, pitch); used by
   * both click placement and keyboard letter placement.
   */
  const placeAtCaret = (currentCaret: MelodyCaret, pitch: string) => {
    const note = entryRest
      ? buildRestNote(entryDuration, entryDotted)
      : buildPitchedNote(pitch, entryDuration, entryDotted);
    const measures = appendMelodyNote(
      sheet,
      currentCaret.measureIdx,
      note,
    );
    updateSheet(id, { measures });
    const beats = durationToBeats(entryDuration, entryDotted);
    const fresh = useSheetsLibrary
      .getState()
      .sheets.find((s) => s.id === id);
    if (fresh) {
      setCaret(advanceCaret(currentCaret, beats, fresh));
    }
  };

  /**
   * Click on the staff: re-anchor the caret to the clicked measure
   * (at the end of any existing notes), then place a note at the
   * clicked pitch and advance.
   */
  const onClickStaff = (measureIdx: number, pitch: string) => {
    // Move caret to clicked measure first — Dorico-style "click puts
    // the caret here." Then place + advance.
    const newCaret = caretAtEndOfMeasure(
      sheet,
      measureIdx,
      caret?.octave ?? 4,
    );
    placeAtCaret(newCaret, pitch);
  };

  const moveCursorTo = (next: LyricCursor) => {
    if (lyricCursor) commitDraftAt(lyricCursor, lyricDraft);
    setLyricCursor(next);
    // Read existing AFTER potential write. Use the freshest sheet via
    // the store getState() since `sheet` here is the stale React prop.
    const fresh = useSheetsLibrary
      .getState()
      .sheets.find((s) => s.id === id);
    const existing = fresh ? getLyricAt(fresh, next) : undefined;
    setLyricDraft(existing ? formatLyricForInput(existing) : "");
  };

  const onLyricCommitAdvance = () => {
    if (!lyricCursor) return;
    commitDraftAt(lyricCursor, lyricDraft);
    const fresh = useSheetsLibrary
      .getState()
      .sheets.find((s) => s.id === id);
    if (!fresh) return;
    const next = nextLyricPosition(fresh, lyricCursor);
    if (!next) {
      // End of sheet — exit lyric mode after committing.
      setEditorMode("none");
      setLyricCursor(null);
      setLyricDraft("");
      return;
    }
    setLyricCursor(next);
    const existing = getLyricAt(fresh, next);
    setLyricDraft(existing ? formatLyricForInput(existing) : "");
  };

  const onLyricRetreat = () => {
    if (!lyricCursor) return;
    const prev = prevLyricPosition(sheet, lyricCursor);
    if (!prev) return; // already at start — no-op
    // Don't auto-commit on retreat (the draft is empty by definition
    // since backspace-on-empty is what triggers this).
    setLyricCursor(prev);
    const existing = getLyricAt(sheet, prev);
    setLyricDraft(existing ? formatLyricForInput(existing) : "");
  };

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8">
      {/* Phase 24c.2: max-w bumped 3xl → 4xl to fit US Letter
          (816px) sheet preview without horizontal scroll. */}
      <div className="flex w-full max-w-4xl flex-col gap-8">
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
            {/* Phase 27 — Play / Stop. Plays the sheet aloud via Tone.js
                (chord comping + melody synth). */}
            <button
              type="button"
              onClick={async () => {
                if (isPlaying) {
                  sheetPlayback.cancel();
                  setIsPlaying(false);
                } else {
                  if (!sheet) return;
                  setIsPlaying(true);
                  try {
                    await sheetPlayback.play(sheet, {
                      onEnded: () => setIsPlaying(false),
                    });
                  } catch {
                    setIsPlaying(false);
                  }
                }
              }}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                isPlaying
                  ? "border-rose-500/60 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                  : "border-emerald-500/40 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/15"
              }`}
              title={isPlaying ? "Stop playback" : "Play this sheet aloud"}
              aria-label={isPlaying ? "Stop playback" : "Play"}
            >
              {isPlaying ? (
                <Square className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isPlaying ? "Stop" : "Play"}
            </button>
            {/* Phase 26 — Undo / Redo. Keyboard: Cmd/Ctrl+Z (undo),
                Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y (redo). */}
            <button
              type="button"
              onClick={() => undoSheet(id)}
              disabled={!canUndo}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Undo (Cmd/Ctrl+Z)"
              aria-label="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => redoSheet(id)}
              disabled={!canRedo}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)"
              aria-label="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </button>
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
            <label className="flex flex-col gap-1 text-xs">
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
            {/* Phase 25.0.2 — Font style toggle. Per-sheet aesthetic
                choice; "standard" keeps the classic Georgia serif
                engraving, "handwritten" switches the whole page to a
                Patrick Hand block-print font (Real Book / iReal Pro
                vibe). */}
            <label className="flex flex-col gap-1 text-xs">
              Font style
              <div className="flex items-center gap-1">
                {SHEET_FONT_STYLES.map((fs) => (
                  <button
                    key={fs}
                    type="button"
                    onClick={() => updateMeta("fontStyle", fs)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                      (sheet.fontStyle ?? "standard") === fs
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                    title={
                      fs === "handwritten"
                        ? "Real Book / iReal Pro handwritten block-print"
                        : "Classic serif engraving"
                    }
                  >
                    {fs === "handwritten" ? "Handwritten" : "Standard"}
                  </button>
                ))}
              </div>
            </label>
          </div>
        </section>

        {/* Live preview — same engraving as the View / Print page so the
            user sees their work in its final form as they edit.
            Phase 24c: "Edit lyrics" toggle turns the preview into an
            interactive lyric authoring surface.
            Phase 25.0: "Click entry" toggle turns the preview into a
            Dorico-style click-on-staff melody authoring surface. The
            two modes are mutually exclusive. */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Preview
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  editorMode === "chord-entry"
                    ? exitChordMode()
                    : enterChordMode()
                }
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  editorMode === "chord-entry"
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
                title={
                  editorMode === "chord-entry"
                    ? "Exit chord-entry mode"
                    : "Click a beat above the staff to enter / edit chords"
                }
              >
                <Music className="h-3.5 w-3.5" />
                {editorMode === "chord-entry"
                  ? "Done chord-entry"
                  : "Chord entry"}
              </button>
              <button
                type="button"
                onClick={() =>
                  editorMode === "click-entry"
                    ? exitClickEntryMode()
                    : enterClickEntryMode()
                }
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  editorMode === "click-entry"
                    ? "border-sky-500/60 bg-sky-500/10 text-sky-500 hover:bg-sky-500/20"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
                title={
                  editorMode === "click-entry"
                    ? "Exit click-entry mode"
                    : "Click on a staff to place a melody note (Dorico-style)"
                }
              >
                <MousePointerClick className="h-3.5 w-3.5" />
                {editorMode === "click-entry"
                  ? "Done click-entry"
                  : "Click entry"}
              </button>
              <button
                type="button"
                onClick={() =>
                  editorMode === "lyrics"
                    ? exitLyricMode()
                    : enterLyricMode()
                }
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  editorMode === "lyrics"
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
                title={
                  editorMode === "lyrics"
                    ? "Exit lyric editing"
                    : "Click notes and type lyrics under the staff"
                }
              >
                <Type className="h-3.5 w-3.5" />
                {editorMode === "lyrics"
                  ? "Done editing lyrics"
                  : "Edit lyrics"}
              </button>
            </div>
          </div>
          {editorMode === "lyrics" && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-amber-500">
                Lyric mode.
              </span>{" "}
              Click any note to place the cursor. Type a syllable,{" "}
              <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                space
              </kbd>{" "}
              to advance,{" "}
              <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                -
              </kbd>{" "}
              for syllable continuation (e.g. <em>love-</em> <em>ly</em>),{" "}
              <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                _
              </kbd>{" "}
              for melisma (one syllable across multiple notes),{" "}
              <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                esc
              </kbd>{" "}
              to exit. Rests + tied follower notes are skipped.
            </p>
          )}
          {editorMode === "chord-entry" && (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-emerald-500">
                Chord entry mode.
              </span>{" "}
              Click any beat hit-region above a staff to anchor the
              cursor. Type a chord (e.g.{" "}
              <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                Cmaj7
              </kbd>{" "}
              ,{" "}
              <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                Bm7b5
              </kbd>{" "}
              ,{" "}
              <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                C/E
              </kbd>
              );{" "}
              <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                Tab
              </kbd>{" "}
              or{" "}
              <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                Enter
              </kbd>{" "}
              commit + advance to next beat,{" "}
              <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                Shift+Tab
              </kbd>{" "}
              retreat,{" "}
              <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                esc
              </kbd>{" "}
              exit. Pick a suggestion to commit it instantly.
            </p>
          )}
          {editorMode === "click-entry" && (
            <div className="flex flex-col gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium text-sky-500">
                  Click entry mode.
                </span>{" "}
                Click a staff to place a note + anchor the caret.
                Then keyboard:{" "}
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                  A-G
                </kbd>{" "}
                place note,{" "}
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                  R
                </kbd>{" "}
                rest,{" "}
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                  ↑↓
                </kbd>{" "}
                nudge last pitch,{" "}
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                  ←→
                </kbd>{" "}
                move caret,{" "}
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                  1-5
                </kbd>{" "}
                rhythm (w/h/q/8/16),{" "}
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                  .
                </kbd>{" "}
                dotted,{" "}
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                  esc
                </kbd>{" "}
                exit.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-mono uppercase tracking-wider text-muted-foreground">
                  Rhythm
                </span>
                {(["w", "h", "q", "8", "16"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setEntryDuration(d)}
                    className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                      entryDuration === d
                        ? "border-sky-500/60 bg-sky-500/15 text-sky-500"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {MELODY_DURATION_LABELS[d]}
                  </button>
                ))}
                <label className="ml-2 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={entryDotted}
                    onChange={(e) => setEntryDotted(e.target.checked)}
                    className="h-3.5 w-3.5 accent-sky-500"
                  />
                  Dotted
                </label>
                <label className="ml-2 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={entryRest}
                    onChange={(e) => setEntryRest(e.target.checked)}
                    className="h-3.5 w-3.5 accent-sky-500"
                  />
                  Rest
                </label>
              </div>
            </div>
          )}
          {/* Phase 24c.2: dropped fixed width override — SheetSurface
              defaults to Letter dimensions (816px) so the editor
              preview matches the printed output 1:1. */}
          <div className="relative" style={{ width: 816 }}>
            <SheetSurface
              sheet={sheet}
              onLayout={
                editorMode !== "none" ? handleLayout : undefined
              }
            />
            {editorMode === "lyrics" && (
              <LyricOverlay
                positions={eligibleLyricPositions}
                cursor={lyricCursor}
                draft={lyricDraft}
                onDraftChange={setLyricDraft}
                onSetCursor={moveCursorTo}
                onCommitAdvance={onLyricCommitAdvance}
                onRetreat={onLyricRetreat}
                onExit={exitLyricMode}
              />
            )}
            {editorMode === "click-entry" && surfaceLayout && (
              <MelodyEntryOverlay
                measureRects={surfaceLayout.measureRects}
                paperHeight={surfaceLayout.paperHeight}
                caret={caret}
                beatsPerMeasure={sheet.timeSignature.beatsPerMeasure}
                onClickStaff={onClickStaff}
                onExit={exitClickEntryMode}
              />
            )}
            {editorMode === "chord-entry" && surfaceLayout && (
              <ChordEntryOverlay
                measureRects={surfaceLayout.measureRects}
                paperHeight={surfaceLayout.paperHeight}
                beatsPerMeasure={sheet.timeSignature.beatsPerMeasure}
                cursor={chordCursor}
                draft={chordDraft}
                suggestions={suggestChords(chordDraft, recentChords, 8)}
                onDraftChange={setChordDraft}
                onSetCursor={moveChordCursorTo}
                onCommitAdvance={onChordCommitAdvance}
                onCommitRetreat={onChordCommitRetreat}
                onPickSuggestion={onChordPickSuggestion}
                onClickOutside={onChordClickOutside}
                onExit={exitChordMode}
              />
            )}
          </div>
          {editorMode === "lyrics" && eligibleLyricPositions.length === 0 && (
            <p className="rounded-md border border-border bg-card/40 px-3 py-2 text-[11px] text-muted-foreground">
              No pitched notes to lyric-edit yet. Add a melody to a
              measure below, then re-enter lyric mode.
            </p>
          )}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sheet.measures.map((measure, mIdx) => (
              <div
                key={measure.id}
                className="group relative flex flex-col gap-2 rounded-md border border-border bg-card/40 p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Measure {mIdx + 1}
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
                {/* Chord chips */}
                <div className="flex flex-wrap items-center gap-1 min-h-[2rem]">
                  {measure.chords.length === 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        addChordToMeasure(mIdx, {
                          root: sheet.keyTonic,
                          quality: sheet.keyMode === "major" ? "maj7" : "min7",
                        })
                      }
                      className="flex flex-1 items-center justify-center gap-1 rounded border border-dashed border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      aria-label="Add chord"
                    >
                      <Plus className="h-3 w-3" />
                      Add chord
                    </button>
                  ) : (
                    measure.chords.map((cb, cIdx) => (
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
                        title={`Beat ${cb.beat}`}
                      >
                        {renderChord(cb.chord, notationStyle)}
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
                {/* Melody staff (Phase 24b) */}
                <div className="rounded border border-border/40 bg-background/50 p-1">
                  <MelodyStaff
                    melody={measure.melody ?? []}
                    timeSignature={sheet.timeSignature}
                    showClef={mIdx === 0}
                    showTimeSignature={mIdx === 0}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMelodyIdx(mIdx)}
                  className="self-start rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  {measure.melody && measure.melody.length > 0
                    ? `Edit melody (${measure.melody.length})`
                    : "Add melody"}
                </button>
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
              ].chord
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

        {/* Melody editor pop-up (Phase 24b) */}
        {editingMelodyIdx !== null && (
          <MelodyEditorModal
            measureIdx={editingMelodyIdx}
            melody={sheet.measures[editingMelodyIdx].melody ?? []}
            timeSignature={sheet.timeSignature}
            onSave={(melody) => {
              updateMeasureMelody(editingMelodyIdx, melody);
            }}
            onClose={() => setEditingMelodyIdx(null)}
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

/**
 * Melody editor modal — pitch + duration pickers + a list of the
 * current notes/rests with delete affordances. Live-renders the
 * staff at the top so the user sees their changes as they author.
 */
function MelodyEditorModal({
  measureIdx,
  melody,
  timeSignature,
  onSave,
  onClose,
}: {
  measureIdx: number;
  melody: MelodyNote[];
  timeSignature: { beatsPerMeasure: number; beatUnit: number };
  onSave: (melody: MelodyNote[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MelodyNote[]>(melody);
  const [pitchLetter, setPitchLetter] = useState<string>("c");
  const [pitchAccidental, setPitchAccidental] = useState<"" | "#" | "b">("");
  const [pitchOctave, setPitchOctave] = useState<number>(4);
  const [duration, setDuration] = useState<MelodyDuration>("q");
  const [dotted, setDotted] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pitchString = `${pitchLetter}${pitchAccidental}/${pitchOctave}`;

  const addNote = () => {
    setDraft((prev) => [
      ...prev,
      { kind: "note", pitch: pitchString, duration, dotted },
    ]);
  };
  const addRest = () => {
    setDraft((prev) => [...prev, { kind: "rest", duration, dotted }]);
  };
  const removeAt = (idx: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  };
  const toggleTieAt = (idx: number) => {
    setDraft((prev) =>
      prev.map((n, i) => {
        if (i !== idx || n.kind !== "note") return n;
        return { ...n, tieToNext: !n.tieToNext };
      }),
    );
  };
  /** Wrap the last 3 notes/rests into a triplet group. */
  const makeTripletFromLast = () => {
    setDraft((prev) => {
      if (prev.length < 3) return prev;
      const groupId = newTupletGroupId();
      const cut = prev.length - 3;
      return prev.map((n, i) =>
        i >= cut ? { ...n, tupletGroup: groupId } : n,
      );
    });
  };
  /** Remove the tuplet grouping from a single note (and all of its group-mates). */
  const ungrouptupletAt = (idx: number) => {
    setDraft((prev) => {
      const groupId = prev[idx]?.tupletGroup;
      if (!groupId) return prev;
      return prev.map((n) => {
        if (n.tupletGroup !== groupId) return n;
        const { tupletGroup: _drop, ...rest } = n;
        void _drop;
        return rest as MelodyNote;
      });
    });
  };
  const handleSave = () => {
    onSave(draft);
    onClose();
  };
  // Last-3-or-more notes available to triplet-ize?
  const canMakeTriplet =
    draft.length >= 3 &&
    !draft.slice(-3).some((n) => n.tupletGroup);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Melody — measure {measureIdx + 1}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live preview */}
        <div className="mb-4 flex justify-center rounded-md border border-border bg-background/30 p-3">
          <MelodyStaff
            melody={draft}
            timeSignature={timeSignature}
            showClef
            showTimeSignature
            width={400}
            height={110}
          />
        </div>

        {/* Note pickers */}
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs">
            Pitch
            <select
              value={pitchLetter}
              onChange={(e) => setPitchLetter(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {["c", "d", "e", "f", "g", "a", "b"].map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Accidental
            <select
              value={pitchAccidental}
              onChange={(e) =>
                setPitchAccidental(e.target.value as "" | "#" | "b")
              }
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Natural</option>
              <option value="#">Sharp (♯)</option>
              <option value="b">Flat (♭)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Octave
            <select
              value={pitchOctave}
              onChange={(e) => setPitchOctave(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {[3, 4, 5, 6].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Duration
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as MelodyDuration)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {MELODY_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {MELODY_DURATION_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mb-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={dotted}
            onChange={(e) => setDotted(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Dotted (1.5× duration)
        </label>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addNote}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Add note ({pitchString.replace("/", "")})
          </button>
          <button
            type="button"
            onClick={addRest}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add rest
          </button>
          <button
            type="button"
            onClick={makeTripletFromLast}
            disabled={!canMakeTriplet}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Group the last 3 notes/rests into a triplet"
          >
            Triplet (last 3)
          </button>
        </div>

        {/* Sequence list. Each chip now shows tie + tuplet state and
            offers per-note controls: tie-to-next toggle (note chips
            only), ungroup-tuplet (when grouped), remove. */}
        {draft.length > 0 && (
          <div className="mb-4 flex flex-col gap-1.5 rounded-md border border-border bg-background/30 p-3">
            <div className="flex flex-wrap gap-1.5">
              {draft.map((n, i) => {
                const isLast = i === draft.length - 1;
                const isNote = n.kind === "note";
                const hasTie = isNote && n.tieToNext === true && !isLast;
                const isTuplet = !!n.tupletGroup;
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-xs font-mono ${
                      isTuplet
                        ? "border-amber-400/60 bg-amber-400/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <span>
                      {n.kind === "rest"
                        ? `R-${MELODY_DURATION_LABELS[n.duration]}`
                        : `${n.pitch.replace("/", "")}-${MELODY_DURATION_LABELS[n.duration]}`}
                      {n.dotted && "."}
                      {hasTie && " ⌣"}
                      {isTuplet && " ³"}
                    </span>
                    {isNote && !isLast && (
                      <button
                        type="button"
                        onClick={() => toggleTieAt(i)}
                        className={`rounded-full px-1 text-[10px] font-medium transition-colors ${
                          hasTie
                            ? "bg-primary/30 text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Toggle tie to next note (same pitch required to render)"
                      >
                        tie
                      </button>
                    )}
                    {isTuplet && (
                      <button
                        type="button"
                        onClick={() => ungrouptupletAt(i)}
                        className="rounded-full px-1 text-[10px] font-medium text-amber-500 hover:text-amber-400 transition-colors"
                        title="Remove this note's tuplet grouping (un-triplet)"
                      >
                        ungroup
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                      aria-label={`Remove note ${i + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <span className="font-mono">⌣</span> = tied to next note
              (renders only when next note is the same pitch).{" "}
              <span className="font-mono">³</span> = part of a tuplet
              group.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
