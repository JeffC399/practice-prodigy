"use client";

import { metronomeEngine } from "@/lib/audio/metronome";
import { useMetronome } from "@/lib/audio/use-metronome";
import { ARPEGGIO_PATTERN_SHORT_NAMES } from "@/lib/music/arpeggio";
import { renderChord } from "@/lib/music/render-chord";
import {
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
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const { state, start, stop } = useMetronome();

  // When the user launched this session from a Quick Start card, anchor
  // their context by showing the drill's name in the header.
  const currentDrill = config.loadedDrillId
    ? drillsLib.drills.find((d) => d.id === config.loadedDrillId) ?? null
    : null;

  const isIdle = state.phase === "idle";
  const isCountIn = state.phase === "count-in";
  const isPlaying = state.phase === "playing";

  const beatsPerMeasure = config.timeSignature.beatsPerMeasure;
  const countInBeats = config.countInMeasures * beatsPerMeasure;

  // Idle preview: deterministic walk through the pool. For random
  // strategies we fall back to "custom" so the preview shows the
  // user's pool in the order they added it — no point pre-randomizing
  // a preview the user is going to re-randomize at Start anyway.
  // Transitions are also off here for a cleaner preview.
  const previewStrategy = RANDOM_ORDERING_STRATEGIES.has(
    config.orderingStrategy,
  )
    ? ("custom" as const)
    : config.orderingStrategy;
  const idlePreviewSequence = useMemo(
    () =>
      generateSequence({
        pool: config.chordPool,
        orderingStrategy: previewStrategy,
        drillMeasures: config.drillMeasures,
        repetitions: config.repetitions,
        repeatIndefinitely: false,
        timeSignature: config.timeSignature,
        transitionUnit: config.transitionUnit,
        transitionCount: 0,
      }),
    [
      config.chordPool,
      previewStrategy,
      config.drillMeasures,
      config.repetitions,
      config.timeSignature,
      config.transitionUnit,
    ],
  );

  const [activeSequence, setActiveSequence] = useState<
    SequenceBeat[] | null
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

  const handleToggle = () => {
    if (isIdle) {
      // Resume path — start from a previously-interrupted session,
      // re-using its pre-rolled sequence (so random strategies don't
      // re-shuffle to a new chord at the resume position) and skipping
      // the count-in (resume = continue, not restart).
      const r = resume.active;
      if (resumeFromUrl && r) {
        setActiveSequence(r.sequence);
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
      // session for resume the next time they hit /practice.
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
          <span className="text-foreground">
            {ARPEGGIO_PATTERN_SHORT_NAMES[config.arpeggioPattern]}
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
            countInRemaining={state.countInBeatsRemaining}
            measure={state.measureInSession}
            totalMeasures={totalPlayMeasures}
          />

          {practiceLayout === "two-pane" ? (
            <TwoPaneDisplay
              currentLabel={currentLabel}
              nextLabel={nextLabel}
              isLongForm={isLongForm}
              isIdle={isIdle}
              currentChordKey={`${bigDisplayChord.root}-${bigDisplayChord.quality}-${absoluteBeat - 1}`}
              nextChordKey={
                nextChord
                  ? `${nextChord.root}-${nextChord.quality}-${absoluteBeat - 1}`
                  : "none"
              }
            />
          ) : (
            <>
              {/* NEXT preview always shows the upcoming different chord —
                  this is the only place the user reads what's coming. The
                  metronome's stick-click sound during prep beats does the
                  "don't play yet" signaling, not the visual. */}
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
                </div>
              ) : (
                <div className="h-6" aria-hidden="true" />
              )}

              {/* Big chord — anchored on the most-recently-PLAYED chord.
                  Stays put during prep beats so the visual stays calm; the
                  audio change (stick-click) is the prep signal. */}
              <div
                className={`font-mono font-semibold leading-none tracking-tight transition-opacity duration-200 text-center text-foreground ${
                  isLongForm ? "text-6xl sm:text-7xl" : "text-[12rem]"
                } ${isIdle ? "opacity-40" : "opacity-100"}`}
                aria-live="polite"
              >
                {currentLabel}
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
    </main>
  );
}

function PhaseBadge({
  isIdle,
  isCountIn,
  isPlaying,
  countInRemaining,
  measure,
  totalMeasures,
}: {
  isIdle: boolean;
  isCountIn: boolean;
  isPlaying: boolean;
  countInRemaining: number;
  measure: number;
  /** Null when the drill loops indefinitely. */
  totalMeasures: number | null;
}) {
  let label: string;
  if (isIdle) {
    label = "Ready";
  } else if (isCountIn) {
    label = `Count-in · ${countInRemaining}`;
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
          isPlaying
            ? "bg-primary"
            : isCountIn
              ? "bg-primary/60"
              : "bg-muted-foreground/40"
        }`}
      />
      <span>{label}</span>
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
        return (
          <div
            key={beatNumber}
            className={`h-3 w-3 rounded-full transition-all duration-100 ${
              isActive
                ? isDownbeat
                  ? `${baseColor} scale-150`
                  : `${isTransition ? "bg-primary/30" : "bg-primary/80"} scale-125`
                : "bg-muted-foreground/30 scale-100"
            }`}
          />
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
 * AnimatePresence + per-chord keys produce a fade-and-rise transition
 * when chords change. The animation is intentionally short (180ms) so
 * mid-drill chord changes never feel like the UI is lagging behind
 * the audio.
 */
function TwoPaneDisplay({
  currentLabel,
  nextLabel,
  isLongForm,
  isIdle,
  currentChordKey,
  nextChordKey,
}: {
  currentLabel: string;
  nextLabel: string | null;
  isLongForm: boolean;
  isIdle: boolean;
  currentChordKey: string;
  nextChordKey: string;
}) {
  const chordTextSize = isLongForm
    ? "text-3xl sm:text-4xl"
    : "text-7xl sm:text-8xl";
  return (
    <div
      className={`grid w-full grid-cols-1 gap-6 sm:grid-cols-2 ${
        isIdle ? "opacity-50" : "opacity-100"
      } transition-opacity duration-200`}
      aria-live="polite"
    >
      <TwoPanePanel label="Now" emphasized>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentChordKey}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`font-mono font-semibold leading-none tracking-tight text-foreground text-center ${chordTextSize}`}
          >
            {currentLabel}
          </motion.div>
        </AnimatePresence>
      </TwoPanePanel>
      <TwoPanePanel label="Next">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={nextChordKey}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`font-mono font-semibold leading-none tracking-tight text-foreground/70 text-center ${chordTextSize}`}
          >
            {nextLabel ?? "—"}
          </motion.div>
        </AnimatePresence>
      </TwoPanePanel>
    </div>
  );
}

function TwoPanePanel({
  label,
  emphasized,
  children,
}: {
  label: string;
  emphasized?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col items-center justify-center gap-4 rounded-xl border px-6 py-10 min-h-[14rem] ${
        emphasized
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card/40"
      }`}
    >
      <span
        className={`font-mono text-[11px] uppercase tracking-wider ${
          emphasized ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      {children}
    </section>
  );
}
