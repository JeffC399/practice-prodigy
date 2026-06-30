"use client";

import { motion } from "framer-motion";
import { AlertCircle, Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  tunerEngine,
  type TunerReading,
} from "@/lib/audio/tuner-engine";

/**
 * Tuner module (Phase 23).
 *
 * Chromatic tuner via microphone input. Big note display + cents
 * needle + Hz readout + A4 reference picker (435..445 Hz for
 * classical/period flexibility). Works for any monophonic
 * instrument; bass/guitar/voice are the primary use cases.
 *
 * The audio engine is module-level singleton (tunerEngine); this
 * page subscribes to its readings and dispatches start/stop.
 * Permissions: requests microphone access on Start; clear permission-
 * denied state if the user blocks.
 */

// Range spans every real-world tuning convention: baroque (415) at
// the low end, "sharp orchestral" (444-450) at the high end. Anything
// above ~450 isn't a real convention -- you'd transpose instead --
// so capping at 450 keeps the slider honest.
const A4_REFERENCE_MIN = 415;
const A4_REFERENCE_MAX = 450;
const A4_PRESETS = [415, 432, 440, 442, 444] as const;
/**
 * One-word context for each A4 preset. 444 has no widely-accepted
 * single-word label in classical practice ("bright" is the most
 * honest descriptive choice — higher A is perceptually brighter).
 */
const A4_PRESET_LABELS: Record<(typeof A4_PRESETS)[number], string> = {
  415: "baroque",
  432: "new-age",
  440: "standard",
  442: "modern",
  444: "bright",
};

/** Smoothing window for cents — averages last N frames to stabilize the needle. */
const CENTS_SMOOTHING_WINDOW = 6;

type MicPermissionState = "idle" | "requesting" | "granted" | "denied";

