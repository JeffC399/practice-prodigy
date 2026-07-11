"use client";

import { KeyRound, Play, Save, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { KeyDrillCard } from "@/components/key-sequencer/key-drill-card";
import { KeySequencerLivePreview } from "@/components/key-sequencer/live-preview";
import { PromptRowEditor } from "@/components/key-sequencer/prompt-row-editor";
import {
  BPM_MAX,
  BPM_MIN,
  ORDERING_STRATEGIES,
  ORDERING_STRATEGY_DISPLAY_NAMES,
  TIME_SIGNATURES,
} from "@/lib/state/practice-config";
import { useKeySequencerConfig } from "@/lib/key-sequencer/config-store";
import { useKeyDrillsLibrary } from "@/lib/key-sequencer/library-store";
import type {
  KeyDrill,
  KeyPitchClass,
  KeySequencerConfig,
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
    // Stay on setup — user tweaks then hits Save changes / Save as new.
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

  const handleDoneEditing = () => setLoadedKeyDrillId(undefined);

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
  useEffect(() => {
    if (mounted) drillsLib.seedStartersIfNeeded();
  }, [mounted, drillsLib]);

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

        {/* Your key drills — the saved library at the top of the page.
            Same location + pattern as /practice's Quick Start section. */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Your key drills
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your saved key drills — click a card to launch, pencil to
              edit, copy to duplicate.
            </p>
          </div>
          {sortedDrills.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-background/30 px-4 py-6 text-center text-sm text-muted-foreground leading-relaxed">
              No saved key drills yet. Configure one below and hit{" "}
              <span className="font-medium text-foreground">
                Save as drill
              </span>{" "}
              to add it here.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {sortedDrills.map((d) => (
                <KeyDrillCard
                  key={d.id}
                  drill={d}
                  isEditing={d.id === loadedKeyDrillId}
                  onLaunch={handleLaunchDrill}
                  onEdit={handleEditDrill}
                  onDuplicate={handleDuplicateDrill}
                  onDelete={(id) => {
                    drillsLib.deleteDrill(id);
                    if (id === loadedKeyDrillId) setLoadedKeyDrillId(undefined);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* Editing badge — visible when the live config was loaded from
            a saved drill. Save changes / Discard / Done editing. */}
        {editingDrill && (
          <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-primary">
                Editing drill · {editingDrill.name}
              </span>
              <div className="flex flex-wrap gap-2">
                {isDirty && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveChanges}
                      className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
                    >
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
              Edit the pool, prompt rows, tempo, or session settings below —
              they all apply to this drill. Click{" "}
              <span className="font-medium text-foreground">Save changes</span>{" "}
              to commit them.
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
                Measures per key
              </span>
              <input
                type="number"
                min={1}
                max={16}
                step={1}
                value={measuresPerKey}
                onChange={(e) =>
                  setMeasuresPerKey(
                    Math.max(1, Math.min(16, parseInt(e.target.value, 10) || 1)),
                  )
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-mono uppercase tracking-wider text-muted-foreground">
                Rest measures between keys
              </span>
              <input
                type="number"
                min={0}
                max={4}
                step={1}
                value={restMeasuresBetweenKeys}
                onChange={(e) =>
                  setRestMeasuresBetweenKeys(
                    Math.max(0, Math.min(4, parseInt(e.target.value, 10) || 0)),
                  )
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-mono uppercase tracking-wider text-muted-foreground">
                Count-in measures
              </span>
              <input
                type="number"
                min={0}
                max={2}
                step={1}
                value={countInMeasures}
                onChange={(e) =>
                  setCountInMeasures(
                    Math.max(0, Math.min(2, parseInt(e.target.value, 10) || 0)),
                  )
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
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
              <input
                type="number"
                min={1}
                max={64}
                step={1}
                value={repetitions}
                onChange={(e) =>
                  setRepetitions(
                    Math.max(1, Math.min(64, parseInt(e.target.value, 10) || 1)),
                  )
                }
                className="w-32 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
          )}
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
                  <input
                    type="number"
                    min={1}
                    max={4}
                    step={1}
                    value={voiceAnnounce.leadBeats}
                    onChange={(e) =>
                      setVoiceAnnounce({
                        ...voiceAnnounce,
                        leadBeats: Math.max(
                          1,
                          Math.min(4, parseInt(e.target.value, 10) || 2),
                        ),
                      })
                    }
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
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
