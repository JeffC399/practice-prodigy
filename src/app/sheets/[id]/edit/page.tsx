"use client";

import {
  ArrowLeft,
  BoxSelect,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Music,
  MousePointerClick,
  Play,
  Plus,
  Redo2,
  SlidersHorizontal,
  Square,
  Trash2,
  Type,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  CHORD_VOICES,
  CHORD_VOICE_LABELS,
  DEFAULT_SHEET_MIXER,
  MELODY_DURATIONS,
  MELODY_DURATION_LABELS,
  MELODY_VOICES,
  MELODY_VOICE_LABELS,
  newMeasureId,
  newSlurGroupId,
  newTupletGroupId,
  SHEET_FONT_STYLES,
  SHEET_KEY_MODES,
  type ChordVoice,
  type MelodyDuration,
  type MelodyNote,
  type MelodyVoice,
  type SheetKeyMode,
  type SheetMixer,
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
  appendMelodyNoteWithSplit,
  buildPitchedNote,
  buildRestNote,
} from "@/lib/sheets/melody-entry";
import {
  connectMidiInput,
  midiNumberToVexPitch,
  type MidiConnectionStatus,
} from "@/lib/sheets/midi-input";
import { sheetPlayback } from "@/lib/audio/sheet-playback";
import {
  advanceCaret,
  caretAtEndOfMeasure,
  durationToBeats,
  existingBeatsInMeasure,
  letterToPitch,
  nudgeLastNoteInMeasure,
  retreatCaret,
  type MelodyCaret,
} from "@/lib/sheets/melody-caret";
import {
  copySelection,
  deleteSelection,
  transposeSelection,
} from "@/lib/sheets/selection";
import { SelectionOverlay } from "@/components/sheets/selection-overlay";
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
    "none" | "lyrics" | "click-entry" | "chord-entry" | "select"
  >("none");
  // Phase 31.4 — melody-note selection state. Set of `${mi}:${ni}`
  // identifiers. Selection is UI-only (not persisted). Operates while
  // editorMode === "select"; other modes clear it on entry.
  const [selection, setSelection] = useState<Set<string>>(
    () => new Set(),
  );
  const [clipboardNotes, setClipboardNotes] = useState<MelodyNote[] | null>(
    null,
  );
  // Phase 31.5 — Zoom + focus mode. Zoom is applied via the CSS
  // `zoom` property on the preview wrapper (well-supported in
  // Chrome / Edge / Safari; Firefox 126+ also supports it). Focus
  // mode adds a `focus-mode` class to `<html>` so the site-header
  // CSS in globals.css can hide the top nav.
  const [zoom, setZoom] = useState(1);
  const [focusMode, setFocusMode] = useState(false);
  // Phase 25.2 — Chord entry mode state.
  const [chordCursor, setChordCursor] = useState<ChordCursor | null>(null);
  const [chordDraft, setChordDraft] = useState("");
  const [recentChords, setRecentChords] = useState<string[]>([]);
  // Phase 27 — Live audio playback state.
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  // Phase 27.1 — instrument picker + mixer panel toggle.
  const [audioPanelOpen, setAudioPanelOpen] = useState(false);
  // Phase 27.1b — session-only tempo % and loop range.
  const [tempoPercent, setTempoPercent] = useState(100); // 50..150
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(1);
  const [loopEnd, setLoopEnd] = useState(1);
  // Phase 31.2 — collapsible metadata section. Default expanded when
  // the sheet's title is still the placeholder (so first-time authors
  // see the fields); collapsed once the user has named the sheet.
  const [metaExpanded, setMetaExpanded] = useState<boolean | null>(null);
  // Phase 31.3 — "Saved" indicator. Flashes for ~1.8s after each
  // store mutation to `updatedAt`. Also triggered by Cmd/Ctrl+S as a
  // reassurance-flash (saves are already automatic on every edit).
  const [saveFlashAt, setSaveFlashAt] = useState<number | null>(null);
  const lastUpdatedRef = useRef<number | undefined>(undefined);
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
  // Phase 30 — MIDI input. `midiEnabled` is the user's toggle; the
  // engine only actually attaches to devices when both `midiEnabled`
  // AND `editorMode === "click-entry"` are true.
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [midiStatus, setMidiStatus] = useState<MidiConnectionStatus>(
    "disconnected",
  );
  const [midiDeviceCount, setMidiDeviceCount] = useState(0);
  const caretRef = useRef<MelodyCaret | null>(null);
  useEffect(() => {
    caretRef.current = caret;
  }, [caret]);
  // Phase 31.3 — Watch sheet.updatedAt. On the first mount we take a
  // baseline (no flash). Every subsequent bump = an actual save;
  // trigger the "Saved" indicator.
  useEffect(() => {
    if (!sheet) return;
    if (lastUpdatedRef.current === undefined) {
      lastUpdatedRef.current = sheet.updatedAt;
      return;
    }
    if (sheet.updatedAt !== lastUpdatedRef.current) {
      lastUpdatedRef.current = sheet.updatedAt;
      setSaveFlashAt(Date.now());
    }
  }, [sheet]);
  // Clear the "Saved" flash after 1.8s.
  useEffect(() => {
    if (saveFlashAt === null) return;
    const t = setTimeout(() => setSaveFlashAt(null), 1800);
    return () => clearTimeout(t);
  }, [saveFlashAt]);
  // Cmd/Ctrl+S: reassurance flash. Saves are already automatic on
  // every mutation, so we just flash the indicator to acknowledge
  // the muscle-memory shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isModS =
        (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === "s";
      if (!isModS) return;
      e.preventDefault();
      setSaveFlashAt(Date.now());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Phase 31.5 — Zoom + focus-mode keyboard shortcuts.
  //   Cmd/Ctrl + = / +   →  zoom in (10% steps, cap 200%)
  //   Cmd/Ctrl + -       →  zoom out (10% steps, floor 50%)
  //   Cmd/Ctrl + 0       →  reset zoom to 100%
  //   F                  →  toggle focus mode (no modifier — quick)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setZoom((z) => Math.min(2, Math.round((z + 0.1) * 100) / 100));
          return;
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 100) / 100));
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          setZoom(1);
          return;
        }
      }
      if (!inInput && !mod && !e.altKey && !e.shiftKey && e.key === "f") {
        e.preventDefault();
        setFocusMode((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Apply focus-mode class to <html> so globals.css can hide site
  // chrome. Cleaned up on unmount so leaving the editor page doesn't
  // strand the class.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (focusMode) root.classList.add("focus-mode");
    else root.classList.remove("focus-mode");
    return () => {
      root.classList.remove("focus-mode");
    };
  }, [focusMode]);
  // Phase 30 — Stable ref to the latest `placeAtCaret` closure so the
  // MIDI subscription effect can invoke it without re-attaching on
  // unrelated state changes. Declared alongside the other hooks
  // (above the `if (!sheet)` early return) so hook order stays
  // stable across renders.
  const placeAtCaretRef = useRef<
    ((c: MelodyCaret, p: string) => void) | null
  >(null);
  // Phase 30 — MIDI subscription. Attaches while both the click-entry
  // mode AND the MIDI toggle are on; auto-detaches otherwise. Uses
  // refs to read the latest caret + placeAtCaret so hot state churn
  // doesn't churn the subscription.
  useEffect(() => {
    if (!midiEnabled || editorMode !== "click-entry") {
      setMidiStatus("disconnected");
      setMidiDeviceCount(0);
      return;
    }
    let cancelled = false;
    let cleanup: () => void = () => {};
    connectMidiInput({
      onNote: (midiNumber) => {
        const pitch = midiNumberToVexPitch(midiNumber);
        const c = caretRef.current;
        const place = placeAtCaretRef.current;
        if (!pitch || !c || !place) return;
        place(c, pitch);
      },
      onStatusChange: (status, count) => {
        if (cancelled) return;
        setMidiStatus(status);
        setMidiDeviceCount(count);
      },
    }).then((res) => {
      if (cancelled) {
        res.disconnect();
        return;
      }
      cleanup = res.disconnect;
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [midiEnabled, editorMode]);
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
   * Phase 31.4 — Selection-mode keyboard shortcuts. Active only when
   * `editorMode === "select"`. Delete / Backspace removes the selected
   * notes; ↑/↓ transposes each by one staff step (Shift = by octave);
   * Cmd/Ctrl+C copies the selection to a local clipboard; Escape
   * clears the selection. Cut and Paste land in a follow-up.
   */
  useEffect(() => {
    if (editorMode !== "select") return;
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
        setSelection(new Set());
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection.size === 0) return;
        e.preventDefault();
        const measures = deleteSelection(fresh, selection);
        updateSheet(id, { measures });
        setSelection(new Set());
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (selection.size === 0) return;
        e.preventDefault();
        const direction: 1 | -1 = e.key === "ArrowUp" ? 1 : -1;
        const measures = transposeSelection(
          fresh,
          selection,
          direction,
          e.shiftKey,
        );
        updateSheet(id, { measures });
        return;
      }
      const modC =
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "c";
      if (modC) {
        if (selection.size === 0) return;
        e.preventDefault();
        setClipboardNotes(copySelection(fresh, selection));
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editorMode, selection, id]);

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
        // Phase 31.1 — auto-split overflow into tied pieces.
        const { measures, beatsPlaced } = appendMelodyNoteWithSplit(
          fresh,
          caret.measureIdx,
          note,
        );
        updateSheet(id, { measures });
        const fresher = useSheetsLibrary
          .getState()
          .sheets.find((s) => s.id === id);
        if (fresher) setCaret(advanceCaret(caret, beatsPlaced, fresher));
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        if (!caret) return;
        const restNote = buildRestNote(entryDuration, entryDotted);
        // Phase 31.1 — rests split too (they distribute but don't tie).
        const { measures, beatsPlaced } = appendMelodyNoteWithSplit(
          fresh,
          caret.measureIdx,
          restNote,
        );
        updateSheet(id, { measures });
        const fresher = useSheetsLibrary
          .getState()
          .sheets.find((s) => s.id === id);
        if (fresher) setCaret(advanceCaret(caret, beatsPlaced, fresher));
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

  /**
   * Phase 28 — Apply a partial form-marking update to a single measure.
   * Pass `undefined` for any field you want to clear (e.g. mark: undefined
   * to remove the Coda symbol).
   */
  const updateMeasureForm = (
    measureIdx: number,
    update: Partial<
      Pick<
        (typeof sheet.measures)[number],
        | "repeatStart"
        | "repeatEnd"
        | "volta"
        | "mark"
        | "instruction"
        | "sectionLabel"
        | "octavaShift"
      >
    >,
  ) => {
    const next = sheet.measures.map((m, i) =>
      i === measureIdx ? { ...m, ...update } : m,
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

  // Phase 31.4 — Selection mode enter/exit.
  const enterSelectMode = () => {
    setEditorMode("select");
    setSelection(new Set());
    setCaret(null);
  };
  const exitSelectMode = () => {
    setEditorMode("none");
    setSelection(new Set());
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
    // Phase 31.1 — Use the auto-splitting variant. If the note fits
    // in the current measure it delegates to the original
    // appendMelodyNote; otherwise it splits into tied pieces across
    // consecutive measures per standard engraving convention.
    const { measures, beatsPlaced } = appendMelodyNoteWithSplit(
      sheet,
      currentCaret.measureIdx,
      note,
    );
    updateSheet(id, { measures });
    const fresh = useSheetsLibrary
      .getState()
      .sheets.find((s) => s.id === id);
    if (fresh) {
      // Advance by the beats actually placed. When the split ran out
      // of measures, beatsPlaced < the note's full duration and the
      // caret clamps to the end of the sheet.
      setCaret(advanceCaret(currentCaret, beatsPlaced, fresh));
    }
  };
  // Phase 30 — sync the placeAtCaret ref (declared in the top-of-
  // component hook block above `if (!sheet)`) via direct assignment
  // rather than a useEffect. useEffect here would break the Rules of
  // Hooks — this line lives below the early return and only runs on
  // renders where sheet is truthy. A ref mutation on render is safe.
  placeAtCaretRef.current = placeAtCaret;

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
            {/* Phase 31.3 — "Saved" indicator. Flashes for ~1.8s after
                each mutation via the effects above. Cmd/Ctrl+S also
                triggers the flash as a reassurance. */}
            <div
              className={`flex items-center gap-1 text-[11px] transition-opacity ${
                saveFlashAt !== null
                  ? "text-emerald-500 opacity-100"
                  : "text-muted-foreground opacity-50"
              }`}
              aria-live="polite"
              title="All changes are saved automatically. Cmd/Ctrl+S flashes this indicator."
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  saveFlashAt !== null ? "bg-emerald-500" : "bg-muted-foreground"
                }`}
              />
              {saveFlashAt !== null ? "Saved" : "Auto-saved"}
            </div>
            {/* Phase 27 — Play / Stop. Plays the sheet aloud via Tone.js
                (sample-based chord comping + melody voice). */}
            <button
              type="button"
              disabled={isLoadingAudio}
              onClick={async () => {
                if (isPlaying) {
                  sheetPlayback.cancel();
                  setIsPlaying(false);
                } else {
                  if (!sheet) return;
                  setIsLoadingAudio(true);
                  try {
                    await sheetPlayback.play(sheet, {
                      tempoPercent: tempoPercent / 100,
                      countIn: sheet.countIn ?? false,
                      loopStartMeasure: loopEnabled ? loopStart : undefined,
                      loopEndMeasure: loopEnabled ? loopEnd : undefined,
                      onEnded: () => setIsPlaying(false),
                    });
                    setIsPlaying(true);
                  } catch (err) {
                    console.error("[sheet-playback] play() failed", err);
                    setIsPlaying(false);
                  } finally {
                    setIsLoadingAudio(false);
                  }
                }
              }}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isPlaying
                  ? "border-rose-500/60 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                  : "border-emerald-500/40 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/15"
              }`}
              title={isPlaying ? "Stop playback" : "Play this sheet aloud"}
              aria-label={isPlaying ? "Stop playback" : "Play"}
            >
              {isLoadingAudio ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Square className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isLoadingAudio
                ? "Loading…"
                : isPlaying
                  ? "Stop"
                  : "Play"}
            </button>
            {/* Phase 27.1 — Audio settings (voice picker + mixer). */}
            <button
              type="button"
              onClick={() => setAudioPanelOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                audioPanelOpen
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-500"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
              title="Audio settings — instruments + mixer"
              aria-label="Audio settings"
            >
              <SlidersHorizontal className="h-4 w-4" />
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

        {/* Phase 27.1 — Audio settings panel. Toggled by the SlidersHorizontal
            button in the header. Voice picker + per-voice mute + volume. */}
        {audioPanelOpen && (
          <section className="flex flex-col gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs uppercase tracking-wider text-emerald-500">
                Audio
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Per-sheet voice + mixer. Samples lazy-load on first Play.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Chord voice + mixer */}
              <div className="flex flex-col gap-2 rounded-md border border-border/40 bg-card/40 p-3">
                <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Chords
                </h4>
                <label className="flex flex-col gap-1 text-xs">
                  Voice
                  <select
                    value={sheet.chordVoice ?? "piano"}
                    onChange={(e) =>
                      updateMeta("chordVoice", e.target.value as ChordVoice)
                    }
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    {CHORD_VOICES.map((v) => (
                      <option key={v} value={v}>
                        {CHORD_VOICE_LABELS[v]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const m = sheet.mixer ?? DEFAULT_SHEET_MIXER;
                      const next: SheetMixer = {
                        ...m,
                        chordMuted: !m.chordMuted,
                      };
                      updateMeta("mixer", next);
                      sheetPlayback.applyMixer(next);
                    }}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                      (sheet.mixer ?? DEFAULT_SHEET_MIXER).chordMuted
                        ? "border-rose-500/60 bg-rose-500/10 text-rose-500"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                    title="Mute chord voice"
                    aria-label="Mute chord voice"
                  >
                    {(sheet.mixer ?? DEFAULT_SHEET_MIXER).chordMuted ? (
                      <VolumeX className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                    {(sheet.mixer ?? DEFAULT_SHEET_MIXER).chordMuted
                      ? "Muted"
                      : "On"}
                  </button>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <input
                      type="range"
                      min={-30}
                      max={6}
                      step={1}
                      value={
                        (sheet.mixer ?? DEFAULT_SHEET_MIXER).chordVolume
                      }
                      onChange={(e) => {
                        const m = sheet.mixer ?? DEFAULT_SHEET_MIXER;
                        const next: SheetMixer = {
                          ...m,
                          chordVolume: Number(e.target.value),
                        };
                        updateMeta("mixer", next);
                        sheetPlayback.applyMixer(next);
                      }}
                      className="w-full accent-emerald-500"
                      aria-label="Chord volume"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {(sheet.mixer ?? DEFAULT_SHEET_MIXER).chordVolume} dB
                    </span>
                  </div>
                </div>
              </div>
              {/* Melody voice + mixer */}
              <div className="flex flex-col gap-2 rounded-md border border-border/40 bg-card/40 p-3">
                <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Melody
                </h4>
                <label className="flex flex-col gap-1 text-xs">
                  Voice
                  <select
                    value={sheet.melodyVoice ?? "piano"}
                    onChange={(e) =>
                      updateMeta(
                        "melodyVoice",
                        e.target.value as MelodyVoice,
                      )
                    }
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    {MELODY_VOICES.map((v) => (
                      <option key={v} value={v}>
                        {MELODY_VOICE_LABELS[v]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const m = sheet.mixer ?? DEFAULT_SHEET_MIXER;
                      const next: SheetMixer = {
                        ...m,
                        melodyMuted: !m.melodyMuted,
                      };
                      updateMeta("mixer", next);
                      sheetPlayback.applyMixer(next);
                    }}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                      (sheet.mixer ?? DEFAULT_SHEET_MIXER).melodyMuted
                        ? "border-rose-500/60 bg-rose-500/10 text-rose-500"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                    title="Mute melody voice"
                    aria-label="Mute melody voice"
                  >
                    {(sheet.mixer ?? DEFAULT_SHEET_MIXER).melodyMuted ? (
                      <VolumeX className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                    {(sheet.mixer ?? DEFAULT_SHEET_MIXER).melodyMuted
                      ? "Muted"
                      : "On"}
                  </button>
                  <div className="flex-1 flex flex-col gap-0.5">
                    <input
                      type="range"
                      min={-30}
                      max={6}
                      step={1}
                      value={
                        (sheet.mixer ?? DEFAULT_SHEET_MIXER).melodyVolume
                      }
                      onChange={(e) => {
                        const m = sheet.mixer ?? DEFAULT_SHEET_MIXER;
                        const next: SheetMixer = {
                          ...m,
                          melodyVolume: Number(e.target.value),
                        };
                        updateMeta("mixer", next);
                        sheetPlayback.applyMixer(next);
                      }}
                      className="w-full accent-emerald-500"
                      aria-label="Melody volume"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {(sheet.mixer ?? DEFAULT_SHEET_MIXER).melodyVolume} dB
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* Phase 27.1b — Practice controls: count-in, tempo %, loop. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-emerald-500/20 pt-4">
              {/* Count-in toggle */}
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Count-in
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateMeta("countIn", !(sheet.countIn ?? false))
                  }
                  className={`flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    sheet.countIn
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-500"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                  title="Play 1 measure of clicks before the music starts"
                >
                  {sheet.countIn
                    ? "1 measure → music"
                    : "Off"}
                </button>
              </div>
              {/* Tempo slider */}
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Tempo
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={50}
                    max={150}
                    step={5}
                    value={tempoPercent}
                    onChange={(e) =>
                      setTempoPercent(Number(e.target.value))
                    }
                    className="flex-1 accent-emerald-500"
                    aria-label="Playback tempo percent"
                  />
                  <span className="font-mono text-xs text-foreground min-w-[3.5rem] text-right">
                    {tempoPercent}%
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {Math.round(((sheet.bpm ?? 120) * tempoPercent) / 100)}{" "}
                  BPM
                </span>
              </div>
              {/* Loop region */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Loop
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !loopEnabled;
                      if (next && sheet.measures.length > 0) {
                        setLoopStart(1);
                        setLoopEnd(sheet.measures.length);
                      }
                      setLoopEnabled(next);
                    }}
                    className={`text-[10px] font-medium ${
                      loopEnabled
                        ? "text-emerald-500"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {loopEnabled ? "On" : "Off"}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={loopStart}
                    onChange={(e) =>
                      setLoopStart(
                        Math.max(
                          1,
                          Math.min(
                            sheet.measures.length,
                            Number(e.target.value) || 1,
                          ),
                        ),
                      )
                    }
                    disabled={!loopEnabled}
                    min={1}
                    max={sheet.measures.length}
                    className="w-14 rounded-md border border-border bg-background px-1.5 py-1 text-xs disabled:opacity-50"
                    aria-label="Loop start measure"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    →
                  </span>
                  <input
                    type="number"
                    value={loopEnd}
                    onChange={(e) =>
                      setLoopEnd(
                        Math.max(
                          loopStart,
                          Math.min(
                            sheet.measures.length,
                            Number(e.target.value) || loopStart,
                          ),
                        ),
                      )
                    }
                    disabled={!loopEnabled}
                    min={loopStart}
                    max={sheet.measures.length}
                    className="w-14 rounded-md border border-border bg-background px-1.5 py-1 text-xs disabled:opacity-50"
                    aria-label="Loop end measure"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    measures
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Phase 31.2 — Title + meta section is now collapsible. Default
            expanded when the title is unset / still the placeholder;
            collapsed once the user has named the sheet so the paper
            surface sits at the top of the viewport instead of below a
            wall of metadata fields. */}
        {(() => {
          const isMetaExpanded =
            metaExpanded ??
            (!sheet.title || sheet.title === "Untitled lead sheet");
          const summaryParts = [
            sheet.composer,
            sheet.style,
            `${sheet.keyTonic} ${sheet.keyMode}`,
            `${sheet.timeSignature.beatsPerMeasure}/${sheet.timeSignature.beatUnit}`,
            sheet.bpm ? `♩=${sheet.bpm}` : null,
            sheet.fontStyle === "handwritten" ? "Handwritten" : null,
          ].filter(Boolean);
          return (
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-5">
              <div className="flex items-start gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <input
                    type="text"
                    value={sheet.title}
                    onChange={(e) => updateMeta("title", e.target.value)}
                    className="bg-transparent text-2xl font-semibold tracking-tight focus:outline-none"
                    placeholder="Untitled lead sheet"
                    aria-label="Sheet title"
                  />
                  {!isMetaExpanded && summaryParts.length > 0 && (
                    <div className="truncate text-xs text-muted-foreground">
                      {summaryParts.join(" · ")}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMetaExpanded(!isMetaExpanded)}
                  className="mt-1.5 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={isMetaExpanded ? "Hide metadata" : "Show metadata"}
                  title={
                    isMetaExpanded
                      ? "Collapse metadata section"
                      : "Expand metadata section"
                  }
                >
                  {isMetaExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
              {isMetaExpanded && (
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
            {/* Phase 27.1.2 — Lyricist (optional). When set with composer,
                the title block renders "Music by ___" / "Words by ___".
                Same person in both fields → "Music and Lyrics by ___". */}
            <label className="flex flex-col gap-1 text-xs">
              Lyricist
              <input
                type="text"
                value={sheet.lyricist ?? ""}
                onChange={(e) =>
                  updateMeta("lyricist", e.target.value || undefined)
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="If different from composer"
              />
            </label>
            {/* Phase 27.1.3 — Arranger (renders as "arr. by ___"). */}
            <label className="flex flex-col gap-1 text-xs">
              Arranger
              <input
                type="text"
                value={sheet.arranger ?? ""}
                onChange={(e) =>
                  updateMeta("arranger", e.target.value || undefined)
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="e.g. Quincy Jones"
              />
            </label>
            {/* Phase 27.1.3 — Source (renders as italic subtitle). */}
            <label className="flex flex-col gap-1 text-xs">
              Source
              <input
                type="text"
                value={sheet.source ?? ""}
                onChange={(e) =>
                  updateMeta("source", e.target.value || undefined)
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                placeholder='e.g. "from Kind of Blue"'
              />
            </label>
            {/* Phase 27.1.3 — Copyright (renders small at bottom-right). */}
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              Copyright
              <input
                type="text"
                value={sheet.copyright ?? ""}
                onChange={(e) =>
                  updateMeta("copyright", e.target.value || undefined)
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="e.g. © 2026 Smith Music Co."
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
              )}
            </section>
          );
        })()}

        {/* Live preview — same engraving as the View / Print page so the
            user sees their work in its final form as they edit.
            Phase 24c: "Edit lyrics" toggle turns the preview into an
            interactive lyric authoring surface.
            Phase 25.0: "Click entry" toggle turns the preview into a
            Dorico-style click-on-staff melody authoring surface. The
            two modes are mutually exclusive. */}
        <section className="flex flex-col gap-2">
          {/* Phase 31.5 — Empty-state nudge. Shows when the sheet has
              no chords AND no melody notes anywhere. Naturally
              disappears the moment the user adds anything. */}
          {(() => {
            const anyChords = sheet.measures.some(
              (m) => m.chords.length > 0,
            );
            const anyNotes = sheet.measures.some(
              (m) => (m.melody?.length ?? 0) > 0,
            );
            if (anyChords || anyNotes) return null;
            return (
              <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                <p className="font-medium text-primary">
                  Fresh sheet — try one of these to get started
                </p>
                <ul className="ml-4 flex flex-col gap-1 text-[13px] text-muted-foreground">
                  <li>
                    Tap{" "}
                    <span className="font-medium text-foreground">
                      Chord entry
                    </span>{" "}
                    above the preview, then click beats to type chord
                    symbols
                  </li>
                  <li>
                    Tap{" "}
                    <span className="font-medium text-foreground">
                      Click entry
                    </span>{" "}
                    and click the staff to place melody notes, or type
                    A–G on your keyboard
                  </li>
                  <li>
                    Turn on{" "}
                    <span className="font-medium text-foreground">
                      MIDI
                    </span>{" "}
                    in click-entry mode and play a keyboard
                  </li>
                </ul>
              </div>
            );
          })()}
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
              {/* Phase 31.4 — Select mode. Click / drag-marquee to
                  select melody notes; then Delete removes them,
                  arrows transpose, Cmd/Ctrl+C copies. */}
              <button
                type="button"
                onClick={() =>
                  editorMode === "select"
                    ? exitSelectMode()
                    : enterSelectMode()
                }
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  editorMode === "select"
                    ? "border-sky-500/60 bg-sky-500/10 text-sky-500 hover:bg-sky-500/20"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
                title={
                  editorMode === "select"
                    ? "Exit selection mode"
                    : "Select notes to delete, transpose, or copy"
                }
              >
                <BoxSelect className="h-3.5 w-3.5" />
                {editorMode === "select" ? "Done selecting" : "Select"}
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
              {/* Phase 31.5 — Zoom + Focus controls. Small icon-only
                  buttons at the right end of the toolbar. */}
              <div className="ml-2 flex items-center gap-1 rounded-md border border-border bg-background px-1 py-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) =>
                      Math.max(0.5, Math.round((z - 0.1) * 100) / 100),
                    )
                  }
                  disabled={zoom <= 0.5}
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                  title="Zoom out (Cmd/Ctrl+-)"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="min-w-[3rem] rounded px-1.5 py-0.5 font-mono text-muted-foreground hover:text-foreground transition-colors"
                  title="Reset zoom (Cmd/Ctrl+0)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) =>
                      Math.min(2, Math.round((z + 0.1) * 100) / 100),
                    )
                  }
                  disabled={zoom >= 2}
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                  title="Zoom in (Cmd/Ctrl+=)"
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => setFocusMode((v) => !v)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  focusMode
                    ? "border-primary/60 bg-primary/10 text-primary hover:bg-primary/20"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
                title={
                  focusMode
                    ? "Exit focus mode (F)"
                    : "Enter focus mode (F) — hides the top nav"
                }
              >
                {focusMode ? "Exit focus" : "Focus"}
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
          {editorMode === "select" && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-[11px]">
              <span className="font-medium text-sky-500">
                Select mode.
              </span>
              <span className="text-muted-foreground">
                Click a note to select · Shift+click to toggle · drag
                for marquee ·{" "}
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                  Del
                </kbd>{" "}
                delete ·{" "}
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                  ↑↓
                </kbd>{" "}
                transpose (Shift = octave) ·{" "}
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                  Cmd/Ctrl+C
                </kbd>{" "}
                copy ·{" "}
                <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
                  Esc
                </kbd>{" "}
                clear.
              </span>
              <span className="ml-auto rounded-full bg-sky-500/20 px-2 py-0.5 font-mono text-sky-500">
                {selection.size} selected
              </span>
              {clipboardNotes && clipboardNotes.length > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-emerald-500">
                  {clipboardNotes.length} on clipboard
                </span>
              )}
            </div>
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
              {/* Phase 30 — MIDI input toggle + status. Only meaningful
                  in click-entry mode; the caret is what MIDI note-ons
                  land on. */}
              <div className="flex flex-wrap items-center gap-2 border-t border-sky-500/20 pt-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setMidiEnabled((v) => !v)}
                  className={`rounded border px-2 py-0.5 font-mono transition-colors ${
                    midiEnabled
                      ? "border-sky-500/60 bg-sky-500/15 text-sky-500"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                  title="Toggle MIDI keyboard input"
                >
                  MIDI {midiEnabled ? "on" : "off"}
                </button>
                {midiEnabled && (
                  <span
                    className={`text-[10px] ${
                      midiStatus === "connected" && midiDeviceCount > 0
                        ? "text-sky-500"
                        : midiStatus === "denied" ||
                            midiStatus === "unsupported"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {midiStatus === "requesting" && "Requesting access…"}
                    {midiStatus === "connected" && midiDeviceCount === 0 &&
                      "No devices connected — plug in a MIDI keyboard"}
                    {midiStatus === "connected" && midiDeviceCount > 0 &&
                      `${midiDeviceCount} device${midiDeviceCount === 1 ? "" : "s"} — play to place notes at the caret`}
                    {midiStatus === "denied" &&
                      "Access denied — allow MIDI in the browser prompt"}
                    {midiStatus === "unsupported" &&
                      "Not supported in this browser (try Chrome / Edge)"}
                    {midiStatus === "disconnected" && "Disconnected"}
                  </span>
                )}
              </div>
            </div>
          )}
          {/* Phase 24c.2: dropped fixed width override — SheetSurface
              defaults to Letter dimensions (816px) so the editor
              preview matches the printed output 1:1.
              Phase 31.5: `zoom` CSS property scales the whole preview
              proportionally. Overlay children (selection / caret /
              lyric) scale together because they're position: absolute
              inside this wrapper — zoom applies to their coord space
              as well. */}
          <div
            className="relative"
            style={{
              width: 816,
              zoom,
            }}
          >
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
            {/* Phase 31.4 — Selection overlay. Highlights selected
                notes + handles click / shift-click / drag-marquee. */}
            {editorMode === "select" && surfaceLayout && (
              <SelectionOverlay
                positions={surfaceLayout.positions}
                paperHeight={surfaceLayout.paperHeight}
                selection={selection}
                onSelectionChange={setSelection}
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Measure {mIdx + 1}
                    </span>
                    {/* Phase 31.0 — beat-count badge. Shows current /
                        expected beats. Red = overflow, amber = under,
                        hidden = exact match. Helps authors catch bars
                        that don't respect the time signature. */}
                    {(() => {
                      const used = existingBeatsInMeasure(measure);
                      const expected =
                        sheet.timeSignature.beatsPerMeasure;
                      if (used === expected) return null;
                      const isOver = used > expected;
                      const label = `${
                        Number.isInteger(used) ? used : used.toFixed(2)
                      }/${expected}`;
                      return (
                        <span
                          className={`rounded px-1 py-0.5 font-mono text-[9px] font-medium ${
                            isOver
                              ? "bg-destructive/20 text-destructive"
                              : "bg-amber-500/20 text-amber-500"
                          }`}
                          title={
                            isOver
                              ? `Overflow: ${used} beats in a ${expected}-beat measure`
                              : `Under-filled: ${used} of ${expected} beats used`
                          }
                        >
                          {label}
                        </span>
                      );
                    })()}
                  </div>
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
                {/* Phase 28 — Form markings: section label + repeat
                    barlines + volta + mark + instruction. Always-visible
                    compact row. */}
                <div className="flex flex-col gap-1 rounded border border-border/30 bg-background/40 p-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      Form
                    </span>
                    <input
                      type="text"
                      value={measure.sectionLabel ?? ""}
                      onChange={(e) =>
                        updateMeasureForm(mIdx, {
                          sectionLabel: e.target.value || undefined,
                        })
                      }
                      placeholder="Section (A / Verse / …)"
                      className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
                      aria-label={`Section label for measure ${mIdx + 1}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateMeasureForm(mIdx, {
                          repeatStart: !measure.repeatStart,
                        })
                      }
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
                        measure.repeatStart
                          ? "border-primary/60 bg-primary/15 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                      title="Repeat start (𝄆 at this measure)"
                    >
                      𝄆
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateMeasureForm(mIdx, {
                          repeatEnd: !measure.repeatEnd,
                        })
                      }
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
                        measure.repeatEnd
                          ? "border-primary/60 bg-primary/15 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                      title="Repeat end (𝄇 at this measure)"
                    >
                      𝄇
                    </button>
                    <select
                      value={measure.volta ?? ""}
                      onChange={(e) =>
                        updateMeasureForm(mIdx, {
                          volta: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                      className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                      aria-label="Volta (ending bracket)"
                      title="Volta (1st / 2nd ending bracket)"
                    >
                      <option value="">— Volta —</option>
                      <option value="1">1.</option>
                      <option value="2">2.</option>
                    </select>
                    <select
                      value={measure.mark ?? ""}
                      onChange={(e) =>
                        updateMeasureForm(mIdx, {
                          mark: (e.target.value || undefined) as
                            | "coda"
                            | "segno"
                            | undefined,
                        })
                      }
                      className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                      aria-label="Mark"
                      title="Mark symbol (Coda / Segno)"
                    >
                      <option value="">— Mark —</option>
                      <option value="coda">Coda</option>
                      <option value="segno">Segno</option>
                    </select>
                    <select
                      value={measure.instruction ?? ""}
                      onChange={(e) =>
                        updateMeasureForm(mIdx, {
                          instruction: (e.target.value || undefined) as
                            | "dc-al-fine"
                            | "ds-al-coda"
                            | "to-coda"
                            | "fine"
                            | undefined,
                        })
                      }
                      className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                      aria-label="Instruction"
                      title="Instruction text (D.C. al Fine etc.)"
                    >
                      <option value="">— Instruction —</option>
                      <option value="dc-al-fine">D.C. al Fine</option>
                      <option value="ds-al-coda">D.S. al Coda</option>
                      <option value="to-coda">To Coda</option>
                      <option value="fine">Fine</option>
                    </select>
                    {/* Phase 30.3 — Ottava (8va / 8vb). Consecutive
                        same-shift measures render as one dashed
                        bracket. Use when a note range would sit on
                        many ledger lines above (8va) or below (8vb)
                        the staff. */}
                    <select
                      value={measure.octavaShift ?? ""}
                      onChange={(e) =>
                        updateMeasureForm(mIdx, {
                          octavaShift: (e.target.value || undefined) as
                            | "8va"
                            | "8vb"
                            | undefined,
                        })
                      }
                      className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                      aria-label="Ottava"
                      title="Ottava marking — display notes an octave closer to the staff and add a dashed 8va (above) or 8vb (below) bracket"
                    >
                      <option value="">— Ottava —</option>
                      <option value="8va">8va (up)</option>
                      <option value="8vb">8vb (down)</option>
                    </select>
                  </div>
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
  /** Phase 29.1 — how many trailing notes to wrap in a slur group. */
  const [slurCount, setSlurCount] = useState<number>(3);

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
  /**
   * Phase 29.1 — Wrap the last N notes/rests into a fresh slur group.
   * Requires 2+ notes and none of the trailing N to already carry a
   * slurGroup (avoids merging into an existing arc).
   */
  const makeSlurFromLast = (n: number) => {
    setDraft((prev) => {
      if (prev.length < n || n < 2) return prev;
      const groupId = newSlurGroupId();
      const cut = prev.length - n;
      return prev.map((entry, i) =>
        i >= cut ? { ...entry, slurGroup: groupId } : entry,
      );
    });
  };
  /** Remove the slur grouping from a note (and all of its group-mates). */
  const ungroupSlurAt = (idx: number) => {
    setDraft((prev) => {
      const groupId = prev[idx]?.slurGroup;
      if (!groupId) return prev;
      return prev.map((entry) => {
        if (entry.slurGroup !== groupId) return entry;
        const { slurGroup: _drop, ...rest } = entry;
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
  // Phase 29.1 — last-N-or-more notes available to slur?
  const canMakeSlur =
    slurCount >= 2 &&
    draft.length >= slurCount &&
    !draft.slice(-slurCount).some((n) => n.slurGroup);

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
          {/* Phase 29.1 — Slur (last N). Number input picks the run
              length; button wraps the tail-N entries into a fresh
              slur group. */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs">
            <span className="text-muted-foreground">Slur (last</span>
            <input
              type="number"
              min={2}
              max={32}
              value={slurCount}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) setSlurCount(Math.max(2, Math.min(32, n)));
              }}
              className="w-10 rounded border border-border bg-background px-1 text-center text-xs"
              aria-label="Number of trailing notes to slur"
            />
            <span className="text-muted-foreground">)</span>
            <button
              type="button"
              onClick={() => makeSlurFromLast(slurCount)}
              disabled={!canMakeSlur}
              className="ml-1 rounded px-2 py-0.5 font-medium text-sky-500 hover:text-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={`Group the last ${slurCount} notes/rests into a slur arc`}
            >
              Apply
            </button>
          </div>
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
                const isSlur = !!n.slurGroup;
                // Border prefers slur styling (sky) over tuplet
                // (amber) when both apply; both are semantically
                // present but only one visual accent renders.
                const borderClass = isSlur
                  ? "border-sky-400/60 bg-sky-400/10"
                  : isTuplet
                    ? "border-amber-400/60 bg-amber-400/10"
                    : "border-border bg-card";
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-xs font-mono ${borderClass}`}
                  >
                    <span>
                      {n.kind === "rest"
                        ? `R-${MELODY_DURATION_LABELS[n.duration]}`
                        : `${n.pitch.replace("/", "")}-${MELODY_DURATION_LABELS[n.duration]}`}
                      {n.dotted && "."}
                      {hasTie && " ⌣"}
                      {isTuplet && " ³"}
                      {isSlur && " ⌒"}
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
                    {isSlur && (
                      <button
                        type="button"
                        onClick={() => ungroupSlurAt(i)}
                        className="rounded-full px-1 text-[10px] font-medium text-sky-500 hover:text-sky-400 transition-colors"
                        title="Remove this note's slur grouping"
                      >
                        unslur
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
              group.{" "}
              <span className="font-mono">⌒</span> = part of a slur
              (curved phrase arc drawn above the run).
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
