"use client";

import { metronomeEngine } from "@/lib/audio/metronome";
import { useMetronome } from "@/lib/audio/use-metronome";
import { ARPEGGIO_PATTERN_SHORT_NAMES } from "@/lib/music/arpeggio";
import { renderChord } from "@/lib/music/render-chord";
import { generateSequence } from "@/lib/music/sequence";
import {
  BPM_MAX,
  BPM_MIN,
  usePracticeConfig,
} from "@/lib/state/practice-config";
import { Minus, Play, Plus, Square, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Chord } from "@/lib/music/chord";

/**
 * Active drill screen. Reads the active practice configuration from the
 * persisted store, generates a fresh chord sequence on Start, and runs
 * the metronome through it.
 *
 * Sequence drilling: the per-measure chord assignments are pre-computed
 * once per Start (via `generateSequence`) and looked up by measure
 * number. For randomized drills this means every Start re-samples,
 * exactly matching the "fresh sample per rep" semantic the user chose.
 *
 * NEXT chord preview is rendered above the current chord
 * (PROJECT-DESIGN.md §4.1 Always-Visible mode); Late-Reveal lands in
 * a polish slice.
 */
export default function PracticeSessionPage() {
  const config = usePracticeConfig();
  const { state, start, stop } = useMetronome();

  const isIdle = state.phase === "idle";
  const isCountIn = state.phase === "count-in";
  const isPlaying = state.phase === "playing";

  const totalMeasures = config.repeatIndefinitely
    ? null
    : config.drillMeasures * config.repetitions;
  const totalPlayingBeats =
    totalMeasures !== null
      ? totalMeasures * config.timeSignature.beatsPerMeasure
      : undefined;
  const countInBeats =
    config.countInMeasures * config.timeSignature.beatsPerMeasure;

  // Idle preview: always shows the deterministic order so the user can
  // see what the drill looks like before pressing Start. The actual
  // randomized sequence is sampled fresh in handleToggle so randomized
  // drills get a new pull each time the user starts. Idle preview is
  // never indefinite — only the active play uses the large buffer.
  const idlePreviewSequence = useMemo(
    () =>
      generateSequence({
        pool: config.chordPool,
        orderingStrategy: config.orderingStrategy,
        drillMeasures: config.drillMeasures,
        repetitions: config.repetitions,
        repeatIndefinitely: false,
        randomizeChords: false,
      }),
    [
      config.chordPool,
      config.orderingStrategy,
      config.drillMeasures,
      config.repetitions,
    ],
  );

  const [activeSequence, setActiveSequence] = useState<Chord[] | null>(null);
  const sequence = isIdle
    ? idlePreviewSequence
    : (activeSequence ?? idlePreviewSequence);

  const activeMeasure =
    isPlaying && state.measureInSession > 0 ? state.measureInSession : 1;
  const currentChord = sequence[activeMeasure - 1] ?? sequence[0];
  const nextChord =
    activeMeasure < sequence.length ? sequence[activeMeasure] : null;

  const currentLabel = useMemo(
    () => renderChord(currentChord, config.notationStyle),
    [currentChord, config.notationStyle],
  );
  const nextLabel = useMemo(
    () =>
      nextChord ? renderChord(nextChord, config.notationStyle) : null,
    [nextChord, config.notationStyle],
  );

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
      setActiveSequence(
        generateSequence({
          pool: config.chordPool,
          orderingStrategy: config.orderingStrategy,
          drillMeasures: config.drillMeasures,
          repetitions: config.repetitions,
          repeatIndefinitely: config.repeatIndefinitely,
          randomizeChords: config.randomizeChords,
        }),
      );
      void start({
        bpm: config.bpm,
        beatsPerMeasure: config.timeSignature.beatsPerMeasure,
        beatUnit: config.timeSignature.beatUnit,
        countInBeats,
        totalPlayingBeats,
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
        <Link
          href="/practice"
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to setup"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Setup</span>
        </Link>
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
              : `${config.drillMeasures} × ${config.repetitions} = ${totalMeasures} measures`}
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
            totalMeasures={totalMeasures}
          />

          {/* NEXT preview */}
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

          {/* Current chord */}
          <div
            className={`font-mono font-semibold text-foreground leading-none tracking-tight transition-opacity duration-200 text-center ${
              isLongForm ? "text-6xl sm:text-7xl" : "text-[12rem]"
            } ${isIdle ? "opacity-40" : "opacity-100"}`}
            aria-live="polite"
          >
            {currentLabel}
          </div>

          <BeatDots
            beatsPerMeasure={config.timeSignature.beatsPerMeasure}
            activeBeat={isIdle ? 0 : state.beatInMeasure}
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
}: {
  beatsPerMeasure: number;
  activeBeat: number;
}) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      {Array.from({ length: beatsPerMeasure }, (_, i) => {
        const beatNumber = i + 1;
        const isActive = beatNumber === activeBeat;
        const isDownbeat = beatNumber === 1;
        return (
          <div
            key={beatNumber}
            className={`h-3 w-3 rounded-full transition-all duration-100 ${
              isActive
                ? isDownbeat
                  ? "bg-primary scale-150"
                  : "bg-primary/80 scale-125"
                : "bg-muted-foreground/30 scale-100"
            }`}
          />
        );
      })}
    </div>
  );
}
