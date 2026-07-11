"use client";

import * as Tone from "tone";
import { metronomeEngine } from "@/lib/audio/metronome";
import { previewPlayer } from "@/lib/audio/preview";
import {
  ARPEGGIO_PATTERNS,
  generateArpeggio,
  getPatternDescription,
  getPatternDisplayName,
  getPatternShortName,
  patternSupportsStartFrom,
  PATTERN_START_FROM_LABELS,
  PATTERN_START_FROM_OPTIONS,
  type ArpeggioPattern,
} from "@/lib/music/arpeggio";
import { useCustomPatternsLibrary } from "@/lib/state/custom-patterns-library";
import { CustomPatternEditor } from "@/components/practice/custom-pattern-editor";
import { notesToDegreeString } from "@/lib/music/custom-patterns";
import {
  CHORD_QUALITIES,
  PITCH_CLASSES,
  PITCH_CLASS_DISPLAY_NAMES,
  QUALITY_DISPLAY_NAMES,
  type Chord,
  type ChordQuality,
  type PitchClass,
} from "@/lib/music/chord";
import {
  CHORD_NOTATION_STYLES,
  NOTATION_STYLE_DISPLAY_NAMES,
  renderChord,
  type ChordNotationStyle,
} from "@/lib/music/render-chord";
import {
  BPM_MAX,
  BPM_MIN,
  COUNT_IN_OPTIONS,
  DEFAULT_PRACTICE_CONFIG,
  DRILL_MAX,
  DRILL_MIN,
  ORDERING_STRATEGIES,
  ORDERING_STRATEGY_DISPLAY_NAMES,
  PATTERN_ORDERINGS,
  PATTERN_ORDERING_DISPLAY_NAMES,
  POOL_MAX,
  RANDOM_ORDERING_STRATEGIES,
  REPS_MAX,
  REPS_MIN,
  TIME_SIGNATURES,
  TRANSITION_MAX,
  TRANSITION_UNIT_OPTIONS,
  type OrderingStrategy,
  type PatternOrdering,
  type PracticeConfig,
  type TransitionUnit,
  usePracticeConfig,
} from "@/lib/state/practice-config";
import { useDrillsLibrary, type Drill } from "@/lib/state/drills-library";
import {
  isShippedDrill,
  SHIPPED_DRILLS,
} from "@/lib/data/shipped-drills";
import { previewPlayChords } from "@/lib/music/sequence";
import {
  isResumable,
  useResumeSession,
} from "@/lib/state/resume-session";
import {
  PATTERN_DISPLAYS,
  PATTERN_DISPLAY_DESCRIPTIONS,
  PATTERN_DISPLAY_LABELS,
  PRACTICE_LAYOUTS,
  PRACTICE_LAYOUT_DESCRIPTIONS,
  PRACTICE_LAYOUT_DISPLAY_NAMES,
  useUserPrefs,
} from "@/lib/state/user-prefs";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  ListChecks,
  Lock,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

/**
 * Practice setup screen. The user configures the drill here, then proceeds
 * to /practice/session to actually play. Configuration is persisted to
 * localStorage so revisits land with the user's last setup ready to go.
 *
 * Multi-chord sequence drilling: the user builds a chord pool, picks an
 * arpeggio pattern that applies to every chord, and the drill cycles
 * through the pool measure by measure. v1 ships "Custom Order" (the
 * order the user arranged the pool); the other 7 strategies from
 * PROJECT-DESIGN.md §4.4 land in the next slice without changing the
 * setup-page shape.
 */
