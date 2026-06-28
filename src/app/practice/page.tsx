"use client";

import { useMetronome } from "@/lib/audio/use-metronome";
import { Play, Square } from "lucide-react";
import Link from "next/link";

/**
 * v1 first-slice practice screen.
 *
 * Hardcoded so we can dial in the audio timing in isolation:
 *   - Chord: A-7
 *   - Tempo: 90 BPM
 *   - Time signature: 4/4
 *   - Count-in: 1 measure (4 beats)
 *   - Playing: 8 measures (32 beats)
 *
 * Everything here will become configurable in the next slice. The single goal
 * of this slice is: does the click feel solid against a real bass?
 */
const HARDCODED_CONFIG = {
  bpm: 90,
  beatsPerMeasure: 4,
  beatUnit: 4 as const,
  countInBeats: 4,
  totalPlayingBeats: 32,
} as const;

const CHORD_LABEL = "A−7";

export default function PracticePage() {
  const { state, start, stop } = useMetronome();
  const isIdle = state.phase === "idle";
  const isCountIn = state.phase === "count-in";
  const isPlaying = state.phase === "playing";

  const handleToggle = () => {
    if (isIdle) {
      void start(HARDCODED_CONFIG);
    } else {
      stop();
    }
  };

  return (
    <main className="flex flex-1 flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Practice Prodigy
        </Link>
        <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <span>{HARDCODED_CONFIG.bpm} BPM</span>
          <span>
            {HARDCODED_CONFIG.beatsPerMeasure}/{HARDCODED_CONFIG.beatUnit}
          </span>
          <span>v1 slice · hardcoded</span>
        </div>
      </header>

      {/* Practice surface */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-3xl flex-col items-center gap-12">
          {/* Phase indicator */}
          <PhaseBadge
            isIdle={isIdle}
            isCountIn={isCountIn}
            isPlaying={isPlaying}
            countInRemaining={state.countInBeatsRemaining}
            measure={state.measureInSession}
            totalMeasures={
              HARDCODED_CONFIG.totalPlayingBeats /
              HARDCODED_CONFIG.beatsPerMeasure
            }
          />

          {/* The chord — the entire point of the screen */}
          <div
            className={`font-mono font-semibold text-foreground text-[12rem] leading-none tracking-tight transition-opacity duration-200 ${
              isIdle ? "opacity-40" : "opacity-100"
            }`}
            aria-live="polite"
          >
            {CHORD_LABEL}
          </div>

          {/* Beat dots */}
          <BeatDots
            beatsPerMeasure={HARDCODED_CONFIG.beatsPerMeasure}
            activeBeat={isIdle ? 0 : state.beatInMeasure}
          />

          {/* Transport */}
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
