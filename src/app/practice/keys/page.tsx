"use client";

import {
  ChevronDown,
  ChevronRight,
  KeyRound,
  Play,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyDrillCard } from "@/components/key-sequencer/key-drill-card";
import { KeySequencerLivePreview } from "@/components/key-sequencer/live-preview";
import { PromptRowEditor } from "@/components/key-sequencer/prompt-row-editor";
import { ClampedNumberInput } from "@/components/shared/clamped-number-input";
import {
  BPM_MAX,
  BPM_MIN,
  ORDERING_STRATEGIES,
  ORDERING_STRATEGY_DISPLAY_NAMES,
  TIME_SIGNATURES,
} from "@/lib/state/practice-config";
import {
  PRACTICE_LAYOUTS,
  PRACTICE_LAYOUT_DISPLAY_NAMES,
  useUserPrefs,
} from "@/lib/state/user-prefs";
import { useKeySequencerConfig } from "@/lib/key-sequencer/config-store";
import { useKeyDrillsLibrary } from "@/lib/key-sequencer/library-store";
import {
  DEFAULT_KEY_SEQUENCER_CONFIG,
  type KeyDrill,
  type KeyPitchClass,
  type KeySequencerConfig,
} from "@/lib/key-sequencer/types";
import {
  isVoiceAnnounceSupported,
  speakUpcoming,
} from "@/lib/key-sequencer/voice-announce";

/**
 * Strip UI-only state fields from a live config to get the shape we
 * actually persist inside a KeyDrill. `loadedKeyDrillId` is UI state
 * (tracks "which drill is loaded"); saving it into another drill would
 * scramble the cross-drill navigation.
 */
function extractKeySequencerConfig(
  c: KeySequencerConfig,
): KeySequencerConfig {
  const { loadedKeyDrillId: _ignored, ...rest } = c;
  return rest;
}

/**
 * Key Sequencer setup page — Phase 45.0 scaffolding.
 *
 * MVP scope for this slice: key-pool selection + ordering strategy
 * dropdown + placeholder for prompt rows (built in 45.1). This gets
 * the route live under the module registry entry so the module
 * switcher can navigate to it and the setup skeleton renders.
 *
 * Full setup (rows editor, live preview, tempo/meter, session length,
 * layout, save-as-drill) lands in subsequent slices.
 */

const KEY_LABELS: Record<KeyPitchClass, { sharp: string; flat: string }> = {
  C: { sharp: "C", flat: "C" },
  "C#": { sharp: "C♯", flat: "D♭" },
  D: { sharp: "D", flat: "D" },
  "D#": { sharp: "D♯", flat: "E♭" },
  E: { sharp: "E", flat: "E" },
  F: { sharp: "F", flat: "F" },
  "F#": { sharp: "F♯", flat: "G♭" },
  G: { sharp: "G", flat: "G" },
  "G#": { sharp: "G♯", flat: "A♭" },
  A: { sharp: "A", flat: "A" },
  "A#": { sharp: "A♯", flat: "B♭" },
  B: { sharp: "B", flat: "B" },
};

const ALL_KEYS: KeyPitchClass[] = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];

/** Cycle of 5ths starting from C — used by "Cycle of 5ths" quickfill. */
const CYCLE_OF_5THS: KeyPitchClass[] = [
  "C", "F", "A#", "D#", "G#", "C#",
  "F#", "B", "E", "A", "D", "G",
];

function keyDisplay(k: KeyPitchClass, pref: "auto" | "sharps" | "flats") {
  if (pref === "sharps") return KEY_LABELS[k].sharp;
  if (pref === "flats") return KEY_LABELS[k].flat;
  // "auto": prefer flats for jazz idiom keys.
  return KEY_LABELS[k].flat;
}

