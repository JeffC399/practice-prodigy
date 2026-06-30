"use client";

import { motion } from "framer-motion";
import {
  Pause,
  Play,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  METRONOME_SOUND_LABELS,
  METRONOME_SOUNDS,
  standaloneMetronome,
  type MetronomeSound,
  type MetronomeState,
} from "@/lib/audio/standalone-metronome";
import {
  CUSTOM_TIME_SIGNATURE_DENOMINATORS,
  CUSTOM_TIME_SIGNATURE_NUMERATOR_MAX,
  METRONOME_VISUAL_STYLE_LABELS,
  METRONOME_VISUAL_STYLES,
  useMetronomePrefs,
  type MetronomeVisualStyle,
} from "@/lib/state/metronome-prefs";
import { TIME_SIGNATURES } from "@/lib/state/practice-config";

/**
 * Standalone Metronome page (Phase 21).
 *
 * Premium-tier metronome: BPM with tap tempo, all 10 time signatures,
 * subdivisions, per-beat accents, sound presets, three visual-indicator
 * styles, polyrhythm support, tempo ramping, beat dropping for ear
 * training, and full keyboard shortcuts.
 *
 * Architectural note: this page is a standalone consumer of the
 * `standaloneMetronome` audio engine (separate from the drill engine).
 * The user's last-used config persists across reloads via the
 * `useMetronomePrefs` Zustand store. Phase 22 will add a RoutineItem
 * launcher that bridges this page to the My Practice routine player.
 */

const BPM_PRESETS = [40, 60, 80, 100, 120, 140, 160, 200] as const;
const SUBDIVISION_OPTIONS: Array<{
  value: 1 | 2 | 3 | 4;
  label: string;
  glyph: string;
}> = [
  { value: 1, label: "Quarter", glyph: "♩" },
  { value: 2, label: "Eighth", glyph: "♪♪" },
  { value: 3, label: "Triplet", glyph: "♪♪♪" },
  { value: 4, label: "Sixteenth", glyph: "♬♬" },
];

const TAP_HISTORY_MAX = 4;
const TAP_RESET_MS = 2000;

