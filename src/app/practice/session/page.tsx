"use client";

import { useMetronome } from "@/lib/audio/use-metronome";
import { renderChord } from "@/lib/music/render-chord";
import { usePracticeConfig } from "@/lib/state/practice-config";
import { Play, Square, Settings2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

/**
 * Active drill screen. Reads the active practice configuration from the
 * persisted store and runs the metronome accordingly. The setup screen
 * (/practice) is the entry point; this route is where the actual drilling
 * happens.
 */
export default function PracticeSessionPage() {
  const config = usePracticeConfig();
  const { state, start, stop } = useMetronome();

  const isIdle = state.phase === "idle";
  const isCountIn = state.phase === "count-in";
  const isPlaying = state.phase === "playing";

  const totalPlayingBeats =
    config.sessionMeasures * config.timeSignature.beatsPerMeasure;
  const countInBeats =
    config.countInMeasures * config.timeSignature.beatsPerMeasure;

  const chordLabel = useMemo(
    () => renderChord(config.chord, config.notationStyle),
    [config.chord, config.notationStyle],
  );

  const handleToggle = () => {
    if (isIdle) {
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
          <span>{config.bpm} BPM</span>
          <span>
            {config.timeSignature.beatsPerMeasure}/
            {config.timeSignature.beatUnit}
          </span>
          <span>{config.sessionMeasures} measures</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-3xl flex-col items-center gap-12">
          <PhaseBadge
            isIdle={isIdle}
            isCountIn={isCountIn}
            isPlaying={isPlaying}
            countInRemaining={state.countInBeatsRemaining}
            measure={state.measureInSession}
            totalMeasures={config.sessionMeasures}
          />

          <div
            className={`font-mono font-semibold text-foreground leading-none tracking-tight transition-opacity duration-200 text-center ${
              config.notationStyle === "long-form"
                ? "text-6xl sm:text-7xl"
                : "text-[12rem]"
            } ${isIdle ? "opacity-40" : "opacity-100"}`}
            aria-live="polite"
          >
            {chordLabel}
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
  totalMeasures: number;
}) {
  let label: string;
  if (isIdle) {
    label = "Ready";
  } else if (isCountIn) {
    label = `Count-in · ${countInRemaining}`;
  } else if (isPlaying) {
    label = `Measure ${measure} of ${totalMeasures}`;
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
