"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Minus, Pause, Play, Plus, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMetronome } from "@/lib/audio/use-metronome";
import { keyDisplay } from "@/lib/key-sequencer/display";
import { buildKeySequence } from "@/lib/key-sequencer/sequencer";
import { useKeySequencerConfig } from "@/lib/key-sequencer/config-store";
import { BPM_MAX, BPM_MIN } from "@/lib/state/practice-config";

/**
 * Key Sequencer drill screen — Phase 45.2.
 *
 * Silent + metronome-only playback (locked design 2026-07-11). No
 * chord voicings, no melody engine — the user's instrument is
 * whatever they're holding.
 *
 * Layout mirrors the Bass Arpeggios session page shell:
 *   • Sticky top bar: back to setup, drill context, tempo controls
 *   • Center: Now / Next cards showing key + prompt-row words
 *   • Bottom: Start/Stop button + beat indicator
 *
 * Session begins with the user pressing Start (browser audio needs
 * a user gesture). Space toggles Start/Stop from anywhere on the
 * page except when typing in an input.
 */

export default function KeySequencerSessionPage() {
  const config = useKeySequencerConfig();
  const { state, start, stop } = useMetronome();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Build the sequence once per config; regenerate on Start so
  // random strategies get a fresh sample.
  const [sessionSeed, setSessionSeed] = useState(() => Date.now());
  const steps = useMemo(
    () => buildKeySequence(config, { sessionSeed }),
    [config, sessionSeed],
  );

  const beatsPerMeasure = config.timeSignature.beatsPerMeasure;
  const totalPlayingBeats = steps.length * beatsPerMeasure;

  // Which step (measure) are we in? Absolute beat = 1..totalPlayingBeats
  // during playing; 0 during idle / count-in.
  const currentStepIdx = useMemo(() => {
    if (state.phase !== "playing") return -1;
    // absoluteBeat is 1-indexed. Measure index is 0-based.
    return Math.min(
      steps.length - 1,
      Math.max(0, Math.floor((state.absoluteBeat - 1) / beatsPerMeasure)),
    );
  }, [state.phase, state.absoluteBeat, beatsPerMeasure, steps.length]);

  const currentStep = currentStepIdx >= 0 ? steps[currentStepIdx] : null;
  const nextStep =
    currentStepIdx >= 0 && currentStepIdx + 1 < steps.length
      ? steps[currentStepIdx + 1]
      : null;

  const isIdle = state.phase === "idle";
  const isCountIn = state.phase === "count-in";
  const isPlaying = state.phase === "playing";

  const handleStart = useCallback(async () => {
    if (isPlaying || isCountIn) return;
    if (config.keyPool.length === 0) return;
    setSessionSeed(Date.now());
    await start({
      bpm: config.bpm,
      beatsPerMeasure,
      beatUnit: config.timeSignature.beatUnit,
      countInBeats: config.countInMeasures * beatsPerMeasure,
      totalPlayingBeats: config.repeatIndefinitely
        ? undefined
        : totalPlayingBeats,
    });
  }, [
    isPlaying,
    isCountIn,
    config,
    beatsPerMeasure,
    totalPlayingBeats,
    start,
  ]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const handleToggle = useCallback(() => {
    if (isPlaying || isCountIn) handleStop();
    else handleStart();
  }, [isPlaying, isCountIn, handleStop, handleStart]);

  const bumpBpm = (delta: number) => {
    const next = Math.min(BPM_MAX, Math.max(BPM_MIN, config.bpm + delta));
    useKeySequencerConfig.getState().setBpm(next);
  };

  // Space = Start/Stop. Guarded so users can type in inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      handleToggle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleToggle]);

  if (!mounted) {
    return (
      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center px-6 py-12"
      >
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Loading Key Sequencer…
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <Link
          href="/practice/keys"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Setup
        </Link>
        <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <span className="text-foreground" title="Beats per minute">
            ♩ = {config.bpm}
          </span>
          <span>
            {beatsPerMeasure}/{config.timeSignature.beatUnit}
          </span>
          <span>
            {config.keyPool.length} keys ×{" "}
            {config.repeatIndefinitely ? "loop" : `${config.repetitions} passes`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => bumpBpm(-5)}
            disabled={config.bpm <= BPM_MIN}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            aria-label="Decrease tempo by 5"
            title="−5 BPM"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="min-w-[3.5rem] text-center font-mono text-sm">
            ♩={config.bpm}
          </span>
          <button
            type="button"
            onClick={() => bumpBpm(5)}
            disabled={config.bpm >= BPM_MAX}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            aria-label="Increase tempo by 5"
            title="+5 BPM"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Center — Now / Next cards */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-8">
        {config.keyPool.length === 0 ? (
          <EmptyPoolState />
        ) : (
          <>
            <div className="flex w-full max-w-3xl flex-col items-center gap-6">
              <NowCard
                step={currentStep}
                isIdle={isIdle}
                isCountIn={isCountIn}
                config={config}
              />
              <NextCard step={nextStep} config={config} />
            </div>

            <BeatDots
              beatsPerMeasure={beatsPerMeasure}
              currentBeat={state.beatInMeasure}
              isPlaying={isPlaying}
              isCountIn={isCountIn}
              countInRemaining={state.countInBeatsRemaining}
            />

            <button
              type="button"
              onClick={handleToggle}
              disabled={config.keyPool.length === 0}
              className={`flex items-center gap-2 rounded-full px-8 py-3 text-lg font-medium shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98] ${
                isPlaying || isCountIn
                  ? "bg-rose-500 text-white hover:bg-rose-600"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {isPlaying || isCountIn ? (
                <>
                  <Square className="h-5 w-5" aria-hidden="true" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" aria-hidden="true" />
                  Start
                </>
              )}
            </button>
            <p className="text-xs text-muted-foreground">
              Space to Start / Stop
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function NowCard({
  step,
  isIdle,
  isCountIn,
  config,
}: {
  step: import("@/lib/key-sequencer/sequencer").KeySequencerStep | null;
  isIdle: boolean;
  isCountIn: boolean;
  config: import("@/lib/key-sequencer/types").KeySequencerConfig;
}) {
  const label = isCountIn ? "Get ready" : "Now";
  const emphasis =
    isIdle || isCountIn ? "opacity-60" : "";
  const displayStep = step ?? {
    isRest: false,
    key: config.keyPool[0] ?? null,
    rowWords: config.promptRows.map(() => "—"),
    measureInRun: 0,
    passIndex: 0,
  };

  const enharmonicPreference = config.enharmonicPreference ?? "auto";

  return (
    <div
      className={`relative flex w-full flex-col items-center gap-4 rounded-xl border-2 border-primary/40 bg-primary/5 px-6 py-8 transition-opacity ${emphasis}`}
    >
      <span className="font-mono text-xs uppercase tracking-wider text-primary">
        {label}
      </span>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${displayStep.key}-${displayStep.rowWords.join("|")}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="flex flex-col items-center gap-2"
        >
          {displayStep.isRest ? (
            <span className="text-6xl font-semibold text-muted-foreground">
              Rest
            </span>
          ) : (
            <span className="text-8xl font-semibold text-foreground leading-none">
              {displayStep.key
                ? keyDisplay(
                    displayStep.key,
                    enharmonicPreference,
                    config.keyOrdering,
                  )
                : "—"}
            </span>
          )}
          {!displayStep.isRest && (
            <div className="flex flex-col items-center gap-1">
              {displayStep.rowWords.map((w, i) => (
                <span
                  key={i}
                  className="text-lg text-muted-foreground"
                >
                  {w || <span className="opacity-40">—</span>}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function NextCard({
  step,
  config,
}: {
  step: import("@/lib/key-sequencer/sequencer").KeySequencerStep | null;
  config: import("@/lib/key-sequencer/types").KeySequencerConfig;
}) {
  if (!step) {
    return (
      <div className="flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-border/60 bg-background/30 px-4 py-4 opacity-70">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          Next
        </span>
        <span className="text-sm text-muted-foreground">— end —</span>
      </div>
    );
  }
  const enharmonicPreference = config.enharmonicPreference ?? "auto";
  return (
    <div className="flex w-full flex-col items-center gap-1 rounded-md border border-border bg-card/40 px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Next
      </span>
      {step.isRest ? (
        <span className="text-xl font-semibold text-muted-foreground">
          Rest
        </span>
      ) : (
        <>
          <span className="text-3xl font-semibold text-foreground leading-none">
            {step.key
              ? keyDisplay(
                  step.key,
                  enharmonicPreference,
                  config.keyOrdering,
                )
              : "—"}
          </span>
          <div className="flex flex-col items-center">
            {step.rowWords.map((w, i) => (
              <span key={i} className="text-xs text-muted-foreground/80">
                {w || <span className="opacity-40">—</span>}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BeatDots({
  beatsPerMeasure,
  currentBeat,
  isPlaying,
  isCountIn,
  countInRemaining,
}: {
  beatsPerMeasure: number;
  currentBeat: number;
  isPlaying: boolean;
  isCountIn: boolean;
  countInRemaining: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: beatsPerMeasure }).map((_, i) => {
        const beatIdx = i + 1;
        const active =
          isPlaying && currentBeat === beatIdx
            ? true
            : isCountIn && beatIdx === beatsPerMeasure - countInRemaining + 1
              ? true
              : false;
        return (
          <span
            key={i}
            className={`h-3 w-3 rounded-full transition-all ${
              active
                ? "bg-primary scale-125"
                : "bg-muted-foreground/30"
            }`}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

function EmptyPoolState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-background/30 px-8 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        No keys selected. Go back to setup and pick at least one key.
      </p>
      <Link
        href="/practice/keys"
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Back to setup
      </Link>
    </div>
  );
}
