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
  type Chord,
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
import {
  ArrowRight,
  ChevronDown,
  ListChecks,
  Play,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";
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
    replaceChordPool,
    appendChords,
    setBpm,
    setTimeSignature,
    setCountInMeasures,
    setDrillMeasures,
    setRepetitions,
    setRandomizeChords,
    setNotationStyle,
    setArpeggioPattern,
  } = config;

  // Quick-build wizard state. Sets aren't directly reactive in
  // React, so each toggle creates a fresh Set.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedRoots, setSelectedRoots] = useState<Set<PitchClass>>(
    () => new Set(),
  );
  const [selectedQualities, setSelectedQualities] = useState<
    Set<ChordQuality>
  >(() => new Set());

  const toggleRoot = (root: PitchClass) =>
    setSelectedRoots((prev) => {
      const next = new Set(prev);
      if (next.has(root)) next.delete(root);
      else next.add(root);
      return next;
    });
  const toggleQuality = (quality: ChordQuality) =>
    setSelectedQualities((prev) => {
      const next = new Set(prev);
      if (next.has(quality)) next.delete(quality);
      else next.add(quality);
      return next;
    });

  const wizardChords: Chord[] = useMemo(() => {
    const chords: Chord[] = [];
    for (const root of PITCH_CLASSES) {
      if (!selectedRoots.has(root)) continue;
      for (const quality of CHORD_QUALITIES) {
        if (!selectedQualities.has(quality)) continue;
        chords.push({ root, quality });
      }
    }
    return chords;
  }, [selectedRoots, selectedQualities]);

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
              className="flex flex-wrap items-center justify-center gap-2"
              aria-live="polite"
            >
              {renderedChords.map((label, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-2 rounded-md border border-border/50 bg-background/40 py-1.5 pl-3 pr-1.5 font-mono font-semibold text-foreground leading-none tracking-tight ${chipTextClass(
                    poolSize,
                    isLongForm,
                  )}`}
                >
                  <span>{label}</span>
                  <button
                    type="button"
                    onClick={() => removeChordAt(i)}
                    disabled={poolSize <= 1}
                    aria-label={`Remove ${label} from pool`}
                    className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/60 hover:bg-border/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
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
            <div className="flex flex-col gap-3">
              {/* Quick-build wizard — collapsible, closed by default */}
              <div className="rounded-md border border-border bg-background/30">
                <button
                  type="button"
                  onClick={() => setWizardOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-background/60 transition-colors"
                  aria-expanded={wizardOpen}
                  aria-controls="quick-build-panel"
                >
                  <span className="flex items-center gap-2">
                    <ListChecks
                      className="h-4 w-4 text-primary"
                      aria-hidden="true"
                    />
                    Quick build — pick roots × qualities
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      wizardOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {wizardOpen && (
                  <div
                    id="quick-build-panel"
                    className="flex flex-col gap-5 border-t border-border px-4 py-4"
                  >
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {/* Roots column */}
                      <WizardColumn
                        title="Roots"
                        presets={[
                          {
                            label: "All",
                            onClick: () =>
                              setSelectedRoots(new Set(PITCH_CLASSES)),
                          },
                          {
                            label: "Naturals",
                            onClick: () =>
                              setSelectedRoots(
                                new Set(WIZARD_ROOTS_NATURALS),
                              ),
                          },
                          {
                            label: "None",
                            onClick: () => setSelectedRoots(new Set()),
                          },
                        ]}
                      >
                        <div className="grid grid-cols-2 gap-1">
                          {PITCH_CLASSES.map((root) => (
                            <WizardCheckbox
                              key={root}
                              label={PITCH_CLASS_DISPLAY_NAMES[root]}
                              checked={selectedRoots.has(root)}
                              onChange={() => toggleRoot(root)}
                            />
                          ))}
                        </div>
                      </WizardColumn>

                      {/* Qualities column */}
                      <WizardColumn
                        title="Qualities"
                        presets={[
                          {
                            label: "All",
                            onClick: () =>
                              setSelectedQualities(
                                new Set(CHORD_QUALITIES),
                              ),
                          },
                          {
                            label: "Common 7ths",
                            onClick: () =>
                              setSelectedQualities(
                                new Set(WIZARD_QUALITIES_COMMON),
                              ),
                          },
                          {
                            label: "Triads",
                            onClick: () =>
                              setSelectedQualities(
                                new Set(WIZARD_QUALITIES_TRIADS),
                              ),
                          },
                          {
                            label: "None",
                            onClick: () => setSelectedQualities(new Set()),
                          },
                        ]}
                      >
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          {CHORD_QUALITIES.map((q) => (
                            <WizardCheckbox
                              key={q}
                              label={QUALITY_DISPLAY_NAMES[q]}
                              checked={selectedQualities.has(q)}
                              onChange={() => toggleQuality(q)}
                            />
                          ))}
                        </div>
                      </WizardColumn>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground">
                        {wizardChords.length === 0 ? (
                          <>Pick at least one root and one quality.</>
                        ) : (
                          <>
                            Will produce{" "}
                            <span className="font-mono text-foreground tabular-nums">
                              {wizardChords.length}
                            </span>{" "}
                            chord
                            {wizardChords.length === 1 ? "" : "s"} (
                            {selectedRoots.size} root
                            {selectedRoots.size === 1 ? "" : "s"} ×{" "}
                            {selectedQualities.size} qualit
                            {selectedQualities.size === 1 ? "y" : "ies"})
                            {wizardChords.length > POOL_MAX &&
                              ` — capped at ${POOL_MAX}.`}
                          </>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            appendChords(wizardChords);
                            setWizardOpen(false);
                          }}
                          disabled={wizardChords.length === 0}
                          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Add to pool
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            replaceChordPool(wizardChords);
                            setWizardOpen(false);
                          }}
                          disabled={wizardChords.length === 0}
                          className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Replace pool
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Scrollable pool list — keeps a 48-chord wizard pool from
                  pushing Pattern / Tempo / Session off the screen. */}
              <div className="flex max-h-96 flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
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
              </div>
              <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  onClick={() => addChord()}
                  disabled={poolSize >= POOL_MAX}
                  className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add chord
                </button>
                <button
                  type="button"
                  onClick={() => replaceChordPool([])}
                  disabled={poolSize <= 1}
                  aria-label="Clear pool (reset to one default chord)"
                  className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-destructive/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Clear pool
                </button>
              </div>
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
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPO_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setBpm(preset)}
                        className={`rounded-md border px-3 py-1 font-mono text-xs tabular-nums transition-colors ${
                          config.bpm === preset
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
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
                    <ClampedNumberInput
                      value={config.bpm}
                      min={BPM_MIN}
                      max={BPM_MAX}
                      onChange={setBpm}
                      ariaLabel="BPM (numeric)"
                      className="w-20"
                    />
                  </div>
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
                <ClampedNumberInput
                  id="drill-measures"
                  value={config.drillMeasures}
                  min={DRILL_MIN}
                  max={DRILL_MAX}
                  onChange={setDrillMeasures}
                  className="w-full"
                />
              </FormField>
              <FormField label="Repetitions" htmlFor="repetitions">
                <ClampedNumberInput
                  id="repetitions"
                  value={config.repetitions}
                  min={REPS_MIN}
                  max={REPS_MAX}
                  onChange={setRepetitions}
                  className="w-full"
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

/** Quick-pick tempo buttons that sit above the slider. */
const TEMPO_PRESETS = [40, 60, 80, 100, 120, 140, 160, 200] as const;

/** Preset selections for the quick-build wizard's column buttons. */
const WIZARD_ROOTS_NATURALS: readonly PitchClass[] = [
  "C",
  "D",
  "E",
  "F",
  "G",
  "A",
  "B",
];
const WIZARD_QUALITIES_COMMON: readonly ChordQuality[] = [
  "maj7",
  "min7",
  "dom7",
  "dim7",
];
const WIZARD_QUALITIES_TRIADS: readonly ChordQuality[] = [
  "maj",
  "min",
  "aug",
];

function WizardColumn({
  title,
  presets,
  children,
}: {
  title: string;
  presets: { label: string; onClick: () => void }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Header + presets stack vertically so each row gets the full
          column width — keeps preset buttons on a single line and lets
          both columns' checkbox grids align at the top. */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.onClick}
              className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

function WizardCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-background/60 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-border bg-background accent-primary cursor-pointer"
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

/**
 * Number input that lets the user type intermediate values (including
 * ones temporarily below the min) without snapping each keystroke. The
 * store is only updated when the typed value is valid and in range;
 * on blur we commit + clamp. Pattern fixes the bug where typing "31"
 * was impossible because the leading "3" got clamped to the min.
 */
function ClampedNumberInput({
  id,
  value,
  min,
  max,
  onChange,
  className,
  ariaLabel,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const display = focused && draft !== null ? draft : String(value);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={display}
      aria-label={ariaLabel}
      onFocus={() => {
        setFocused(true);
        setDraft(String(value));
      }}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9]/g, "");
        setDraft(v);
        const n = Number(v);
        if (v !== "" && !isNaN(n) && n >= min && n <= max) {
          onChange(n);
        }
      }}
      onBlur={() => {
        setFocused(false);
        if (draft === null) return;
        const n = Number(draft);
        const clamped =
          draft !== "" && !isNaN(n)
            ? Math.max(min, Math.min(max, n))
            : min;
        onChange(clamped);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={`rounded-md border border-border bg-background px-3 py-2 font-mono text-sm tabular-nums focus:border-primary focus:outline-none ${className ?? ""}`}
    />
  );
}

/**
 * Adaptive text size for sequence preview chips — shrink as the pool
 * grows so a 20-chord pool doesn't dominate the screen. Long-form
 * notation scales down an extra tier because each chord label is
 * already several words long.
 */
function chipTextClass(poolSize: number, isLongForm: boolean): string {
  if (isLongForm) {
    if (poolSize <= 6) return "text-base";
    if (poolSize <= 14) return "text-sm";
    return "text-xs";
  }
  if (poolSize <= 6) return "text-3xl";
  if (poolSize <= 12) return "text-2xl";
  if (poolSize <= 20) return "text-xl";
  return "text-lg";
}
