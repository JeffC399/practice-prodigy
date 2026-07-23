"use client";

import {
  ChevronDown,
  ChevronRight,
  ListMusic,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryChipWithPopover } from "@/components/practice/category-chip-with-popover";
import { ClampedNumberInput } from "@/components/shared/clamped-number-input";
import { OnboardingCard } from "@/components/shared/onboarding-card";
import { PresetChip } from "@/components/shared/preset-chip";
import type { CategoryId } from "@/lib/practice/categories";
import { PITCH_CLASSES } from "@/lib/music/chord";
import { useScaleDrillConfig } from "@/lib/scale-driller/config-store";
import { rootDisplay } from "@/lib/scale-driller/display";
import { useScaleDrillsLibrary } from "@/lib/scale-driller/library-store";
import {
  SCALE_DISPLAY_MODE_LABELS,
  SCALE_DISPLAY_MODES,
  SCALE_DISPLAY_NAMES,
  SCALE_GROUPS,
  SCALE_QUALITIES,
  SCALE_SHORT_LABELS,
  type ScaleDrill,
  type ScaleInstance,
  type ScalePitchClass,
  type ScaleQuality,
} from "@/lib/scale-driller/types";
import {
  BPM_MAX,
  BPM_MIN,
  ORDERING_STRATEGIES,
  ORDERING_STRATEGY_DISPLAY_NAMES,
  TIME_SIGNATURES,
} from "@/lib/state/practice-config";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * Scale Driller setup page — Phase 62.
 *
 * Mirrors the Key Sequencer setup page's structure so the two modules
 * feel identical in navigation and rhythm. Differences: the "pool"
 * here is a cross-product of scale qualities × keys instead of just
 * keys, and there's no prompt-row editor (scale qualities are the
 * "quality" prompt built in).
 */

