"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Play, Plus, Settings2, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMetronome } from "@/lib/audio/use-metronome";
import { keyDisplay, keySpokenForm } from "@/lib/key-sequencer/display";
import { buildKeySequence } from "@/lib/key-sequencer/sequencer";
import { useKeySequencerConfig } from "@/lib/key-sequencer/config-store";
import {
  cancelVoiceAnnounce,
  speakUpcoming,
} from "@/lib/key-sequencer/voice-announce";
import {
  BPM_MAX,
  BPM_MIN,
  RANDOM_ORDERING_STRATEGIES,
} from "@/lib/state/practice-config";
import { useUserPrefs } from "@/lib/state/user-prefs";

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
  const practiceLayout = useUserPrefs((s) => s.practiceLayout);
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

  // Phase 46 — beatStyles for prep/transition measures. Every beat of
  // a step where isRest = true gets played with the stick-click audio
  // (matches Arpeggios' transition behavior).
  const beatStyles = useMemo(() => {
    const styles: Array<"play" | "transition"> = [];
    for (const step of steps) {
      for (let b = 0; b < beatsPerMeasure; b++) {
        styles.push(step.isRest ? "transition" : "play");
      }
    }
    return styles;
  }, [steps, beatsPerMeasure]);

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

  // Phase 52 — DISPLAY step differs from LOGIC step when idle. While
  // idle we want to preview the sequence's actual first step (which
  // for random orderings requires the sessionSeed we'd use at Start).
  // For play control (restartCurrentKey / skipToNextKey) we still
  // gate on `currentStepIdx >= 0` because those are only meaningful
  // when actually playing.
  const displayStepIdx = currentStepIdx >= 0 ? currentStepIdx : 0;
  const currentStep = steps[displayStepIdx] ?? null;
  const nextStep = steps[displayStepIdx + 1] ?? null;

  const isIdle = state.phase === "idle";
  const isCountIn = state.phase === "count-in";
  const isPlaying = state.phase === "playing";

  const handleStart = useCallback(async () => {
    if (isPlaying || isCountIn) return;
    if (config.keyPool.length === 0) return;
    // Phase 52 — do NOT regenerate sessionSeed here. The user must
    // see the same first-key preview they get when they hit Start.
    // Seed is set once on mount + refreshable via the Shuffle button.
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

  const bumpBpm = (delta: number) => {
    const next = Math.min(BPM_MAX, Math.max(BPM_MIN, config.bpm + delta));
    useKeySequencerConfig.getState().setBpm(next);
  };

  const halveBpm = () => {
    const next = Math.max(BPM_MIN, Math.round(config.bpm / 2));
    useKeySequencerConfig.getState().setBpm(next);
  };

  const doubleBpm = () => {
    const next = Math.min(BPM_MAX, config.bpm * 2);
    useKeySequencerConfig.getState().setBpm(next);
  };

  /**
   * Phase 53 — Restart-current-key / skip-next-key removed per
   * user request (2026-07-12). The Space keyboard shortcut plus
   * Stop / Start covers the same intent with less UI clutter.
   */

  // Phase 45.7 — voice announcement scheduling. Fires an utterance
  // `leadBeats` beats BEFORE each measure change (or on beat 1 of
  // measure 1 as a heads-up). Uses lastAnnouncedStep to fire once per
  // upcoming measure. Cancels on stop / unmount below.
  const [lastAnnouncedStep, setLastAnnouncedStep] = useState<number>(-1);
  const va = config.voiceAnnounce;
  useEffect(() => {
    if (!va?.enabled) return;
    if (!isPlaying) return;
    if (currentStepIdx < 0) return;

    // Beat within the CURRENT measure (1..beatsPerMeasure).
    const beat = state.beatInMeasure;
    if (beat === 0) return;

    const leadBeats = Math.max(1, Math.min(4, va.leadBeats));
    // Fire when we're `leadBeats` beats away from the end of the
    // current measure, OR immediately on beat 1 of the very first
    // measure so the user gets an initial heads-up.
    const isFirstBeatOfFirstMeasure =
      beat === 1 && currentStepIdx === 0 && lastAnnouncedStep !== 0;
    const isLeadIntoNext =
      beat >= beatsPerMeasure - leadBeats + 1 &&
      currentStepIdx + 1 < steps.length &&
      lastAnnouncedStep !== currentStepIdx + 1;

    if (!isFirstBeatOfFirstMeasure && !isLeadIntoNext) return;

    const targetIdx = isFirstBeatOfFirstMeasure ? 0 : currentStepIdx + 1;
    const target = steps[targetIdx];
    if (!target || target.isRest || !target.key) {
      setLastAnnouncedStep(targetIdx);
      return;
    }

    const spokenKey = keySpokenForm(
      target.key,
      config.enharmonicPreference ?? "auto",
      config.keyOrdering,
    );
    const text =
      va.template === "key-only"
        ? `${spokenKey}.`
        : [spokenKey, ...target.rowWords.filter((w) => w.length > 0)]
            .join(". ") + ".";
    speakUpcoming(text, va.rate);
    setLastAnnouncedStep(targetIdx);
  }, [
    va,
    isPlaying,
    state.beatInMeasure,
    currentStepIdx,
    beatsPerMeasure,
    steps,
    config.enharmonicPreference,
    config.keyOrdering,
    lastAnnouncedStep,
  ]);

  // Cancel any pending utterance whenever the drill stops OR the
  // component unmounts.
  useEffect(() => {
    if (!isPlaying && !isCountIn) cancelVoiceAnnounce();
  }, [isPlaying, isCountIn]);
  useEffect(() => {
    return () => cancelVoiceAnnounce();
  }, []);

  // Reset the "last announced" tracker whenever a fresh Start happens.
  useEffect(() => {
    if (isCountIn) setLastAnnouncedStep(-1);
  }, [isCountIn]);

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
      {/* Phase 56 — Header rebuilt to mirror Arpeggios exactly.
          Layout: [Setup link] | [status chips] [jump controls]
          [tempo cluster] [time-sig] [drill length]. Chips use the
          same font-mono / uppercase / primary-accent conventions. */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/practice/keys"
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to setup"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Setup</span>
          </Link>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {/* Status chips — same treatment as Arpeggios: Random /
              Loop ∞ / Prep <N><unit>. Primary tint highlights active
              non-default settings. */}
          {RANDOM_ORDERING_STRATEGIES.has(config.keyOrdering) && (
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
          {/* Tempo cluster — verbatim port from Arpeggios (÷2 / -5 /
              readout / +5 / ×2 in compact h-5 chips). */}
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
            {config.keyPool.length} keys ×{" "}
            {config.repeatIndefinitely
              ? "loop"
              : `${config.repetitions} ${
                  config.repetitions === 1 ? "pass" : "passes"
                }`}
          </span>
        </div>
      </header>

      {/* Center — Now / Next cards */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-8">
        {config.keyPool.length === 0 ? (
          <EmptyPoolState />
        ) : (
          <>
            {/* Phase 53 — PhaseBadge above the panes, matching Arpeggios.
                Dot + label: "Ready" / "Count-in · N" / "Get Ready" /
                "Measure N of M". Same colors, same pulse behavior. */}
            <PhaseBadge
              isIdle={isIdle}
              isCountIn={isCountIn}
              isPlaying={isPlaying}
              isTransition={isPlaying && !!currentStep?.isRest}
              countInRemaining={state.countInBeatsRemaining}
              measure={state.measureInSession}
              totalMeasures={
                // Phase 57 — always show "of N". When looping, N is
                // the pool-scan length (one full cycle). Non-loop is
                // the fully expanded steps.length.
                config.repeatIndefinitely
                  ? config.keyPool.length *
                    Math.max(1, config.measuresPerKey)
                  : steps.length
              }
            />

            {(() => {
              // Phase 51 — During prep the Next panel disappears
              // completely (Arpeggios pattern), and the Now panel's
              // pulsing ring keys off beatTick so it flashes ON each
              // metronome click. beatTick = step + measure + beat so
              // it advances exactly once per audible beat.
              const isPrep = !!currentStep && currentStep.isRest;
              const isPreparing = isCountIn || isPrep;
              // Phase 54 — beatTick advances on EVERY beat including
              // count-in. Arpeggios uses the same pattern:
              // countInBeatsRemaining changes during count-in and
              // absoluteBeat changes during play. Together they make
              // a per-beat unique key so the pulse animation re-mounts
              // on every metronome click regardless of phase.
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
                        // Phase 54 — w-full so this fills the grid cell
                        // and matches the Now pane's width exactly.
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
  beatTick,
}: {
  step: import("@/lib/key-sequencer/sequencer").KeySequencerStep | null;
  isIdle: boolean;
  isCountIn: boolean;
  config: import("@/lib/key-sequencer/types").KeySequencerConfig;
  /**
   * Phase 51 — Re-keyed each beat during prep so the pulsing ring
   * animation re-mounts and flashes ON every metronome click.
   * Matches Arpeggios' two-pane Now-panel pulse behavior exactly.
   * Phase 54 — string so count-in beats (which don't advance
   * beatInMeasure) still change the key on every click.
   */
  beatTick: string;
}) {
  const isPrep = !!step && step.isRest;
  const isPreparing = isCountIn || isPrep;
  const label = isPreparing ? "Get ready" : "Now";
  const emphasis = isIdle ? "opacity-35" : isPreparing ? "opacity-60" : "";
  // Phase 52 — the caller now passes an ACTUAL step from the built
  // sequence for the idle preview (steps[0]) so we never fall back
  // to raw pool[0]. Empty-pool sanity guard only.
  const displayStep = step ?? {
    isRest: false,
    key: null as import("@/lib/key-sequencer/types").KeyPitchClass | null,
    rowWords: config.promptRows.map(() => "—"),
    measureInRun: 0,
    passIndex: 0,
    upcomingKey: undefined as
      | import("@/lib/key-sequencer/types").KeyPitchClass
      | undefined,
  };

  const enharmonicPreference = config.enharmonicPreference ?? "auto";

  // During prep we show the UPCOMING key (what you're getting ready
  // to play). During play we show the current step's key.
  const bigKey = displayStep.isRest
    ? (displayStep.upcomingKey ?? null)
    : displayStep.key;

  return (
    <div
      // Phase 57 — dimensions ported verbatim from Arpeggios'
      // TwoPanePanel (emphasized variant): single border weight,
      // primary/60 border, primary/10 bg, shadow-sm, py-10 padding,
      // min-h-[14rem] so both panes share the same height regardless
      // of content. See TwoPanePanel in practice/session/page.tsx.
      className={`relative flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-primary/60 bg-primary/10 px-6 py-10 shadow-sm transition-opacity min-h-[14rem] ${emphasis}`}
    >
      {/* Phase 53 — Beat-synced pulsing ring during prep. Matches
          Arpeggios exactly: ring-4 ring-primary + amber boxShadow
          glow, re-keyed on beatTick so the initial → animate fires
          on each audio click.
          Phase 57 — ring inset trimmed to -0.5 to match Arpeggios. */}
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
          // Key change re-triggers the fade only when the KEY OR PREP
          // STATE changes — not on every beat tick.
          key={`${bigKey}-${isPrep ? "prep" : "play"}-${displayStep.rowWords.join("|")}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="relative z-10 flex flex-col items-center gap-2"
        >
          <span className="text-8xl font-semibold text-foreground leading-none">
            {bigKey
              ? keyDisplay(
                  bigKey,
                  enharmonicPreference,
                  config.keyOrdering,
                )
              : "—"}
          </span>
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
        // Rest / prep measure — show upcoming key only, no "(prep)"
        // decoration. The pulsing Now panel + PhaseBadge already
        // communicate the prep state.
        step.upcomingKey ? (
          <span className="text-3xl font-semibold text-foreground/70 leading-none">
            {keyDisplay(
              step.upcomingKey,
              enharmonicPreference,
              config.keyOrdering,
            )}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">— end —</span>
        )
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

/**
 * Two-pane variant of the Next card — equal-weight side-by-side
 * pane matching the Bass Arpeggios two-pane layout convention. The
 * key + words are sized larger than the single-pane Next preview so
 * both panes read as balanced peers.
 */
function TwoPaneNextCard({
  step,
  config,
}: {
  step: import("@/lib/key-sequencer/sequencer").KeySequencerStep | null;
  config: import("@/lib/key-sequencer/types").KeySequencerConfig;
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
  return (
    <div
      // Phase 57 — dimensions ported from Arpeggios' TwoPanePanel
      // (non-emphasized variant): border-border/60, bg-card/20,
      // py-10, min-h-[14rem]. Matches the Now pane's outer footprint
      // so the two-pane grid renders as truly symmetric cells.
      className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-xl border border-border/60 bg-card/20 px-6 py-10 min-h-[14rem]"
    >
      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Next
      </span>
      {step.isRest ? (
        // Rest / prep measure — show upcoming key only, no "(prep)"
        // decoration. See single-pane NextCard.
        step.upcomingKey ? (
          <span className="text-7xl font-semibold text-foreground/60 leading-none">
            {keyDisplay(
              step.upcomingKey,
              enharmonicPreference,
              config.keyOrdering,
            )}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">— end —</span>
        )
      ) : (
        <>
          <span className="text-7xl font-semibold text-foreground/70 leading-none">
            {step.key
              ? keyDisplay(
                  step.key,
                  enharmonicPreference,
                  config.keyOrdering,
                )
              : "—"}
          </span>
          <div className="flex flex-col items-center gap-1">
            {step.rowWords.map((w, i) => (
              <span key={i} className="text-base text-muted-foreground/80">
                {w || <span className="opacity-40">—</span>}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Phase 53 — PhaseBadge port from the Arpeggios session page. Unifies
 * the "we're preparing" treatment across the two modules: pulsing
 * primary dot + primary-tinted label during count-in AND inter-key
 * prep windows. Idle → grey dot, playing → solid primary dot.
 */
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
    // Phase 57 — modulo the measure for parity with Arpeggios.
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
