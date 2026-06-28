"use client";

import * as Tone from "tone";
import { previewPlayer } from "@/lib/audio/preview";
import {
  ARPEGGIO_PATTERNS,
  ARPEGGIO_PATTERN_DESCRIPTIONS,
  ARPEGGIO_PATTERN_DISPLAY_NAMES,
  ARPEGGIO_PATTERN_SHORT_NAMES,
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
  DEFAULT_PRACTICE_CONFIG,
  DRILL_MAX,
  DRILL_MIN,
  POOL_MAX,
  REPS_MAX,
  REPS_MIN,
  TIME_SIGNATURES,
  TRANSITION_MAX,
  TRANSITION_UNIT_OPTIONS,
  type PracticeConfig,
  type TransitionUnit,
  usePracticeConfig,
} from "@/lib/state/practice-config";
import { useDrillsLibrary, type Drill } from "@/lib/state/drills-library";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ListChecks,
  Pencil,
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
    setRepeatIndefinitely,
    setRandomizeChords,
    setTransitionUnit,
    setTransitionCount,
    setNotationStyle,
    setArpeggioPattern,
    loadConfig,
    loadedDrillId,
    setLoadedDrillId,
  } = config;
  const drillsLib = useDrillsLibrary();
  // Sort drills so most-recently-launched bubbles to the top of Quick Start.
  // Drills that have never been launched fall to the bottom in save order.
  const sortedDrills = useMemo(
    () =>
      [...drillsLib.drills].sort(
        (a, b) => (b.lastLoadedAt ?? 0) - (a.lastLoadedAt ?? 0),
      ),
    [drillsLib.drills],
  );
  const editingDrill = useMemo(
    () =>
      loadedDrillId
        ? drillsLib.drills.find((d) => d.id === loadedDrillId) ?? null
        : null,
    [loadedDrillId, drillsLib.drills],
  );
  // Has the live config diverged from the saved drill's config? Drives
  // the "Discard changes" affordance and the Save changes button state.
  //
  // Both sides go through extractPracticeConfig so:
  //   (a) key order is identical (insertion order from the same code path)
  //   (b) UI-state fields like loadedDrillId that may have leaked into
  //       older saved drills get stripped on both sides
  //   (c) drills saved under older schemas fall back to defaults for
  //       newly-added fields — not "dirty" from the schema change alone
  const isDirty = useMemo(() => {
    if (!editingDrill) return false;
    const live = JSON.stringify(extractPracticeConfig(config));
    const saved = JSON.stringify(extractPracticeConfig(editingDrill.config));
    return live !== saved;
  }, [editingDrill, config]);

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

  // Save-as-drill inline form state.
  const [isSavingDrill, setIsSavingDrill] = useState(false);
  const [saveDrillName, setSaveDrillName] = useState("");
  const [saveDrillNotes, setSaveDrillNotes] = useState("");

  // Controlled-open state for the Chord pool section, so a click on a
  // chip in the Sequence preview can force it open before scrolling.
  const [chordPoolOpen, setChordPoolOpen] = useState(false);
  const poolRowRefs = useRef<Array<HTMLDivElement | null>>([]);

  /**
   * Pull a clean PracticeConfig out of any source (the live store or a
   * saved drill's config). Listing fields explicitly is the only safe
   * way to avoid UI-state fields like `loadedDrillId` leaking into a
   * saved drill snapshot — JSON.stringify-the-whole-store dropped
   * functions but didn't strip non-PracticeConfig data, which caused
   * the Save changes button to read as dirty on fresh drill loads.
   */
  const extractPracticeConfig = (
    source: Partial<PracticeConfig>,
  ): PracticeConfig => ({
    ...DEFAULT_PRACTICE_CONFIG,
    ...(source.chordPool !== undefined && { chordPool: source.chordPool }),
    ...(source.orderingStrategy !== undefined && {
      orderingStrategy: source.orderingStrategy,
    }),
    ...(source.measuresPerChord !== undefined && {
      measuresPerChord: source.measuresPerChord,
    }),
    ...(source.drillMeasures !== undefined && {
      drillMeasures: source.drillMeasures,
    }),
    ...(source.repetitions !== undefined && {
      repetitions: source.repetitions,
    }),
    ...(source.repeatIndefinitely !== undefined && {
      repeatIndefinitely: source.repeatIndefinitely,
    }),
    ...(source.randomizeChords !== undefined && {
      randomizeChords: source.randomizeChords,
    }),
    ...(source.bpm !== undefined && { bpm: source.bpm }),
    ...(source.timeSignature !== undefined && {
      timeSignature: source.timeSignature,
    }),
    ...(source.countInMeasures !== undefined && {
      countInMeasures: source.countInMeasures,
    }),
    ...(source.notationStyle !== undefined && {
      notationStyle: source.notationStyle,
    }),
    ...(source.arpeggioPattern !== undefined && {
      arpeggioPattern: source.arpeggioPattern,
    }),
    ...(source.transitionUnit !== undefined && {
      transitionUnit: source.transitionUnit,
    }),
    ...(source.transitionCount !== undefined && {
      transitionCount: source.transitionCount,
    }),
  });

  /** Snapshot of the live PracticeConfig (no loadedDrillId, no setters). */
  const snapshotConfig = (): PracticeConfig =>
    extractPracticeConfig(config);

  const handleSaveDrill = () => {
    const name = saveDrillName.trim();
    if (!name) return;
    const id = drillsLib.saveDrill(
      name,
      snapshotConfig(),
      saveDrillNotes,
    );
    setSaveDrillName("");
    setSaveDrillNotes("");
    setIsSavingDrill(false);
    // The new drill becomes the one being edited so subsequent Save
    // changes / Save as new chains work intuitively.
    setLoadedDrillId(id);
  };

  /** Reset live config to the saved drill's state (does not touch name/notes). */
  const handleDiscardChanges = () => {
    if (!editingDrill) return;
    loadConfig(editingDrill.config);
  };

  // Brief "Saved" confirmation that survives the dirty→clean transition
  // so the user gets feedback that the click actually did something.
  const [justSavedAt, setJustSavedAt] = useState<number | null>(null);

  /** Overwrite the currently-edited Drill with the current config. */
  const handleSaveChanges = () => {
    if (!editingDrill) return;
    drillsLib.updateDrillConfig(editingDrill.id, snapshotConfig());
    setJustSavedAt(Date.now());
    setTimeout(() => setJustSavedAt(null), 1500);
  };

  const handleEditDrill = (drill: Drill) => {
    loadConfig(drill.config);
    setLoadedDrillId(drill.id);
    // Scroll to top so the user sees the editing badge.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleDoneEditing = () => setLoadedDrillId(null);

  const handleLoadDrill = async (drill: Drill) => {
    // Unlock audio context while still inside the click gesture so the
    // session page's autostart can play immediately. Browsers gate
    // audio to user gestures; without this, a Quick Start launch from
    // a fresh tab would land on the drill page muted until the user
    // pressed Start manually.
    try {
      await Tone.start();
    } catch {
      // Silent — if the unlock fails, the user just has to hit Start manually.
    }
    loadConfig(drill.config);
    // Launching is launching — it deliberately does NOT enter edit
    // mode. Otherwise pressing Done editing then launching the same
    // drill would reopen the editing badge on return to setup, which
    // surprises the user. Edit mode is only entered via the explicit
    // pencil on the card.
    drillsLib.markDrillLoaded(drill.id);
    router.push("/practice/session?autostart=1");
  };

  /** Open Chord pool + scroll the chosen row into view + focus its root select. */
  const handleSequenceChipClick = (index: number) => {
    setChordPoolOpen(true);
    // setTimeout lets the section finish expanding before we scroll
    // (the row may have been display:none-equivalent inside the
    // collapsed body when we issued the click).
    setTimeout(() => {
      const el = poolRowRefs.current[index];
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const select = el.querySelector("select");
      if (select) (select as HTMLSelectElement).focus();
    }, 60);
  };

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

  // One-line summaries surfaced in the collapsed section headers so the
  // user always sees the current value without expanding.
  const chordPoolSummary = `${poolSize} chord${poolSize === 1 ? "" : "s"}${
    config.randomizeChords ? " · Random" : ""
  }`;
  const patternSummary =
    ARPEGGIO_PATTERN_SHORT_NAMES[config.arpeggioPattern];
  const tempoMeterSummary = `♩ = ${config.bpm} · ${config.timeSignature.beatsPerMeasure}/${config.timeSignature.beatUnit}`;
  const prepSummary =
    config.transitionCount > 0
      ? ` · prep ${config.transitionCount} ${config.transitionUnit === "measures" ? (config.transitionCount === 1 ? "measure" : "measures") : config.transitionCount === 1 ? "beat" : "beats"}`
      : "";
  const sessionSummary = config.repeatIndefinitely
    ? `${config.drillMeasures} measures / rep · Loop ∞${prepSummary}`
    : `${config.drillMeasures} × ${config.repetitions} = ${
        config.drillMeasures * config.repetitions
      } measures${prepSummary}`;

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
              drill cycles through the pool one chord per measure. Save
              your setup as a drill for one-click access next time.
            </p>
          </div>

          {/* Editing badge — name and notes are always-editable inline.
              `key`d to the drill id so switching drills mid-edit cleanly
              resets the uncontrolled inputs. Saves on blur (and blur
              fires when the user clicks Done editing, so explicit "save
              details" was unnecessary noise). */}
          {editingDrill && (
            <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-xs uppercase tracking-wider text-primary">
                  Editing drill
                </span>
                <div className="flex flex-wrap shrink-0 gap-2">
                  {isDirty && (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 transition-colors"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={handleDiscardChanges}
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-destructive/50 transition-colors"
                      >
                        Discard changes
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleDoneEditing}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Done editing
                  </button>
                </div>
              </div>
              <input
                key={`${editingDrill.id}-name`}
                type="text"
                defaultValue={editingDrill.name}
                onBlur={(e) =>
                  drillsLib.updateDrillMeta(editingDrill.id, {
                    name: e.target.value,
                  })
                }
                placeholder="Drill name"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none"
              />
              <textarea
                key={`${editingDrill.id}-notes`}
                defaultValue={editingDrill.notes ?? ""}
                onBlur={(e) =>
                  drillsLib.updateDrillMeta(editingDrill.id, {
                    notes: e.target.value.slice(0, 300),
                  })
                }
                placeholder="Add notes (optional) — e.g. Slow at 60. Focus on left-hand timing."
                rows={2}
                className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:border-primary focus:outline-none focus:text-foreground"
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Edit chords, pattern, tempo, and session in the sections
                below — they all apply to this drill. Click{" "}
                <span className="font-medium text-foreground">
                  Save changes
                </span>{" "}
                to commit them.
              </p>
            </div>
          )}

          {/* Quick Start — saved drills launch with one click. */}
          <FormSection title="Quick start">
            {drillsLib.drills.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No saved drills yet. Configure one below and click{" "}
                <span className="font-medium text-foreground">
                  Save as drill
                </span>{" "}
                to add it here for one-click launch.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sortedDrills.map((drill) => (
                  <DrillCard
                    key={drill.id}
                    drill={drill}
                    isEditing={drill.id === loadedDrillId}
                    onLaunch={handleLoadDrill}
                    onEdit={handleEditDrill}
                    onDelete={drillsLib.deleteDrill}
                  />
                ))}
              </div>
            )}
          </FormSection>

          {/* Sequence preview. Min-height keeps the card stable across
              notation styles even when the pool has just one chord. */}
          <section className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card/40 px-6 py-10">
            <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <span>
                Sequence · {poolSize} chord{poolSize === 1 ? "" : "s"}
              </span>
              {poolSize > 1 && (
                <button
                  type="button"
                  onClick={() => replaceChordPool([])}
                  className="rounded-sm border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-destructive/50 transition-colors"
                >
                  Clear pool
                </button>
              )}
            </div>
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              aria-live="polite"
            >
              {renderedChords.map((label, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-2 rounded-md border border-border/50 bg-background/40 py-1.5 pl-1.5 pr-1.5 font-mono font-semibold text-foreground leading-none tracking-tight ${chipTextClass(
                    poolSize,
                    isLongForm,
                  )}`}
                >
                  <button
                    type="button"
                    onClick={() => handleSequenceChipClick(i)}
                    aria-label={`Edit ${label} in chord pool`}
                    className="rounded-sm px-1.5 hover:text-primary transition-colors"
                  >
                    {label}
                  </button>
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
          <CollapsibleSection
            title="Chord pool"
            summary={chordPoolSummary}
            open={chordPoolOpen}
            onOpenChange={setChordPoolOpen}
          >
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
                    ref={(el) => {
                      poolRowRefs.current[index] = el;
                    }}
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
          </CollapsibleSection>

          {/* Arpeggio pattern */}
          <CollapsibleSection title="Pattern" summary={patternSummary}>
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
          </CollapsibleSection>

          {/* Tempo & meter */}
          <CollapsibleSection title="Tempo & meter" summary={tempoMeterSummary}>
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
          </CollapsibleSection>

          {/* Session shape */}
          <CollapsibleSection title="Session" summary={sessionSummary}>
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
                  className={`w-full ${
                    config.repeatIndefinitely
                      ? "opacity-40 pointer-events-none"
                      : ""
                  }`}
                />
              </FormField>
            </div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={config.repeatIndefinitely}
                onChange={(e) => setRepeatIndefinitely(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border bg-background accent-primary cursor-pointer"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Loop until stopped
                </span>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  {config.repeatIndefinitely
                    ? "Repetitions ignored — drill keeps going until you press Stop."
                    : "When on, the drill loops indefinitely instead of running a fixed number of repetitions."}
                </span>
              </div>
            </label>

            {/* Prep between chords — inter-chord count-in for beginners
                who need time to find the next root before playing. */}
            <div className="flex flex-col gap-2 rounded-md border border-border bg-background/30 p-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">
                  Prep between chords
                </span>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Inserts {config.transitionUnit} of &ldquo;GET
                  READY&rdquo; prep before each chord change so you have
                  time to find the new root before playing.
                </span>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                <ClampedNumberInput
                  id="transition-count"
                  value={config.transitionCount}
                  min={0}
                  max={TRANSITION_MAX}
                  onChange={setTransitionCount}
                  className="w-20"
                  ariaLabel="Prep count"
                />
                <Select
                  aria-label="Prep unit"
                  value={config.transitionUnit}
                  onChange={(e) =>
                    setTransitionUnit(e.target.value as TransitionUnit)
                  }
                  disabled={config.transitionCount === 0}
                  className={
                    config.transitionCount === 0
                      ? "opacity-40 cursor-not-allowed"
                      : ""
                  }
                >
                  {TRANSITION_UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u === "measures" ? "Measures" : "Beats"}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {config.transitionCount === 0 ? (
                  "Off — chords change immediately, no prep."
                ) : (
                  <>
                    Each chord change gets{" "}
                    <span className="font-mono text-foreground tabular-nums">
                      {config.transitionCount}
                    </span>{" "}
                    {config.transitionUnit === "measures"
                      ? config.transitionCount === 1
                        ? "measure"
                        : "measures"
                      : config.transitionCount === 1
                        ? "beat"
                        : "beats"}{" "}
                    of prep time. The upcoming chord shows on screen with
                    a{" "}
                    <span className="font-medium text-primary">
                      GET READY
                    </span>{" "}
                    label.
                  </>
                )}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {config.repeatIndefinitely ? (
                <>
                  <span className="font-mono tabular-nums text-foreground">
                    {config.drillMeasures}
                  </span>{" "}
                  measure{config.drillMeasures === 1 ? "" : "s"} per rep ·
                  loops until you stop.
                </>
              ) : (
                <>
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
                </>
              )}
            </p>
          </CollapsibleSection>

          {/* Start button */}
          <div className="flex flex-col gap-3">
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

            {/* Save area — differs depending on whether a Drill is loaded for edit. */}
            {isSavingDrill ? (
              <div className="flex flex-col gap-3 rounded-md border border-border bg-background/40 p-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="drill-name"
                    className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
                  >
                    Name this drill
                  </label>
                  <input
                    id="drill-name"
                    type="text"
                    value={saveDrillName}
                    onChange={(e) => setSaveDrillName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) handleSaveDrill();
                      if (e.key === "Escape") {
                        setSaveDrillName("");
                        setSaveDrillNotes("");
                        setIsSavingDrill(false);
                      }
                    }}
                    placeholder="e.g. Morning warm-up"
                    autoFocus
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="drill-notes"
                    className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
                  >
                    Notes (optional)
                  </label>
                  <textarea
                    id="drill-notes"
                    value={saveDrillNotes}
                    onChange={(e) =>
                      setSaveDrillNotes(e.target.value.slice(0, 300))
                    }
                    placeholder="e.g. Slow at 60. Focus on left-hand timing."
                    rows={2}
                    className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSaveDrillName("");
                      setSaveDrillNotes("");
                      setIsSavingDrill(false);
                    }}
                    className="rounded-md border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDrill}
                    disabled={!saveDrillName.trim()}
                    className="rounded-md border border-primary/40 bg-primary/15 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : editingDrill ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={!isDirty}
                  aria-label={
                    isDirty
                      ? `Save changes to ${editingDrill.name}`
                      : "No changes to save"
                  }
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    isDirty
                      ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25"
                      : justSavedAt !== null
                        ? "border-primary/40 bg-primary/15 text-primary cursor-default"
                        : "border-dashed border-border bg-background/40 text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {justSavedAt !== null && !isDirty
                    ? "Saved"
                    : `Save changes to "${editingDrill.name}"`}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingDrill(true)}
                  className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                  Save as new drill
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSavingDrill(true)}
                className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Bookmark className="h-4 w-4" aria-hidden="true" />
                Save current setup as drill
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/** A saved drill rendered as a tile in the Quick Start section. */
function DrillCard({
  drill,
  isEditing,
  onLaunch,
  onEdit,
  onDelete,
}: {
  drill: Drill;
  isEditing: boolean;
  onLaunch: (drill: Drill) => void;
  onEdit: (drill: Drill) => void;
  onDelete: (id: string) => void;
}) {
  const c = drill.config;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const flags: string[] = [];
  if (c.randomizeChords) flags.push("Random");
  if (c.repeatIndefinitely) flags.push("Loop ∞");
  const lengthLabel = c.repeatIndefinitely
    ? `${c.drillMeasures} measures / rep`
    : `${c.drillMeasures} × ${c.repetitions} = ${c.drillMeasures * c.repetitions} measures`;

  return (
    <div
      className={`relative rounded-lg border bg-background/40 transition-colors ${
        isEditing
          ? "border-primary/60 bg-primary/5"
          : "border-border hover:border-primary/60 hover:bg-primary/5"
      }`}
    >
      <button
        type="button"
        onClick={() => onLaunch(drill)}
        className="group block w-full p-3 text-left"
      >
        <div className="flex items-center gap-2 pr-20">
          <Play
            className="h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span className="flex-1 truncate font-medium text-foreground">
            {drill.name}
          </span>
        </div>
        <div className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
          {c.chordPool.length} chord{c.chordPool.length === 1 ? "" : "s"} ·{" "}
          {ARPEGGIO_PATTERN_SHORT_NAMES[c.arpeggioPattern]} · ♩={c.bpm} ·{" "}
          {c.timeSignature.beatsPerMeasure}/{c.timeSignature.beatUnit}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {lengthLabel}
          {flags.length > 0 && (
            <>
              {" · "}
              <span className="text-primary">{flags.join(" · ")}</span>
            </>
          )}
        </div>
        {drill.notes && (
          <div className="mt-1.5 line-clamp-2 text-xs italic text-muted-foreground/80">
            {drill.notes}
          </div>
        )}
      </button>
      {/* Card actions. Two-click delete confirm prevents accidental loss. */}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {confirmingDelete ? (
          <>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-sm border border-border bg-background px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(drill.id);
                setConfirmingDelete(false);
              }}
              className="rounded-sm border border-destructive/60 bg-destructive/15 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-destructive hover:bg-destructive/25 transition-colors"
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onEdit(drill)}
              aria-label={`Edit drill ${drill.name}`}
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/50 hover:bg-border/60 hover:text-foreground transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete drill ${drill.name}`}
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/50 hover:bg-border/60 hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
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

/**
 * Section that collapses to its header. Header shows the section title
 * (small mono caps) AND a one-line summary of the current state in the
 * foreground color so the user never loses sight of "what's set" even
 * when the section is closed. Click anywhere on the header to toggle.
 * Default-closed — keeps the setup screen clean; users open just the
 * section they want to tinker with.
 */
function CollapsibleSection({
  title,
  summary,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
}: {
  title: string;
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** When provided, the section becomes controlled by the parent. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <section className="flex flex-col rounded-md border border-border bg-background/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background/60 transition-colors"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <span className="text-sm font-medium text-foreground">
            {summary}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
          {children}
        </div>
      )}
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