export default function MetronomePage() {
  const prefs = useMetronomePrefs();
  const {
    bpm,
    beatsPerMeasure,
    beatUnit,
    subdivisionsPerBeat,
    accentPattern,
    sound,
    volume,
    polyrhythm,
    tempoRamp,
    dropEveryNthMeasure,
    visualStyle,
    setBpm,
    setBeatsPerMeasure,
    setBeatUnit,
    setSubdivisionsPerBeat,
    cycleBeatAccent,
    setSound,
    setVolume,
    setPolyrhythm,
    setTempoRamp,
    setDropEveryNthMeasure,
    setVisualStyle,
    customTimeSignatures,
    addCustomTimeSignature,
    removeCustomTimeSignature,
    resetToDefaults,
  } = prefs;

  const [engineState, setEngineState] = useState<MetronomeState>({
    isPlaying: false,
    currentBeat: 0,
    currentMeasure: 0,
    liveBpm: bpm,
    isDroppedMeasure: false,
  });
  const [mounted, setMounted] = useState(false);
  // Inline custom-time-signature composer state. When `addingCustom`
  // is true, two number inputs + a Save button surface under the
  // time-sig dropdown.
  const [addingCustom, setAddingCustom] = useState(false);
  const [customNumerator, setCustomNumerator] = useState(5);
  const [customDenominator, setCustomDenominator] = useState<number>(8);
  useEffect(() => {
    // SSR-hydration guard: persisted Zustand state isn't available
    // until after mount, so we defer the first real render to avoid
    // server/client HTML mismatch. The setState happens once on mount
    // and never again.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const unsubscribe = standaloneMetronome.subscribe(setEngineState);
    return () => {
      unsubscribe();
      // On unmount (navigate away), stop the metronome so audio doesn't
      // continue silently in the background.
      standaloneMetronome.stop();
    };
  }, []);

  // Live BPM updates when playing.
  useEffect(() => {
    if (engineState.isPlaying) standaloneMetronome.setBpm(bpm);
  }, [bpm, engineState.isPlaying]);

  // Live volume updates always (so muting during play works).
  useEffect(() => {
    standaloneMetronome.setVolume(volume);
  }, [volume]);

  const handleStartStop = useCallback(async () => {
    if (engineState.isPlaying) {
      standaloneMetronome.stop();
      return;
    }
    await standaloneMetronome.start({
      bpm,
      beatsPerMeasure,
      beatUnit,
      subdivisionsPerBeat,
      accentPattern,
      sound,
      volume,
      polyrhythm,
      tempoRamp,
      dropEveryNthMeasure,
    });
  }, [
    engineState.isPlaying,
    bpm,
    beatsPerMeasure,
    beatUnit,
    subdivisionsPerBeat,
    accentPattern,
    sound,
    volume,
    polyrhythm,
    tempoRamp,
    dropEveryNthMeasure,
  ]);

  // Tap tempo — average inter-tap intervals over the most recent few taps.
  const tapTimestampsRef = useRef<number[]>([]);
  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    const taps = tapTimestampsRef.current;
    // Reset if too much time has passed since the last tap.
    if (taps.length > 0 && now - taps[taps.length - 1] > TAP_RESET_MS) {
      tapTimestampsRef.current = [now];
      return;
    }
    taps.push(now);
    if (taps.length > TAP_HISTORY_MAX) taps.shift();
    if (taps.length >= 2) {
      const intervals = taps
        .slice(1)
        .map((t, i) => t - taps[i]);
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tappedBpm = Math.round(60000 / avgMs);
      setBpm(tappedBpm);
    }
  }, [setBpm]);

  // Keyboard shortcuts: space = play/stop, arrows = BPM ±5, T = tap tempo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        void handleStartStop();
      } else if (e.code === "ArrowUp" || e.code === "ArrowRight") {
        e.preventDefault();
        setBpm(bpm + 5);
      } else if (e.code === "ArrowDown" || e.code === "ArrowLeft") {
        e.preventDefault();
        setBpm(bpm - 5);
      } else if (e.code === "KeyT") {
        e.preventDefault();
        handleTapTempo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bpm, handleStartStop, handleTapTempo, setBpm]);

  // Resync accent pattern if beatsPerMeasure changed elsewhere (e.g. via direct
  // store mutation). Defensive — setBeatsPerMeasure already does this.
  useEffect(() => {
    prefs.resyncAccentPattern();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatsPerMeasure]);

  const liveBpmLabel = engineState.isPlaying ? engineState.liveBpm : bpm;
  const currentBeatIdx = engineState.isPlaying
    ? engineState.currentBeat - 1
    : -1;

  if (!mounted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Loading metronome…
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Metronome</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Subdivisions, per-beat accents, polyrhythms, tempo ramping, and
            silent measures for ear training. Spacebar = play/stop, arrow
            keys = BPM ±5, T = tap tempo.
          </p>
        </header>

        {/* Big BPM display + visual indicator */}
        <section className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card/40 px-8 py-10">
          <BeatIndicator
            visualStyle={visualStyle}
            beatsPerMeasure={beatsPerMeasure}
            currentBeatIdx={currentBeatIdx}
            accentPattern={accentPattern}
            isPlaying={engineState.isPlaying}
            isDroppedMeasure={engineState.isDroppedMeasure}
          />
          <div className="flex flex-col items-center gap-1">
            <div
              className="font-mono text-7xl font-semibold tracking-tight text-foreground tabular-nums"
              aria-live="polite"
              aria-label={`Tempo: ${liveBpmLabel} BPM`}
            >
              {liveBpmLabel}
            </div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              BPM · {beatsPerMeasure}/{beatUnit}
              {engineState.isPlaying &&
                ` · measure ${engineState.currentMeasure}`}
              {engineState.isDroppedMeasure && " · (silent)"}
            </div>
          </div>

          {/* Start / Stop */}
          <button
            type="button"
            onClick={handleStartStop}
            className={`flex items-center gap-2 rounded-full px-8 py-3 text-lg font-semibold transition-transform active:scale-95 ${
              engineState.isPlaying
                ? "bg-secondary text-foreground hover:bg-secondary/80"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
            aria-label={engineState.isPlaying ? "Stop metronome" : "Start metronome"}
          >
            {engineState.isPlaying ? (
              <>
                <Pause className="h-5 w-5" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Start
              </>
            )}
          </button>
        </section>

        {/* BPM controls */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Tempo
            </h2>
            <button
              type="button"
              onClick={handleTapTempo}
              className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              aria-label="Tap tempo"
            >
              Tap tempo (T)
            </button>
          </div>
          {/* Slider row: −5 / −1 nudge buttons on the left, slider in
              the middle, and a 2x2 adjust grid on the right (+1/+5 on
              top, ÷2/×2 on bottom). All adjust buttons share the same
              BpmAdjust component so they're guaranteed identical in
              size + styling. */}
          <div className="flex items-center gap-3">
            <div className="grid grid-cols-1 gap-1.5">
              <BpmAdjust onClick={() => setBpm(bpm - 5)} label="−5" />
              <BpmAdjust onClick={() => setBpm(bpm - 1)} label="−1" />
            </div>
            <input
              type="range"
              min={30}
              max={300}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="flex-1 accent-primary"
              aria-label="BPM slider"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <BpmAdjust onClick={() => setBpm(bpm + 1)} label="+1" />
              <BpmAdjust onClick={() => setBpm(bpm + 5)} label="+5" />
              <BpmAdjust onClick={() => setBpm(Math.round(bpm / 2))} label="÷2" />
              <BpmAdjust onClick={() => setBpm(bpm * 2)} label="×2" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BPM_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setBpm(p)}
                className={`rounded-md border px-2.5 py-1 text-xs font-mono transition-colors ${
                  bpm === p
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </section>

        {/* Meter + subdivisions + per-beat accents */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-5">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Meter & subdivisions
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 text-sm sm:col-span-1">
              <label htmlFor="metronome-time-sig">Time signature</label>
              {/* Built-in + user-saved custom sigs share the dropdown.
                  Custom entries get a "(custom)" suffix so they're
                  visually distinct. The "+ Custom" button below
                  toggles an inline composer for adding new ones. */}
              <div className="flex items-center gap-2">
                <select
                  id="metronome-time-sig"
                  value={`${beatsPerMeasure}/${beatUnit}`}
                  onChange={(e) => {
                    const [b, u] = e.target.value.split("/").map(Number);
                    setBeatsPerMeasure(b);
                    setBeatUnit(u);
                  }}
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {TIME_SIGNATURES.map((ts) => (
                    <option
                      key={`${ts.beatsPerMeasure}/${ts.beatUnit}`}
                      value={`${ts.beatsPerMeasure}/${ts.beatUnit}`}
                    >
                      {ts.beatsPerMeasure}/{ts.beatUnit}
                    </option>
                  ))}
                  {customTimeSignatures.length > 0 && (
                    <optgroup label="Your custom">
                      {customTimeSignatures.map((ts) => (
                        <option
                          key={`c-${ts.beatsPerMeasure}/${ts.beatUnit}`}
                          value={`${ts.beatsPerMeasure}/${ts.beatUnit}`}
                        >
                          {ts.beatsPerMeasure}/{ts.beatUnit} (custom)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              {/* Add-custom inline form. Two-row stack: inputs above,
                  buttons below right-aligned. Prevents the previous
                  single-row layout from busting out of the container
                  when the parent gets narrow. */}
              {addingCustom ? (
                <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                  <span className="text-[11px] font-medium text-primary">
                    New custom time signature
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={CUSTOM_TIME_SIGNATURE_NUMERATOR_MAX}
                      value={customNumerator}
                      onChange={(e) =>
                        setCustomNumerator(
                          Math.max(
                            1,
                            Math.min(
                              CUSTOM_TIME_SIGNATURE_NUMERATOR_MAX,
                              Number(e.target.value) || 1,
                            ),
                          ),
                        )
                      }
                      className="w-16 rounded border border-border bg-background px-2 py-1 text-center text-sm"
                      aria-label="Numerator"
                    />
                    <span className="text-muted-foreground">/</span>
                    <select
                      value={customDenominator}
                      onChange={(e) =>
                        setCustomDenominator(Number(e.target.value))
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                      aria-label="Denominator"
                    >
                      {CUSTOM_TIME_SIGNATURE_DENOMINATORS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAddingCustom(false)}
                      className="rounded-md border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const sig = {
                          beatsPerMeasure: customNumerator,
                          beatUnit: customDenominator,
                        };
                        addCustomTimeSignature(sig);
                        setBeatsPerMeasure(customNumerator);
                        setBeatUnit(customDenominator);
                        setAddingCustom(false);
                      }}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      Save & use
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingCustom(true)}
                  className="inline-flex items-center gap-1 self-start rounded-md border border-dashed border-border bg-background/30 px-2 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add custom time signature
                </button>
              )}
              {/* Manage saved customs — small inline list with delete affordance. */}
              {customTimeSignatures.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    Saved:
                  </span>
                  {customTimeSignatures.map((ts) => {
                    const isActive =
                      ts.beatsPerMeasure === beatsPerMeasure &&
                      ts.beatUnit === beatUnit;
                    return (
                      <span
                        key={`${ts.beatsPerMeasure}/${ts.beatUnit}`}
                        className={`inline-flex items-center gap-1 rounded-full border pl-2 pr-0.5 py-0 text-[10px] font-mono ${
                          isActive
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border bg-background/30 text-muted-foreground"
                        }`}
                      >
                        {ts.beatsPerMeasure}/{ts.beatUnit}
                        <button
                          type="button"
                          onClick={() => removeCustomTimeSignature(ts)}
                          className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                          aria-label={`Remove custom ${ts.beatsPerMeasure}/${ts.beatUnit}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              Subdivisions per beat
              <div className="flex gap-1.5">
                {SUBDIVISION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSubdivisionsPerBeat(opt.value)}
                    className={`flex flex-1 flex-col items-center rounded-md border px-2 py-2 text-xs transition-colors ${
                      subdivisionsPerBeat === opt.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <span className="text-base leading-none">{opt.glyph}</span>
                    <span className="mt-1">{opt.label}</span>
                  </button>
                ))}
              </div>
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Per-beat accents</span>
              <span className="text-[11px] text-muted-foreground">
                Click a beat to cycle: normal → accent → mute → normal
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {accentPattern.map((acc, idx) => {
                const isCurrent = idx === currentBeatIdx && engineState.isPlaying;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => cycleBeatAccent(idx)}
                    className={`flex h-12 w-12 items-center justify-center rounded-md border text-sm font-mono font-medium transition-all ${
                      acc === "accent"
                        ? "border-primary bg-primary/30 text-primary"
                        : acc === "mute"
                          ? "border-border bg-background/30 text-muted-foreground/40 line-through"
                          : "border-border bg-background text-foreground"
                    } ${isCurrent ? "ring-2 ring-primary scale-110" : ""}`}
                    aria-label={`Beat ${idx + 1}, ${acc}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Sound + volume + visual */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-5">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Sound & visual
          </h2>
          <label className="flex flex-col gap-1.5 text-sm">
            Click sound
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METRONOME_SOUNDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSound(s)}
                  className={`rounded-md border px-2.5 py-2 text-sm transition-colors ${
                    sound === s
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  {METRONOME_SOUND_LABELS[s]}
                </button>
              ))}
            </div>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setVolume(volume > 0 ? 0 : 0.75)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={volume > 0 ? "Mute" : "Unmute"}
            >
              {volume > 0 ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </button>
            <span className="text-sm font-medium">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1 accent-primary"
              aria-label="Volume"
            />
            <span className="font-mono text-xs text-muted-foreground w-10 text-right">
              {Math.round(volume * 100)}%
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Visual style
            <div className="grid grid-cols-3 gap-2">
              {METRONOME_VISUAL_STYLES.map((vs) => (
                <button
                  key={vs}
                  type="button"
                  onClick={() => setVisualStyle(vs)}
                  className={`rounded-md border px-2.5 py-2 text-sm transition-colors ${
                    visualStyle === vs
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  {METRONOME_VISUAL_STYLE_LABELS[vs]}
                </button>
              ))}
            </div>
          </label>
        </section>

        {/* Advanced: polyrhythm, tempo ramp, beat drop */}
        <details className="rounded-xl border border-border bg-card/40 p-5">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
            Advanced (polyrhythm · tempo ramp · silent measures)
          </summary>
          <div className="mt-4 flex flex-col gap-5">
            {/* Polyrhythm */}
            <div className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={polyrhythm.enabled}
                  onChange={(e) =>
                    setPolyrhythm({ enabled: e.target.checked })
                  }
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">Polyrhythm</span>
                <span className="text-[11px] text-muted-foreground">
                  Secondary pulse at a different rate (e.g. 3-against-4)
                </span>
              </label>
              {polyrhythm.enabled && (
                <div className="ml-6 grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs">
                    Hits per measure
                    <input
                      type="number"
                      min={2}
                      max={9}
                      value={polyrhythm.hitsPerMeasure}
                      onChange={(e) =>
                        setPolyrhythm({
                          hitsPerMeasure: Math.max(
                            2,
                            Math.min(9, Number(e.target.value) || 2),
                          ),
                        })
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-sm w-20"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    Sound
                    <select
                      value={polyrhythm.sound}
                      onChange={(e) =>
                        setPolyrhythm({
                          sound: e.target.value as MetronomeSound,
                        })
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                    >
                      {METRONOME_SOUNDS.map((s) => (
                        <option key={s} value={s}>
                          {METRONOME_SOUND_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>

            {/* Tempo ramp */}
            <div className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tempoRamp.enabled}
                  onChange={(e) => setTempoRamp({ enabled: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">Tempo ramp</span>
                <span className="text-[11px] text-muted-foreground">
                  Gradually increase BPM over N measures, then loop
                </span>
              </label>
              {tempoRamp.enabled && (
                <div className="ml-6 grid grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1 text-xs">
                    Start BPM
                    <input
                      type="number"
                      min={30}
                      max={300}
                      value={tempoRamp.startBpm}
                      onChange={(e) =>
                        setTempoRamp({ startBpm: Number(e.target.value) || 60 })
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    End BPM
                    <input
                      type="number"
                      min={30}
                      max={300}
                      value={tempoRamp.endBpm}
                      onChange={(e) =>
                        setTempoRamp({ endBpm: Number(e.target.value) || 120 })
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    Over measures
                    <input
                      type="number"
                      min={1}
                      max={64}
                      value={tempoRamp.overMeasures}
                      onChange={(e) =>
                        setTempoRamp({
                          overMeasures: Math.max(
                            1,
                            Number(e.target.value) || 8,
                          ),
                        })
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Beat drop */}
            <div className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dropEveryNthMeasure > 0}
                  onChange={(e) =>
                    setDropEveryNthMeasure(e.target.checked ? 4 : 0)
                  }
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">Silent measures</span>
                <span className="text-[11px] text-muted-foreground">
                  Every Nth measure goes silent — ear-training drill
                </span>
              </label>
              {dropEveryNthMeasure > 0 && (
                <div className="ml-6">
                  <label className="flex flex-col gap-1 text-xs">
                    Silent every
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={2}
                        max={16}
                        value={dropEveryNthMeasure}
                        onChange={(e) =>
                          setDropEveryNthMeasure(
                            Math.max(2, Number(e.target.value) || 4),
                          )
                        }
                        className="rounded border border-border bg-background px-2 py-1 text-sm w-20"
                      />
                      <span className="text-xs text-muted-foreground">
                        measures
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>
        </details>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset all metronome settings to defaults?")) {
                resetToDefaults();
                if (engineState.isPlaying) standaloneMetronome.stop();
              }
            }}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </button>
          <p className="text-[11px] text-muted-foreground">
            Settings persist locally · Spacebar toggles play
          </p>
        </div>
      </div>
    </main>
  );
}

function BpmAdjust({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  // Fixed width + height so every adjust button looks identical, no
  // matter which row it appears in or what its label length is. The
  // 2.75rem width fits "−5" / "+5" / "÷2" / "×2" with equal whitespace.
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-11 items-center justify-center rounded-md border border-border bg-background font-mono text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground active:scale-95 transition-all"
    >
      {label}
    </button>
  );
}

/* ----------- Beat indicator (three visual styles) ----------- */

function BeatIndicator({
  visualStyle,
  beatsPerMeasure,
  currentBeatIdx,
  accentPattern,
  isPlaying,
  isDroppedMeasure,
}: {
  visualStyle: MetronomeVisualStyle;
  beatsPerMeasure: number;
  currentBeatIdx: number;
  accentPattern: Array<"normal" | "accent" | "mute">;
  isPlaying: boolean;
  isDroppedMeasure: boolean;
}) {
  if (visualStyle === "pulse") {
    return (
      <PulseIndicator
        currentBeatIdx={currentBeatIdx}
        isPlaying={isPlaying}
        isDroppedMeasure={isDroppedMeasure}
      />
    );
  }
  if (visualStyle === "pendulum") {
    return (
      <PendulumIndicator
        beatsPerMeasure={beatsPerMeasure}
        currentBeatIdx={currentBeatIdx}
        isPlaying={isPlaying}
      />
    );
  }
  return (
    <DotsIndicator
      beatsPerMeasure={beatsPerMeasure}
      currentBeatIdx={currentBeatIdx}
      accentPattern={accentPattern}
      isDroppedMeasure={isDroppedMeasure}
    />
  );
}

function DotsIndicator({
  beatsPerMeasure,
  currentBeatIdx,
  accentPattern,
  isDroppedMeasure,
}: {
  beatsPerMeasure: number;
  currentBeatIdx: number;
  accentPattern: Array<"normal" | "accent" | "mute">;
  isDroppedMeasure: boolean;
}) {
  return (
    <div className="flex h-20 items-center justify-center gap-2.5">
      {Array.from({ length: beatsPerMeasure }, (_, i) => {
        const isActive = i === currentBeatIdx;
        const acc = accentPattern[i] ?? "normal";
        const baseSize = acc === "accent" ? 18 : 14;
        return (
          <motion.div
            key={i}
            animate={{
              scale: isActive ? 1.6 : 1,
              opacity: isDroppedMeasure ? 0.25 : isActive ? 1 : 0.4,
            }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className={`rounded-full ${
              acc === "mute"
                ? "bg-muted-foreground/30"
                : isActive
                  ? "bg-primary"
                  : "bg-foreground/30"
            }`}
            style={{ width: baseSize, height: baseSize }}
          />
        );
      })}
    </div>
  );
}

function PulseIndicator({
  currentBeatIdx,
  isPlaying,
  isDroppedMeasure,
}: {
  currentBeatIdx: number;
  isPlaying: boolean;
  isDroppedMeasure: boolean;
}) {
  const beatKey = `${currentBeatIdx}-${isPlaying}`;
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <div className="absolute inset-0 rounded-full border-2 border-border" />
      {isPlaying && (
        <motion.div
          key={beatKey}
          initial={{ scale: 0.6, opacity: 0.9 }}
          animate={{ scale: 1, opacity: isDroppedMeasure ? 0.15 : 0.45 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="absolute inset-0 rounded-full bg-primary"
        />
      )}
      <span className="relative font-mono text-2xl font-semibold text-foreground tabular-nums">
        {currentBeatIdx >= 0 ? currentBeatIdx + 1 : "—"}
      </span>
    </div>
  );
}

function PendulumIndicator({
  beatsPerMeasure,
  currentBeatIdx,
  isPlaying,
}: {
  beatsPerMeasure: number;
  currentBeatIdx: number;
  isPlaying: boolean;
}) {
  // Map current beat to a -1..1 swing position. Pendulum swings left
  // on even beats, right on odd beats — visual approximation, not a
  // physically accurate pendulum.
  const swingPosition = useMemo(() => {
    if (currentBeatIdx < 0) return 0;
    return currentBeatIdx % 2 === 0 ? -1 : 1;
  }, [currentBeatIdx]);
  return (
    <div className="relative flex h-32 w-48 items-end justify-center overflow-hidden">
      <div className="absolute top-2 h-2 w-2 rounded-full bg-foreground/50" />
      <motion.div
        animate={{ rotate: isPlaying ? swingPosition * 25 : 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{ transformOrigin: "top center" }}
        className="absolute top-2 h-24 w-0.5 bg-primary"
      >
        <div className="absolute -left-2 bottom-0 h-4 w-4 rounded-full bg-primary" />
      </motion.div>
      <div className="absolute bottom-0 font-mono text-xs text-muted-foreground">
        {currentBeatIdx >= 0
          ? `Beat ${currentBeatIdx + 1} of ${beatsPerMeasure}`
          : "—"}
      </div>
    </div>
  );
}
