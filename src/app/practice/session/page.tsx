"use client";

import { metronomeEngine } from "@/lib/audio/metronome";
import { useMetronome } from "@/lib/audio/use-metronome";
import { ARPEGGIO_PATTERN_SHORT_NAMES } from "@/lib/music/arpeggio";
import { renderChord } from "@/lib/music/render-chord";
import {
  findNextDifferentChord,
  generateSequence,
  type SequenceBeat,
} from "@/lib/music/sequence";
import {
  BPM_MAX,
  BPM_MIN,
  usePracticeConfig,
} from "@/lib/state/practice-config";
import { useDrillsLibrary } from "@/lib/state/drills-library";
import { Minus, Play, Plus, Square, Settings2 } from "lucide-react";
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

  // Idle preview: deterministic order with NO transitions so the user
  // sees the canonical pool walk. Active sequence (sampled fresh on
  // each Start) uses the real settings including transitions.
  const idlePreviewSequence = useMemo(
    () =>
      generateSequence({
        pool: config.chordPool,
        orderingStrategy: config.orderingStrategy,
        drillMeasures: config.drillMeasures,
        repetitions: config.repetitions,
        repeatIndefinitely: false,
        randomizeChords: false,
        timeSignature: config.timeSignature,
        transitionUnit: config.transitionUnit,
        transitionCount: 0,
      }),
    [
      config.chordPool,
      config.orderingStrategy,
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

  // The metronome reports (measure, beatInMeasure). Convert to a 1-indexed
  // absolute beat counter so we can index into the beat-level sequence.
  const absoluteBeat =
    isPlaying && state.measureInSession > 0
      ? (state.measureInSession - 1) * beatsPerMeasure + state.beatInMeasure
      : 1;
  const currentEntry = useMemo<SequenceBeat>(
    () =>
      sequence[absoluteBeat - 1] ??
      sequence[0] ??
      ({ chord: config.chordPool[0], kind: "play" } as SequenceBeat),
    [sequence, absoluteBeat, config.chordPool],
  );
  const isTransition = currentEntry.kind === "transition";

  /**
   * Big-display chord: the most recently PLAYED chord. During prep
   * beats this means the big display stays anchored on the chord
   * that was just played, rather than swapping in the upcoming
   * chord. The NEXT preview below already shows what's coming, so
   * the big display would just be redundant + jarring if it changed.
   */
  const bigDisplayChord = useMemo(() => {
    if (currentEntry.kind === "play") return currentEntry.chord;
    // Walk backward through the sequence to find the last play beat.
    for (let i = absoluteBeat - 2; i >= 0; i--) {
      if (sequence[i].kind === "play") return sequence[i].chord;
    }
    // No prior play beat (very first measure is a transition, which
    // shouldn't happen since generation skips the first transition,
    // but defensively): show whatever's at this position.
    return currentEntry.chord;
  }, [absoluteBeat, currentEntry, sequence]);

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
  const autoStartFiredRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("autostart") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoStartFromUrl(true);
      // Strip the flag so a refresh doesn't auto-relaunch the drill.
      const url = new URL(window.location.href);
      url.searchParams.delete("autostart");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleToggle = () => {
    if (isIdle) {
      // Fresh sequence at every Start. For randomizeChords this
      // re-samples (the "fresh sample per rep" semantic the user picked);
      // for deterministic it's a harmless rebuild.
      const fresh = generateSequence({
        pool: config.chordPool,
        orderingStrategy: config.orderingStrategy,
        drillMeasures: config.drillMeasures,
        repetitions: config.repetitions,
        repeatIndefinitely: config.repeatIndefinitely,
        randomizeChords: config.randomizeChords,
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
      stop();
    }
  };

  // Trigger autostart once when conditions align. The ref ensures we
  // never fire twice even if handleToggle's identity changes.
  useEffect(() => {
    if (autoStartFromUrl && isIdle && !autoStartFiredRef.current) {
      autoStartFiredRef.current = true;
      handleToggle();
    }
    // handleToggle has unstable identity; the ref guards against
    // duplicate invocation, so exhaustive-deps is intentionally
    // omitted here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartFromUrl, isIdle]);

  const isLongForm = config.notationStyle === "long-form";

  const bumpBpm = (delta: number) => {
    const next = Math.max(BPM_MIN, Math.min(BPM_MAX, config.bpm + delta));
    if (next === config.bpm) return;
    config.setBpm(next);
    // Push the live tempo to the metronome transport immediately so the
    // change takes effect at the next tick, even mid-drill.
    metronomeEngine.setBpm(next);
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
          {config.randomizeChords && (
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
          {/* Live tempo nudge — adjusts the metronome and the persisted
              config in one click; works mid-drill. */}
          <span className="flex items-center gap-1">
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