export default function KeySequencerSetupPage() {
  const router = useRouter();
  const keyPool = useKeySequencerConfig((s) => s.keyPool);
  const setKeyPool = useKeySequencerConfig((s) => s.setKeyPool);
  const keyOrdering = useKeySequencerConfig((s) => s.keyOrdering);
  const setKeyOrdering = useKeySequencerConfig((s) => s.setKeyOrdering);
  const promptRows = useKeySequencerConfig((s) => s.promptRows);
  const setPromptRows = useKeySequencerConfig((s) => s.setPromptRows);
  const enharmonicPreference =
    useKeySequencerConfig((s) => s.enharmonicPreference) ?? "auto";
  const setEnharmonicPreference = useKeySequencerConfig(
    (s) => s.setEnharmonicPreference,
  );
  const wholeConfig = useKeySequencerConfig();
  const bpm = useKeySequencerConfig((s) => s.bpm);
  const setBpm = useKeySequencerConfig((s) => s.setBpm);
  const timeSignature = useKeySequencerConfig((s) => s.timeSignature);
  const setTimeSignature = useKeySequencerConfig((s) => s.setTimeSignature);
  const measuresPerKey = useKeySequencerConfig((s) => s.measuresPerKey);
  const setMeasuresPerKey = useKeySequencerConfig(
    (s) => s.setMeasuresPerKey,
  );
  const repetitions = useKeySequencerConfig((s) => s.repetitions);
  const setRepetitions = useKeySequencerConfig((s) => s.setRepetitions);
  const repeatIndefinitely = useKeySequencerConfig(
    (s) => s.repeatIndefinitely,
  );
  const setRepeatIndefinitely = useKeySequencerConfig(
    (s) => s.setRepeatIndefinitely,
  );
  const restMeasuresBetweenKeys = useKeySequencerConfig(
    (s) => s.restMeasuresBetweenKeys,
  );
  const setRestMeasuresBetweenKeys = useKeySequencerConfig(
    (s) => s.setRestMeasuresBetweenKeys,
  );
  const countInMeasures = useKeySequencerConfig((s) => s.countInMeasures);
  const setCountInMeasures = useKeySequencerConfig(
    (s) => s.setCountInMeasures,
  );
  const voiceAnnounce = useKeySequencerConfig((s) => s.voiceAnnounce);
  const setVoiceAnnounce = useKeySequencerConfig((s) => s.setVoiceAnnounce);
  const ttsSupported = isVoiceAnnounceSupported();

  // Phase 46 — prep between keys (transition system).
  const transitionUnit = useKeySequencerConfig((s) => s.transitionUnit) ?? "measures";
  const setTransitionUnit = useKeySequencerConfig((s) => s.setTransitionUnit);
  const transitionMeasures =
    useKeySequencerConfig((s) => s.transitionMeasures) ?? 0;
  const setTransitionMeasures = useKeySequencerConfig(
    (s) => s.setTransitionMeasures,
  );
  const transitionBeats =
    useKeySequencerConfig((s) => s.transitionBeats) ?? 0;
  const setTransitionBeats = useKeySequencerConfig((s) => s.setTransitionBeats);

  // Phase 46 — user's practice layout preference (single / two pane).
  const practiceLayout = useUserPrefs((s) => s.practiceLayout);
  const setPracticeLayout = useUserPrefs((s) => s.setPracticeLayout);

  // Phase 47 — both sections collapsible with summary chips.
  const [customOpen, setCustomOpen] = useState(true);
  const [builtInsOpen, setBuiltInsOpen] = useState(true);

  // Phase 49 — Edit-click feedback:
  // • justLoadedDrillId flags the drill card that was just clicked so
  //   the editing badge can pulse briefly (2s auto-clear).
  // • editingBadgeRef targets the scroll destination.
  const [justLoadedDrillId, setJustLoadedDrillId] = useState<string | null>(
    null,
  );
  const editingBadgeRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!justLoadedDrillId) return;
    const t = setTimeout(() => setJustLoadedDrillId(null), 2200);
    return () => clearTimeout(t);
  }, [justLoadedDrillId]);
  const reset = useKeySequencerConfig((s) => s.reset);
  const handleCreateNewExercise = () => {
    // Reset to defaults (matches DEFAULT_KEY_SEQUENCER_CONFIG shape)
    // and clear the loaded-drill link so the editing badge disappears.
    reset();
    setSaveName("");
    setSaveNotes("");
    // Scroll to the top of the setup content so the user sees the
    // fresh slate immediately.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const loadedKeyDrillId = useKeySequencerConfig((s) => s.loadedKeyDrillId);
  const setLoadedKeyDrillId = useKeySequencerConfig(
    (s) => s.setLoadedKeyDrillId,
  );
  const loadConfig = useKeySequencerConfig((s) => s.loadConfig);
  const drillsLib = useKeyDrillsLibrary();

  const [saveName, setSaveName] = useState("");
  const [saveNotes, setSaveNotes] = useState("");

  const sortedDrills = useMemo(
    () =>
      [...drillsLib.drills].sort(
        (a, b) => (b.lastLoadedAt ?? 0) - (a.lastLoadedAt ?? 0),
      ),
    [drillsLib.drills],
  );

  // Phase 46 — split user drills from starter templates.
  const userDrills = useMemo(
    () => sortedDrills.filter((d) => !d.isStarter),
    [sortedDrills],
  );
  const templateDrills = useMemo(
    () => sortedDrills.filter((d) => d.isStarter),
    [sortedDrills],
  );

  const editingDrill = useMemo(() => {
    if (!loadedKeyDrillId) return null;
    return drillsLib.drills.find((d) => d.id === loadedKeyDrillId) ?? null;
  }, [loadedKeyDrillId, drillsLib.drills]);

  const isDirty = useMemo(() => {
    if (!editingDrill) return false;
    const live = JSON.stringify(extractKeySequencerConfig(wholeConfig));
    const saved = JSON.stringify(
      extractKeySequencerConfig(editingDrill.config),
    );
    return live !== saved;
  }, [editingDrill, wholeConfig]);

  const handleLaunchDrill = (drill: KeyDrill) => {
    loadConfig({
      ...drill.config,
      loadedKeyDrillId: drill.id,
    });
    drillsLib.markDrillLoaded(drill.id);
    router.push("/practice/keys/session");
  };

  const handleEditDrill = (drill: KeyDrill) => {
    loadConfig({
      ...drill.config,
      loadedKeyDrillId: drill.id,
    });
    // Phase 49 — visual feedback on Edit click:
    // (1) Trigger the "just loaded" pulse on the editing badge,
    // (2) Scroll the badge into view so the user immediately sees
    //     the "you're editing X" affordance appear.
    setJustLoadedDrillId(drill.id);
    // Defer the scroll one frame so the badge has mounted.
    requestAnimationFrame(() => {
      editingBadgeRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  const handleDuplicateDrill = (drill: KeyDrill) => {
    const newId = drillsLib.duplicateDrill(drill.id);
    if (newId) {
      const dup = drillsLib.drills.find((d) => d.id === newId);
      if (dup) {
        loadConfig({ ...dup.config, loadedKeyDrillId: newId });
      }
    }
  };

  const handleDoneEditing = () => {
    // Phase 49 — Done editing returns to a fresh blank canvas so the
    // next setup starts clean, matching the page-open behavior.
    reset();
  };

  const handleSaveChanges = () => {
    if (!editingDrill) return;
    drillsLib.updateDrillConfig(
      editingDrill.id,
      extractKeySequencerConfig(wholeConfig),
    );
  };

  const handleSaveAsNew = () => {
    const trimmedName = saveName.trim();
    if (!trimmedName) return;
    const newId = drillsLib.saveDrill(
      trimmedName,
      extractKeySequencerConfig(wholeConfig),
      saveNotes.trim() || undefined,
    );
    setSaveName("");
    setSaveNotes("");
    setLoadedKeyDrillId(newId);
  };

  const handleDiscardChanges = () => {
    if (!editingDrill) return;
    loadConfig({
      ...editingDrill.config,
      loadedKeyDrillId: editingDrill.id,
    });
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Phase 45.5 — seed starter templates on first install. Guarded by
  // seededStartersVersion inside the library store so this only runs
  // once per user regardless of how many times they visit the page.
  // Phase 47 — retro-flag any drills seeded before the isStarter
  // field existed, so users who visited between 45.5 and 46 see their
  // templates in Built-in Drills instead of Your Custom Drills.
  useEffect(() => {
    if (!mounted) return;
    drillsLib.seedStartersIfNeeded();
    drillsLib.reflagLegacyStartersIfNeeded();
  }, [mounted, drillsLib]);

  // Phase 49 — Fresh-slate on page open. Whatever config was persisted
  // from a previous visit is discarded so the user lands on a blank
  // setup. If they want to continue a saved drill, they click its
  // card in Your Custom Drills / Built-in Drills. Runs exactly once
  // after mount using a ref so hot-reloads don't retrigger.
  const didInitialResetRef = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    if (didInitialResetRef.current) return;
    didInitialResetRef.current = true;
    reset();
  }, [mounted, reset]);

  const toggleKey = (k: KeyPitchClass) => {
    if (keyPool.includes(k)) {
      setKeyPool(keyPool.filter((x) => x !== k));
    } else {
      setKeyPool([...keyPool, k]);
    }
  };

  const selectAll = () => setKeyPool(ALL_KEYS);
  const selectCycleOf5ths = () => {
    setKeyPool(CYCLE_OF_5THS);
    setKeyOrdering("cycleOf5ths");
  };
  const clearAll = () => setKeyPool([]);

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
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center px-3 py-4 sm:px-6 sm:py-8"
    >
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Key Sequencer
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Compose a key drill
          </h1>
          <p className="text-sm text-muted-foreground leading-6">
            Pick a pool of keys + layer your own prompt rows on top.
            Instrument-neutral: silent + metronome only. You play on
            whatever instrument you like, guided by the key + your prompt
            words on the Now / Next cards.
          </p>
        </header>

        {/* Your Custom Drills — user-owned, top of page. Collapsible
            with summary chip when closed (mirrors Bass Arpeggios'
            CollapsibleSection convention). */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => setCustomOpen((v) => !v)}
              className="flex items-center gap-2 text-left"
              aria-expanded={customOpen}
            >
              {customOpen ? (
                <ChevronDown
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <ChevronRight
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <div className="flex flex-col">
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Your custom drills
                  <span className="ml-1.5 normal-case tracking-normal font-normal text-muted-foreground/70">
                    · {userDrills.length}
                  </span>
                </span>
                {!customOpen && (
                  <span className="text-[11px] text-muted-foreground/70">
                    {userDrills.length === 0
                      ? "None saved yet — click to expand."
                      : `Latest: ${userDrills[0]?.name ?? ""}`}
                  </span>
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={handleCreateNewExercise}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              title="Reset the setup to a fresh drill"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Create new exercise
            </button>
          </div>
          {customOpen && (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Click a card to launch, pencil to edit, copy to duplicate.
              </p>
              {userDrills.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-background/30 px-4 py-6 text-center text-sm text-muted-foreground leading-relaxed">
                  No custom drills yet — try a template from{" "}
                  <span className="font-medium text-foreground">
                    Built-in Drills
                  </span>{" "}
                  below, or configure your own and hit{" "}
                  <span className="font-medium text-foreground">
                    Save as drill
                  </span>
                  .
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {userDrills.map((d) => (
                    <KeyDrillCard
                      key={d.id}
                      drill={d}
                      isEditing={d.id === loadedKeyDrillId}
                      onLaunch={handleLaunchDrill}
                      onEdit={handleEditDrill}
                      onDuplicate={handleDuplicateDrill}
                      onDelete={(id) => {
                        drillsLib.deleteDrill(id);
                        if (id === loadedKeyDrillId)
                          setLoadedKeyDrillId(undefined);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Built-in Drills — the shipped starter templates.
            Collapsible with the same pattern. Duplicating a built-in
            creates a user-owned copy; the original stays untouched.
            "Restore" re-inserts any missing templates the user may
            have deleted. */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => setBuiltInsOpen((v) => !v)}
              className="flex items-center gap-2 text-left"
              aria-expanded={builtInsOpen}
            >
              {builtInsOpen ? (
                <ChevronDown
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <ChevronRight
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <div className="flex flex-col">
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Built-in drills
                  <span className="ml-1.5 normal-case tracking-normal font-normal text-muted-foreground/70">
                    · {templateDrills.length}
                  </span>
                </span>
                {!builtInsOpen && (
                  <span className="text-[11px] text-muted-foreground/70">
                    Curated starters — click to expand.
                  </span>
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={() => drillsLib.restoreMissingStarters()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              title="Restore any built-in drills you've deleted"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restore
            </button>
          </div>
          {builtInsOpen && templateDrills.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Shipped with Practice Prodigy. Duplicate one to make it your
                own — the original stays here for reference.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {templateDrills.map((d) => (
                  <KeyDrillCard
                    key={d.id}
                    drill={d}
                    isEditing={d.id === loadedKeyDrillId}
                    onLaunch={handleLaunchDrill}
                    onEdit={handleEditDrill}
                    onDuplicate={handleDuplicateDrill}
                    onDelete={(id) => {
                      drillsLib.deleteDrill(id);
                      if (id === loadedKeyDrillId)
                        setLoadedKeyDrillId(undefined);
                    }}
                  />
                ))}
              </div>
            </>
          )}
          {builtInsOpen && templateDrills.length === 0 && (
            <p className="rounded-md border border-dashed border-border bg-background/30 px-4 py-6 text-center text-sm text-muted-foreground leading-relaxed">
              No built-in drills present. Click{" "}
              <span className="font-medium text-foreground">Restore</span> to
              bring them back.
            </p>
          )}
        </section>

        {/* Editing badge — visible when the live config was loaded
            from a saved drill. Phase 49 — visually louder + a pulse
            ring for ~2s after the user just clicked Edit, so the
            state change is impossible to miss. Ref target for the
            auto-scroll on Edit click. */}
        {editingDrill && (
          <div
            ref={editingBadgeRef}
            className={`flex flex-col gap-3 rounded-lg border-2 border-primary/60 bg-primary/10 px-5 py-4 shadow-md transition-all ${
              justLoadedDrillId === editingDrill.id
                ? "ring-4 ring-primary/40 animate-pulse"
                : ""
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wider text-primary">
                  Now editing
                </span>
                <span className="text-lg font-semibold text-foreground">
                  {editingDrill.name}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {isDirty && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveChanges}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardChanges}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-destructive/50"
                    >
                      Discard changes
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleDoneEditing}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Done editing
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The sections below have been populated with this drill&rsquo;s
              settings. Edit anything — the pool, prompt rows, tempo,
              session settings — and click{" "}
              <span className="font-medium text-foreground">Save changes</span>{" "}
              to commit them, or{" "}
              <span className="font-medium text-foreground">Done editing</span>{" "}
              to return to a blank canvas.
            </p>
          </div>
        )}

        {/* Key pool */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Key pool
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pick which keys the drill will cycle through. Tap "All 12" for
              a full-chromatic drill or "Cycle of 5ths" for jazz-standard
              order.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              All 12
            </button>
            <button
              type="button"
              onClick={selectCycleOf5ths}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              Cycle of 5ths (jazz order)
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
            {ALL_KEYS.map((k) => {
              const selected = keyPool.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleKey(k)}
                  aria-pressed={selected}
                  className={`flex h-12 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                    selected
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {keyDisplay(k, enharmonicPreference)}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            {keyPool.length} of 12 keys selected
          </div>
        </section>

        {/* Ordering + enharmonic */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-wider text-muted-foreground">
              Key ordering
            </span>
            <select
              value={keyOrdering}
              onChange={(e) =>
                setKeyOrdering(
                  e.target.value as (typeof ORDERING_STRATEGIES)[number],
                )
              }
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {ORDERING_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {ORDERING_STRATEGY_DISPLAY_NAMES[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono uppercase tracking-wider text-muted-foreground">
              Enharmonic display
            </span>
            <select
              value={enharmonicPreference}
              onChange={(e) =>
                setEnharmonicPreference(
                  e.target.value as "auto" | "sharps" | "flats",
                )
              }
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="auto">Auto (context-aware)</option>
              <option value="sharps">Sharps (C♯, D♯, F♯…)</option>
              <option value="flats">Flats (D♭, E♭, G♭…)</option>
            </select>
          </label>
        </section>

        {/* Prompt rows — the composability heart of Key Sequencer.
            Users type free-text words in up to 3 rows; each measure
            surfaces one word per row combined with the key. */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Prompt rows
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Layer up to 3 rows of key words on top of the key
              selection. Each measure will show the current key plus
              one word from each row (per that row's ordering).
            </p>
          </div>
          <PromptRowEditor rows={promptRows} onChange={setPromptRows} />
        </section>

        {/* Live preview of the first 4 measures. Reruns on every
            config change. Stable seed so previews don't flicker on
            each keystroke. */}
        <section className="flex flex-col gap-3">
          <KeySequencerLivePreview config={wholeConfig} />
        </section>

        {/* Session settings — tempo, meter, session length, rest,
            count-in. Kept as one focused section so users can dial
            in the drill's feel in one place. */}
        <section className="flex flex-col gap-4 rounded-md border border-border bg-card/40 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Session settings
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tempo, meter, how long each key surfaces, and how many
              times the sequence repeats.
            </p>
          </div>

          {/* Tempo — slider + numeric input */}
          <label className="flex flex-col gap-2 text-xs">
            <div className="flex items-baseline justify-between">
              <span className="font-mono uppercase tracking-wider text-muted-foreground">
                Tempo
              </span>
              <span className="font-mono text-sm text-foreground">
                ♩ = {bpm}
              </span>
            </div>
            <input
              type="range"
              min={BPM_MIN}
              max={BPM_MAX}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value, 10))}
              className="w-full accent-[color:var(--primary)]"
              aria-label="Tempo BPM"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-mono uppercase tracking-wider text-muted-foreground">
                Time signature
              </span>
              <select
                value={`${timeSignature.beatsPerMeasure}/${timeSignature.beatUnit}`}
                onChange={(e) => {
                  const found = TIME_SIGNATURES.find(
                    (ts) =>
                      `${ts.beatsPerMeasure}/${ts.beatUnit}` === e.target.value,
                  );
                  if (found) setTimeSignature(found);
                }}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                {TIME_SIGNATURES.map((ts) => (
                  <option
                    key={`${ts.beatsPerMeasure}/${ts.beatUnit}`}
                    value={`${ts.beatsPerMeasure}/${ts.beatUnit}`}
                  >
                    {ts.beatsPerMeasure}/{ts.beatUnit}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-mono uppercase tracking-wider text-muted-foreground">
                Measures each key stays
              </span>
              <ClampedNumberInput
                value={measuresPerKey}
                min={1}
                max={16}
                onChange={setMeasuresPerKey}
                ariaLabel="Measures each key stays"
              />
              <span className="text-[10px] text-muted-foreground/70">
                How long each key stays before advancing. Set to 1 for a fresh key every measure.
              </span>
            </label>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-mono uppercase tracking-wider text-muted-foreground">
                Prep between keys
              </span>
              <div className="flex items-center gap-2">
                <ClampedNumberInput
                  className="w-20"
                  value={
                    transitionUnit === "measures"
                      ? transitionMeasures
                      : transitionBeats
                  }
                  min={0}
                  max={transitionUnit === "measures" ? 4 : 16}
                  onChange={(v) => {
                    if (transitionUnit === "measures") {
                      setTransitionMeasures(v);
                    } else {
                      setTransitionBeats(v);
                    }
                  }}
                  ariaLabel="Prep between keys"
                />
                <select
                  value={transitionUnit}
                  onChange={(e) =>
                    setTransitionUnit(
                      e.target.value as "measures" | "beats",
                    )
                  }
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="measures">measures</option>
                  <option value="beats">beats</option>
                </select>
              </div>
              <span className="text-[10px] text-muted-foreground/70">
                Silence + stick-click cue between keys (matches Arpeggios).
              </span>
            </div>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-mono uppercase tracking-wider text-muted-foreground">
                Count-in measures
              </span>
              <ClampedNumberInput
                value={countInMeasures}
                min={0}
                max={2}
                onChange={setCountInMeasures}
                ariaLabel="Count-in measures"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={repeatIndefinitely}
              onChange={(e) => setRepeatIndefinitely(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--primary)]"
            />
            <span>Loop indefinitely (Stop when you're done)</span>
          </label>

          {!repeatIndefinitely && (
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-mono uppercase tracking-wider text-muted-foreground">
                Number of passes
              </span>
              <ClampedNumberInput
                className="w-32"
                value={repetitions}
                min={1}
                max={64}
                onChange={setRepetitions}
                ariaLabel="Number of passes"
              />
            </label>
          )}
        </section>

        {/* Display — practice-screen layout picker. Mirrors the Arpeggios
            module's Display section so the picker feels the same across
            modules. Applies globally via useUserPrefs. */}
        <section className="flex flex-col gap-3 rounded-md border border-border bg-card/40 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Display
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Drill-screen layout. Applies to both Arpeggios and Key
              Sequencer.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PRACTICE_LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setPracticeLayout(l)}
                className={`flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors ${
                  practiceLayout === l
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-background hover:border-primary/40"
                }`}
              >
                <span
                  className={`text-sm font-medium ${
                    practiceLayout === l ? "text-primary" : "text-foreground"
                  }`}
                >
                  {PRACTICE_LAYOUT_DISPLAY_NAMES[l]}
                </span>
                <span className="text-[10px] text-muted-foreground/80">
                  {l === "single-pane"
                    ? "Big Now card, small Next preview below."
                    : "Equal-weight Now / Next side-by-side."}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Voice announcement — optional browser TTS reads the upcoming
            key + row words a beat or two before each change. Great for
            eyes-off practice on any instrument. */}
        <section className="flex flex-col gap-3 rounded-md border border-border bg-card/40 p-5">
          <div className="flex items-baseline justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Voice announcement
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Optional — the browser will read the upcoming key + words
                aloud a couple beats before each change. Great for
                eyes-off practice.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={voiceAnnounce?.enabled ?? false}
                onChange={(e) =>
                  setVoiceAnnounce({
                    enabled: e.target.checked,
                    leadBeats: voiceAnnounce?.leadBeats ?? 2,
                    rate: voiceAnnounce?.rate ?? 1.0,
                    template: voiceAnnounce?.template ?? "key-then-rows",
                  })
                }
                disabled={!ttsSupported}
                className="h-4 w-4 accent-[color:var(--primary)]"
              />
              <span>Enabled</span>
            </label>
          </div>
          {!ttsSupported && (
            <p className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
              Your browser doesn&rsquo;t support speech synthesis. Try
              Chrome, Edge, Firefox, or Safari.
            </p>
          )}
          {ttsSupported && voiceAnnounce?.enabled && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-mono uppercase tracking-wider text-muted-foreground">
                    Template
                  </span>
                  <select
                    value={voiceAnnounce.template}
                    onChange={(e) =>
                      setVoiceAnnounce({
                        ...voiceAnnounce,
                        template: e.target.value as
                          | "key-then-rows"
                          | "key-only",
                      })
                    }
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="key-then-rows">
                      Key + rows ("A flat. Minor 7. Ascending.")
                    </option>
                    <option value="key-only">Key only ("A flat.")</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-mono uppercase tracking-wider text-muted-foreground">
                    Lead beats
                  </span>
                  <ClampedNumberInput
                    value={voiceAnnounce.leadBeats}
                    min={1}
                    max={4}
                    onChange={(v) =>
                      setVoiceAnnounce({ ...voiceAnnounce, leadBeats: v })
                    }
                    ariaLabel="Lead beats"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-mono uppercase tracking-wider text-muted-foreground">
                    Rate ({voiceAnnounce.rate.toFixed(2)}×)
                  </span>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={voiceAnnounce.rate}
                    onChange={(e) =>
                      setVoiceAnnounce({
                        ...voiceAnnounce,
                        rate: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-[color:var(--primary)]"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() =>
                  speakUpcoming(
                    voiceAnnounce.template === "key-only"
                      ? "A flat."
                      : "A flat. Minor 7. Ascending.",
                    voiceAnnounce.rate,
                  )
                }
                className="self-start rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Test voice
              </button>
            </div>
          )}
        </section>

        {/* Save-as-drill form — always visible, saves the current live
            config as a new library entry. Save changes on an existing
            loaded drill goes through the editing-badge above. */}
        <section className="flex flex-col gap-3 rounded-md border border-border bg-card/40 p-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Save as drill
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Snapshot the current setup into your library — appears at the
              top of this page for one-click re-launch.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value.slice(0, 80))}
              placeholder="Drill name (e.g. Morning warmup)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              disabled={keyPool.length === 0}
            />
            <button
              type="button"
              onClick={handleSaveAsNew}
              disabled={!saveName.trim() || keyPool.length === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save as new drill
            </button>
          </div>
          <textarea
            value={saveNotes}
            onChange={(e) => setSaveNotes(e.target.value.slice(0, 300))}
            placeholder="Notes (optional) — e.g. Slow at 60. Focus on left-hand timing."
            rows={2}
            className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:border-primary focus:text-foreground focus:outline-none"
            disabled={keyPool.length === 0}
          />
        </section>

        {/* Launch — go to the drill session. */}
        <section className="flex flex-col items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => router.push("/practice/keys/session")}
            disabled={keyPool.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-lg font-medium text-primary-foreground shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-5 w-5" aria-hidden="true" />
            Start drill
          </button>
          <p className="text-[11px] text-muted-foreground/70">
            Space to Start / Stop once you're in the drill screen. Press{" "}
            <kbd className="rounded border border-border bg-card px-1 font-mono text-[10px]">
              ?
            </kbd>{" "}
            anywhere to see all shortcuts.
          </p>
        </section>

        {/* Foothold link back home */}
        <div className="flex justify-center">
          <Link
            href="/"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