export default function TunerPage() {
  const [reading, setReading] = useState<TunerReading>({
    frequencyHz: null,
    noteName: null,
    octave: null,
    cents: null,
    rms: 0,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermissionState>(
    "idle",
  );
  const [a4Reference, setA4Reference] = useState(440);
  const [smoothedCents, setSmoothedCents] = useState(0);
  const [centsHistory] = useState<number[]>([]);
  // Sticky note display — keeps the last detected note visible during
  // brief drops in input level so the screen doesn't blink during a
  // string-pluck decay. Updated inside the engine subscription
  // callback (not synchronously in render or in a derived effect).
  const [stickyNote, setStickyNote] = useState<{
    noteName: string;
    octave: number;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = tunerEngine.subscribe((r) => {
      setReading(r);
      // Cents smoothing — only push when we have a real reading.
      if (r.cents !== null) {
        centsHistory.push(r.cents);
        if (centsHistory.length > CENTS_SMOOTHING_WINDOW) {
          centsHistory.shift();
        }
        const avg =
          centsHistory.reduce((a, b) => a + b, 0) / centsHistory.length;
        setSmoothedCents(avg);
      } else {
        centsHistory.length = 0;
        setSmoothedCents(0);
      }
      // Sticky note — only update when we have a real reading; null
      // readings leave the previous value in place so the display
      // doesn't blink between frames.
      if (r.noteName && r.octave !== null) {
        setStickyNote({ noteName: r.noteName, octave: r.octave });
      }
    });
    return () => {
      unsubscribe();
      tunerEngine.stop();
    };
  }, [centsHistory]);

  useEffect(() => {
    tunerEngine.setReferenceA4(a4Reference);
  }, [a4Reference]);

  const handleStartStop = useCallback(async () => {
    if (isRunning) {
      tunerEngine.stop();
      setIsRunning(false);
      return;
    }
    setMicPermission("requesting");
    try {
      await tunerEngine.start();
      setMicPermission("granted");
      setIsRunning(true);
    } catch (err) {
      console.error("Tuner: mic access denied", err);
      setMicPermission("denied");
      setIsRunning(false);
    }
  }, [isRunning]);

  // Tuning quality: green (in tune within ±5), yellow (close within ±15),
  // red (off). Drives the needle color + center indicator.
  const tuningQuality: "in-tune" | "close" | "off" | "idle" =
    reading.cents === null
      ? "idle"
      : Math.abs(smoothedCents) <= 5
        ? "in-tune"
        : Math.abs(smoothedCents) <= 15
          ? "close"
          : "off";


  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Tuner</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Chromatic tuner via microphone input. Pluck a note and hold —
            the needle shows how many cents off from the nearest
            equal-tempered pitch. Works for any monophonic instrument
            (bass, guitar, voice).
          </p>
        </header>

        {/* Permission denied state */}
        {micPermission === "denied" && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-destructive">
                Microphone access denied
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                The tuner needs microphone access to detect pitch. Open
                your browser&rsquo;s site settings, allow microphone for
                this site, and reload.
              </span>
            </div>
          </div>
        )}

        {/* Main display */}
        <section className="flex flex-col items-center gap-8 rounded-2xl border border-border bg-card/40 px-8 py-10">
          {/* Big note display */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={`font-mono text-9xl font-semibold tracking-tight tabular-nums leading-none transition-colors duration-150 ${
                tuningQuality === "in-tune"
                  ? "text-primary"
                  : tuningQuality === "idle"
                    ? "text-muted-foreground/30"
                    : "text-foreground"
              }`}
              aria-live="polite"
            >
              {stickyNote && isRunning ? (
                <>
                  {stickyNote.noteName}
                  <span className="text-5xl text-muted-foreground ml-1 align-top">
                    {stickyNote.octave}
                  </span>
                </>
              ) : (
                "—"
              )}
            </div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {reading.frequencyHz !== null
                ? `${reading.frequencyHz.toFixed(1)} Hz`
                : isRunning
                  ? "Listening…"
                  : "Idle"}
            </div>
          </div>

          {/* Cents needle */}
          <CentsNeedle
            cents={smoothedCents}
            isActive={isRunning && reading.cents !== null}
            quality={tuningQuality}
          />

          {/* Start/Stop button */}
          <button
            type="button"
            onClick={handleStartStop}
            className={`flex items-center gap-2 rounded-full px-8 py-3 text-lg font-semibold transition-transform active:scale-95 ${
              isRunning
                ? "bg-secondary text-foreground hover:bg-secondary/80"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
            disabled={micPermission === "requesting"}
            aria-label={isRunning ? "Stop tuner" : "Start tuner"}
          >
            {isRunning ? (
              <>
                <MicOff className="h-5 w-5" />
                Stop
              </>
            ) : micPermission === "requesting" ? (
              <>
                <Mic className="h-5 w-5 animate-pulse" />
                Requesting mic…
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                Start
              </>
            )}
          </button>

          {/* Input level meter — minimal "is anything coming in?" indicator */}
          {isRunning && (
            <div className="w-full max-w-xs">
              <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-75"
                  style={{
                    width: `${Math.min(100, reading.rms * 800)}%`,
                  }}
                />
              </div>
              <div className="mt-1 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Input level
              </div>
            </div>
          )}
        </section>

        {/* A4 reference picker */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Reference pitch (A4)
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {a4Reference} Hz
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={A4_REFERENCE_MIN}
              max={A4_REFERENCE_MAX}
              step={1}
              value={a4Reference}
              onChange={(e) => setA4Reference(Number(e.target.value))}
              className="flex-1 accent-primary"
              aria-label="A4 reference frequency"
            />
          </div>
          {/* Uniform-width preset buttons — each carries a one-word
              context label so the column reads as a balanced row of
              equal-sized tiles instead of variable-width chips. */}
          <div className="grid grid-cols-5 gap-1.5">
            {A4_PRESETS.map((preset) => {
              const label = A4_PRESET_LABELS[preset];
              const active = a4Reference === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setA4Reference(preset)}
                  className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 transition-colors ${
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <span className="font-mono text-sm tabular-nums">
                    {preset}
                  </span>
                  <span className="text-[10px] opacity-70">{label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Standard is 440 Hz. Modern orchestras tune to 442 (and a few
            even brighter at 444). Baroque performance practice uses
            415; 432 is the new-age tuning.
          </p>
        </section>
      </div>
    </main>
  );
}

function CentsNeedle({
  cents,
  isActive,
  quality,
}: {
  cents: number;
  isActive: boolean;
  quality: "in-tune" | "close" | "off" | "idle";
}) {
  // Clamp to ±50 cents for the visual range (anything beyond is the
  // nearest neighbor note).
  const clamped = Math.max(-50, Math.min(50, cents));
  // -50 → -45°, +50 → +45° — gentle pendulum sweep instead of a
  // full 180°.
  const rotation = isActive ? (clamped / 50) * 45 : 0;
  const needleColor =
    quality === "in-tune"
      ? "bg-primary"
      : quality === "close"
        ? "bg-amber-400"
        : quality === "off"
          ? "bg-destructive"
          : "bg-muted-foreground/40";

  return (
    <div className="relative flex h-32 w-72 items-end justify-center overflow-hidden">
      {/* Scale marks */}
      <div className="absolute inset-x-0 bottom-0 flex h-full items-end justify-between px-2 text-[10px] font-mono text-muted-foreground/60">
        <span>−50</span>
        <span>−25</span>
        <span className="text-foreground/60">0</span>
        <span>+25</span>
        <span>+50</span>
      </div>
      {/* Center "in tune" zone */}
      <div className="absolute inset-x-0 top-2 mx-auto h-2 w-12 rounded-full border border-primary/30 bg-primary/10" />
      {/* Pivot point */}
      <div className="absolute bottom-4 h-3 w-3 rounded-full bg-foreground/50" />
      {/* Needle */}
      <motion.div
        animate={{ rotate: rotation }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{ transformOrigin: "bottom center" }}
        className={`absolute bottom-4 h-24 w-1 rounded-full ${needleColor}`}
      />
      {/* Cents readout */}
      <div className="absolute bottom-0 font-mono text-xs text-muted-foreground tabular-nums">
        {isActive
          ? `${cents > 0 ? "+" : ""}${cents.toFixed(0)} cents`
          : "—"}
      </div>
    </div>
  );
}