export default function PracticeSetupPage() {
  const router = useRouter();
  const config = usePracticeConfig();
  const {
    addChord,
    removeChordAt,
    setChordRootAt,
    setChordQualityAt,
    replaceChordPool,
    appendChords,
    setBpm,
    setTimeSignature,
    setCountInMeasures,
    setDrillMeasures,
    setRepetitions,
    setRepeatIndefinitely,
    setOrderingStrategy,
    setTransitionUnit,
    setTransitionCount,
    setNotationStyle,
    setArpeggioPattern,
    togglePatternInPool,
    setPatternOrdering,
    setPatternDisplay,
    setPatternStartFrom,
    setLockFirstMeasureToRoot,
    cleanDeadPatternRefs,
    loadConfig,
    loadedDrillId,
    setLoadedDrillId,
  } = config;
  const drillsLib = useDrillsLibrary();
  const practiceLayout = useUserPrefs((s) => s.practiceLayout);
  const setPracticeLayout = useUserPrefs((s) => s.setPracticeLayout);
  // The global default — used as the fallback when the drill's
  // own patternDisplay is null. The picker on the setup screen
  // writes to the per-drill override (setPatternDisplay from
  // the config store, destructured above), NOT here.
  const globalPatternDisplay = useUserPrefs((s) => s.patternDisplay);
  const hasSeenOnboarding = useUserPrefs((s) => s.hasSeenOnboarding);
  const dismissOnboarding = useUserPrefs((s) => s.dismissOnboarding);
  // Custom patterns library (Phase 13). Subscribed so the pattern grid
  // re-renders when patterns are created / renamed / deleted.
  const customPatterns = useCustomPatternsLibrary((s) => s.patterns);
  // Custom-pattern editor modal state. `editingId` is null for the
  // "+ New custom pattern" flow, or the existing pattern's id for edit.
  const [editorState, setEditorState] = useState<{
    open: boolean;
    editingId: string | null;
  }>({ open: false, editingId: null });
  // Sweep dead pattern references whenever the custom-patterns library
  // changes (or on mount). Custom patterns get deleted from the library
  // via the editor's Delete button; without this sweep the patternPool
  // keeps the orphan ID and the setup-screen dropdown shows a
  // "Deleted pattern" entry. The action is idempotent — it bails out
  // when nothing would change, so this effect never loops.
  useEffect(() => {
    const validIds = new Set(customPatterns.map((p) => p.id));
    cleanDeadPatternRefs(validIds);
  }, [customPatterns, cleanDeadPatternRefs]);
  const resume = useResumeSession();
  const resumable = isResumable(resume.active);
  const handleResumeClick = async () => {
    if (!resume.active) return;
    try {
      await Tone.start();
    } catch {
      // Silent — Start button in the session will retry the unlock.
    }
    loadConfig(resume.active.config);
    setLoadedDrillId(resume.active.loadedDrillId);
    router.push("/practice/session?resume=1");
  };
  // Quick Start surfaces two distinct lists, in their own sections:
  //   "Your drills" — the user's saved drills, sorted most-recently-launched
  //                   first. Always-open section; carries an empty state.
  //   "Built-in drills" — the shipped library in seed order. Collapsible
  //                       and collapsed by default to keep the repeat-user
  //                       surface compact; one click expands.
  const userDrills = useMemo(
    () =>
      [...drillsLib.drills].sort(
        (a, b) => (b.lastLoadedAt ?? 0) - (a.lastLoadedAt ?? 0),
      ),
    [drillsLib.drills],
  );
  // Editing lookup considers both lists — a shipped drill can be opened
  // for edit (the pencil), but its Save changes is locked; only Save as
  // new is offered. See the editing badge below.
  const editingDrill = useMemo(() => {
    if (!loadedDrillId) return null;
    return (
      drillsLib.drills.find((d) => d.id === loadedDrillId) ??
      SHIPPED_DRILLS.find((d) => d.id === loadedDrillId) ??
      null
    );
  }, [loadedDrillId, drillsLib.drills]);
  const isEditingShipped = !!editingDrill && isShippedDrill(editingDrill.id);
  // Has the live config diverged from the saved drill's config? Drives
  // the "Discard changes" affordance and the Save changes button state.
  //
  // Both sides go through extractPracticeConfig so:
  //   (a) key order is identical (insertion order from the same code path)
  //   (b) UI-state fields like loadedDrillId that may have leaked into
  //       older saved drills get stripped on both sides
  //   (c) drills saved under older schemas fall back to defaults for
  //       newly-added fields — not "dirty" from the schema change alone
  const isDirty = useMemo(() => {
    if (!editingDrill) return false;
    const live = JSON.stringify(extractPracticeConfig(config));
    const saved = JSON.stringify(extractPracticeConfig(editingDrill.config));
    return live !== saved;
  }, [editingDrill, config]);

  // Quick-build wizard state. Sets aren't directly reactive in
  // React, so each toggle creates a fresh Set.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedRoots, setSelectedRoots] = useState<Set<PitchClass>>(
    () => new Set(),
  );
  const [selectedQualities, setSelectedQualities] = useState<
    Set<ChordQuality>
  >(() => new Set());

  const toggleRoot = (root: PitchClass) =>
    setSelectedRoots((prev) => {
      const next = new Set(prev);
      if (next.has(root)) next.delete(root);
      else next.add(root);
      return next;
    });
  const toggleQuality = (quality: ChordQuality) =>
    setSelectedQualities((prev) => {
      const next = new Set(prev);
      if (next.has(quality)) next.delete(quality);
      else next.add(quality);
      return next;
    });

  const wizardChords: Chord[] = useMemo(() => {
    const chords: Chord[] = [];
    for (const root of PITCH_CLASSES) {
      if (!selectedRoots.has(root)) continue;
      for (const quality of CHORD_QUALITIES) {
        if (!selectedQualities.has(quality)) continue;
        chords.push({ root, quality });
      }
    }
    return chords;
  }, [selectedRoots, selectedQualities]);

  // Gate render until after mount so persisted-store hydration doesn't
  // diff against SSR's default values. The setState-in-effect pattern is
  // canonical for this case; the alternative (useSyncExternalStore against
  // persist middleware) adds complexity without changing behavior.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Stop any in-flight preview when the user navigates away.
  useEffect(() => {
    return () => previewPlayer.cancel();
  }, []);

  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewIdRef = useRef(0);

  // Tap-tempo state. Each tap timestamps Date.now(); after 2+ taps we
  // compute BPM from the average interval. A pause of >2s resets the
  // buffer so a long delay doesn't pollute the running average.
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  // Inactivity reset — clears the tap buffer after 2.5s of no taps so
  // the next tap starts a fresh session. Cleared on every tap.
  const tapResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (tapResetTimerRef.current) clearTimeout(tapResetTimerRef.current);
    };
  }, []);

  const handleTapTempo = () => {
    const now = Date.now();
    setTapTimes((prev) => {
      // Reset if the previous tap was too long ago (drift / new session).
      const fresh =
        prev.length > 0 && now - prev[prev.length - 1] > 2000 ? [] : prev;
      // Keep the last 8 taps — long enough to smooth the running average,
      // short enough that tempo changes mid-tapping converge quickly.
      const next = [...fresh, now].slice(-8);
      if (next.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < next.length; i++) {
          intervals.push(next[i] - next[i - 1]);
        }
        const avgMs =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const bpm = Math.round(60000 / avgMs);
        // setBpm itself clamps to [BPM_MIN, BPM_MAX].
        setBpm(bpm);
      }
      return next;
    });
    // (Re)arm the inactivity reset.
    if (tapResetTimerRef.current) clearTimeout(tapResetTimerRef.current);
    tapResetTimerRef.current = setTimeout(() => setTapTimes([]), 2500);
  };

  const handleHalveTempo = () => setBpm(Math.round(config.bpm / 2));
  const handleDoubleTempo = () => setBpm(config.bpm * 2);

  // Test sound — plays one metronome click so the user can verify
  // audio is wired up before they commit to a drill. Useful for
  // testers whose browser hasn't yet been gestured (some older Safari
  // versions and locked-down enterprise installs can fail silently).
  const [audioTestedAt, setAudioTestedAt] = useState<number | null>(null);
  const handleTestSound = async () => {
    try {
      await metronomeEngine.playTestClick();
      setAudioTestedAt(Date.now());
      setTimeout(() => setAudioTestedAt(null), 2500);
    } catch {
      // Swallow — if the unlock fails the user has bigger problems
      // than the metronome (browser audio is fully blocked).
    }
  };

  // Save-as-drill inline form state.
  const [isSavingDrill, setIsSavingDrill] = useState(false);
  const [saveDrillName, setSaveDrillName] = useState("");
  const [saveDrillNotes, setSaveDrillNotes] = useState("");

  // Controlled-open state for the Chord pool section, so a click on a
  // chip in the Sequence preview can force it open before scrolling.
  const [chordPoolOpen, setChordPoolOpen] = useState(false);
  // Hide the Sequence-preview chord chips by default — matches the
  // "all panes closed by default" treatment used by the
  // CollapsibleSection components. Users with small pools can toggle
  // them back on; users with huge pools never have to wait for a
  // 48-chord chip wall to render before they can scroll to the
  // controls below. Not persisted (per session).
  const [chipsVisible, setChipsVisible] = useState(false);
  const poolRowRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Drag-to-reorder (chord pool, Custom order only). PointerSensor for
  // mouse/touch; KeyboardSensor for Space-to-pick-up + Arrow-to-move
  // accessibility.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = config.chordPoolIds.indexOf(active.id as string);
    const toIndex = config.chordPoolIds.indexOf(over.id as string);
    if (fromIndex < 0 || toIndex < 0) return;
    config.moveChord(fromIndex, toIndex);
  };

  // Stable memoized items array for SortableContext — dnd-kit re-runs
  // some internal setup when the reference changes; memoizing keeps
  // the drop animation crisp.
  const sortableItems = useMemo(
    () => config.chordPoolIds,
    [config.chordPoolIds],
  );

  /** Snapshot of the live PracticeConfig (no loadedDrillId, no setters). */
  const snapshotConfig = (): PracticeConfig =>
    extractPracticeConfig(config);

  const handleSaveDrill = () => {
    const name = saveDrillName.trim();
    if (!name) return;
    const id = drillsLib.saveDrill(
      name,
      snapshotConfig(),
      saveDrillNotes,
    );
    setSaveDrillName("");
    setSaveDrillNotes("");
    setIsSavingDrill(false);
    // The new drill becomes the one being edited so subsequent Save
    // changes / Save as new chains work intuitively.
    setLoadedDrillId(id);
  };

  /** Reset live config to the saved drill's state (does not touch name/notes). */
  const handleDiscardChanges = () => {
    if (!editingDrill) return;
    loadConfig(editingDrill.config);
  };

  // Brief "Saved" confirmation that survives the dirty→clean transition
  // so the user gets feedback that the click actually did something.
  const [justSavedAt, setJustSavedAt] = useState<number | null>(null);

  /** Overwrite the currently-edited Drill with the current config. */
  const handleSaveChanges = () => {
    if (!editingDrill) return;
    drillsLib.updateDrillConfig(editingDrill.id, snapshotConfig());
    setJustSavedAt(Date.now());
    setTimeout(() => setJustSavedAt(null), 1500);
  };

  const handleEditDrill = (drill: Drill) => {
    loadConfig(drill.config);
    setLoadedDrillId(drill.id);
    // Scroll to top so the user sees the editing badge.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleDoneEditing = () => setLoadedDrillId(null);

  const handleLoadDrill = async (drill: Drill) => {
    // Unlock audio context while still inside the click gesture so the
    // session page's autostart can play immediately. Browsers gate
    // audio to user gestures; without this, a Quick Start launch from
    // a fresh tab would land on the drill page muted until the user
    // pressed Start manually.
    try {
      await Tone.start();
    } catch {
      // Silent — if the unlock fails, the user just has to hit Start manually.
    }
    loadConfig(drill.config);
    // Launching is launching — it deliberately does NOT enter edit
    // mode. Otherwise pressing Done editing then launching the same
    // drill would reopen the editing badge on return to setup, which
    // surprises the user. Edit mode is only entered via the explicit
    // pencil on the card.
    //
    // Built-in drills aren't in the library store, so markDrillLoaded
    // would be a no-op — skip the unnecessary set call.
    if (!isShippedDrill(drill.id)) {
      drillsLib.markDrillLoaded(drill.id);
    }
    router.push("/practice/session?autostart=1");
  };

  /** Open Chord pool + scroll the chosen row into view + focus its root select. */
  const handleSequenceChipClick = (index: number) => {
    setChordPoolOpen(true);
    // setTimeout lets the section finish expanding before we scroll
    // (the row may have been display:none-equivalent inside the
    // collapsed body when we issued the click).
    setTimeout(() => {
      const el = poolRowRefs.current[index];
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const select = el.querySelector("select");
      if (select) (select as HTMLSelectElement).focus();
    }, 60);
  };

  const firstChord = config.chordPool[0];

  const handlePreview = async () => {
    if (isPreviewing) {
      previewPlayer.cancel();
      setIsPreviewing(false);
      return;
    }
    if (!firstChord) return;
    const myId = ++previewIdRef.current;
    setIsPreviewing(true);
    const notes = generateArpeggio(firstChord, config.arpeggioPattern);
    await previewPlayer.playArpeggio(notes, config.bpm);
    const totalMs = (notes.length * (60 / config.bpm) + 0.4) * 1000;
    setTimeout(() => {
      if (previewIdRef.current === myId) setIsPreviewing(false);
    }, totalMs);
  };

  const renderedChords = useMemo(
    () =>
      config.chordPool.map((chord) =>
        renderChord(chord, config.notationStyle),
      ),
    [config.chordPool, config.notationStyle],
  );

  const timeSignatureValue = `${config.timeSignature.beatsPerMeasure}/${config.timeSignature.beatUnit}`;

  const handleTimeSignatureChange = (value: string) => {
    const [beatsPerMeasure, beatUnit] = value.split("/").map(Number);
    const match = TIME_SIGNATURES.find(
      (ts) =>
        ts.beatsPerMeasure === beatsPerMeasure && ts.beatUnit === beatUnit,
    );
    if (match) setTimeSignature(match);
  };

  const handleStart = () => {
    router.push("/practice/session");
  };

  if (!mounted) {
    return (
      <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Loading setup…
        </div>
      </main>
    );
  }

  const poolSize = config.chordPool.length;
  const isLongForm = config.notationStyle === "long-form";

  // Pre-flight preview — first 4 play chords the user will hear with
  // the current ordering applied. For deterministic strategies this is
  // exact; for random it's a freshly-rolled sample (re-rolls on every
  // config change), with a caption that says actual order will vary.
  // Lets the user catch "I configured this wrong" before pressing Start.
  const previewChords =
    poolSize === 0
      ? []
      : previewPlayChords(
          {
            pool: config.chordPool,
            orderingStrategy: config.orderingStrategy,
            drillMeasures: config.drillMeasures,
            repetitions: config.repetitions,
            repeatIndefinitely: config.repeatIndefinitely,
            timeSignature: config.timeSignature,
            transitionUnit: config.transitionUnit,
            transitionCount: config.transitionCount,
          },
          4,
        );
  const isRandomStrategy = RANDOM_ORDERING_STRATEGIES.has(
    config.orderingStrategy,
  );
  const renderedPreviewChords = previewChords.map((chord) =>
    renderChord(chord, config.notationStyle),
  );
  const totalPlayChords = config.repeatIndefinitely
    ? Infinity
    : config.drillMeasures * config.repetitions;
  const previewHasMore = totalPlayChords > previewChords.length;

  // One-line summaries surfaced in the collapsed section headers so the
  // user always sees the current value without expanding.
  const chordPoolSummary = `${poolSize} chord${poolSize === 1 ? "" : "s"} · ${
    ORDERING_STRATEGY_DISPLAY_NAMES[config.orderingStrategy]
  }`;
  const patternPoolCount = config.patternPool.length;
  const startFromSuffix =
    config.patternStartFrom !== "root"
      ? ` · from ${config.patternStartFrom}`
      : "";
  const patternSummary =
    patternPoolCount <= 1
      ? `${getPatternShortName(config.arpeggioPattern)}${startFromSuffix}`
      : `${patternPoolCount} patterns · ${getPatternShortName(config.arpeggioPattern)}+${startFromSuffix}`;
  const tempoMeterSummary = `♩ = ${config.bpm} · ${config.timeSignature.beatsPerMeasure}/${config.timeSignature.beatUnit}`;
  const prepSummary =
    config.transitionCount > 0
      ? ` · prep ${config.transitionCount} ${config.transitionUnit === "measures" ? (config.transitionCount === 1 ? "measure" : "measures") : config.transitionCount === 1 ? "beat" : "beats"}`
      : "";
  const sessionSummary = config.repeatIndefinitely
    ? `${config.drillMeasures} measures / rep · Loop ∞${prepSummary}`
    : `${config.drillMeasures} × ${config.repetitions} = ${
        config.drillMeasures * config.repetitions
      } measures${prepSummary}`;

  return (
    <main id="main-content" className="flex flex-1 flex-col">
      {/* Page sub-header. The brand link + module switcher live in the
          persistent shell above; this just labels the current surface. */}
      <header className="flex items-center justify-end border-b border-border px-6 py-2">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Setup
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="flex w-full max-w-3xl flex-col gap-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Configure your drill
            </h1>
            <p className="text-sm text-muted-foreground">
              Build a chord pool, pick a pattern, set tempo and meter. The
              drill cycles through the pool one chord per measure. Save
              your setup as a drill for one-click access next time.
            </p>
          </div>

          {/* Resume banner — surfaces when a previous in-flight session
              was interrupted (browser crash, tab close, sleep) and the
              snapshot is still recent (<10 min). One click resumes
              from the exact same chord at the exact same beat; Dismiss
              clears the snapshot. Sits above the editing badge as the
              top-priority recovery action. */}
          {resumable && resume.active && (
            <div className="flex flex-col gap-3 rounded-md border border-primary/40 bg-primary/10 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-primary">
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  Resume last session
                </div>
                <div className="flex flex-wrap shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={handleResumeClick}
                    className="rounded-md border border-primary/50 bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 transition-colors"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => resume.clear()}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {resume.active.drillName ? (
                  <>
                    Pick up{" "}
                    <span className="font-medium text-primary">
                      {resume.active.drillName}
                    </span>{" "}
                    at measure{" "}
                    <span className="font-mono tabular-nums">
                      {resume.active.measureNumber}
                    </span>
                    {resume.active.totalMeasures !== null && (
                      <>
                        {" "}
                        of{" "}
                        <span className="font-mono tabular-nums">
                          {resume.active.totalMeasures}
                        </span>
                      </>
                    )}
                    .
                  </>
                ) : (
                  <>
                    Pick up your last session at measure{" "}
                    <span className="font-mono tabular-nums">
                      {resume.active.measureNumber}
                    </span>
                    {resume.active.totalMeasures !== null && (
                      <>
                        {" "}
                        of{" "}
                        <span className="font-mono tabular-nums">
                          {resume.active.totalMeasures}
                        </span>
                      </>
                    )}
                    .
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Same chord, same beat — no count-in, just continues
                from where you left off.
              </p>
            </div>
          )}

          {/* Editing badge — two flavors:
                User drill: name and notes are always-editable inline,
                  saved on blur. `key`d to the drill id so switching
                  drills mid-edit cleanly resets the uncontrolled inputs.
                Shipped drill: name and notes are read-only (you can't
                  modify the built-in). Save changes is unavailable;
                  Save as new drill is the only commit path. */}
          {editingDrill && !isEditingShipped && (
            <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-xs uppercase tracking-wider text-primary">
                  Editing drill
                </span>
                <div className="flex flex-wrap shrink-0 gap-2">
                  {isDirty && (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 transition-colors"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={handleDiscardChanges}
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-destructive/50 transition-colors"
                      >
                        Discard changes
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleDoneEditing}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Done editing
                  </button>
                </div>
              </div>
              <input
                key={`${editingDrill.id}-name`}
                type="text"
                defaultValue={editingDrill.name}
                onBlur={(e) =>
                  drillsLib.updateDrillMeta(editingDrill.id, {
                    name: e.target.value,
                  })
                }
                placeholder="Drill name"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
              />
              <textarea
                key={`${editingDrill.id}-notes`}
                defaultValue={editingDrill.notes ?? ""}
                onBlur={(e) =>
                  drillsLib.updateDrillMeta(editingDrill.id, {
                    notes: e.target.value.slice(0, 300),
                  })
                }
                placeholder="Add notes (optional) — e.g. Slow at 60. Focus on left-hand timing."
                rows={2}
                className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:border-primary focus:outline-none focus:text-foreground"
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Edit chords, pattern, tempo, and session in the sections
                below — they all apply to this drill. Click{" "}
                <span className="font-medium text-foreground">
                  Save changes
                </span>{" "}
                to commit them.
              </p>
            </div>
          )}
          {editingDrill && isEditingShipped && (
            <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-primary">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Editing built-in drill
                </span>
                <button
                  type="button"
                  onClick={handleDoneEditing}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Done editing
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">
                  {editingDrill.name}
                </span>
                {editingDrill.notes && (
                  <span className="text-xs italic text-muted-foreground leading-relaxed">
                    {editingDrill.notes}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Built-in drills can&rsquo;t be modified directly. Tweak
                anything in the sections below, then use{" "}
                <span className="font-medium text-foreground">
                  Save as new drill
                </span>{" "}
                to keep your customized copy.
              </p>
            </div>
          )}

          {/* First-visit onboarding hint (Phase 17). Dismissible
              welcome card that surfaces only until the user clicks
              "Got it" — then sticks dismissed in user-prefs. Frames
              the three high-leverage starting points so a first-time
              tester knows what to try without having to discover the
              app surface-by-surface. */}
          {!hasSeenOnboarding && (
            <div className="relative rounded-lg border border-primary/40 bg-primary/5 px-5 py-4">
              <button
                type="button"
                onClick={() => dismissOnboarding()}
                className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Dismiss welcome message"
              >
                <X className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-semibold text-primary pr-8">
                Welcome to Practice Prodigy
              </h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Three quick things to try:
              </p>
              <ol className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-mono text-primary shrink-0">1.</span>
                  <span>
                    <span className="font-medium text-foreground">
                      Tap a Built-in drill below
                    </span>{" "}
                    to launch a ready-made arpeggio session.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-primary shrink-0">2.</span>
                  <span>
                    In the{" "}
                    <span className="font-medium text-foreground">
                      Pattern
                    </span>{" "}
                    section, hit{" "}
                    <span className="font-medium text-foreground">
                      + New custom pattern
                    </span>{" "}
                    to author your own arpeggio shape.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-primary shrink-0">3.</span>
                  <span>
                    Try{" "}
                    <span className="font-medium text-foreground">
                      Start from: Random
                    </span>{" "}
                    for an expert-mode inversion drill that re-rolls
                    every measure.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => dismissOnboarding()}
                className="mt-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                Got it
              </button>
            </div>
          )}

          {/* Your drills + Your patterns — the two user-owned libraries,
              paired at the top so "everything I've saved" reads as one
              block. Built-in drills tuck into a collapsible below. */}
          <FormSection
            title="Your drills"
            subtitle="Your saved sessions — click a card to launch, pencil to edit."
          >
            {userDrills.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background/30 px-4 py-6 text-center text-sm text-muted-foreground leading-relaxed">
                No saved drills yet. Configure one below and click{" "}
                <span className="font-medium text-foreground">
                  Save as drill
                </span>{" "}
                to add it here — or expand the{" "}
                <span className="font-medium text-foreground">
                  Built-in drills
                </span>{" "}
                library below to launch one of the 10 drills that ship
                with Practice Prodigy.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {userDrills.map((drill) => (
                  <DrillCard
                    key={drill.id}
                    drill={drill}
                    isEditing={drill.id === loadedDrillId}
                    isShipped={false}
                    onLaunch={handleLoadDrill}
                    onEdit={handleEditDrill}
                    onDelete={drillsLib.deleteDrill}
                  />
                ))}
              </div>
            )}
          </FormSection>

          {/* Your patterns — pairs visually with Your drills above so
              the two user-owned libraries sit together as one "my
              stuff" block. Phase 19 reordered this from below
              Built-in drills to here. */}
          <section
            id="your-patterns"
            className="flex flex-col gap-4 scroll-mt-20"
          >
            <div className="flex flex-col gap-1">
              <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Your patterns
                {customPatterns.length > 0 && (
                  <span className="ml-1.5 text-muted-foreground/70 font-normal normal-case tracking-normal">
                    · {customPatterns.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                Your toolkit. Author custom arpeggio shapes here — they
                become available as checkboxes in any drill&rsquo;s
                pattern setup below.
              </p>
            </div>
            {customPatterns.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-background/30 px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No custom patterns yet. Author your own arpeggio
                  shape — pick the intervals, set durations, even add
                  rests.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setEditorState({ open: true, editingId: null })
                  }
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  New custom pattern
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {customPatterns.map((cp) => {
                  const degreeStr = notesToDegreeString(cp.notes);
                  return (
                    <div
                      key={cp.id}
                      className="group relative rounded-xl border border-border bg-card/40 px-4 py-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex flex-col gap-1 pr-16">
                        <span className="text-sm font-medium text-foreground truncate">
                          {cp.name}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground truncate">
                          {degreeStr}
                        </span>
                        <span className="text-[11px] text-muted-foreground/70">
                          {cp.notes.length} note
                          {cp.notes.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="absolute right-2 top-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditorState({
                              open: true,
                              editingId: cp.id,
                            })
                          }
                          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          aria-label={`Edit ${cp.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setEditorState({ open: true, editingId: null })
                  }
                  className="group flex min-h-[5.5rem] items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/30 px-4 py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors"
                  aria-label="Create a new custom pattern"
                >
                  <Plus className="h-4 w-4 transition-transform group-hover:scale-110" />
                  New custom pattern
                </button>
              </div>
            )}
          </section>

          <CollapsibleSection
            title="Built-in drills"
            summary={`${SHIPPED_DRILLS.length} ready to launch · jazz · blues · pop · rock`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SHIPPED_DRILLS.map((drill) => (
                <DrillCard
                  key={drill.id}
                  drill={drill}
                  isEditing={drill.id === loadedDrillId}
                  isShipped={true}
                  onLaunch={handleLoadDrill}
                  onEdit={handleEditDrill}
                  onDelete={drillsLib.deleteDrill}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Built-in drills ship with Practice Prodigy and can&rsquo;t
              be deleted. Open one with the pencil to tweak it — the only
              save path is{" "}
              <span className="font-medium text-foreground">
                Save as new drill
              </span>
              , so your customized copy lives in{" "}
              <span className="font-medium text-foreground">
                Your drills
              </span>{" "}
              above.
            </p>
          </CollapsibleSection>

          {/* Sequence preview. Header is a clickable toggle (with
              chevron) so users can see at a glance that the chips
              expand/collapse — same affordance pattern as the
              CollapsibleSection components below. The "Clear pool"
              control sits separately to its right so it never
              accidentally triggers the collapse on a stray click. */}
          <section
            className={`flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card/40 px-6 py-4 ${
              chipsVisible ? "min-h-72" : ""
            }`}
          >
            <div className="flex w-full items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <button
                type="button"
                onClick={() => setChipsVisible((v) => !v)}
                aria-expanded={chipsVisible}
                aria-controls="sequence-chips"
                className="flex items-center gap-2 rounded-sm px-1 py-0.5 hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                    chipsVisible ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
                <span>
                  Sequence · {poolSize} chord{poolSize === 1 ? "" : "s"}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  ({chipsVisible ? "click to hide" : "click to show"})
                </span>
              </button>
              {poolSize > 1 && (
                <button
                  type="button"
                  onClick={() => replaceChordPool([])}
                  className="rounded-sm border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-destructive/50 transition-colors"
                >
                  Clear pool
                </button>
              )}
            </div>
            {chipsVisible && (
              <div
                id="sequence-chips"
                className="flex flex-wrap items-center justify-center gap-2"
                aria-live="polite"
              >
                {renderedChords.map((label, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-2 rounded-md border border-border/50 bg-background/40 py-1.5 pl-1.5 pr-1.5 font-mono font-semibold text-foreground leading-none tracking-tight ${chipTextClass(
                      poolSize,
                      isLongForm,
                    )}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSequenceChipClick(i)}
                      aria-label={`Edit ${label} in chord pool`}
                      className="rounded-sm px-1.5 hover:text-primary transition-colors"
                    >
                      {label}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeChordAt(i)}
                      disabled={poolSize <= 1}
                      aria-label={`Remove ${label} from pool`}
                      className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/60 hover:bg-border/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <label
                htmlFor="notation-style"
                className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
              >
                Notation
              </label>
              <select
                id="notation-style"
                value={config.notationStyle}
                onChange={(e) =>
                  setNotationStyle(e.target.value as ChordNotationStyle)
                }
                className="rounded-md border border-border bg-background px-3 py-1 text-xs focus:border-primary focus:outline-none"
              >
                {CHORD_NOTATION_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {NOTATION_STYLE_DISPLAY_NAMES[style]}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Chord pool builder */}
          <CollapsibleSection
            title="Chord pool"
            summary={chordPoolSummary}
            open={chordPoolOpen}
            onOpenChange={setChordPoolOpen}
          >
            <div className="flex flex-col gap-3">
              {/* Quick-build wizard — collapsible, closed by default */}
              <div className="rounded-md border border-border bg-background/30">
                <button
                  type="button"
                  onClick={() => setWizardOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-background/60 transition-colors"
                  aria-expanded={wizardOpen}
                  aria-controls="quick-build-panel"
                >
                  <span className="flex items-center gap-2">
                    <ListChecks
                      className="h-4 w-4 text-primary"
                      aria-hidden="true"
                    />
                    Quick build — pick roots × qualities
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      wizardOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {wizardOpen && (
                  <div
                    id="quick-build-panel"
                    className="flex flex-col gap-5 border-t border-border px-4 py-4"
                  >
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {/* Roots column */}
                      <WizardColumn
                        title="Roots"
                        presets={[
                          {
                            label: "All",
                            onClick: () =>
                              setSelectedRoots(new Set(PITCH_CLASSES)),
                          },
                          {
                            label: "Naturals",
                            onClick: () =>
                              setSelectedRoots(
                                new Set(WIZARD_ROOTS_NATURALS),
                              ),
                          },
                          {
                            label: "None",
                            onClick: () => setSelectedRoots(new Set()),
                          },
                        ]}
                      >
                        <div className="grid grid-cols-2 gap-1">
                          {PITCH_CLASSES.map((root) => (
                            <WizardCheckbox
                              key={root}
                              label={PITCH_CLASS_DISPLAY_NAMES[root]}
                              checked={selectedRoots.has(root)}
                              onChange={() => toggleRoot(root)}
                            />
                          ))}
                        </div>
                      </WizardColumn>

                      {/* Qualities column */}
                      <WizardColumn
                        title="Qualities"
                        presets={[
                          {
                            label: "All",
                            onClick: () =>
                              setSelectedQualities(
                                new Set(CHORD_QUALITIES),
                              ),
                          },
                          {
                            label: "Common 7ths",
                            onClick: () =>
                              setSelectedQualities(
                                new Set(WIZARD_QUALITIES_COMMON),
                              ),
                          },
                          {
                            label: "Triads",
                            onClick: () =>
                              setSelectedQualities(
                                new Set(WIZARD_QUALITIES_TRIADS),
                              ),
                          },
                          {
                            label: "None",
                            onClick: () => setSelectedQualities(new Set()),
                          },
                        ]}
                      >
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          {CHORD_QUALITIES.map((q) => (
                            <WizardCheckbox
                              key={q}
                              label={QUALITY_DISPLAY_NAMES[q]}
                              checked={selectedQualities.has(q)}
                              onChange={() => toggleQuality(q)}
                            />
                          ))}
                        </div>
                      </WizardColumn>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground">
                        {wizardChords.length === 0 ? (
                          <>Pick at least one root and one quality.</>
                        ) : (
                          <>
                            Will produce{" "}
                            <span className="font-mono text-foreground tabular-nums">
                              {wizardChords.length}
                            </span>{" "}
                            chord
                            {wizardChords.length === 1 ? "" : "s"} (
                            {selectedRoots.size} root
                            {selectedRoots.size === 1 ? "" : "s"} ×{" "}
                            {selectedQualities.size} qualit
                            {selectedQualities.size === 1 ? "y" : "ies"})
                            {wizardChords.length > POOL_MAX &&
                              ` — capped at ${POOL_MAX}.`}
                          </>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            appendChords(wizardChords);
                            setWizardOpen(false);
                          }}
                          disabled={wizardChords.length === 0}
                          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Add to pool
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            replaceChordPool(wizardChords);
                            setWizardOpen(false);
                          }}
                          disabled={wizardChords.length === 0}
                          className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Replace pool
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Scrollable pool list — keeps a 48-chord wizard pool from
                  pushing Pattern / Tempo / Session off the screen. The
                  drag handle column only does anything when ordering is
                  Custom (other strategies derive play order from the
                  pool — manual reordering is meaningless). */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortableItems}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex max-h-96 flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
                    {config.chordPool.map((chord, index) => {
                      const slotId =
                        config.chordPoolIds[index] ?? `legacy-${index}`;
                      return (
                        <SortableChordRow
                          key={slotId}
                          id={slotId}
                          chord={chord}
                          index={index}
                          canDrag={config.orderingStrategy === "custom"}
                          poolSize={poolSize}
                          onRootChange={(root) =>
                            setChordRootAt(index, root)
                          }
                          onQualityChange={(q) =>
                            setChordQualityAt(index, q)
                          }
                          onRemove={() => removeChordAt(index)}
                          rowRef={(el) => {
                            poolRowRefs.current[index] = el;
                          }}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
              <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  onClick={() => addChord()}
                  disabled={poolSize >= POOL_MAX}
                  className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add chord
                </button>
                <button
                  type="button"
                  onClick={() => replaceChordPool([])}
                  disabled={poolSize <= 1}
                  aria-label="Clear pool (reset to one default chord)"
                  className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-destructive/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Clear pool
                </button>
              </div>
              <div className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-3">
                <label
                  htmlFor="ordering-strategy"
                  className="text-sm font-medium text-foreground"
                >
                  Order
                </label>
                <Select
                  id="ordering-strategy"
                  value={config.orderingStrategy}
                  onChange={(e) =>
                    setOrderingStrategy(e.target.value as OrderingStrategy)
                  }
                >
                  {ORDERING_STRATEGIES.map((s) => (
                    <option key={s} value={s}>
                      {ORDERING_STRATEGY_DISPLAY_NAMES[s]}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {orderingDescription(config.orderingStrategy, poolSize, config.drillMeasures)}
                </p>
              </div>
            </div>
          </CollapsibleSection>

          {/* Arpeggio pattern */}
          <CollapsibleSection title="Drill patterns" summary={patternSummary}>
            <div className="flex flex-col gap-4">
              {/* Section lead-in (Phase 19). Clarifies scope so the
                  user knows this is per-drill, not the global library
                  (which lives in Your patterns at the top of the
                  page). */}
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                Pick which patterns this drill uses, in what order, and
                which inversion. Edits here only affect the current
                drill — to author or rename a custom pattern, head up to{" "}
                <a
                  href="#your-patterns"
                  className="font-medium text-primary hover:underline"
                >
                  Your patterns
                </a>
                .
              </p>
              {/* Multi-select pattern pool. Grouped into three labeled
                  sections so the now-4 built-ins + customs read as one
                  organized surface instead of a single long grid:
                    1. Ascending  (root-up shapes)
                    2. Descending (top-down shapes)
                    3. Custom     (user patterns + the "+ New" tile)
                  All tiles share `min-h-[5.5rem]` so the sections line
                  up across rows. Pulled into a reusable
                  `renderBuiltInTile` so the two built-in sections stay
                  in lockstep without duplication. */}
              {(() => {
                const renderBuiltInTile = (p: ArpeggioPattern) => {
                  const inPool = config.patternPool.includes(p);
                  const isOnlyPattern =
                    inPool && config.patternPool.length === 1;
                  return (
                    <label
                      key={p}
                      className={`flex min-h-[5.5rem] items-start gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                        inPool
                          ? "border-primary/40 bg-primary/10"
                          : "border-border bg-background hover:border-primary/40"
                      } ${
                        isOnlyPattern ? "cursor-not-allowed" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={inPool}
                        disabled={isOnlyPattern}
                        onChange={() => togglePatternInPool(p)}
                        className="mt-0.5 h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                        aria-label={`Toggle ${getPatternDisplayName(p)} in pool`}
                      />
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span
                          className={`text-sm font-medium ${
                            inPool ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {getPatternShortName(p)}
                          {config.patternStartFrom !== "root" && (
                            <span className="ml-1.5 inline-block rounded-full bg-primary/20 px-1.5 py-0 text-[9px] uppercase tracking-wider font-mono text-primary align-middle">
                              from {config.patternStartFrom}
                            </span>
                          )}
                        </span>
                        <span
                          className="text-[11px] text-muted-foreground leading-snug"
                          title={getPatternDescription(p)}
                        >
                          {getPatternDescription(p)}
                        </span>
                      </div>
                    </label>
                  );
                };
                const ascending = ARPEGGIO_PATTERNS.filter(
                  (p) => !p.endsWith("-desc"),
                );
                const descending = ARPEGGIO_PATTERNS.filter((p) =>
                  p.endsWith("-desc"),
                );
                return (
                  <div className="flex flex-col gap-4">
                    <section className="flex flex-col gap-2">
                      <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Ascending
                      </h4>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {ascending.map(renderBuiltInTile)}
                      </div>
                    </section>
                    <section className="flex flex-col gap-2">
                      <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Descending
                      </h4>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {descending.map(renderBuiltInTile)}
                      </div>
                    </section>
                    {/* Custom sub-row (Phase 18): config-only.
                        Library management — create / edit / delete —
                        lives in the "Your patterns" section at the
                        top of the page. This row only surfaces the
                        existing custom patterns as ticking checkboxes
                        so the user can add them to the current drill's
                        pool. */}
                    <section className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Custom{" "}
                          {customPatterns.length > 0 && (
                            <span className="text-muted-foreground/70 font-normal normal-case tracking-normal">
                              · {customPatterns.length}
                            </span>
                          )}
                        </h4>
                        <a
                          href="#your-patterns"
                          className="text-[10px] uppercase tracking-wider text-muted-foreground/70 hover:text-primary transition-colors"
                        >
                          Manage patterns ↑
                        </a>
                      </div>
                      {customPatterns.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                          No custom patterns yet. Create one in{" "}
                          <a
                            href="#your-patterns"
                            className="font-medium text-primary hover:underline"
                          >
                            Your patterns
                          </a>{" "}
                          above to add to this pool.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {customPatterns.map((cp) => {
                            const inPool = config.patternPool.includes(
                              cp.id,
                            );
                            const isOnlyPattern =
                              inPool && config.patternPool.length === 1;
                            const degreeStr = notesToDegreeString(cp.notes);
                            return (
                              <label
                                key={cp.id}
                                className={`flex min-h-[5.5rem] items-start gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                                  inPool
                                    ? "border-primary/40 bg-primary/10"
                                    : "border-border bg-background hover:border-primary/40"
                                } ${
                                  isOnlyPattern ? "cursor-not-allowed" : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={inPool}
                                  disabled={isOnlyPattern}
                                  onChange={() =>
                                    togglePatternInPool(cp.id)
                                  }
                                  className="mt-0.5 h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                                  aria-label={`Toggle ${cp.name} in pool`}
                                />
                                <div className="flex flex-1 flex-col gap-0.5">
                                  <span
                                    className={`text-sm font-medium ${
                                      inPool
                                        ? "text-primary"
                                        : "text-foreground"
                                    }`}
                                  >
                                    {cp.name}
                                  </span>
                                  <span className="font-mono text-[11px] text-muted-foreground leading-snug">
                                    {degreeStr}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                );
              })()}
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Tick one pattern for a single-pattern drill (the v1
                default) or multiple to cycle through them. The drill
                always keeps at least one pattern.
              </p>

              {/* Start-from modifier (Phase 15). Rotates the chord-tone
                  built-in patterns so the user can practice inversions
                  (3rd / 5th / 7th) or have the engine randomize per
                  measure. Disabled when no chord-tone built-in is in
                  the pool (customs ignore the modifier). */}
              {(() => {
                const anyBuiltIn = config.patternPool.some((p) =>
                  patternSupportsStartFrom(p),
                );
                return (
                  <div
                    className={`flex flex-col gap-2 rounded-md border border-border bg-background/30 p-3 ${
                      anyBuiltIn ? "" : "opacity-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        Start from
                      </span>
                      {!anyBuiltIn && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
                          custom-only pool
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PATTERN_START_FROM_OPTIONS.map((opt) => {
                        const active = config.patternStartFrom === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setPatternStartFrom(opt)}
                            disabled={!anyBuiltIn}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                              active
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            }`}
                            aria-pressed={active}
                          >
                            {PATTERN_START_FROM_LABELS[opt]}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Rotates which chord tone lands on beat 1 of the
                      built-in patterns. Pick <span className="font-mono">3rd</span>{" "}
                      to drill 1st-inversion arpeggios (3-5-7-8),{" "}
                      <span className="font-mono">5th</span> for 2nd
                      inversion, etc.{" "}
                      <span className="font-mono">Random</span> rolls a new
                      starting tone each measure — the expert-mode drill.
                      Custom patterns and Triads&rsquo; 7th slot ignore the
                      modifier (Triads wrap to root).
                    </p>
                    {/* Random sub-option: lock the very first measure of
                        the drill to root so the user has a footing at
                        session start before subsequent measures
                        randomize. Only meaningful when Random is the
                        active value. */}
                    {config.patternStartFrom === "random" && anyBuiltIn && (
                      <label className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.lockFirstMeasureToRoot}
                          onChange={(e) =>
                            setLockFirstMeasureToRoot(e.target.checked)
                          }
                          className="h-3.5 w-3.5 accent-primary cursor-pointer"
                        />
                        <span>
                          Lock first measure to root — gives you a footing
                          at the start before subsequent measures
                          randomize.
                        </span>
                      </label>
                    )}
                  </div>
                );
              })()}

              {/* Ordering picker — only relevant when pool has 2+
                  patterns. Custom (cycles through in checkbox order) is
                  the default; the three random strategies match what
                  the chord pool offers. */}
              {patternPoolCount > 1 && (
                <div className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-3">
                  <label
                    htmlFor="pattern-ordering"
                    className="text-sm font-medium text-foreground"
                  >
                    Pattern order
                  </label>
                  <Select
                    id="pattern-ordering"
                    value={config.patternOrdering}
                    onChange={(e) =>
                      setPatternOrdering(e.target.value as PatternOrdering)
                    }
                  >
                    {PATTERN_ORDERINGS.map((o) => (
                      <option key={o} value={o}>
                        {PATTERN_ORDERING_DISPLAY_NAMES[o]}
                      </option>
                    ))}
                  </Select>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {patternOrderingDescription(config.patternOrdering)}
                  </p>
                </div>
              )}

              {/* Primary-pattern picker (shown only when pool > 1) lets
                  the user choose which pattern is the Preview target and
                  the legacy arpeggioPattern. With a single-pattern pool,
                  the Preview always uses that one pattern. */}
              {patternPoolCount > 1 && (
                <div className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-3">
                  <label
                    htmlFor="primary-pattern"
                    className="text-sm font-medium text-foreground"
                  >
                    Preview pattern
                  </label>
                  <Select
                    id="primary-pattern"
                    value={config.arpeggioPattern}
                    onChange={(e) =>
                      setArpeggioPattern(e.target.value as ArpeggioPattern)
                    }
                  >
                    {config.patternPool.map((p) => (
                      <option key={p} value={p}>
                        {getPatternDisplayName(p)}
                      </option>
                    ))}
                  </Select>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Which pattern the Preview button auditions over the
                    first chord. Doesn&rsquo;t affect what plays during
                    the drill (that&rsquo;s the pool + order).
                  </p>
                </div>
              )}

              <div className="flex items-stretch gap-3">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 active:scale-[0.98] transition-all"
                  aria-label={
                    isPreviewing ? "Stop preview" : "Preview arpeggio"
                  }
                >
                  {isPreviewing ? (
                    <>
                      <Square className="h-4 w-4" aria-hidden="true" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Preview {getPatternShortName(config.arpeggioPattern)}
                    </>
                  )}
                </button>
              </div>

              {/* Pattern subtitle display — PER-DRILL override. Writes
                  to PracticeConfig.patternDisplay. When null (Follow
                  global), the drill uses the user-prefs default set
                  in /settings. When a specific mode is selected here,
                  the drill is pinned to that mode regardless of the
                  global default (so e.g. an ear-training drill can
                  force "degrees" while transcription drills stay on
                  "name"). */}
              <div className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-3">
                <span className="text-sm font-medium text-foreground">
                  Pattern subtitle on drill screen
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {/* "Follow global" button — sets the per-drill
                      patternDisplay to null. */}
                  <button
                    type="button"
                    onClick={() => setPatternDisplay(null)}
                    className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors ${
                      config.patternDisplay === null
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        config.patternDisplay === null
                          ? "text-primary"
                          : "text-foreground"
                      }`}
                    >
                      Follow global
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-relaxed">
                      Use the default set in Settings (
                      {PATTERN_DISPLAY_LABELS[globalPatternDisplay].toLowerCase()}
                      ).
                    </span>
                  </button>
                  {PATTERN_DISPLAYS.map((mode) => {
                    const selected = config.patternDisplay === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPatternDisplay(mode)}
                        className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors ${
                          selected
                            ? "border-primary/50 bg-primary/10"
                            : "border-border bg-background hover:border-primary/40"
                        }`}
                      >
                        <span
                          className={`text-xs font-medium ${
                            selected ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {PATTERN_DISPLAY_LABELS[mode]}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-relaxed">
                          {PATTERN_DISPLAY_DESCRIPTIONS[mode]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Saved with this drill. Settings has the global
                  default that applies when this drill is set to
                  &ldquo;Follow global.&rdquo;
                </p>
              </div>
            </div>
          </CollapsibleSection>

          {/* Tempo & meter */}
          <CollapsibleSection title="Tempo & meter" summary={tempoMeterSummary}>
            <div className="flex flex-col gap-6">
              <FormField
                label={
                  <div className="flex items-center justify-between">
                    <span>Tempo</span>
                    <span className="font-mono text-base font-medium text-foreground tabular-nums">
                      ♩ = {config.bpm}
                    </span>
                  </div>
                }
                htmlFor="bpm"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPO_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setBpm(preset)}
                        className={`rounded-md border px-3 py-1 font-mono text-xs tabular-nums transition-colors ${
                          config.bpm === preset
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      id="bpm"
                      type="range"
                      min={BPM_MIN}
                      max={BPM_MAX}
                      value={config.bpm}
                      onChange={(e) => setBpm(Number(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <ClampedNumberInput
                      value={config.bpm}
                      min={BPM_MIN}
                      max={BPM_MAX}
                      onChange={setBpm}
                      ariaLabel="BPM (numeric)"
                      className="w-20"
                    />
                  </div>
                  {/* Tap tempo + halve/double row. Tap derives BPM from
                      the user's tap interval (2+ taps required); halve
                      and double snap to common woodshed tempos. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTapTempo}
                      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        tapTimes.length > 0
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40"
                      }`}
                      aria-label="Tap to set tempo"
                    >
                      <span>Tap tempo</span>
                      {tapTimes.length > 0 && (
                        <span className="font-mono tabular-nums text-[10px] opacity-80">
                          {tapTimes.length === 1
                            ? "tap again…"
                            : `${tapTimes.length} taps`}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleHalveTempo}
                      disabled={config.bpm <= BPM_MIN}
                      aria-label="Halve tempo"
                      title="Halve tempo (÷2)"
                      className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      &divide;2
                    </button>
                    <button
                      type="button"
                      onClick={handleDoubleTempo}
                      disabled={config.bpm >= BPM_MAX}
                      aria-label="Double tempo"
                      title="Double tempo (×2)"
                      className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      &times;2
                    </button>
                    <button
                      type="button"
                      onClick={handleTestSound}
                      aria-label="Test sound"
                      title="Play one click to confirm audio works"
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        audioTestedAt !== null
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40"
                      }`}
                    >
                      <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {audioTestedAt !== null
                        ? "Played"
                        : "Test sound"}
                    </button>
                    <p className="text-[11px] text-muted-foreground/80 leading-snug">
                      {tapTimes.length === 0
                        ? "Tap 2+ times to set tempo by feel."
                        : tapTimes.length === 1
                          ? "Got it — tap again to lock the tempo."
                          : `Locked at ♪ = ${config.bpm}.`}
                    </p>
                  </div>
                </div>
              </FormField>

              <FormField label="Time signature" htmlFor="time-signature">
                <Select
                  id="time-signature"
                  value={timeSignatureValue}
                  onChange={(e) => handleTimeSignatureChange(e.target.value)}
                >
                  {TIME_SIGNATURES.map((ts) => {
                    const v = `${ts.beatsPerMeasure}/${ts.beatUnit}`;
                    return (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    );
                  })}
                </Select>
              </FormField>
            </div>
          </CollapsibleSection>

          {/* Session shape */}
          <CollapsibleSection title="Session" summary={sessionSummary}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Count-in" htmlFor="count-in">
                <Select
                  id="count-in"
                  value={config.countInMeasures}
                  onChange={(e) =>
                    setCountInMeasures(Number(e.target.value))
                  }
                >
                  {COUNT_IN_OPTIONS.map((opt) => (
                    <option key={opt.measures} value={opt.measures}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Drill length (measures)" htmlFor="drill-measures">
                <ClampedNumberInput
                  id="drill-measures"
                  value={config.drillMeasures}
                  min={DRILL_MIN}
                  max={DRILL_MAX}
                  onChange={setDrillMeasures}
                  className="w-full"
                />
              </FormField>
              <FormField label="Repetitions" htmlFor="repetitions">
                <ClampedNumberInput
                  id="repetitions"
                  value={config.repetitions}
                  min={REPS_MIN}
                  max={REPS_MAX}
                  onChange={setRepetitions}
                  className={`w-full ${
                    config.repeatIndefinitely
                      ? "opacity-40 pointer-events-none"
                      : ""
                  }`}
                />
              </FormField>
            </div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={config.repeatIndefinitely}
                onChange={(e) => setRepeatIndefinitely(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border bg-background accent-primary cursor-pointer"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Loop until stopped
                </span>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  {config.repeatIndefinitely
                    ? "Repetitions ignored — drill keeps going until you press Stop."
                    : "When on, the drill loops indefinitely instead of running a fixed number of repetitions."}
                </span>
              </div>
            </label>

            {/* Prep between chords — inter-chord count-in for beginners
                who need time to find the next root before playing. */}
            <div className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">
                  Prep between chords
                </span>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Inserts {config.transitionUnit} of &ldquo;GET
                  READY&rdquo; prep before each chord change so you have
                  time to find the new root before playing.
                </span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                <ClampedNumberInput
                  id="transition-count"
                  value={config.transitionCount}
                  min={0}
                  max={TRANSITION_MAX}
                  onChange={setTransitionCount}
                  className="w-20"
                  ariaLabel="Prep count"
                />
                <Select
                  aria-label="Prep unit"
                  value={config.transitionUnit}
                  onChange={(e) =>
                    setTransitionUnit(e.target.value as TransitionUnit)
                  }
                  disabled={config.transitionCount === 0}
                  className={
                    config.transitionCount === 0
                      ? "opacity-40 cursor-not-allowed"
                      : ""
                  }
                >
                  {TRANSITION_UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u === "measures" ? "Measures" : "Beats"}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {config.transitionCount === 0 ? (
                  "Off — chords change immediately, no prep."
                ) : (
                  <>
                    Each chord change gets{" "}
                    <span className="font-mono text-foreground tabular-nums">
                      {config.transitionCount}
                    </span>{" "}
                    {config.transitionUnit === "measures"
                      ? config.transitionCount === 1
                        ? "measure"
                        : "measures"
                      : config.transitionCount === 1
                        ? "beat"
                        : "beats"}{" "}
                    of prep time. The upcoming chord shows on screen with
                    a{" "}
                    <span className="font-medium text-primary">
                      GET READY
                    </span>{" "}
                    label.
                  </>
                )}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {config.repeatIndefinitely ? (
                <>
                  <span className="font-mono tabular-nums text-foreground">
                    {config.drillMeasures}
                  </span>{" "}
                  measure{config.drillMeasures === 1 ? "" : "s"} per rep ·
                  loops until you stop.
                </>
              ) : (
                <>
                  <span className="font-mono tabular-nums text-foreground">
                    {config.drillMeasures}
                  </span>{" "}
                  measure{config.drillMeasures === 1 ? "" : "s"} ×{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {config.repetitions}
                  </span>{" "}
                  rep{config.repetitions === 1 ? "" : "s"} ={" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {config.drillMeasures * config.repetitions}
                  </span>{" "}
                  total measure
                  {config.drillMeasures * config.repetitions === 1 ? "" : "s"}.
                </>
              )}
            </p>
          </CollapsibleSection>

          {/* Display — user-global preference for how the drill screen
              renders. Lives in user-prefs, NOT PracticeConfig, so the
              choice applies across every drill (it's a personal viewing
              preference, not a per-drill property). Phase 9 Settings
              will surface this same choice on /settings as well. */}
          <CollapsibleSection
            title="Display"
            summary={PRACTICE_LAYOUT_DISPLAY_NAMES[practiceLayout]}
          >
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PRACTICE_LAYOUTS.map((layout) => {
                  const selected = layout === practiceLayout;
                  return (
                    <button
                      key={layout}
                      type="button"
                      onClick={() => setPracticeLayout(layout)}
                      className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-primary/50 bg-primary/10"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <span
                        className={`text-sm font-medium ${
                          selected ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {PRACTICE_LAYOUT_DISPLAY_NAMES[layout]}
                      </span>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        {PRACTICE_LAYOUT_DESCRIPTIONS[layout]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Applies to the drill screen. This setting is yours
                personally — it doesn&rsquo;t save with each drill, so
                you can change it once and every drill respects it.
              </p>
            </div>
          </CollapsibleSection>

          {/* Pre-flight preview — shows the first chords the user will
              actually hear, with the current ordering applied. Catches
              "I configured this wrong" before drilling 16 measures. */}
          {previewChords.length > 0 && (
            <section
              className="flex flex-col gap-3 rounded-md border border-border bg-background/30 px-4 py-3"
              aria-label="Drill preview"
            >
              <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Up first
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {renderedPreviewChords.map((label, i) => (
                  <Fragment key={i}>
                    {i > 0 && (
                      <ChevronRight
                        className="h-3.5 w-3.5 text-muted-foreground/40"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`inline-flex items-center rounded-md border border-border/60 bg-background/60 px-2.5 py-1 font-mono font-medium text-foreground leading-none ${
                        isLongForm ? "text-xs" : "text-base"
                      }`}
                    >
                      {label}
                    </span>
                  </Fragment>
                ))}
                {previewHasMore && (
                  <>
                    <ChevronRight
                      className="h-3.5 w-3.5 text-muted-foreground/40"
                      aria-hidden="true"
                    />
                    <span className="font-mono text-sm text-muted-foreground/70">
                      …
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isRandomStrategy ? (
                  <>
                    Random ordering —{" "}
                    <span className="text-foreground">
                      the actual order will vary
                    </span>{" "}
                    each time you press Start. This is one sample roll.
                  </>
                ) : (
                  <>
                    These are the first {previewChords.length} chord
                    {previewChords.length === 1 ? "" : "s"} you&rsquo;ll
                    hear. Re-check before launching.
                  </>
                )}
              </p>
            </section>
          )}

          {/* Start button */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleStart}
              className="group flex items-center justify-between gap-3 rounded-lg bg-primary px-6 py-4 text-base font-medium text-primary-foreground shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>Start practice</span>
              <ArrowRight
                className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>

            {/* Save area — differs depending on whether a Drill is loaded for edit. */}
            {isSavingDrill ? (
              <div className="flex flex-col gap-3 rounded-md border border-border bg-background/40 p-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="drill-name"
                    className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
                  >
                    Name this drill
                  </label>
                  <input
                    id="drill-name"
                    type="text"
                    value={saveDrillName}
                    onChange={(e) => setSaveDrillName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) handleSaveDrill();
                      if (e.key === "Escape") {
                        setSaveDrillName("");
                        setSaveDrillNotes("");
                        setIsSavingDrill(false);
                      }
                    }}
                    placeholder="e.g. Morning warm-up"
                    autoFocus
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="drill-notes"
                    className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
                  >
                    Notes (optional)
                  </label>
                  <textarea
                    id="drill-notes"
                    value={saveDrillNotes}
                    onChange={(e) =>
                      setSaveDrillNotes(e.target.value.slice(0, 300))
                    }
                    placeholder="e.g. Slow at 60. Focus on left-hand timing."
                    rows={2}
                    className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSaveDrillName("");
                      setSaveDrillNotes("");
                      setIsSavingDrill(false);
                    }}
                    className="rounded-md border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDrill}
                    disabled={!saveDrillName.trim()}
                    className="rounded-md border border-primary/40 bg-primary/15 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : editingDrill && isEditingShipped ? (
              <button
                type="button"
                onClick={() => setIsSavingDrill(true)}
                className="flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/15 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/25 transition-colors"
              >
                <Bookmark className="h-4 w-4" aria-hidden="true" />
                Save as new drill
              </button>
            ) : editingDrill ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={!isDirty}
                  aria-label={
                    isDirty
                      ? `Save changes to ${editingDrill.name}`
                      : "No changes to save"
                  }
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    isDirty
                      ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25"
                      : justSavedAt !== null
                        ? "border-primary/40 bg-primary/15 text-primary cursor-default"
                        : "border-dashed border-border bg-background/40 text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {justSavedAt !== null && !isDirty
                    ? "Saved"
                    : `Save changes to "${editingDrill.name}"`}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingDrill(true)}
                  className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                  Save as new drill
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSavingDrill(true)}
                className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Bookmark className="h-4 w-4" aria-hidden="true" />
                Save current setup as drill
              </button>
            )}
          </div>
        </div>
      </div>
      {editorState.open && (
        <CustomPatternEditor
          editingId={editorState.editingId}
          onClose={() =>
            setEditorState({ open: false, editingId: null })
          }
          onSaved={(newId) => {
            // Auto-toggle the just-saved pattern into the pool, but
            // only on Create (edits leave pool membership alone).
            if (!editorState.editingId) {
              if (!config.patternPool.includes(newId)) {
                togglePatternInPool(newId);
              }
            }
          }}
        />
      )}
    </main>
  );
}

/** A saved drill rendered as a tile in the Quick Start section. */
function DrillCard({
  drill,
  isEditing,
  isShipped,
  onLaunch,
  onEdit,
  onDelete,
}: {
  drill: Drill;
  isEditing: boolean;
  /** Shipped drills get a Built-in badge and hide the delete affordance. */
  isShipped: boolean;
  onLaunch: (drill: Drill) => void;
  onEdit: (drill: Drill) => void;
  onDelete: (id: string) => void;
}) {
  const c = drill.config;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const flags: string[] = [];
  if (
    c.orderingStrategy &&
    RANDOM_ORDERING_STRATEGIES.has(c.orderingStrategy)
  ) {
    flags.push("Random");
  }
  if (c.repeatIndefinitely) flags.push("Loop ∞");
  const lengthLabel = c.repeatIndefinitely
    ? `${c.drillMeasures} measures / rep`
    : `${c.drillMeasures} × ${c.repetitions} = ${c.drillMeasures * c.repetitions} measures`;

  return (
    <div
      className={`relative rounded-lg border bg-background/40 transition-colors ${
        isEditing
          ? "border-primary/60 bg-primary/5"
          : "border-border hover:border-primary/60 hover:bg-primary/5"
      }`}
    >
      <button
        type="button"
        onClick={() => onLaunch(drill)}
        className="group block w-full p-3 text-left"
      >
        <div className="flex items-center gap-2 pr-20">
          <Play
            className="h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span className="flex-1 truncate font-medium text-foreground">
            {drill.name}
          </span>
        </div>
        <div className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
          {c.chordPool.length} chord{c.chordPool.length === 1 ? "" : "s"} ·{" "}
          {getPatternShortName(c.arpeggioPattern)} · ♩={c.bpm} ·{" "}
          {c.timeSignature.beatsPerMeasure}/{c.timeSignature.beatUnit}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {lengthLabel}
          {flags.length > 0 && (
            <>
              {" · "}
              <span className="text-primary">{flags.join(" · ")}</span>
            </>
          )}
        </div>
        {drill.notes && (
          <div className="mt-1.5 line-clamp-2 text-xs italic text-muted-foreground/80">
            {drill.notes}
          </div>
        )}
      </button>
      {/* Card actions. Shipped drills only show edit (delete hidden — they
          can't be removed, they're built in; the section header already
          conveys "built-in", so no per-card chip is needed). User drills
          get the two-click delete confirm to prevent accidental loss. */}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {!isShipped && confirmingDelete ? (
          <>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-sm border border-border bg-background px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(drill.id);
                setConfirmingDelete(false);
              }}
              className="rounded-sm border border-destructive/60 bg-destructive/15 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-destructive hover:bg-destructive/25 transition-colors"
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onEdit(drill)}
              aria-label={`Edit drill ${drill.name}`}
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/50 hover:bg-border/60 hover:text-foreground transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {!isShipped && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                aria-label={`Delete drill ${drill.name}`}
                className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/50 hover:bg-border/60 hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  /**
   * Optional one-line description of the section's role. Sits right
   * under the title in muted text. Used to differentiate similarly-
   * named sections (e.g. "Your patterns" library vs "Drill patterns"
   * config) so the user can tell their roles apart at a glance.
   */
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Section that collapses to its header. Header shows the section title
 * (small mono caps) AND a one-line summary of the current state in the
 * foreground color so the user never loses sight of "what's set" even
 * when the section is closed. Click anywhere on the header to toggle.
 * Default-closed — keeps the setup screen clean; users open just the
 * section they want to tinker with.
 */
function CollapsibleSection({
  title,
  summary,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
}: {
  title: string;
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** When provided, the section becomes controlled by the parent. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <section className="flex flex-col rounded-md border border-border bg-background/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background/60 transition-colors"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <span className="text-sm font-medium text-foreground">
            {summary}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
          {children}
        </div>
      )}
    </section>
  );
}

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    children: React.ReactNode;
  },
) {
  const { className, children, ...rest } = props;
  return (
    <select
      {...rest}
      className={`w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none ${className ?? ""}`}
    >
      {children}
    </select>
  );
}

/**
 * Pull a clean PracticeConfig out of any source (the live store or a
 * saved drill's config). Listing fields explicitly is the only safe
 * way to avoid UI-state fields (like loadedDrillId) leaking into a
 * saved drill snapshot. Used by BOTH the save path and the isDirty
 * comparison so they're structurally symmetric. Lives at module
 * scope so it's available to every render of the setup component —
 * defining it inside the function caused a temporal-dead-zone crash
 * when the isDirty useMemo (declared earlier in the same scope) tried
 * to call it.
 *
 * NOTE: chordPoolIds is intentionally NOT copied from `source` and is
 * always pinned to a constant placeholder. The IDs are an internal
 * view artifact for drag-tracking (parallel to chordPool, regenerated
 * non-deterministically by loadConfig when the saved length doesn't
 * match the live pool). Two configs with identical chordPools but
 * different slot IDs behave identically — so the IDs must be excluded
 * from both the save snapshot and the dirty comparison, otherwise a
 * just-loaded drill spuriously reports "dirty" (chordPoolIds drift on
 * load → live differs from saved → Save changes button mis-highlights
 * on every load of a drill saved before Phase 2's id-array was added).
 */
const EMPTY_IDS: string[] = [];
function extractPracticeConfig(
  source: Partial<PracticeConfig>,
): PracticeConfig {
  return {
    ...DEFAULT_PRACTICE_CONFIG,
    chordPoolIds: EMPTY_IDS,
    ...(source.chordPool !== undefined && { chordPool: source.chordPool }),
    ...(source.orderingStrategy !== undefined && {
      orderingStrategy: source.orderingStrategy,
    }),
    ...(source.measuresPerChord !== undefined && {
      measuresPerChord: source.measuresPerChord,
    }),
    ...(source.drillMeasures !== undefined && {
      drillMeasures: source.drillMeasures,
    }),
    ...(source.repetitions !== undefined && {
      repetitions: source.repetitions,
    }),
    ...(source.repeatIndefinitely !== undefined && {
      repeatIndefinitely: source.repeatIndefinitely,
    }),
    ...(source.bpm !== undefined && { bpm: source.bpm }),
    ...(source.timeSignature !== undefined && {
      timeSignature: source.timeSignature,
    }),
    ...(source.countInMeasures !== undefined && {
      countInMeasures: source.countInMeasures,
    }),
    ...(source.notationStyle !== undefined && {
      notationStyle: source.notationStyle,
    }),
    ...(source.arpeggioPattern !== undefined && {
      arpeggioPattern: source.arpeggioPattern,
    }),
    ...(source.patternPool !== undefined && {
      patternPool: source.patternPool,
    }),
    ...(source.patternOrdering !== undefined && {
      patternOrdering: source.patternOrdering,
    }),
    ...(source.patternDisplay !== undefined && {
      patternDisplay: source.patternDisplay,
    }),
    ...(source.transitionUnit !== undefined && {
      transitionUnit: source.transitionUnit,
    }),
    ...(source.transitionCount !== undefined && {
      transitionCount: source.transitionCount,
    }),
  };
}

/** Quick-pick tempo buttons that sit above the slider. */
const TEMPO_PRESETS = [40, 60, 80, 100, 120, 140, 160, 200] as const;

/** Per-strategy explanatory text under the Order dropdown. */
function orderingDescription(
  strategy: OrderingStrategy,
  poolSize: number,
  drillMeasures: number,
): string {
  switch (strategy) {
    case "custom":
      return "Drill plays the pool top-to-bottom, looping if it's shorter than the drill length. Drag the handle on the left of each row to reorder.";
    case "chromaticAsc":
      return "Pool sorted chromatically up from the first chord. C → C♯ → D ...";
    case "chromaticDesc":
      return "Pool sorted chromatically down from the first chord. C → B → B♭ ...";
    case "cycleOf5ths":
      return "Pool sorted in the canonical jazz direction (descending 5ths / ascending 4ths). Cmaj7 ii-V-I sequences stay in order.";
    case "cycleOf4ths":
      return "Pool sorted ascending 5ths / descending 4ths. C → G → D → A ...";
    case "randomReplace": {
      const slots = Math.min(drillMeasures, poolSize);
      return `Each measure independently picks a random chord from your pool of ${poolSize}. Chords can repeat within a rep. ${slots} slots per drill.`;
    }
    case "randomShuffleOnce":
      return "Shuffled once at the start of the session — same order plays for every rep.";
    case "randomShuffleEachPass":
      return `Each rep samples ${Math.min(drillMeasures, poolSize)} chord${
        Math.min(drillMeasures, poolSize) === 1 ? "" : "s"
      } at random from your pool of ${poolSize}. Fresh sample every rep.`;
  }
}

/** Per-pattern-ordering explanatory text under the Pattern Order dropdown. */
function patternOrderingDescription(ordering: PatternOrdering): string {
  switch (ordering) {
    case "custom":
      return "Cycles through the selected patterns in the order shown above, wrapping when the list runs out.";
    case "randomReplace":
      return "Each measure independently picks a random pattern. Patterns can repeat back-to-back.";
    case "randomShuffleOnce":
      return "Pool is shuffled once at the start of the session, then cycles in that order.";
    case "randomShuffleEachPass":
      return "Pool is re-shuffled each time it cycles through, so consecutive passes use a different order.";
  }
}

/**
 * A draggable chord-pool row. useSortable wires the row's transform +
 * transition for the drag animation; the grip-icon button receives the
 * drag listeners. When canDrag is false (any non-Custom ordering), the
 * grip is muted and the row is non-draggable.
 */
function SortableChordRow({
  id,
  chord,
  index,
  canDrag,
  poolSize,
  onRootChange,
  onQualityChange,
  onRemove,
  rowRef,
}: {
  id: string;
  chord: Chord;
  index: number;
  canDrag: boolean;
  poolSize: number;
  onRootChange: (root: PitchClass) => void;
  onQualityChange: (quality: ChordQuality) => void;
  onRemove: () => void;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !canDrag });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        rowRef(el);
      }}
      style={style}
      className="grid grid-cols-[auto_7rem_1fr_auto] gap-2 items-center"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={!canDrag}
        aria-label={
          canDrag
            ? `Reorder chord ${index + 1}`
            : "Reorder available with Custom order"
        }
        className={`flex h-9 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors ${
          canDrag
            ? "cursor-grab hover:text-foreground hover:bg-background/60 active:cursor-grabbing"
            : "cursor-not-allowed opacity-30"
        }`}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <select
        aria-label={`Chord ${index + 1} root`}
        value={chord.root}
        onChange={(e) => onRootChange(e.target.value as PitchClass)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      >
        {PITCH_CLASSES.map((pc) => (
          <option key={pc} value={pc}>
            {PITCH_CLASS_DISPLAY_NAMES[pc]}
          </option>
        ))}
      </select>
      <select
        aria-label={`Chord ${index + 1} quality`}
        value={chord.quality}
        onChange={(e) => onQualityChange(e.target.value as ChordQuality)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      >
        {CHORD_QUALITIES.map((q) => (
          <option key={q} value={q}>
            {QUALITY_DISPLAY_NAMES[q]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        disabled={poolSize <= 1}
        aria-label={`Remove chord ${index + 1}`}
        className="flex items-center justify-center rounded-md border border-border bg-background h-9 w-9 text-muted-foreground hover:text-foreground hover:border-destructive/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Preset selections for the quick-build wizard's column buttons. */
const WIZARD_ROOTS_NATURALS: readonly PitchClass[] = [
  "C",
  "D",
  "E",
  "F",
  "G",
  "A",
  "B",
];
const WIZARD_QUALITIES_COMMON: readonly ChordQuality[] = [
  "maj7",
  "min7",
  "dom7",
  "dim7",
];
const WIZARD_QUALITIES_TRIADS: readonly ChordQuality[] = [
  "maj",
  "min",
  "aug",
];

function WizardColumn({
  title,
  presets,
  children,
}: {
  title: string;
  presets: { label: string; onClick: () => void }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Header + presets stack vertically so each row gets the full
          column width — keeps preset buttons on a single line and lets
          both columns' checkbox grids align at the top. */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.onClick}
              className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

function WizardCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-background/60 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-border bg-background accent-primary cursor-pointer"
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

/**
 * Number input that lets the user type intermediate values (including
 * ones temporarily below the min) without snapping each keystroke. The
 * store is only updated when the typed value is valid and in range;
 * on blur we commit + clamp. Pattern fixes the bug where typing "31"
 * was impossible because the leading "3" got clamped to the min.
 *
 * Includes ±1 stepper buttons (up/down chevrons) so users can nudge
 * without typing. Buttons disable at the min/max boundaries.
 */
function ClampedNumberInput({
  id,
  value,
  min,
  max,
  onChange,
  className,
  ariaLabel,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const display = focused && draft !== null ? draft : String(value);

  const step = (delta: number) => {
    const next = Math.max(min, Math.min(max, value + delta));
    if (next !== value) onChange(next);
  };

  return (
    <div
      className={`relative flex items-stretch rounded-md border border-border bg-background focus-within:border-primary transition-colors ${className ?? ""}`}
    >
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={display}
        aria-label={ariaLabel}
        onFocus={() => {
          setFocused(true);
          setDraft(String(value));
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, "");
          setDraft(v);
          const n = Number(v);
          if (v !== "" && !isNaN(n) && n >= min && n <= max) {
            onChange(n);
          }
        }}
        onBlur={() => {
          setFocused(false);
          if (draft === null) return;
          const n = Number(draft);
          const clamped =
            draft !== "" && !isNaN(n)
              ? Math.max(min, Math.min(max, n))
              : min;
          onChange(clamped);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp") {
            e.preventDefault();
            step(1);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            step(-1);
          }
        }}
        className="flex-1 min-w-0 rounded-l-md bg-transparent px-3 py-2 font-mono text-sm tabular-nums focus:outline-none"
      />
      <div className="flex flex-col border-l border-border">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => step(1)}
          disabled={value >= max}
          aria-label={`Increase ${ariaLabel ?? "value"} by 1`}
          className="flex h-1/2 w-6 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUp className="h-3 w-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => step(-1)}
          disabled={value <= min}
          aria-label={`Decrease ${ariaLabel ?? "value"} by 1`}
          className="flex h-1/2 w-6 items-center justify-center border-t border-border text-muted-foreground hover:text-foreground hover:bg-background/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Adaptive text size for sequence preview chips — shrink as the pool
 * grows so a 20-chord pool doesn't dominate the screen. Long-form
 * notation scales down an extra tier because each chord label is
 * already several words long.
 */
function chipTextClass(poolSize: number, isLongForm: boolean): string {
  if (isLongForm) {
    if (poolSize <= 6) return "text-base";
    if (poolSize <= 14) return "text-sm";
    return "text-xs";
  }
  if (poolSize <= 6) return "text-3xl";
  if (poolSize <= 12) return "text-2xl";
  if (poolSize <= 20) return "text-xl";
  return "text-lg";
}
