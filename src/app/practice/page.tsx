"use client";

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
  SESSION_MAX,
  SESSION_MIN,
  TIME_SIGNATURES,
  usePracticeConfig,
} from "@/lib/state/practice-config";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/**
 * Practice setup screen. The user configures the drill here, then proceeds
 * to /practice/session to actually play. Configuration is persisted to
 * localStorage so revisits land with the user's last setup ready to go.
 *
 * Currently single-chord drills only — the sequence builder (multi-chord
 * pools + ordering strategies) lands in a later slice per PROJECT-DESIGN.md §4.4.
 */
export default function PracticeSetupPage() {
  const router = useRouter();
  const config = usePracticeConfig();
  const {
    setRoot,
    setQuality,
    setBpm,
    setTimeSignature,
    setCountInMeasures,
    setSessionMeasures,
    setNotationStyle,
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

  const chordPreview = useMemo(
    () => renderChord(config.chord, config.notationStyle),
    [config.chord, config.notationStyle],
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
              Pick a chord, tempo, and meter. Settings are remembered so the
              next time you open this screen, you can start drilling
              immediately.
            </p>
          </div>

          {/* Chord preview */}
          <section className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card/40 px-6 py-10">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Chord
            </div>
            <div
              className={`font-mono font-semibold text-foreground leading-none tracking-tight text-center ${
                config.notationStyle === "long-form" ? "text-4xl" : "text-7xl"
              }`}
              aria-live="polite"
            >
              {chordPreview}
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

          {/* Chord picker */}
          <FormSection title="Chord">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Root" htmlFor="root">
                <Select
                  id="root"
                  value={config.chord.root}
                  onChange={(e) => setRoot(e.target.value as PitchClass)}
                >
                  {PITCH_CLASSES.map((pc) => (
                    <option key={pc} value={pc}>
                      {PITCH_CLASS_DISPLAY_NAMES[pc]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Quality" htmlFor="quality">
                <Select
                  id="quality"
                  value={config.chord.quality}
                  onChange={(e) => setQuality(e.target.value as ChordQuality)}
                >
                  {CHORD_QUALITIES.map((q) => (
                    <option key={q} value={q}>
                      {QUALITY_DISPLAY_NAMES[q]}
                    </option>
                  ))}
                </Select>
              </FormField>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <FormField label="Length (measures)" htmlFor="session-measures">
                <input
                  id="session-measures"
                  type="number"
                  min={SESSION_MIN}
                  max={SESSION_MAX}
                  value={config.sessionMeasures}
                  onChange={(e) =>
                    setSessionMeasures(Number(e.target.value) || SESSION_MIN)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm tabular-nums focus:border-primary focus:outline-none"
                />
              </FormField>
            </div>
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
