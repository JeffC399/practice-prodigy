"use client";

import { metronomeEngine } from "@/lib/audio/metronome";
import { useMetronome } from "@/lib/audio/use-metronome";
import {
  getPatternDegrees,
  getPatternShortName,
  parsePatternDegrees,
  type ArpeggioPattern,
} from "@/lib/music/arpeggio";
import { useCustomPatternsLibrary } from "@/lib/state/custom-patterns-library";
import { renderChord } from "@/lib/music/render-chord";
import {
  buildPatternsForSession,
  currentChordStartIndex,
  findNextDifferentChord,
  generateSequence,
  nextChordStartIndex,
  prevChordStartIndex,
  type SequenceBeat,
} from "@/lib/music/sequence";
import {
  BPM_MAX,
  BPM_MIN,
  RANDOM_ORDERING_STRATEGIES,
  usePracticeConfig,
} from "@/lib/state/practice-config";
import { useDrillsLibrary } from "@/lib/state/drills-library";
import { useResumeSession } from "@/lib/state/resume-session";
import { useUserPrefs } from "@/lib/state/user-prefs";
import { AnimatePresence, motion } from "framer-motion";
import {
  Minus,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SkipBack,
  SkipForward,
  Square,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/** Summary surfaced in the DrillCompleteOverlay on natural completion. */
type CompletedSummary = {
  drillName: string | null;
  totalMeasures: number;
  elapsedMs: number;
  avgBpm: number;
};

/**
 * Active drill screen. Reads the active practice configuration from the
 * persisted store, generates a fresh beat-by-beat sequence on Start,
 * and runs the metronome through it.
 *
 * Sequence drilling: the sequence is now BEAT-level (SequenceBeat[]) so
 * inter-chord prep transitions can land mid-measure when the user picks
 * "beats" unit. The metronome ticks beats; the drill page maps current
 * (measure, beatInMeasure) → absoluteBeat → sequence[absoluteBeat-1].
 *
 * NEXT chord preview is rendered above the current chord
 * (PROJECT-DESIGN.md §4.1 Always-Visible mode); Late-Reveal lands in
 * a polish slice.
 */
export default function PracticeSessionPage() {
  const config = usePracticeConfig();
  const drillsLib = useDrillsLibrary();
  const practiceLayout = useUserPrefs((s) => s.practiceLayout);
  const globalPatternDisplay = useUserPrefs((s) => s.patternDisplay);
  // Cascade: per-drill override (config.patternDisplay) wins over the
  // user-global default. null on the drill means "follow global".
  const patternDisplay = config.patternDisplay ?? globalPatternDisplay;
  const { state, start, stop } = useMetronome();

  // When the user launched this session from a Quick Start card, anchor
  // their context by showing the drill's name in the header.
  const currentDrill = config.loadedDrillId
    ? drillsLib.drills.find((d) => d.id === config.loadedDrillId) ?? null
    : null;

  const isIdle = state.phase === "idle";
  const isCountIn = state.phase === "count-in";
  const isPlaying = state.phase === "playing";
  // "Preparation" means EITHER the start-of-session count-in OR an
  // inter-chord transition window. Both are aurally identical (the
  // metronome uses the stick-click for both), so the visual treatment
  // should match: dimmed brightness, "Get ready" label, pulsing ring.
  // Computed once here and threaded everywhere the visual prep signals
  // need to fire.
  //
  // Note: isCountIn alone was driving the visual treatment before, which
  // missed the inter-chord prep case entirely — the badge stayed
  // "Measure N" and the panels stayed in their playing state even
  // though the metronome was audibly in a prep window.

  const beatsPerMeasure = config.timeSignature.beatsPerMeasure;
  const countInBeats = config.countInMeasures * beatsPerMeasure;

  // Idle preview: ALWAYS uses the chord pool in raw order (the same
  // order shown in the Sequence box on /practice). User reported it
  // was jarring that deterministic-sort strategies (chromatic asc/desc,
  // cycle of 5ths/4ths) made the drill screen open with a different
  // first chord than the Sequence box -- the eye landed on chord X
  // in setup and chord Y when it navigated to the drill. Now both
  // surfaces show the same first chord. Once the user presses Start,
  // the actual ordering strategy kicks in. Transitions are also off
  // here for a cleaner pre-Start preview.
  const idlePreviewSequence = useMemo(
    () =>
      generateSequence({
        pool: config.chordPool,
        orderingStrategy: "custom",
        drillMeasures: config.drillMeasures,
        repetitions: config.repetitions,
        repeatIndefinitely: false,
        timeSignature: config.timeSignature,
        transitionUnit: config.transitionUnit,
        transitionCount: 0,
      }),
    [
      config.chordPool,
      config.drillMeasures,
      config.repetitions,
      config.timeSignature,
      config.transitionUnit,
    ],
  );

  const [activeSequence, setActiveSequence] = useState<
    SequenceBeat[] | null
  >(null);
  // Per-measure arpeggio pattern lookup, built once at Start (so random
  // pattern orderings don't re-roll on every render). Indexed by
  // 0-based play-measure number.
  const [activePatterns, setActivePatterns] = useState<
    ArpeggioPattern[] | null
  >(null);
  const sequence = isIdle
    ? idlePreviewSequence
    : (activeSequence ?? idlePreviewSequence);

  // The metronome exposes absoluteBeat (1-indexed; counts both play
  // AND prep beats) directly now so we can index into the beat-level
  // sequence without recomputing from measure + beatInMeasure (which
  // are play-only after the prep-window refactor).
  const absoluteBeat = isPlaying && state.absoluteBeat > 0
    ? state.absoluteBeat
    : 1;
  const currentEntry = useMemo<SequenceBeat>(
    () =>
      sequence[absoluteBeat - 1] ??
      sequence[0] ??
      ({ chord: config.chordPool[0], kind: "play" } as SequenceBeat),
    [sequence, absoluteBeat, config.chordPool],
  );

  /**
   * Big-display chord: whatever the current sequence entry references.
   * Crucially this means during PREP beats the upcoming chord appears
   * in the big display immediately when the prep starts — so the user
   * has the full prep window to read the new chord and find the root,
   * not just from the moment play resumes. The earlier jarring
   * treatment (primary color + dimmed opacity) is gone; the chord
   * renders normally regardless of prep vs play. The stick-click
   * audio carries the "don't play yet" signal during prep.
   */
  const bigDisplayChord = currentEntry.chord;
  const isTransition = currentEntry.kind === "transition";
  // Unified "preparation" predicate — true during the start-of-session
  // count-in AND during inter-chord transition windows. Drives the
  // visual prep signals (Get ready label, pulsing ring, dim opacity,
  // badge styling) so they fire whenever the metronome is aurally
  // in stick-click mode, not just at session start.
  const isPreparing = isCountIn || (isPlaying && isTransition);

  // Per-measure pattern labels — drives the small "Arp 7ths" / "Scale
  // Tones" subtitle under the Now and Next chord displays. The
  // displayed pattern needs to match the displayed CHORD at each
  // position, which means special-casing the inter-chord prep window:
  //
  //   - Idle / count-in: showing chord m1, so pattern = patterns[0]
  //   - Playing measure N (non-transition): showing chord m_N, so
  //     pattern = patterns[N - 1]
  //   - Inter-chord prep BEFORE measure N+1: showing UPCOMING chord
  //     m_{N+1} (bigDisplayChord already does this), so pattern =
  //     patterns[N], which is state.measureInSession (it stayed at
  //     N during prep because the engine pauses the measure counter
  //     during transition beats).
  //
  // Earlier the index was `measureInSession - 1` even during prep,
  // which lagged behind the chord display by one measure — chord
  // moved to the upcoming one but the pattern was still showing the
  // just-played one.
  const currentMeasureIdx = !isPlaying
    ? 0
    : isTransition
      ? state.measureInSession
      : Math.max(0, state.measureInSession - 1);
  const nextMeasureIdx = currentMeasureIdx + 1;
  const fallbackPattern: ArpeggioPattern = config.patternPool[0] ?? config.arpeggioPattern;
  const currentPattern =
    activePatterns?.[currentMeasureIdx] ?? fallbackPattern;
  const nextPattern =
    activePatterns?.[nextMeasureIdx] ?? currentPattern;
  // PatternSubtitle (below) handles the per-position rendering based
  // on patternDisplay mode. Earlier versions pre-computed string
  // labels here; the lit-up-degrees feature (Phase 12) needs to render
  // each digit independently, so the rendering moved into the
  // component itself. Only the header summary stays a string.
  /** Compact pattern-pool summary for the drill-screen header. Uses
   *  the name-form regardless of patternDisplay (so the header is
   *  always identifiable even when subtitles are degrees/hidden). */
  // Subscribe to the custom-patterns library so the labels live-update
  // when a custom pattern is renamed/deleted while the drill is open.
  useCustomPatternsLibrary((s) => s.patterns);
  const headerPatternLabel =
    config.patternPool.length <= 1
      ? getPatternShortName(currentPattern)
      : `${getPatternShortName(currentPattern)} +${config.patternPool.length - 1}`;

  // Lit-up scale-degree tracking — for the "degrees" pattern-display
  // mode, the digits in the current chord's subtitle pulse in time
  // with when each note should actually be played. The state tracks
  // which note index of the current measure's pattern is "active"
  // right now. -1 means no note is highlighted (idle, count-in, prep).
  //
  // On each play-beat tick the effect resets to the first note of
  // that beat and schedules setTimeout-based highlights for any
  // sub-beat notes (e.g. Scale Tones: 8 notes in a 4-beat measure
  // means 2 notes per beat -- the second one fires at half-beat).
  const [activeNoteIdx, setActiveNoteIdx] = useState<number>(-1);
  const noteHighlightTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    // Clear any pending sub-beat highlights from the previous beat.
    noteHighlightTimersRef.current.forEach((t) => clearTimeout(t));
    noteHighlightTimersRef.current = [];

    if (!isPlaying || isTransition || state.beatInMeasure < 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveNoteIdx(-1);
      return;
    }

    // Rhythm-aware scheduling (Phase 14). Each note in the pattern
    // carries its own duration in beats. We compute cumulative start
    // beats, find which note is active at the current beat boundary,
    // and schedule setTimeout-based highlights for any notes that
    // start within the current beat window.
    const segments = parsePatternDegrees(currentPattern);
    if (segments.length === 0) {
      setActiveNoteIdx(-1);
      return;
    }
    const startBeats: number[] = [];
    let acc = 0;
    for (const seg of segments) {
      startBeats.push(acc);
      acc += seg.durationBeats;
    }
    const currentBeat = state.beatInMeasure - 1; // 0-indexed within measure
    const nextBeat = currentBeat + 1;
    // Active note at currentBeat = the latest segment whose start <= currentBeat.
    // Allow a tiny epsilon for float comparison (durations like 0.75 + 0.25 sum cleanly).
    const EPS = 1e-6;
    let active = -1;
    for (let i = 0; i < startBeats.length; i++) {
      if (startBeats[i] <= currentBeat + EPS) active = i;
      else break;
    }
    setActiveNoteIdx(active);

    // Schedule sub-beat highlights for notes that start strictly
    // inside (currentBeat, nextBeat) — e.g. the "+ of 1" note in an
    // 8-8-quarter triad pattern.
    const beatDurationMs = 60000 / config.bpm;
    for (let i = 0; i < startBeats.length; i++) {
      const s = startBeats[i];
      if (s > currentBeat + EPS && s < nextBeat - EPS) {
        const offsetMs = (s - currentBeat) * beatDurationMs;
        const timer = setTimeout(
          () => setActiveNoteIdx(i),
          Math.round(offsetMs),
        );
        noteHighlightTimersRef.current.push(timer);
      }
    }

    return () => {
      noteHighlightTimersRef.current.forEach((t) => clearTimeout(t));
      noteHighlightTimersRef.current = [];
    };
  }, [
    isPlaying,
    isTransition,
    state.beatInMeasure,
    state.measureInSession,
    currentPattern,
    config.bpm,
  ]);

  // Monotonic per-beat key used by the prep ring's pulse animation —
  // changes on every beat tick regardless of phase. During count-in,
  // countInBeatsRemaining decrements; during play/transition,
  // absoluteBeat increments. Either change makes this string change,
  // remounting the ring overlay and re-firing its flash animation.
  // Result: the pulse lands ON each beat instead of running on a
  // fixed 2s Tailwind loop that's out of phase with the audio.
  const beatTick = `${state.countInBeatsRemaining}-${state.absoluteBeat}`;

  const nextChord = useMemo(
    () => findNextDifferentChord(sequence, absoluteBeat - 1),
    [sequence, absoluteBeat],
  );

  const currentLabel = useMemo(
    () => renderChord(bigDisplayChord, config.notationStyle),
    [bigDisplayChord, config.notationStyle],
  );
  const nextLabel = useMemo(
    () =>
      nextChord ? renderChord(nextChord, config.notationStyle) : null,
    [nextChord, config.notationStyle],
  );

  // For the header "8 × 4 = 32 measures" summary we report the PLAY
  // length only (transitions don't count as drill measures). The
  // metronome stop length comes from the active sequence (which already
  // includes transition beats) — see handleToggle.
  const totalPlayMeasures = config.repeatIndefinitely
    ? null
    : config.drillMeasures * config.repetitions;

  // Quick Start auto-launch — if we arrived with ?autostart=1 (set by a
  // Quick Start card click on /practice), start the drill once we mount.
  // Read the URL directly so the page stays statically prerendered
  // (useSearchParams would force us into a Suspense boundary).
  const [autoStartFromUrl, setAutoStartFromUrl] = useState(false);
  const [resumeFromUrl, setResumeFromUrl] = useState(false);
  const autoStartFiredRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = new URL(window.location.href);
    if (params.get("resume") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResumeFromUrl(true);
      url.searchParams.delete("resume");
      window.history.replaceState({}, "", url.toString());
    } else if (params.get("autostart") === "1") {
      setAutoStartFromUrl(true);
      url.searchParams.delete("autostart");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const resume = useResumeSession();

  // Session-stats tracking — track session start time + BPM samples
  // so we can present a "Drill complete!" summary card when a non-
  // looping drill ends naturally. Refs (not state) for the trackers
  // because they don't drive renders; useState for the summary
  // itself because that DOES drive the overlay render.
  const sessionStartRef = useRef<number | null>(null);
  const bpmSamplesRef = useRef<number[]>([]);
  // userStopped flips true when the user explicitly clicks Stop —
  // distinguishes manual stop from natural completion. Cleared on
  // every fresh Start.
  const userStoppedRef = useRef(false);
  const [completedSummary, setCompletedSummary] =
    useState<CompletedSummary | null>(null);

  const handleToggle = () => {
    if (isIdle) {
      // Reset session-stats tracking for the new drill.
      sessionStartRef.current = Date.now();
      bpmSamplesRef.current = [config.bpm];
      userStoppedRef.current = false;
      setCompletedSummary(null);
      // Resume path — start from a previously-interrupted session,
      // re-using its pre-rolled sequence (so random strategies don't
      // re-shuffle to a new chord at the resume position) and skipping
      // the count-in (resume = continue, not restart).
      const r = resume.active;
      if (resumeFromUrl && r) {
        setActiveSequence(r.sequence);
        // Re-roll patterns on resume — these aren't persisted in the
        // resume blob (yet), so the resumed drill gets a fresh pattern
        // sequence. For multi-pattern drills with random ordering this
        // means a slightly different pattern at the resume position.
        // Acceptable v1 behavior; can persist patterns alongside the
        // sequence later if needed.
        const playMeasures = r.totalMeasures ?? r.sequence.length;
        setActivePatterns(
          buildPatternsForSession(
            config.patternPool,
            config.patternOrdering,
            playMeasures,
          ),
        );
        const beatStyles = r.sequence.map((b) => b.kind);
        void start({
          bpm: config.bpm,
          beatsPerMeasure,
          beatUnit: config.timeSignature.beatUnit,
          countInBeats: 0,
          totalPlayingBeats: config.repeatIndefinitely
            ? undefined
            : r.sequence.length,
          beatStyles,
          initialBeatIndex: r.beatIndex,
        });
        return;
      }
      // Fresh sequence at every Start. Random strategies re-roll;
      // deterministic strategies are a harmless rebuild.
      const fresh = generateSequence({
        pool: config.chordPool,
        orderingStrategy: config.orderingStrategy,
        drillMeasures: config.drillMeasures,
        repetitions: config.repetitions,
        repeatIndefinitely: config.repeatIndefinitely,
        timeSignature: config.timeSignature,
        transitionUnit: config.transitionUnit,
        transitionCount: config.transitionCount,
      });
      setActiveSequence(fresh);
      // Pattern pool sequence — pre-rolled once so random pattern
      // orderings don't change per render. One pattern per play
      // measure; indexed by 0-based measure number.
      const playMeasureCount = config.repeatIndefinitely
        ? Math.max(config.drillMeasures * 256, 1024)
        : config.drillMeasures * config.repetitions;
      const patterns = buildPatternsForSession(
        config.patternPool,
        config.patternOrdering,
        playMeasureCount,
      );
      setActivePatterns(patterns);
      // Map each beat's kind so the engine can pick the right click
      // synth (transition → stick-click; play → tonal click).
      const beatStyles = fresh.map((b) => b.kind);
      void start({
        bpm: config.bpm,
        beatsPerMeasure,
        beatUnit: config.timeSignature.beatUnit,
        countInBeats,
        totalPlayingBeats: config.repeatIndefinitely
          ? undefined
          : fresh.length,
        beatStyles,
      });
    } else {
      // User-pressed Stop is intentional cessation — don't offer this
      // session for resume the next time they hit /practice, AND
      // don't show the completion-stats overlay (that's reserved for
      // drills the user played all the way through).
      userStoppedRef.current = true;
      stop();
      resume.clear();
    }
  };

  // Trigger autostart once when conditions align. The ref ensures we
  // never fire twice even if handleToggle's identity changes. Both the
  // Quick-Start autostart and the resume flow funnel through the same
  // ref so they can't race against each other.
  useEffect(() => {
    if (
      (autoStartFromUrl || resumeFromUrl) &&
      isIdle &&
      !autoStartFiredRef.current
    ) {
      autoStartFiredRef.current = true;
      handleToggle();
    }
    // handleToggle has unstable identity; the ref guards against
    // duplicate invocation, so exhaustive-deps is intentionally
    // omitted here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartFromUrl, resumeFromUrl, isIdle]);

  // Persist a resume snapshot on each play-measure boundary. The
  // sequence + position are captured so a browser crash leaves a
  // recovery target on the next /practice visit. A ref guards against
  // re-saving the same measure across re-renders.
  const lastSavedMeasureRef = useRef<number>(0);
  useEffect(() => {
    if (!isPlaying) return;
    if (activeSequence === null) return;
    // Only fire on the downbeat of a play measure — beatInMeasure
    // === 1 happens once per measure (transition beats use 0).
    if (state.beatInMeasure !== 1) return;
    if (state.measureInSession === lastSavedMeasureRef.current) return;
    lastSavedMeasureRef.current = state.measureInSession;
    resume.save({
      config: {
        chordPool: config.chordPool,
        chordPoolIds: config.chordPoolIds,
        orderingStrategy: config.orderingStrategy,
        measuresPerChord: config.measuresPerChord,
        drillMeasures: config.drillMeasures,
        repetitions: config.repetitions,
        repeatIndefinitely: config.repeatIndefinitely,
        transitionUnit: config.transitionUnit,
        transitionCount: config.transitionCount,
        bpm: config.bpm,
        timeSignature: config.timeSignature,
        countInMeasures: config.countInMeasures,
        notationStyle: config.notationStyle,
        arpeggioPattern: config.arpeggioPattern,
        patternPool: config.patternPool,
        patternOrdering: config.patternOrdering,
        patternDisplay: config.patternDisplay,
      },
      drillName: currentDrill?.name ?? null,
      loadedDrillId: config.loadedDrillId,
      beatIndex: absoluteBeat - 1,
      measureNumber: state.measureInSession,
      totalMeasures: totalPlayMeasures,
      sequence: activeSequence,
    });
    // resume + config are intentionally read-only inside the effect;
    // the dep array only needs the values that drive WHEN to save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPlaying,
    state.beatInMeasure,
    state.measureInSession,
    activeSequence,
  ]);

  // Reset the per-session saved-measure tracker whenever the engine
  // returns to idle (either user-pressed Stop or natural end) so the
  // next Start re-saves from measure 1 onward.
  const prevPhaseRef = useRef(state.phase);
  useEffect(() => {
    if (prevPhaseRef.current !== "idle" && state.phase === "idle") {
      lastSavedMeasureRef.current = 0;
      // Natural completion path — clear the resume blob so the
      // banner doesn't reappear after a finished drill. (The Stop
      // button branch in handleToggle ALSO clears; double-clear is
      // harmless.)
      resume.clear();
      // If the drill ended WITHOUT the user pressing Stop AND the
      // drill was fixed-length (not an indefinite loop), surface a
      // stats overlay celebrating the finish.
      if (!userStoppedRef.current && !config.repeatIndefinitely) {
        const start = sessionStartRef.current ?? Date.now();
        const elapsedMs = Date.now() - start;
        const samples = bpmSamplesRef.current;
        const avgBpm =
          samples.length > 0
            ? Math.round(
                samples.reduce((a, b) => a + b, 0) / samples.length,
              )
            : config.bpm;
        setCompletedSummary({
          drillName: currentDrill?.name ?? null,
          totalMeasures: config.drillMeasures * config.repetitions,
          elapsedMs,
          avgBpm,
        });
      }
    }
    prevPhaseRef.current = state.phase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const isLongForm = config.notationStyle === "long-form";

  const bumpBpm = (delta: number) => {
    const next = Math.max(BPM_MIN, Math.min(BPM_MAX, config.bpm + delta));
    if (next === config.bpm) return;
    config.setBpm(next);
    // Push the live tempo to the metronome transport immediately so the
    // change takes effect at the next tick, even mid-drill.
    metronomeEngine.setBpm(next);
  };

  // Half / double tempo — the woodshed workflow (play full speed,
  // drop to half to figure out a passage, kick back to full to
  // verify). Mid-drill so the change applies without a Stop+Start.
  const scaleBpm = (factor: number) => {
    const next = Math.max(
      BPM_MIN,
      Math.min(BPM_MAX, Math.round(config.bpm * factor)),
    );
    if (next === config.bpm) return;
    config.setBpm(next);
    metronomeEngine.setBpm(next);
  };

  // (Session stats refs/state are declared earlier in the component
  // body — above handleToggle — so React's immutability lint sees the
  // useState declaration before any reference to its setter.)

  // Sample the live BPM every time it changes during play so we can
  // average it for the stats card. Skips during idle / count-in.
  useEffect(() => {
    if (!isPlaying) return;
    bpmSamplesRef.current.push(config.bpm);
  }, [isPlaying, config.bpm]);

  // Mid-drill jump targets — computed once per render against the live
  // sequence so the button enabled/disabled states stay accurate as the
  // user advances through chord runs.
  const currentBeatIndex = isPlaying ? absoluteBeat - 1 : 0;
  const jumpTargets = useMemo(() => {
    if (!isPlaying || activeSequence === null) {
      return { restart: null, skip: null, rewind: null };
    }
    return {
      restart: currentChordStartIndex(activeSequence, currentBeatIndex),
      skip: nextChordStartIndex(activeSequence, currentBeatIndex),
      rewind: prevChordStartIndex(activeSequence, currentBeatIndex),
    };
  }, [isPlaying, activeSequence, currentBeatIndex]);

  // Chord-run start indexes — used to key the two-pane animations so
  // the panels only retrigger their fade-and-rise when the actual
  // chord changes, not on every beat. Falls back to 0 when idle / no
  // sequence yet so the keys stay stable through the count-in.
  const currentRunStart = jumpTargets.restart ?? 0;
  const nextRunStart = jumpTargets.skip ?? 0;

  // "Restart" at the very first beat of the very first chord is a no-op,
  // so we disable it there — otherwise the button is always available
  // during play, including transition beats (where it restarts the just-
  // played chord, the user's instinctive recovery move).
  const canRestart =
    jumpTargets.restart !== null && jumpTargets.restart < currentBeatIndex;
  const canSkip = jumpTargets.skip !== null;
  const canRewind = jumpTargets.rewind !== null;

  const jumpTo = (target: number | null) => {
    if (target === null) return;
    metronomeEngine.jumpToBeat(target);
  };

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/practice"
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to setup"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Setup</span>
          </Link>
          {currentDrill && (
            <span className="hidden sm:flex items-center gap-2">
              <span className="text-muted-foreground/40">|</span>
              <span className="text-sm font-medium text-foreground truncate max-w-[18rem]">
                {currentDrill.name}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <span className="text-foreground" title="Active arpeggio pattern">
            {headerPatternLabel}
          </span>
          {RANDOM_ORDERING_STRATEGIES.has(config.orderingStrategy) && (
            <span className="text-primary">Random</span>
          )}
          {config.repeatIndefinitely && (
            <span className="text-primary">Loop ∞</span>
          )}
          {config.transitionCount > 0 && (
            <span className="text-primary">
              Prep {config.transitionCount}
              {config.transitionUnit === "measures" ? "m" : "b"}
            </span>
          )}
          {/* Mid-drill jump controls — only visible while playing.
              Restart/skip/rewind let the user redo a flubbed chord or
              jump ahead without restarting the whole drill. */}
          {isPlaying && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => jumpTo(jumpTargets.rewind)}
                disabled={!canRewind}
                aria-label="Rewind one chord"
                title="Rewind one chord"
                className="flex h-6 w-6 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <SkipBack className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => jumpTo(jumpTargets.restart)}
                disabled={!canRestart}
                aria-label="Restart current chord"
                title="Restart current chord"
                className="flex h-6 w-6 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => jumpTo(jumpTargets.skip)}
                disabled={!canSkip}
                aria-label="Skip to next chord"
                title="Skip to next chord"
                className="flex h-6 w-6 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <SkipForward className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          )}
          {/* Live tempo controls — all adjust the metronome AND the
              persisted config in one click; work mid-drill without a
              Stop+Start. ±5 for fine tuning, ÷2 and ×2 for woodshedding
              (play full speed → drop to half → kick back to full). */}
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scaleBpm(0.5)}
              disabled={config.bpm <= BPM_MIN}
              aria-label="Halve tempo"
              title="Halve tempo (÷2)"
              className="flex h-5 px-1.5 items-center justify-center rounded-sm border border-border bg-background font-mono text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              &divide;2
            </button>
            <button
              type="button"
              onClick={() => bumpBpm(-5)}
              disabled={config.bpm <= BPM_MIN}
              aria-label="Decrease tempo by 5 BPM"
              className="flex h-5 w-5 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="h-3 w-3" aria-hidden="true" />
            </button>
            <span className="text-foreground tabular-nums w-12 text-center">
              ♩={config.bpm}
            </span>
            <button
              type="button"
              onClick={() => bumpBpm(+5)}
              disabled={config.bpm >= BPM_MAX}
              aria-label="Increase tempo by 5 BPM"
              className="flex h-5 w-5 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scaleBpm(2)}
              disabled={config.bpm >= BPM_MAX}
              aria-label="Double tempo"
              title="Double tempo (×2)"
              className="flex h-5 px-1.5 items-center justify-center rounded-sm border border-border bg-background font-mono text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              &times;2
            </button>
          </span>
          <span>
            {config.timeSignature.beatsPerMeasure}/
            {config.timeSignature.beatUnit}
          </span>
          <span>
            {config.repeatIndefinitely
              ? `${config.drillMeasures} measures / rep`
              : `${config.drillMeasures} × ${config.repetitions} = ${totalPlayMeasures} measures`}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-3xl flex-col items-center gap-10">
          <PhaseBadge
            isIdle={isIdle}
            isCountIn={isCountIn}
            isPlaying={isPlaying}
            isTransition={isPlaying && isTransition}
            countInRemaining={state.countInBeatsRemaining}
            measure={state.measureInSession}
            totalMeasures={totalPlayMeasures}
          />

          {/* Progress bar — peripheral indicator of how far through a
              fixed-length drill the user is. The wrapper is ALWAYS
              rendered (with reserved h-1 height) so the chord panels
              below don't jump when the bar appears/disappears during
              prep <-> play transitions. Visibility is controlled by
              opacity, not conditional render. Hidden entirely for
              indefinite loops since there's no total to track. */}
          {totalPlayMeasures !== null && totalPlayMeasures > 0 && (
            <div
              className={`h-1 w-full max-w-md overflow-hidden rounded-full bg-border/60 transition-opacity duration-300 ${
                isPlaying && !isTransition ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden="true"
            >
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.min(100, (state.measureInSession / totalPlayMeasures) * 100)}%`,
                }}
              />
            </div>
          )}

          {practiceLayout === "two-pane" ? (
            <TwoPaneDisplay
              currentLabel={currentLabel}
              nextLabel={nextLabel}
              currentPattern={currentPattern}
              nextPattern={nextPattern}
              patternDisplay={patternDisplay}
              activeNoteIdx={activeNoteIdx}
              isLongForm={isLongForm}
              isIdle={isIdle}
              isPreparing={isPreparing}
              beatTick={beatTick}
              // Keys are chord-RUN-stable (not beat-stable) so the
              // fade-and-rise animation only retriggers when the
              // chord actually changes — not on every beat tick.
              currentChordKey={`${bigDisplayChord.root}-${bigDisplayChord.quality}-${currentRunStart}`}
              nextChordKey={
                nextChord
                  ? `${nextChord.root}-${nextChord.quality}-${nextRunStart}`
                  : "none"
              }
            />
          ) : (
            <>
              {/* NEXT preview always shows the upcoming different chord +
                  the pattern to play over it — this is the only place the
                  user reads what's coming. The metronome's stick-click
                  sound during prep beats does the "don't play yet"
                  signaling, not the visual. */}
              {nextLabel && !isIdle ? (
                <div className="flex items-center gap-3 font-mono text-sm text-muted-foreground">
                  <span className="uppercase tracking-wider text-xs">Next</span>
                  <span
                    className={`font-semibold text-foreground/80 ${
                      isLongForm ? "text-lg" : "text-2xl"
                    } leading-none tracking-tight`}
                  >
                    {nextLabel}
                  </span>
                  <PatternSubtitle
                    pattern={nextPattern}
                    mode={patternDisplay}
                    activeNoteIdx={-1}
                    tone="secondary"
                  />
                </div>
              ) : (
                <div className="h-6" aria-hidden="true" />
              )}

              {/* Big chord — anchored on the most-recently-PLAYED chord.
                  Stays put during prep beats so the visual stays calm; the
                  audio change (stick-click) is the prep signal. During
                  prep a beat-synced pulsing ring + amber glow wraps the
                  chord block, mirroring the two-pane Now panel treatment.
                  Opacity dims to 0.5 during prep (same scale as two-pane).
              */}
              <div className="relative flex flex-col items-center gap-3 px-8 py-6 rounded-xl">
                {isPreparing && (
                  <motion.span
                    // Re-keying on each beat re-mounts the span,
                    // restarting the initial → animate transition.
                    // The ring flash lands ON each audio click.
                    key={beatTick}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0.25 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-1 rounded-xl ring-4 ring-primary"
                    style={{
                      boxShadow:
                        "0 0 18px 2px rgba(245, 158, 11, 0.7)",
                    }}
                  />
                )}
                <div
                  className={`relative z-10 font-mono font-semibold leading-none tracking-tight transition-opacity duration-300 text-center text-foreground ${
                    isLongForm ? "text-6xl sm:text-7xl" : "text-[12rem]"
                  }`}
                  style={{
                    opacity: isIdle ? 0.35 : isPreparing ? 0.5 : 1,
                  }}
                  aria-live="polite"
                >
                  {currentLabel}
                </div>
                {!isIdle && (
                  <span className="relative z-10 text-xs">
                    <PatternSubtitle
                      pattern={currentPattern}
                      mode={patternDisplay}
                      activeNoteIdx={activeNoteIdx}
                      tone="primary"
                    />
                  </span>
                )}
              </div>
            </>
          )}

          <BeatDots
            beatsPerMeasure={beatsPerMeasure}
            activeBeat={isIdle ? 0 : state.beatInMeasure}
            isTransition={!isIdle && isTransition}
          />

          <button
            type="button"
            onClick={handleToggle}
            className="flex items-center gap-3 rounded-full bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            aria-label={isIdle ? "Start practice" : "Stop practice"}
          >
            {isIdle ? (
              <>
                <Play className="h-5 w-5" aria-hidden="true" />
                Start
              </>
            ) : (
              <>
                <Square className="h-5 w-5" aria-hidden="true" />
                Stop
              </>
            )}
          </button>
        </div>
      </div>
      {completedSummary && (
        <DrillCompleteOverlay
          summary={completedSummary}
          onPracticeAgain={() => {
            setCompletedSummary(null);
            handleToggle();
          }}
          onDismiss={() => setCompletedSummary(null)}
        />
      )}
    </main>
  );
}

/**
 * Drill-complete summary overlay — celebratory wrap-up when a fixed-
 * length (non-looping) drill ends naturally. Stays on top of the
 * drill screen until the user dismisses or presses Practice again.
 *
 * Reuses dismiss patterns from the feedback modal: Esc closes, click
 * outside closes, explicit X button. The "Practice again" button
 * resets stats tracking and re-fires handleToggle for a fresh run.
 */
function DrillCompleteOverlay({
  summary,
  onPracticeAgain,
  onDismiss,
}: {
  summary: CompletedSummary;
  onPracticeAgain: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const minutes = Math.floor(summary.elapsedMs / 60000);
  const seconds = Math.round((summary.elapsedMs % 60000) / 1000);
  const elapsedLabel =
    minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-background/85 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drill-complete-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-5 rounded-lg border border-primary/40 bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-primary">
              Drill complete
            </span>
            <h2
              id="drill-complete-title"
              className="text-xl font-semibold text-foreground"
            >
              {summary.drillName ?? "Nice work!"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <StatItem label="Measures" value={String(summary.totalMeasures)} />
          <StatItem label="Time" value={elapsedLabel} />
          <StatItem
            label="Avg BPM"
            value={`♩=${summary.avgBpm}`}
          />
        </dl>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Link
            href="/practice"
            onClick={onDismiss}
            className="rounded-md border border-border bg-background px-4 py-2 text-center text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            Back to setup
          </Link>
          <button
            type="button"
            onClick={onPracticeAgain}
            className="rounded-md border border-primary/40 bg-primary/20 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/30 transition-colors"
          >
            Practice again
          </button>
        </div>
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-background px-3 py-2 text-center">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono text-sm font-semibold text-foreground tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/**
 * Pattern subtitle — renders the pattern info below a chord on the
 * drill screen. In "name" mode it's a static text label. In "degrees"
 * mode each digit is its own span and the one at `activeNoteIdx`
 * gets a primary-color highlight, pulsing in time with when that
 * note should be played (Phase 12). Pass activeNoteIdx = -1 to
 * suppress all highlighting (Next panel, idle, prep).
 */
function PatternSubtitle({
  pattern,
  mode,
  activeNoteIdx,
  tone,
}: {
  pattern: ArpeggioPattern;
  mode: "name" | "degrees" | "hidden";
  /** -1 = no highlight. Otherwise the index of the note currently playing. */
  activeNoteIdx: number;
  /** "primary" (Now) gets normal contrast; "secondary" (Next) is dimmer. */
  tone: "primary" | "secondary";
}) {
  if (mode === "hidden") return null;
  const baseClass =
    tone === "secondary"
      ? "font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70"
      : "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

  if (mode === "name") {
    return <span className={baseClass}>{getPatternShortName(pattern)}</span>;
  }
  // degrees mode — per-digit rendering
  const segments = parsePatternDegrees(pattern);
  return (
    <span
      className={baseClass}
      aria-label={`Scale degrees: ${getPatternDegrees(pattern)}`}
    >
      {segments.map((seg, i) => {
        const isActive = activeNoteIdx === seg.idx;
        const isPast = activeNoteIdx > seg.idx;
        return (
          <span key={seg.idx} className="inline-flex items-baseline">
            <motion.span
              animate={{
                scale: isActive ? 1.4 : 1,
                opacity: isActive ? 1 : isPast ? 0.4 : 0.9,
              }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className={`inline-block min-w-[0.75em] text-center ${
                isActive
                  ? "text-primary font-semibold"
                  : isPast
                    ? "text-muted-foreground/50"
                    : ""
              }`}
              style={{ originY: 0.5 }}
            >
              {seg.label}
            </motion.span>
            {i < segments.length - 1 && (
              <span className="opacity-30">-</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function PhaseBadge({
  isIdle,
  isCountIn,
  isPlaying,
  isTransition,
  countInRemaining,
  measure,
  totalMeasures,
}: {
  isIdle: boolean;
  isCountIn: boolean;
  isPlaying: boolean;
  /** True only when playing AND currently in a prep/transition beat. */
  isTransition: boolean;
  countInRemaining: number;
  measure: number;
  /** Null when the drill loops indefinitely. */
  totalMeasures: number | null;
}) {
  // Unified "preparation" treatment: pulsing dot + amber label text
  // applies during count-in AND during inter-chord transition windows.
  // Both use the stick-click sound; the badge mirrors that.
  const isPreparing = isCountIn || isTransition;
  let label: string;
  if (isIdle) {
    label = "Ready";
  } else if (isCountIn) {
    label = `Count-in · ${countInRemaining}`;
  } else if (isTransition) {
    // Drop the "Measure N · " prefix during the prep window between
    // chords — that measure has technically finished playing and the
    // user is preparing for the next one. "Get Ready" alone is
    // cleaner and avoids the "Measure 1 · Get Ready" ambiguity (which
    // measure am I on?). The Next panel tells the user what's
    // coming; the badge just needs to say "prep is happening."
    label = "Get Ready";
  } else if (isPlaying) {
    label =
      totalMeasures === null
        ? `Measure ${measure}`
        : `Measure ${measure} of ${totalMeasures}`;
  } else {
    label = "";
  }

  return (
    <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
      <span
        className={`inline-block h-2 w-2 rounded-full transition-colors ${
          isPreparing
            ? "bg-primary animate-pulse"
            : isPlaying
              ? "bg-primary"
              : "bg-muted-foreground/40"
        }`}
      />
      <span className={isPreparing ? "text-primary" : ""}>{label}</span>
    </div>
  );
}

function BeatDots({
  beatsPerMeasure,
  activeBeat,
  isTransition,
}: {
  beatsPerMeasure: number;
  activeBeat: number;
  isTransition: boolean;
}) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      {Array.from({ length: beatsPerMeasure }, (_, i) => {
        const beatNumber = i + 1;
        const isActive = beatNumber === activeBeat;
        const isDownbeat = beatNumber === 1;
        const baseColor = isTransition
          ? "bg-primary/40"
          : "bg-primary";
        // Beat-1 punch — when the downbeat fires during normal play
        // (not transition), an extra "ping" ring radiates outward
        // around the dot. Gives a third visual signal of the meter
        // (alongside the existing scale-up and the audio click) for
        // users who want to lock to the beat visually.
        const showDownbeatPunch =
          isActive && isDownbeat && !isTransition;
        return (
          <div
            key={beatNumber}
            className="relative flex h-3 w-3 items-center justify-center"
          >
            <div
              className={`absolute inset-0 rounded-full transition-all duration-100 ${
                isActive
                  ? isDownbeat
                    ? `${baseColor} scale-150`
                    : `${isTransition ? "bg-primary/30" : "bg-primary/80"} scale-125`
                  : "bg-muted-foreground/30 scale-100"
              }`}
            />
            {showDownbeatPunch && (
              <span className="absolute inset-0 rounded-full bg-primary opacity-70 animate-ping" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Two-pane practice layout — equally-weighted Now / Next panels side
 * by side. Selected from the user-prefs store; renders in place of the
 * single-pane "big chord + small NEXT preview" arrangement.
 *
 * Both panels get the same dimensions + typography so the Next chord
 * reads as comfortable read-ahead rather than peripheral hint. The
 * "Now" panel gets a subtle primary-tinted background to anchor focus
 * (which one to play right now).
 *
 * AnimatePresence keyed on the chord-RUN-start index (not beat index)
 * produces a fade-and-rise transition ONLY when the chord changes,
 * not on every beat. Earlier versions keyed on the beat index, which
 * made both panels blink every tick — visually loud and conflicted
 * with the per-beat dot animation that's already there.
 *
 * Count-in vs play distinction: the panels render at 70% opacity
 * during count-in (mirroring the aural distinction the stick-click
 * makes vs the tonal click). Snaps to 100% when play begins.
 *
 * Pattern label: each panel shows the arpeggio pattern below the
 * chord so the user always sees both "what chord" and "what pattern
 * to play over it" at a glance. Once pattern-pool ordering ships, the
 * label will differ per panel; for now it's the global pattern.
 */
function TwoPaneDisplay({
  currentLabel,
  nextLabel,
  currentPattern,
  nextPattern,
  patternDisplay,
  activeNoteIdx,
  isLongForm,
  isIdle,
  isPreparing,
  beatTick,
  currentChordKey,
  nextChordKey,
}: {
  currentLabel: string;
  nextLabel: string | null;
  /** Pattern playing under the Now chord; rendered as PatternSubtitle. */
  currentPattern: ArpeggioPattern;
  /** Pattern that will play under the Next chord. */
  nextPattern: ArpeggioPattern;
  /** name / degrees / hidden — drives subtitle rendering. */
  patternDisplay: "name" | "degrees" | "hidden";
  /** Currently playing note index in the current measure (-1 if no highlight). */
  activeNoteIdx: number;
  isLongForm: boolean;
  isIdle: boolean;
  /**
   * True when the metronome is in EITHER count-in or inter-chord
   * transition mode. Drives the unified visual prep treatment so the
   * panels look the same whenever the audio is in stick-click mode.
   */
  isPreparing: boolean;
  /**
   * Per-beat monotonic key. Used by the prep ring overlay to flash
   * synchronized to the audio clicks — when this string changes, the
   * ring re-mounts and re-fires its initial-to-animate transition.
   */
  beatTick: string;
  currentChordKey: string;
  nextChordKey: string;
}) {
  const chordTextSize = isLongForm
    ? "text-3xl sm:text-4xl"
    : "text-7xl sm:text-8xl";
  // Opacity applied via inline style (not Tailwind class) so the value
  // is guaranteed to land regardless of class purging. Count-in gets a
  // deeper dim than the initial "opacity-70 was too subtle to notice"
  // pass — 0.5 reads as unmistakably "this is preparation."
  // Three distinct states with well-separated opacity values. Earlier
  // versions had idle (0.45) and count-in (0.5) almost identical, which
  // made count-in invisible to the user — the only visible transition
  // was idle → playing on Stop. Now idle = 0.4, count-in = 0.8,
  // playing = 1.0 — both transitions clearly LIGHT UP the chord.
  // Combined with the per-panel label swap ("Now" -> "Get ready") and
  // the pulsing border on the Now panel, count-in is unmissable.
  // 0.5 during prep — half-bright vs full play (1.0), unmistakable.
  // Still brighter than idle's 0.35 so prep and "stopped" don't read
  // as the same thing.
  const containerOpacity = isIdle ? 0.35 : isPreparing ? 0.5 : 1;
  return (
    <div
      className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 transition-opacity duration-300"
      style={{ opacity: containerOpacity }}
      aria-live="polite"
    >
      <TwoPanePanel
        label={isPreparing ? "Get ready" : "Now"}
        emphasized
        pulsing={isPreparing}
        beatTick={beatTick}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentChordKey}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col items-center gap-2"
          >
            <span
              className={`font-mono font-semibold leading-none tracking-tight text-foreground text-center ${chordTextSize}`}
            >
              {currentLabel}
            </span>
            <PatternSubtitle
              pattern={currentPattern}
              mode={patternDisplay}
              activeNoteIdx={activeNoteIdx}
              tone="primary"
            />
          </motion.div>
        </AnimatePresence>
      </TwoPanePanel>
      {/* Next panel — hidden entirely during prep (user explicitly
          chose hide over dim 2026-06-29). The Now panel stays in its
          grid cell (left); the right cell becomes empty space so the
          student's attention is fully on the chord they're about to
          play. AnimatePresence handles a smooth fade-out / fade-in so
          the transition isn't jarring. */}
      <AnimatePresence initial={false}>
        {!isPreparing && (
          <motion.div
            key="next-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
      <TwoPanePanel label="Next">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={nextChordKey}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col items-center gap-2"
          >
            <span
              className={`font-mono font-semibold leading-none tracking-tight text-foreground/70 text-center ${chordTextSize}`}
            >
              {nextLabel ?? "—"}
            </span>
            {nextLabel && (
              <PatternSubtitle
                pattern={nextPattern}
                mode={patternDisplay}
                activeNoteIdx={-1}
                tone="secondary"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </TwoPanePanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TwoPanePanel({
  label,
  emphasized,
  pulsing,
  beatTick,
  children,
}: {
  label: string;
  emphasized?: boolean;
  /**
   * When true, a beat-synchronized ring overlay flashes on every
   * audio click — count-in beats and inter-chord prep beats. The
   * overlay is keyed on `beatTick` so it re-mounts each beat,
   * re-firing the flash animation. Result: the visual pulse lands
   * ON the audio click, not on a fixed 2s loop that's out of phase.
   */
  pulsing?: boolean;
  /** Monotonic per-beat key — drives the ring-flash animation. */
  beatTick?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`relative flex flex-col items-center justify-center gap-4 rounded-xl border px-6 py-10 min-h-[14rem] ${
        emphasized
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card/40"
      }`}
    >
      {pulsing && (
        <motion.span
          // Re-keying on each beat re-mounts the span, which restarts
          // the initial → animate transition. That's how the ring
          // flashes ON the audio beat instead of looping out-of-phase.
          key={beatTick}
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 0.25, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          aria-hidden="true"
          className="pointer-events-none absolute -inset-0.5 rounded-xl ring-4 ring-primary"
          // Amber glow boxShadow added inline so it pulses in lockstep
          // with the ring opacity. The 18px blur reads as a clear
          // "halo" around the panel edge during the flash.
          style={{ boxShadow: "0 0 18px 2px rgba(245, 158, 11, 0.7)" }}
        />
      )}
      <span
        className={`relative z-10 font-mono text-[11px] uppercase tracking-wider ${
          emphasized ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <div className="relative z-10 flex flex-col items-center gap-4">
        {children}
      </div>
    </section>
  );
}
