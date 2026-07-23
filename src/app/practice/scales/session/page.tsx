"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Play, Plus, Settings2, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { metronomeEngine } from "@/lib/audio/metronome";
import { useMetronome } from "@/lib/audio/use-metronome";
import { useScaleDrillConfig } from "@/lib/scale-driller/config-store";
import {
  scaleInstanceDisplay,
  scaleSecondaryTokens,
} from "@/lib/scale-driller/display";
import { buildScaleSequence } from "@/lib/scale-driller/sequencer";
import {
  BPM_MAX,
  BPM_MIN,
  RANDOM_ORDERING_STRATEGIES,
} from "@/lib/state/practice-config";
import { useUserPrefs } from "@/lib/state/user-prefs";
import { useSessionTracker } from "@/lib/tracking/session-tracker";

/**
 * Scale Driller drill screen — Phase 62.
 *
 * Mirrors the Key Sequencer session page exactly: sticky top bar,
 * center Now/Next panes, bottom Start/Stop + beat dots. Space toggles
 * Start/Stop. Same tempo cluster, same PhaseBadge, same prep-window
 * pulse. Differences: big label is "D Dorian" (root + scale name)
 * with a secondary line showing spelled notes or interval degrees.
 */

export default function ScaleDrillerSessionPage() {
  const config = useScaleDrillConfig();
  const practiceLayout = useUserPrefs((s) => s.practiceLayout);
  const { state, start, stop } = useMetronome();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const [sessionSeed] = useState(() => Date.now());
  const steps = useMemo(
    () => buildScaleSequence(config, { sessionSeed }),
    [config, sessionSeed],
  );

  const beatsPerMeasure = config.timeSignature.beatsPerMeasure;
  const totalPlayingBeats = steps.length * beatsPerMeasure;

  const beatStyles = useMemo(() => {
    const styles: Array<"play" | "transition"> = [];
    for (const step of steps) {
      for (let b = 0; b < beatsPerMeasure; b++) {
        styles.push(step.isRest ? "transition" : "play");
      }
    }
    return styles;
  }, [steps, beatsPerMeasure]);

  const currentStepIdx = useMemo(() => {
    if (state.phase !== "playing") return -1;
    return Math.min(
      steps.length - 1,
      Math.max(0, Math.floor((state.absoluteBeat - 1) / beatsPerMeasure)),
    );
  }, [state.phase, state.absoluteBeat, beatsPerMeasure, steps.length]);

  const displayStepIdx = currentStepIdx >= 0 ? currentStepIdx : 0;
  const currentStep = steps[displayStepIdx] ?? null;
  const nextStep = steps[displayStepIdx + 1] ?? null;

  const isIdle = state.phase === "idle";
  const isCountIn = state.phase === "count-in";
  const isPlaying = state.phase === "playing";

  const handleStart = useCallback(async () => {
    if (isPlaying || isCountIn) return;
    if (config.scalePool.length === 0) return;
    await start({
      bpm: config.bpm,
      beatsPerMeasure,
      beatUnit: config.timeSignature.beatUnit,
      countInBeats: config.countInMeasures * beatsPerMeasure,
      totalPlayingBeats: config.repeatIndefinitely
        ? undefined
        : totalPlayingBeats,
      beatStyles,
    });
  }, [
    isPlaying,
    isCountIn,
    config,
    beatsPerMeasure,
    totalPlayingBeats,
    beatStyles,
    start,
  ]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const handleToggle = useCallback(() => {
    if (isPlaying || isCountIn) handleStop();
    else handleStart();
  }, [isPlaying, isCountIn, handleStop, handleStart]);

  // Slice A.8 (Phase 88) — Central session tracker heartbeat while
  // playing. Same pattern as Arpeggios + Key Sequencer.
  useEffect(() => {
    if (!isPlaying) return;
    useSessionTracker.getState().reportActivity({
      module: "scale-driller",
      itemId: config.loadedScaleDrillId ?? undefined,
    });
  }, [isPlaying, state.measureInSession, config.loadedScaleDrillId]);

  // Live tempo updates during drill (matches Arpeggios / Key Sequencer).
  const bumpBpm = (delta: number) => {
    const next = Math.min(BPM_MAX, Math.max(BPM_MIN, config.bpm + delta));
    if (next === config.bpm) return;
    useScaleDrillConfig.getState().setBpm(next);
    metronomeEngine.setBpm(next);
  };

  const halveBpm = () => {
    const next = Math.max(BPM_MIN, Math.round(config.bpm / 2));
    if (next === config.bpm) return;
    useScaleDrillConfig.getState().setBpm(next);
    metronomeEngine.setBpm(next);
  };

  const doubleBpm = () => {
    const next = Math.min(BPM_MAX, config.bpm * 2);
    if (next === config.bpm) return;
    useScaleDrillConfig.getState().setBpm(next);
    metronomeEngine.setBpm(next);
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
          Loading Scale Driller…
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/practice/scales"
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to setup"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Setup</span>
          </Link>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {RANDOM_ORDERING_STRATEGIES.has(config.ordering) && (
            <span className="text-primary">Random</span>
          )}
          {config.repeatIndefinitely && (
            <span className="text-primary">Loop ∞</span>
          )}
          {(() => {
            const unit = config.transitionUnit ?? "measures";
            const count =
              unit === "measures"
                ? (config.transitionMeasures ?? 0)
                : (config.transitionBeats ?? 0);
            return count > 0 ? (
              <span className="text-primary">
                Prep {count}
                {unit === "measures" ? "m" : "b"}
              </span>
            ) : null;
          })()}
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={halveBpm}
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
              onClick={doubleBpm}
              disabled={config.bpm >= BPM_MAX}
              aria-label="Double tempo"
              title="Double tempo (×2)"
              className="flex h-5 px-1.5 items-center justify-center rounded-sm border border-border bg-background font-mono text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              &times;2
            </button>
          </span>
          <span>
            {beatsPerMeasure}/{config.timeSignature.beatUnit}
          </span>
          <span>
            {config.scalePool.length} scales ×{" "}
            {config.repeatIndefinitely
              ? "loop"
              : `${config.repetitions} ${
                  config.repetitions === 1 ? "pass" : "passes"
                }`}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-8">
        {config.scalePool.length === 0 ? (
          <EmptyPoolState />
        ) : (
          <>
            <PhaseBadge
              isIdle={isIdle}
              isCountIn={isCountIn}
              isPlaying={isPlaying}
              isTransition={isPlaying && !!currentStep?.isRest}
              countInRemaining={state.countInBeatsRemaining}
              measure={state.measureInSession}
              totalMeasures={
                config.repeatIndefinitely
                  ? config.scalePool.length *
                    Math.max(1, config.measuresPerScale)
                  : steps.length
              }
            />

            {(() => {
              const isPrep = !!currentStep && currentStep.isRest;
              const isPreparing = isCountIn || isPrep;
              const beatTick = `${state.countInBeatsRemaining}-${state.absoluteBeat}`;
              return practiceLayout === "two-pane" ? (
                <div className="grid w-full max-w-4xl grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
                  <NowCard
                    step={currentStep}
                    isIdle={isIdle}
                    isCountIn={isCountIn}
                    config={config}
                    beatTick={beatTick}
                  />
                  <AnimatePresence initial={false}>
                    {!isPreparing && (
                      <motion.div
                        key="next-panel"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="w-full"
                      >
                        <TwoPaneNextCard step={nextStep} config={config} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex w-full max-w-3xl flex-col items-center gap-6">
                  <NowCard
                    step={currentStep}
                    isIdle={isIdle}
                    isCountIn={isCountIn}
                    config={config}
                    beatTick={beatTick}
                  />
                  {/* Phase 65 — Fixed-height slot for the Next chip so
                      the Start button / beat dots below don't jump up
                      when Next fades out during count-in and prep. The
                      chip's natural height is ~86px; 6rem (96px) gives
                      it a small comfort buffer and keeps the layout
                      perfectly stable through play → prep → play. */}
                  <div className="w-full min-h-[6rem]">
                    <AnimatePresence initial={false}>
                      {!isPreparing && (
                        <motion.div
                          key="next-panel-single"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className="w-full"
                        >
                          <NextCard step={nextStep} config={config} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })()}

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
              disabled={config.scalePool.length === 0}
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
  beatTick,
}: {
  step: import("@/lib/scale-driller/sequencer").ScaleDrillStep | null;
  isIdle: boolean;
  isCountIn: boolean;
  config: import("@/lib/scale-driller/types").ScaleDrillConfig;
  beatTick: string;
}) {
  const isPrep = !!step && step.isRest;
  const isPreparing = isCountIn || isPrep;
  const label = isPreparing ? "Get ready" : "Now";
  const emphasis = isIdle ? "opacity-35" : isPreparing ? "opacity-60" : "";
  const displayStep = step ?? {
    isRest: false,
    scale: config.scalePool[0] ?? null,
    measureInRun: 0,
    passIndex: 0,
    upcomingScale: undefined,
  };

  const enharmonicPreference = config.enharmonicPreference ?? "auto";
  const bigScale = displayStep.isRest
    ? (displayStep.upcomingScale ?? null)
    : displayStep.scale;

  const secondary = bigScale
    ? scaleSecondaryTokens(
        bigScale,
        config.displayMode,
        enharmonicPreference,
        config.ordering,
      )
    : [];

  return (
    <div
      className={`relative flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-primary/60 bg-primary/10 px-6 py-10 shadow-sm transition-opacity min-h-[14rem] ${emphasis}`}
    >
      {isPreparing && (
        <motion.span
          key={beatTick}
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 0.25, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          aria-hidden="true"
          className="pointer-events-none absolute -inset-0.5 rounded-xl ring-4 ring-primary"
          style={{ boxShadow: "0 0 18px 2px rgba(245, 158, 11, 0.7)" }}
        />
      )}
      <span className="relative z-10 font-mono text-xs uppercase tracking-wider text-primary">
        {label}
      </span>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${bigScale?.root ?? "-"}-${bigScale?.quality ?? "-"}-${isPrep ? "prep" : "play"}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="relative z-10 flex flex-col items-center gap-2"
        >
          <span className="text-6xl font-semibold text-foreground leading-none">
            {bigScale
              ? scaleInstanceDisplay(
                  bigScale,
                  enharmonicPreference,
                  config.ordering,
                )
              : "—"}
          </span>
          {secondary.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-lg text-muted-foreground">
              {secondary.map((tok, i) => (
                <span key={i} className="tabular-nums">
                  {tok}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact NextCard — used in the single-pane layout so the drill
 * screen fits on one viewport without scroll. Small "NEXT" chip
 * showing the upcoming scale + notes/degrees at 1/3 the visual weight
 * of the Now panel. Mirrors Key Sequencer's single-pane NextCard.
 */
function NextCard({
  step,
  config,
}: {
  step: import("@/lib/scale-driller/sequencer").ScaleDrillStep | null;
  config: import("@/lib/scale-driller/types").ScaleDrillConfig;
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
  const bigScale = step.isRest ? step.upcomingScale ?? null : step.scale;
  const secondary = bigScale
    ? scaleSecondaryTokens(
        bigScale,
        config.displayMode,
        enharmonicPreference,
        config.ordering,
      )
    : [];
  return (
    <div className="flex w-full flex-col items-center gap-1 rounded-md border border-border bg-card/40 px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Next
      </span>
      <span className="text-3xl font-semibold text-foreground/70 leading-none">
        {bigScale
          ? scaleInstanceDisplay(
              bigScale,
              enharmonicPreference,
              config.ordering,
            )
          : "—"}
      </span>
      {secondary.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 text-xs text-muted-foreground/70">
          {secondary.map((tok, i) => (
            <span key={i} className="tabular-nums">
              {tok}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Two-pane variant of the Next card — equal-weight side-by-side pane
 * matching the Arpeggios / Key Sequencer two-pane layout convention.
 * Same text sizes as the Now pane so the "NEXT" label aligns with
 * "NOW" on the same Y coordinate.
 */
function TwoPaneNextCard({
  step,
  config,
}: {
  step: import("@/lib/scale-driller/sequencer").ScaleDrillStep | null;
  config: import("@/lib/scale-driller/types").ScaleDrillConfig;
}) {
  if (!step) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-background/20 px-6 py-10 min-h-[14rem] text-muted-foreground/60">
        <span className="font-mono text-xs uppercase tracking-wider">Next</span>
        <span className="text-sm">— end —</span>
      </div>
    );
  }
  const enharmonicPreference = config.enharmonicPreference ?? "auto";
  const bigScale = step.isRest ? step.upcomingScale ?? null : step.scale;
  const secondary = bigScale
    ? scaleSecondaryTokens(
        bigScale,
        config.displayMode,
        enharmonicPreference,
        config.ordering,
      )
    : [];

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-xl border border-border/60 bg-card/20 px-6 py-10 min-h-[14rem]">
      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Next
      </span>
      <div className="flex flex-col items-center gap-2">
        <span className="text-6xl font-semibold text-foreground/40 leading-none">
          {bigScale
            ? scaleInstanceDisplay(
                bigScale,
                enharmonicPreference,
                config.ordering,
              )
            : "—"}
        </span>
        {secondary.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-lg text-muted-foreground/60">
            {secondary.map((tok, i) => (
              <span key={i} className="tabular-nums">
                {tok}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
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
  isTransition: boolean;
  countInRemaining: number;
  measure: number;
  totalMeasures: number | null;
}) {
  const isPreparing = isCountIn || isTransition;
  let label: string;
  if (isIdle) {
    label = "Ready";
  } else if (isCountIn) {
    label = `Count-in · ${countInRemaining}`;
  } else if (isTransition) {
    label = "Get Ready";
  } else if (isPlaying) {
    if (totalMeasures === null || totalMeasures <= 0) {
      label = `Measure ${measure}`;
    } else {
      const display =
        measure > 0 ? ((measure - 1) % totalMeasures) + 1 : measure;
      label = `Measure ${display} of ${totalMeasures}`;
    }
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
        No scales selected. Go back to setup and pick at least one
        scale and one key.
      </p>
      <Link
        href="/practice/scales"
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Back to setup
      </Link>
    </div>
  );
}
