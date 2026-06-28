"use client";

import { previewPlayer } from "@/lib/audio/preview";
import {
  ARPEGGIO_PATTERNS,
  ARPEGGIO_PATTERN_DESCRIPTIONS,
  ARPEGGIO_PATTERN_DISPLAY_NAMES,
  generateArpeggio,
  type ArpeggioPattern,
} from "@/lib/music/arpeggio";
import {
  CHORD_QUALITIES,
  PITCH_CLASSES,
  PITCH_CLASS_DISPLAY_NAMES,
  QUALITY_DISPLAY_NAMES,
  type ChordQuality,
  type PitchClass,
} from "@/lib/music/chord";
import {
  CHORD_NOTATION_STYLES,
  NOTATION_STYLE_DISPLAY_NAMES,
  renderChord,
  type ChordNotationStyle,
} from "@/lib/music/render-chord";
import {
  BPM_MAX,
  BPM_MIN,
  COUNT_IN_OPTIONS,
  DRILL_MAX,
  DRILL_MIN,
  POOL_MAX,
  REPS_MAX,
  REPS_MIN,
  TIME_SIGNATURES,
  usePracticeConfig,
} from "@/lib/state/practice-config";
import { ArrowRight, Play, Plus, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Practice setup screen. The user configures the drill here, then proceeds
 * to /practice/session to actually play. Configuration is persisted to
 * localStorage so revisits land with the user's last setup ready to go.
 *
 * Multi-chord sequence drilling: the user builds a chord pool, picks an
 * arpeggio pattern that applies to every chord, and the drill cycles
 * through the pool measure by measure. v1 ships "Custom Order" (the
 * order the user arranged the pool); the other 7 strategies from
 * PROJECT-DESIGN.md §4.4 land in the next slice without changing the
 * setup-page shape.
 */
export default function PracticeSetupPage() {
  const router = useRouter();
  const config = usePracticeConfig();
  const {
    addChord,
    removeChordAt,
    setChordRootAt,
    setChordQualityAt,
    setBpm,
    setTimeSignature,
    setCountInMeasures,
    setDrillMeasures,
    setRepetitions,
    setRandomizeChords,
    setNotationStyle,
    setArpeggioPattern,
  } = config;

  // Gate render until after mount so persisted-store hydration doesn't
  // diff against SSR's default values. The setState-in-effect pattern is
  // canonical for this case; the alternative (useSyncExternalStore against
  // persist middleware) adds complexity without changing behavior.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Stop any in-flight preview when the user navigates away.
  useEffect(() => {
    return () => previewPlayer.cancel();
  }, []);

  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewIdRef = useRef(0);

  const firstChord = config.chordPool[0];

  const handlePreview = async () => {
    if (isPreviewing) {
      previewPlayer.cancel();
      setIsPreviewing(false);
      return;
    }
    if (!firstChord) return;
    const myId = ++previewIdRef.current;
    setIsPreviewing(true);
    const notes = generateArpeggio(firstChord, config.arpeggioPattern);
    await previewPlayer.playArpeggio(notes, config.bpm);
    const totalMs = (notes.length * (60 / config.bpm) + 0.4) * 1000;
    setTimeout(() => {
      if (previewIdRef.current === myId) setIsPreviewing(false);
    }, totalMs);
  };

  const renderedChords = useMemo(
    () =>
      config.chordPool.map((chord) =>
        renderChord(chord, config.notationStyle),
      ),
    [config.chordPool, config.notationStyle],
  );

  const timeSignatureValue = `${config.timeSignature.beatsPerMeasure}/${config.timeSignature.beatUnit}`;

  const handleTimeSignatureChange = (value: string) => {
    const [beatsPerMeasure, beatUnit] = value.split("/").map(Number);
    const match = TIME_SIGNATURES.find(
      (ts) =>
        ts.beatsPerMeasure === beatsPerMeasure && ts.beatUnit === beatUnit,
    );
    if (match) setTimeSignature(match);
  };

  const handleStart = () => {
    router.push("/practice/session");
  };

  if (!mounted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Loading setup…
        </div>
      </main>
    );
  }

  const poolSize = config.chordPool.length;
  const isLongForm = config.notationStyle === "long-form";

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Practice Prodigy
        </Link>
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Setup
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="flex w-full max-w-2xl flex-col gap-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Configure your drill
            </h1>
            <p className="text-sm text-muted-foreground">
              Build a chord pool, pick a pattern, set tempo and meter. The
              drill cycles through the pool one chord per measure. Settings
              are remembered.
            </p>
          </div>

          {/* Sequence preview. Min-height keeps the card stable across
              notation styles even when the pool has just one chord. */}
          <section className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card/40 px-6 py-10">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Sequence · {poolSize} chord{poolSize === 1 ? "" : "s"}
            </div>
            <div
              className={`flex flex-wrap items-center justify-center text-center font-mono font-semibold text-foreground leading-tight tracking-tight ${
                isLongForm
                  ? "gap-x-5 gap-y-2 text-2xl"
                  : "gap-x-6 gap-y-2 text-5xl"
              }`}
              aria-live="polite"
            >
              {renderedChords.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <label
                htmlFor="notation-style"
                className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
              >
                Notation
              </label>
              <select
                id="notation-style"
                value={config.notationStyle}
                onChange={(e) =>
                  setNotationStyle(e.target.value as ChordNotationStyle)
                }
                className="rounded-md border border-border bg-background px-3 py-1 text-xs focus:border-primary focus:outline-none"
              >
                {CHORD_NOTATION_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {NOTATION_STYLE_DISPLAY_NAMES[style]}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Chord pool builder */}
          <FormSection title="Chord pool">
            <div className="flex flex-col gap-2">
              {config.chordPool.map((chord, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[7rem_1fr_auto] gap-2 items-center"
                >
                  <Select
                    aria-label={`Chord ${index + 1} root`}
                    value={chord.root}
                    onChange={(e) =>
                      setChordRootAt(index, e.target.value as PitchClass)
                    }
                  >
                    {PITCH_CLASSES.map((pc) => (
                      <option key={pc} value={pc}>
                        {PITCH_CLASS_DISPLAY_NAMES[pc]}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label={`Chord ${index + 1} quality`}
                    value={chord.quality}
                    onChange={(e) =>
                      setChordQualityAt(
                        index,
                        e.target.value as ChordQuality,
                      )
                    }
                  >
                    {CHORD_QUALITIES.map((q) => (
                      <option key={q} value={q}>
                        {QUALITY_DISPLAY_NAMES[q]}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeChordAt(index)}
                    disabled={poolSize <= 1}
                    aria-label={`Remove chord ${index + 1}`}
                    className="flex items-center justify-center rounded-md border border-border bg-background h-9 w-9 text-muted-foreground hover:text-foreground hover:border-destructive/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addChord()}
                disabled={poolSize >= POOL_MAX}
                className="mt-1 flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add chord
              </button>
              <label className="flex items-start gap-3 pt-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={config.randomizeChords}
                  onChange={(e) => setRandomizeChords(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border bg-background accent-primary cursor-pointer"
                />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    Randomize chord order
                  </span>
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {config.randomizeChords
                      ? `Each repetition samples ${Math.min(config.drillMeasures, poolSize)} chord${
                          Math.min(config.drillMeasures, poolSize) === 1
                            ? ""
                            : "s"
                        } at random from your pool of ${poolSize}. Fresh sample every rep.`
                      : "Custom order — drill plays the pool top-to-bottom, looping if it's shorter than the drill length."}
                  </span>
                </div>
              </label>
            </div>
          </FormSection>

          {/* Arpeggio pattern */}
          <FormSection title="Pattern">
            <div className="flex flex-col gap-3">
              <div className="flex items-stretch gap-3">
                <Select
                  id="arpeggio-pattern"
                  value={config.arpeggioPattern}
                  onChange={(e) =>
                    setArpeggioPattern(e.target.value as ArpeggioPattern)
                  }
                  className="flex-1"
                  aria-label="Arpeggio pattern"
                >
                  {ARPEGGIO_PATTERNS.map((p) => (
                    <option key={p} value={p}>
                      {ARPEGGIO_PATTERN_DISPLAY_NAMES[p]}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={handlePreview}
                  className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 text-sm font-medium text-primary hover:bg-primary/20 active:scale-[0.98] transition-all"
                  aria-label={
                    isPreviewing ? "Stop preview" : "Preview arpeggio"
                  }
                >
                  {isPreviewing ? (
                    <>
                      <Square className="h-4 w-4" aria-hidden="true" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Preview
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {ARPEGGIO_PATTERN_DESCRIPTIONS[config.arpeggioPattern]}
                {poolSize > 1 && (
                  <>
                    {" "}
                    Preview auditions the pattern over the first chord in
                    the pool.
                  </>
                )}
              </p>
            </div>
          </FormSection>

          {/* Tempo & meter */}
          <FormSection title="Tempo & meter">
            <div className="flex flex-col gap-6">
              <FormField
                label={
                  <div className="flex items-center justify-between">
                    <span>Tempo</span>
                    <span className="font-mono text-base font-medium text-foreground tabular-nums">
                      ♩ = {config.bpm}
                    </span>
                  </div>
                }
                htmlFor="bpm"
              >
                <div className="flex items-center gap-4">
                  <input
                    id="bpm"
                    type="range"
                    min={BPM_MIN}
                    max={BPM_MAX}
                    value={config.bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <input
                    type="number"
                    min={BPM_MIN}
                    max={BPM_MAX}
                    value={config.bpm}
                    onChange={(e) => setBpm(Number(e.target.value) || BPM_MIN)}
                    className="w-20 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm tabular-nums focus:border-primary focus:outline-none"
                    aria-label="BPM (numeric)"
                  />
                </div>
              </FormField>

              <FormField label="Time signature" htmlFor="time-signature">
                <Select
                  id="time-signature"
                  value={timeSignatureValue}
                  onChange={(e) => handleTimeSignatureChange(e.target.value)}
                >
                  {TIME_SIGNATURES.map((ts) => {
                    const v = `${ts.beatsPerMeasure}/${ts.beatUnit}`;
                    return (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    );
                  })}
                </Select>
              </FormField>
            </div>
          </FormSection>

          {/* Session shape */}
          <FormSection title="Session">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Count-in" htmlFor="count-in">
                <Select
                  id="count-in"
                  value={config.countInMeasures}
                  onChange={(e) =>
                    setCountInMeasures(Number(e.target.value))
                  }
                >
                  {COUNT_IN_OPTIONS.map((opt) => (
                    <option key={opt.measures} value={opt.measures}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Drill length (measures)" htmlFor="drill-measures">
                <input
                  id="drill-measures"
                  type="number"
                  min={DRILL_MIN}
                  max={DRILL_MAX}
                  value={config.drillMeasures}
                  onChange={(e) =>
                    setDrillMeasures(Number(e.target.value) || DRILL_MIN)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm tabular-nums focus:border-primary focus:outline-none"
                />
              </FormField>
              <FormField label="Repetitions" htmlFor="repetitions">
                <input
                  id="repetitions"
                  type="number"
                  min={REPS_MIN}
                  max={REPS_MAX}
                  value={config.repetitions}
                  onChange={(e) =>
                    setRepetitions(Number(e.target.value) || REPS_MIN)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm tabular-nums focus:border-primary focus:outline-none"
                />
              </FormField>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground">
                {config.drillMeasures}
              </span>{" "}
              measure{config.drillMeasures === 1 ? "" : "s"} ×{" "}
              <span className="font-mono tabular-nums text-foreground">
                {config.repetitions}
              </span>{" "}
              rep{config.repetitions === 1 ? "" : "s"} ={" "}
              <span className="font-mono tabular-nums text-foreground">
                {config.drillMeasures * config.repetitions}
              </span>{" "}
              total measure
              {config.drillMeasures * config.repetitions === 1 ? "" : "s"}.
            </p>
          </FormSection>

          {/* Start button */}
          <button
            type="button"
            onClick={handleStart}
            className="group flex items-center justify-between gap-3 rounded-lg bg-primary px-6 py-4 text-base font-medium text-primary-foreground shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <span>Start practice</span>
            <ArrowRight
              className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </main>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    children: React.ReactNode;
  },
) {
  const { className, children, ...rest } = props;
  return (
    <select
      {...rest}
      className={`w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none ${className ?? ""}`}
    >
      {children}
    </select>
  );
}