export default function ScaleDrillerSetupPage() {
  const router = useRouter();
  const config = useScaleDrillConfig();
  const drillsLib = useScaleDrillsLibrary();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // First-visit onboarding.
  const hasSeenOnboarding = useUserPrefs(
    (s) => s.hasSeenScaleDrillerOnboarding,
  );
  const dismissOnboarding = useUserPrefs(
    (s) => s.dismissScaleDrillerOnboarding,
  );

  // Seed starter templates on first install / restore missing on later loads.
  useEffect(() => {
    drillsLib.seedStartersIfNeeded();
    drillsLib.restoreMissingStarters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [customOpen, setCustomOpen] = useState(true);
  const [builtInsOpen, setBuiltInsOpen] = useState(true);
  const editingBadgeRef = useRef<HTMLDivElement | null>(null);
  const [justLoadedDrillId, setJustLoadedDrillId] = useState<string | null>(
    null,
  );

  const sortedDrills = useMemo(() => {
    return [...drillsLib.drills].sort((a, b) => {
      const aTs = a.lastLoadedAt ?? a.createdAt;
      const bTs = b.lastLoadedAt ?? b.createdAt;
      return bTs - aTs;
    });
  }, [drillsLib.drills]);

  const userDrills = useMemo(
    () => sortedDrills.filter((d) => !d.isStarter),
    [sortedDrills],
  );
  const templateDrills = useMemo(
    () => sortedDrills.filter((d) => d.isStarter),
    [sortedDrills],
  );

  const editingDrill = useMemo(() => {
    if (!config.loadedScaleDrillId) return null;
    return drillsLib.drills.find((d) => d.id === config.loadedScaleDrillId) ?? null;
  }, [config.loadedScaleDrillId, drillsLib.drills]);

  const handleLaunchDrill = (drill: ScaleDrill) => {
    config.loadConfig({ ...drill.config, loadedScaleDrillId: drill.id });
    drillsLib.markDrillLoaded(drill.id);
    router.push("/practice/scales/session");
  };

  const handleEditDrill = (drill: ScaleDrill) => {
    config.loadConfig({ ...drill.config, loadedScaleDrillId: drill.id });
    setJustLoadedDrillId(drill.id);
    requestAnimationFrame(() => {
      editingBadgeRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  // Phase 62 — Cmd/Ctrl + Enter starts the drill.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (useScaleDrillConfig.getState().scalePool.length === 0) return;
      e.preventDefault();
      router.push("/practice/scales/session");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6"
    >
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <ListMusic className="h-3.5 w-3.5" aria-hidden="true" />
            Scale Driller
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Compose a scale drill
          </h1>
          <p className="text-sm text-muted-foreground leading-6">
            Pick a pool of scales × keys. Each measure surfaces one
            scale (e.g. &quot;D Dorian&quot;) with its spelled notes or
            interval degrees. Silent + metronome only — play on
            whatever instrument you like.
          </p>
        </header>

        {/* First-visit onboarding hint. */}
        <OnboardingCard
          visible={!hasSeenOnboarding}
          onDismiss={dismissOnboarding}
          title="Welcome to Scale Driller"
          intro="Three quick things to try:"
          bullets={[
            {
              heading: "Tap a Built-in drill below",
              body: "to launch a ready-made scale drill in any style.",
            },
            {
              heading: "Build your own pool",
              body: "in the Scale pool section — check the scales AND the keys you want. Every combination becomes one measure of the drill.",
            },
            {
              heading: "Display mode",
              body: "toggle between spelled notes (D E F G ...) and interval degrees (1 2 ♭3 4 ...) to match your pedagogy.",
            },
          ]}
        />

        {/* Your custom drills. */}
        <section className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            className="flex items-center gap-2 text-left"
            aria-expanded={customOpen}
          >
            {customOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="flex flex-col">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Your custom drills
                <span className="ml-1.5 normal-case tracking-normal font-normal text-muted-foreground/70">
                  · {userDrills.length}
                </span>
              </span>
            </div>
          </button>
          {customOpen && (
            <div className="flex flex-col gap-2">
              {userDrills.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-4 py-3 text-xs text-muted-foreground">
                  No custom drills yet. Build a pool below and save it as a drill.
                </p>
              ) : (
                userDrills.map((d) => (
                  <ScaleDrillCard
                    key={d.id}
                    drill={d}
                    justLoaded={justLoadedDrillId === d.id}
                    onLaunch={() => handleLaunchDrill(d)}
                    onEdit={() => handleEditDrill(d)}
                    onDelete={() => drillsLib.deleteDrill(d.id)}
                    onSetCategory={(cat) =>
                      drillsLib.setDrillCategory(d.id, cat)
                    }
                  />
                ))
              )}
            </div>
          )}
        </section>

        {/* Built-in drills. */}
        <section className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setBuiltInsOpen((v) => !v)}
            className="flex items-center gap-2 text-left"
            aria-expanded={builtInsOpen}
          >
            {builtInsOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="flex flex-col">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Built-in drills
                <span className="ml-1.5 normal-case tracking-normal font-normal text-muted-foreground/70">
                  · {templateDrills.length}
                </span>
              </span>
            </div>
          </button>
          {builtInsOpen && (
            <div className="flex flex-col gap-2">
              {templateDrills.map((d) => (
                <ScaleDrillCard
                  key={d.id}
                  drill={d}
                  justLoaded={justLoadedDrillId === d.id}
                  onLaunch={() => handleLaunchDrill(d)}
                  onEdit={() => handleEditDrill(d)}
                  onDelete={() => drillsLib.deleteDrill(d.id)}
                  onSetCategory={(cat) =>
                    drillsLib.setDrillCategory(d.id, cat)
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Editing badge. */}
        {editingDrill && (
          <div
            ref={editingBadgeRef}
            className={`flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-xs ${
              justLoadedDrillId === editingDrill.id ? "animate-pulse" : ""
            }`}
          >
            <span className="text-primary">
              Editing: <span className="font-medium">{editingDrill.name}</span>
            </span>
            <button
              type="button"
              onClick={() => config.reset()}
              className="rounded-md border border-border bg-background px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              Done editing
            </button>
          </div>
        )}

        {/* Scale pool builder. */}
        <ScalePoolSection
          scalePool={config.scalePool}
          setScalePool={config.setScalePool}
        />

        {/* Ordering + display mode. */}
        <section className="flex flex-col gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Ordering &amp; display
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Scale order</span>
              <select
                value={config.ordering}
                onChange={(e) =>
                  config.setOrdering(
                    e.target.value as typeof config.ordering,
                  )
                }
                className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {ORDERING_STRATEGIES.map((s) => (
                  <option key={s} value={s}>
                    {ORDERING_STRATEGY_DISPLAY_NAMES[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                Display mode
              </span>
              <select
                value={config.displayMode}
                onChange={(e) =>
                  config.setDisplayMode(
                    e.target.value as typeof config.displayMode,
                  )
                }
                className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {SCALE_DISPLAY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {SCALE_DISPLAY_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Session settings. */}
        <section className="flex flex-col gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Session settings
          </span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Tempo (BPM)</span>
              <ClampedNumberInput
                value={config.bpm}
                min={BPM_MIN}
                max={BPM_MAX}
                onChange={config.setBpm}
                ariaLabel="Tempo"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Time sig</span>
              <select
                value={`${config.timeSignature.beatsPerMeasure}/${config.timeSignature.beatUnit}`}
                onChange={(e) => {
                  const [bpm, unit] = e.target.value.split("/").map(Number);
                  const match = TIME_SIGNATURES.find(
                    (t) => t.beatsPerMeasure === bpm && t.beatUnit === unit,
                  );
                  if (match) config.setTimeSignature(match);
                }}
                className="rounded-md border border-border bg-background px-2 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {TIME_SIGNATURES.map((t) => (
                  <option
                    key={`${t.beatsPerMeasure}/${t.beatUnit}`}
                    value={`${t.beatsPerMeasure}/${t.beatUnit}`}
                  >
                    {t.beatsPerMeasure}/{t.beatUnit}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Bars/scale</span>
              <ClampedNumberInput
                value={config.measuresPerScale}
                min={1}
                max={16}
                onChange={config.setMeasuresPerScale}
                ariaLabel="Measures per scale"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Passes</span>
              <ClampedNumberInput
                value={config.repetitions}
                min={1}
                max={16}
                onChange={config.setRepetitions}
                ariaLabel="Passes"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.repeatIndefinitely}
                onChange={(e) => config.setRepeatIndefinitely(e.target.checked)}
                className="rounded border-border"
              />
              Loop indefinitely
            </label>
            <label className="flex items-center gap-2">
              Count-in:
              <select
                value={config.countInMeasures}
                onChange={(e) =>
                  config.setCountInMeasures(Number(e.target.value))
                }
                className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
              >
                <option value={0}>Off</option>
                <option value={1}>1 measure</option>
                <option value={2}>2 measures</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              Prep between scales:
              <ClampedNumberInput
                value={config.transitionMeasures ?? 0}
                min={0}
                max={4}
                onChange={config.setTransitionMeasures}
                ariaLabel="Prep measures"
                className="w-24"
              />
              <span className="text-muted-foreground/70">measures</span>
            </label>
          </div>
        </section>

        {/* Save-as-drill. */}
        <SaveDrillInline />

        {/* Launch. */}
        <section className="flex flex-col items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => router.push("/practice/scales/session")}
            disabled={config.scalePool.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-lg font-medium text-primary-foreground shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-5 w-5" aria-hidden="true" />
            Start drill
          </button>
          <p className="text-center text-[11px] text-muted-foreground/70">
            <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
              Cmd/Ctrl + Enter
            </kbd>{" "}
            to Start · Space to Start / Stop once you&apos;re in the
            drill screen. Press{" "}
            <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
              ?
            </kbd>{" "}
            anywhere to see all shortcuts.
          </p>
        </section>
      </div>
    </main>
  );
}

/**
 * Scale pool builder. Two axes: quality checkboxes + key checkboxes.
 * Cross-product of the checked cells becomes the pool. Users who want
 * finer-grained control (specific combos, not all-of-column × all-of-
 * row) can drop specific instances via the small "custom picks" list
 * below the matrix.
 */
/**
 * Musically meaningful key presets — the flat-side / sharp-side split
 * mirrors the cycle-of-5ths conventions jazz musicians use.
 */
const NATURAL_KEYS: ScalePitchClass[] = ["C", "D", "E", "F", "G", "A", "B"];
const FLAT_KEYS: ScalePitchClass[] = ["F", "A#", "D#", "G#", "C#", "F#"]; // F, B♭, E♭, A♭, D♭, G♭
const SHARP_KEYS: ScalePitchClass[] = ["G", "D", "A", "E", "B", "F#"];

function ScalePoolSection({
  scalePool,
  setScalePool,
}: {
  scalePool: ScaleInstance[];
  setScalePool: (pool: ScaleInstance[]) => void;
}) {
  const selectedQualities = useMemo(() => {
    const set = new Set<ScaleQuality>();
    for (const s of scalePool) set.add(s.quality);
    return set;
  }, [scalePool]);
  const selectedKeys = useMemo(() => {
    const set = new Set<ScalePitchClass>();
    for (const s of scalePool) set.add(s.root);
    return set;
  }, [scalePool]);

  // Group the pool by root so the preview reads as "one row per key"
  // instead of a truncated flat list — teaches the cross-product
  // structure at a glance and stays scannable at 84+ combos.
  const poolByRoot = useMemo(() => {
    const map = new Map<ScalePitchClass, ScaleInstance[]>();
    for (const s of scalePool) {
      const arr = map.get(s.root) ?? [];
      arr.push(s);
      map.set(s.root, arr);
    }
    // Preserve the order the roots first appear in the pool.
    return Array.from(map.entries());
  }, [scalePool]);

  const rebuildPool = (
    qualities: ScaleQuality[],
    keys: ScalePitchClass[],
  ) => {
    const out: ScaleInstance[] = [];
    for (const root of keys) {
      for (const quality of qualities) {
        out.push({ root, quality });
      }
    }
    setScalePool(out);
  };

  const toggleQuality = (q: ScaleQuality) => {
    const next = new Set(selectedQualities);
    if (next.has(q)) next.delete(q);
    else next.add(q);
    rebuildPool(
      [...next],
      selectedKeys.size > 0 ? [...selectedKeys] : ["C"],
    );
  };

  const toggleKey = (k: ScalePitchClass) => {
    const next = new Set(selectedKeys);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    rebuildPool(
      selectedQualities.size > 0 ? [...selectedQualities] : ["ionian"],
      [...next],
    );
  };

  // Phase 66 — Individual combo removal via × on each pool chip.
  // Removes only the one specific instance without touching
  // checkbox state. Note: subsequent bulk checkbox toggles rebuild
  // the cross-product and will re-introduce this combo. Documented
  // in the setup-page onboarding card so users know the rule.
  const removeCombo = (combo: ScaleInstance) => {
    setScalePool(
      scalePool.filter(
        (s) => !(s.root === combo.root && s.quality === combo.quality),
      ),
    );
  };

  // Phase 66 — Manual add of a specific combo (root + quality).
  // Deduped — appending an existing combo is a no-op.
  const addCombo = (combo: ScaleInstance) => {
    if (
      scalePool.some(
        (s) => s.root === combo.root && s.quality === combo.quality,
      )
    ) {
      return;
    }
    setScalePool([...scalePool, combo]);
  };

  // Phase 66 — Scale preset chips. Each replaces the current
  // qualities selection with a musically meaningful subset. Keys
  // stay whatever the user has set (defaulting to C when empty).
  const applyScalePreset = (qualities: ScaleQuality[]) => {
    rebuildPool(
      qualities,
      selectedKeys.size > 0 ? [...selectedKeys] : ["C"],
    );
  };

  // Phase 66 — Key preset chips. Same shape as scale presets.
  const applyKeyPreset = (keys: ScalePitchClass[]) => {
    rebuildPool(
      selectedQualities.size > 0 ? [...selectedQualities] : ["ionian"],
      keys,
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Scale pool
          <span className="ml-1.5 normal-case tracking-normal font-normal text-muted-foreground/70">
            · {scalePool.length} combo{scalePool.length === 1 ? "" : "s"}
          </span>
        </span>
        {/* Phase 68 — Always render Clear pool so the header row
            height stays fixed. `invisible` when the pool is empty
            hides the button visually + suppresses pointer events
            without collapsing its layout footprint. */}
        <button
          type="button"
          onClick={() => setScalePool([])}
          aria-hidden={scalePool.length === 0}
          tabIndex={scalePool.length === 0 ? -1 : 0}
          className={`text-[11px] text-muted-foreground hover:text-foreground transition-colors ${
            scalePool.length === 0 ? "invisible pointer-events-none" : ""
          }`}
        >
          Clear pool
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Scales box — quick presets + grouped checkboxes. */}
        <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/30 p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Scales
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/70">
              {selectedQualities.size} of {SCALE_QUALITIES.length} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <PresetChip
              label="All"
              onClick={() => applyScalePreset([...SCALE_QUALITIES])}
            />
            {SCALE_GROUPS.map((g) => (
              <PresetChip
                key={g.slug}
                label={g.label}
                onClick={() => applyScalePreset(g.qualities)}
              />
            ))}
            <PresetChip label="None" onClick={() => applyScalePreset([])} muted />
          </div>
          <div className="flex flex-col gap-2 text-xs">
            {SCALE_GROUPS.map((g) => (
              <div key={g.slug} className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  {g.label}
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {g.qualities.map((q) => (
                    <label
                      key={q}
                      className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-background/60 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedQualities.has(q)}
                        onChange={() => toggleQuality(q)}
                        className="rounded border-border"
                      />
                      <span>{SCALE_DISPLAY_NAMES[q]}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Keys box — quick presets + 12 checkboxes. */}
        <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/30 p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Keys
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/70">
              {selectedKeys.size} of {PITCH_CLASSES.length} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <PresetChip
              label="All"
              onClick={() => applyKeyPreset([...PITCH_CLASSES])}
            />
            <PresetChip
              label="Naturals"
              onClick={() => applyKeyPreset(NATURAL_KEYS)}
            />
            <PresetChip
              label="Flats"
              onClick={() => applyKeyPreset(FLAT_KEYS)}
            />
            <PresetChip
              label="Sharps"
              onClick={() => applyKeyPreset(SHARP_KEYS)}
            />
            <PresetChip label="None" onClick={() => applyKeyPreset([])} muted />
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-xs">
            {PITCH_CLASSES.map((k) => (
              <label
                key={k}
                className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-background/60 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedKeys.has(k)}
                  onChange={() => toggleKey(k)}
                  className="rounded border-border"
                />
                <span>{rootDisplay(k, "auto")}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Phase 68 — Pool preview panel now ALWAYS renders. When the
          pool is empty, it shows a compact empty-state line at the
          same height as one populated root row, so the elements
          below (AddSpecificCombo) stay put across empty → 1-combo →
          full transitions. No layout jump when the user selects
          their first scale.
          The panel uses min-h-[3rem] so a truly empty pool still
          reserves the row height. */}
      <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-background/20 p-3 min-h-[3rem]">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Pool preview · grouped by root
          </span>
        </div>
        {scalePool.length === 0 ? (
          <span className="text-[11px] text-muted-foreground/60">
            No combos yet — pick scales and keys above to build your
            pool.
          </span>
        ) : (
          <div className="flex flex-col gap-1">
            {poolByRoot.map(([root, combos]) => (
              <div
                key={root}
                className="flex flex-wrap items-center gap-1.5"
              >
                <span className="w-6 shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">
                  {rootDisplay(root, "auto")}
                </span>
                {combos.map((s) => (
                  <button
                    key={`${s.root}-${s.quality}`}
                    type="button"
                    onClick={() => removeCombo(s)}
                    aria-label={`Remove ${rootDisplay(s.root, "auto")} ${SCALE_DISPLAY_NAMES[s.quality]}`}
                    className="group inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <span>{SCALE_SHORT_LABELS[s.quality]}</span>
                    <X
                      className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add specific combo — hand-pick workflow. */}
      <AddSpecificCombo onAdd={addCombo} />
    </section>
  );
}

/**
 * Inline "+ Add combo" affordance for the hand-pick workflow.
 * Opens a small popover with root + scale dropdowns; click Add to
 * append that specific instance to the pool. Deduped by the caller.
 */
function AddSpecificCombo({
  onAdd,
}: {
  onAdd: (combo: ScaleInstance) => void;
}) {
  const [open, setOpen] = useState(false);
  const [root, setRoot] = useState<ScalePitchClass>("C");
  const [quality, setQuality] = useState<ScaleQuality>("ionian");

  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-border/60 px-3 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Add specific combo
        </button>
      ) : (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border/60 bg-background/20 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Root</span>
            <select
              value={root}
              onChange={(e) => setRoot(e.target.value as ScalePitchClass)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              {PITCH_CLASSES.map((k) => (
                <option key={k} value={k}>
                  {rootDisplay(k, "auto")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Scale</span>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as ScaleQuality)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              {SCALE_QUALITIES.map((q) => (
                <option key={q} value={q}>
                  {SCALE_DISPLAY_NAMES[q]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              onAdd({ root, quality });
            }}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Compact card representing one saved drill. Same visual language as
 * KeyDrillCard so the two module libraries feel identical.
 */
function ScaleDrillCard({
  drill,
  justLoaded,
  onLaunch,
  onEdit,
  onDelete,
  onSetCategory,
}: {
  drill: ScaleDrill;
  justLoaded: boolean;
  onLaunch: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Slice A.10 (Phase 92) — Editable per-drill category. */
  onSetCategory?: (category: CategoryId | undefined) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const summary = useMemo(() => {
    const pool = drill.config.scalePool.length;
    const bpm = drill.config.bpm;
    const ts = drill.config.timeSignature;
    return `${pool} combos · ♩=${bpm} · ${ts.beatsPerMeasure}/${ts.beatUnit}`;
  }, [drill.config]);

  return (
    <div
      className={`group flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 px-4 py-3 transition-colors hover:border-primary/50 ${
        justLoaded ? "animate-pulse" : ""
      }`}
    >
      <button
        type="button"
        onClick={onLaunch}
        className="flex flex-1 flex-col items-start text-left"
      >
        <span className="text-sm font-medium text-foreground">
          {drill.name}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground/70">
          {summary}
        </span>
        {drill.notes && (
          <span className="text-[11px] italic text-muted-foreground/70">
            {drill.notes}
          </span>
        )}
      </button>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit drill"
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {confirmingDelete ? (
          <>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md px-2 py-0.5 text-[10px] font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete drill"
            className="rounded-md p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-background/60 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {/* Slice A.10 (Phase 92) — Category chip pinned to the card's
          trailing edge next to the actions. Positioned to the LEFT of
          the launch button title so it doesn't get lost in the
          hover-revealed actions column. */}
      {onSetCategory && (
        <div className="ml-2 shrink-0">
          <CategoryChipWithPopover
            value={drill.category}
            onChange={onSetCategory}
            align="right"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Inline save form under the Start button. Distinguishes save-as-new
 * from update-existing based on whether a drill is currently loaded.
 */
function SaveDrillInline() {
  const config = useScaleDrillConfig();
  const drillsLib = useScaleDrillsLibrary();
  const editingDrill = useMemo(() => {
    if (!config.loadedScaleDrillId) return null;
    return drillsLib.drills.find((d) => d.id === config.loadedScaleDrillId) ?? null;
  }, [config.loadedScaleDrillId, drillsLib.drills]);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [showSaved, setShowSaved] = useState(false);

  const flashSaved = () => {
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  };

  const buildSnapshot = (): import("@/lib/scale-driller/types").ScaleDrillConfig => ({
    scalePool: config.scalePool,
    ordering: config.ordering,
    transitionUnit: config.transitionUnit,
    transitionMeasures: config.transitionMeasures,
    transitionBeats: config.transitionBeats,
    bpm: config.bpm,
    timeSignature: config.timeSignature,
    measuresPerScale: config.measuresPerScale,
    repetitions: config.repetitions,
    repeatIndefinitely: config.repeatIndefinitely,
    countInMeasures: config.countInMeasures,
    enharmonicPreference: config.enharmonicPreference,
    displayMode: config.displayMode,
    voiceAnnounce: config.voiceAnnounce,
  });

  const handleSaveNew = () => {
    if (!name.trim()) return;
    if (config.scalePool.length === 0) return;
    drillsLib.saveDrill(name.trim(), buildSnapshot(), notes.trim() || undefined);
    setName("");
    setNotes("");
    flashSaved();
  };

  const handleSaveOverwrite = () => {
    if (!editingDrill) return;
    drillsLib.updateDrillConfig(editingDrill.id, buildSnapshot());
    flashSaved();
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/30 p-4">
      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {editingDrill ? "Save changes" : "Save as drill"}
      </span>
      {editingDrill ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveOverwrite}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save changes to &ldquo;{editingDrill.name}&rdquo;
          </button>
          <span className="text-[11px] text-muted-foreground">
            Or fill in a name below to save as a new drill.
          </span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 min-w-[200px]">
          <span className="text-xs text-muted-foreground">Drill name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Modes practice — Monday warmup"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 min-w-[200px]">
          <span className="text-xs text-muted-foreground">Notes (optional)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Slow at 60. Focus on ♭7."
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={handleSaveNew}
          disabled={!name.trim() || config.scalePool.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Save
        </button>
      </div>
      {showSaved && (
        <span className="text-[11px] text-emerald-500">Saved ✓</span>
      )}
    </section>
  );
}
