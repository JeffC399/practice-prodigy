import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ArpeggioPattern } from "@/lib/music/arpeggio";
import {
  LEGACY_BUILT_IN_PATTERN_IDS,
  remapLegacyPatternId,
} from "@/lib/music/arpeggio";
import type { Chord, PitchClass, ChordQuality } from "@/lib/music/chord";
import type { ChordNotationStyle } from "@/lib/music/render-chord";
import type { PatternDisplay } from "./user-prefs";

/**
 * Persistent practice configuration store.
 *
 * Holds the chord pool, tempo, meter, drill length, repetitions, and
 * randomization toggles that drive the /practice/session drill screen.
 * Persisted to localStorage so the user's last setup survives reloads
 * and revisits — they don't have to re-pick everything every time.
 *
 * This is the first concrete piece of the **cascading defaults**
 * architecture (PROJECT-DESIGN.md §3.2). For this slice it's a single
 * flat layer; future slices will introduce the four-layer cascade
 * (System → User → Pattern → Per-session override).
 */

export const TIME_SIGNATURES = [
  { beatsPerMeasure: 2, beatUnit: 4 },
  { beatsPerMeasure: 3, beatUnit: 4 },
  { beatsPerMeasure: 4, beatUnit: 4 },
  { beatsPerMeasure: 5, beatUnit: 4 },
  { beatsPerMeasure: 7, beatUnit: 4 },
  { beatsPerMeasure: 5, beatUnit: 8 },
  { beatsPerMeasure: 6, beatUnit: 8 },
  { beatsPerMeasure: 7, beatUnit: 8 },
  { beatsPerMeasure: 9, beatUnit: 8 },
  { beatsPerMeasure: 12, beatUnit: 8 },
] as const;

export type TimeSignature = (typeof TIME_SIGNATURES)[number];

export const COUNT_IN_OPTIONS = [
  { measures: 0, label: "Off" },
  { measures: 1, label: "1 measure" },
  { measures: 2, label: "2 measures" },
] as const;

export const TRANSITION_UNIT_OPTIONS = ["measures", "beats"] as const;
export type TransitionUnit = (typeof TRANSITION_UNIT_OPTIONS)[number];

/**
 * Ordering strategies per PROJECT-DESIGN.md §4.4. v1 ships all 8; this
 * slice implements "custom" (deterministic) and "randomSamplePerRep"
 * (fresh random sample from the chord pool on every repetition). The
 * remaining 6 land in a later slice without changing the store shape.
 */
export const ORDERING_STRATEGIES = [
  "custom",
  "chromaticAsc",
  "chromaticDesc",
  "cycleOf5ths",
  "cycleOf4ths",
  "randomReplace",
  "randomShuffleOnce",
  "randomShuffleEachPass",
] as const;

export type OrderingStrategy = (typeof ORDERING_STRATEGIES)[number];

export const ORDERING_STRATEGY_DISPLAY_NAMES: Record<
  OrderingStrategy,
  string
> = {
  custom: "Custom (drag to reorder)",
  chromaticAsc: "Chromatic ascending",
  chromaticDesc: "Chromatic descending",
  cycleOf5ths: "Cycle of 5ths (C → F → B♭ ...)",
  cycleOf4ths: "Cycle of 4ths (C → G → D ...)",
  randomReplace: "Random with replacement",
  randomShuffleOnce: "Random shuffled (once)",
  randomShuffleEachPass: "Random shuffled (each rep)",
};

/** Strategies whose generation involves randomness (drives Random badge). */
export const RANDOM_ORDERING_STRATEGIES: ReadonlySet<OrderingStrategy> =
  new Set([
    "randomReplace",
    "randomShuffleOnce",
    "randomShuffleEachPass",
  ]);

/**
 * Pattern ordering — narrower than OrderingStrategy because patterns
 * have no pitch class / cycle position, so the chromatic / cycle
 * sorting strategies don't apply. Only the strategies that work on
 * an arbitrary list of items are valid here.
 */
export const PATTERN_ORDERINGS = [
  "custom",
  "randomReplace",
  "randomShuffleOnce",
  "randomShuffleEachPass",
] as const;
export type PatternOrdering = (typeof PATTERN_ORDERINGS)[number];

export const PATTERN_ORDERING_DISPLAY_NAMES: Record<PatternOrdering, string> = {
  custom: "Custom (cycle through)",
  randomReplace: "Random with replacement",
  randomShuffleOnce: "Random shuffled (once)",
  randomShuffleEachPass: "Random shuffled (each rep)",
};

export const RANDOM_PATTERN_ORDERINGS: ReadonlySet<PatternOrdering> = new Set([
  "randomReplace",
  "randomShuffleOnce",
  "randomShuffleEachPass",
]);

export type PracticeConfig = {
  chordPool: Chord[];
  /**
   * Stable per-slot IDs for the chord pool — parallel to chordPool
   * (same length, same ordering). Used as the sortable item id for
   * drag-and-drop so dnd-kit can track an entry's identity across
   * reorders. Without these, the drop animation stutters because
   * index-based IDs change every time the pool reorders.
   */
  chordPoolIds: string[];
  orderingStrategy: OrderingStrategy;
  measuresPerChord: number;
  /**
   * Length of ONE drill repetition, in measures. Total played
   * measures = drillMeasures × repetitions.
   */
  drillMeasures: number;
  /** How many times to run the drill. Each rep re-samples when randomized. */
  repetitions: number;
  /**
   * When true, ignore `repetitions` and run the drill until the user
   * stops. Maps to a large pre-generated sequence buffer in practice
   * (no actual infinity), but functionally limitless for any normal
   * practice session.
   */
  repeatIndefinitely: boolean;
  /**
   * Unit for the inter-chord prep window (see transitionCount). The
   * measures option locks transitions to bar boundaries (intuitive
   * for beginners); beats lets advanced users dial in sub-measure
   * prep at the cost of mid-measure chord changes on screen.
   */
  transitionUnit: TransitionUnit;
  /**
   * Beats (or measures, per transitionUnit) of "GET READY" prep
   * inserted between chord changes during play. 0 disables. Sub-
   * sequent chord positions in the play sequence get this many beats
   * of pre-display before the actual play beats begin — gives the
   * user time to find the new root before they have to start the
   * arpeggio.
   */
  transitionCount: number;
  bpm: number;
  timeSignature: TimeSignature;
  countInMeasures: number;
  notationStyle: ChordNotationStyle;
  /**
   * The PRIMARY arpeggio pattern. Kept for backwards compatibility
   * with older drill snapshots and as the "fallback" pattern when
   * patternPool has just one entry (which is the default for drills
   * that haven't opted into multi-pattern drilling). Most reads of
   * "what pattern to play right now" should go through the per-
   * measure picker (patternAtMeasure in sequence.ts), not this field
   * directly.
   */
  arpeggioPattern: ArpeggioPattern;
  /**
   * Pattern pool — list of arpeggio patterns the drill cycles
   * through, one per play measure. For backwards compatibility, this
   * defaults to a single-entry list containing `arpeggioPattern`.
   * Users who want pattern-mixing drills extend the pool to 2+ entries
   * via the Pattern section on the setup screen. Pattern ordering
   * (below) determines how the pool is sequenced across measures.
   */
  patternPool: ArpeggioPattern[];
  /**
   * How patterns from `patternPool` are sequenced across the drill's
   * play measures. Pool of size 1 makes this irrelevant. Pool of size
   * 2+ uses one of the four strategies (see PatternOrdering).
   */
  patternOrdering: PatternOrdering;
  /**
   * Per-drill override for the global pattern-display preference.
   * `null` (the default) means "use the user-global setting" — saved
   * drills inherit the user's preference at the time they're loaded.
   * Any non-null value pins the drill to that specific display mode
   * regardless of the global setting (e.g. an ear-training drill
   * might force "degrees" while transcription drills stay on "name").
   */
  patternDisplay: PatternDisplay | null;
};

export const BPM_MIN = 30;
export const BPM_MAX = 300;
export const DRILL_MIN = 1;
export const DRILL_MAX = 64;
export const REPS_MIN = 1;
export const REPS_MAX = 32;
// Up to 12 roots × 12 qualities — comfortably handles the wizard's
// largest reasonable cross-products (e.g. 12 roots × all common
// 7ths = 48 chords) without artificial truncation.
export const POOL_MAX = 144;
export const TRANSITION_MAX = 16;

/**
 * Exported default PracticeConfig — consumed by setup-page logic that
 * needs to normalize older saved drill snapshots up to the current
 * schema (so newly-added fields don't show as "dirty" just because
 * an old drill doesn't carry them yet).
 */
function newChordSlotId(): string {
  return `slot_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export const DEFAULT_PRACTICE_CONFIG: PracticeConfig = {
  chordPool: [{ root: "A", quality: "min7" }],
  chordPoolIds: ["slot_default"],
  orderingStrategy: "custom",
  measuresPerChord: 1,
  drillMeasures: 8,
  repetitions: 1,
  repeatIndefinitely: false,
  transitionUnit: "measures",
  transitionCount: 0,
  bpm: 90,
  timeSignature: { beatsPerMeasure: 4, beatUnit: 4 },
  countInMeasures: 1,
  notationStyle: "jazz-minus",
  arpeggioPattern: "7th-chords",
  // Pool defaults to the single arpeggioPattern above, so a fresh
  // PracticeConfig behaves exactly like pre-Phase-10 — one pattern
  // drilled across every measure. Users opt into multi-pattern
  // drilling by extending the pool from the setup screen.
  patternPool: ["7th-chords"],
  patternOrdering: "custom",
  // null = follow the user-global pattern-display preference. Drills
  // can pin a specific display mode by setting this explicitly.
  patternDisplay: null,
};

type PracticeConfigStore = PracticeConfig & {
  /**
   * ID of the Drill currently being edited, or null when the user is
   * working on an ad-hoc setup. UI state — sits in the store so it
   * survives navigation between setup and session. Set on Edit-card
   * click; cleared on Done-editing / Save-as-new.
   */
  loadedDrillId: string | null;
  setLoadedDrillId: (id: string | null) => void;
  addChord: (chord?: Chord) => void;
  removeChordAt: (index: number) => void;
  setChordRootAt: (index: number, root: PitchClass) => void;
  setChordQualityAt: (index: number, quality: ChordQuality) => void;
  /** Replace the entire pool. Used by the quick-build wizard. */
  replaceChordPool: (chords: Chord[]) => void;
  /** Append chords to the pool. Used by the quick-build "Add" action. */
  appendChords: (chords: Chord[]) => void;
  /** Move a chord from one position to another. Used by drag-to-reorder. */
  moveChord: (fromIndex: number, toIndex: number) => void;
  setOrderingStrategy: (strategy: OrderingStrategy) => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  setCountInMeasures: (measures: number) => void;
  setDrillMeasures: (measures: number) => void;
  setRepetitions: (reps: number) => void;
  setRepeatIndefinitely: (repeat: boolean) => void;
  setTransitionUnit: (unit: TransitionUnit) => void;
  setTransitionCount: (count: number) => void;
  setNotationStyle: (style: ChordNotationStyle) => void;
  setArpeggioPattern: (pattern: ArpeggioPattern) => void;
  /**
   * Toggle a pattern's membership in the pool. Adding the only
   * pattern leaves the pool empty? — no: setTogglePatternInPool
   * always keeps at least one entry, refusing to remove the last
   * pattern. The arpeggioPattern field is kept in sync with the
   * first pool entry so legacy code paths still work.
   */
  togglePatternInPool: (pattern: ArpeggioPattern) => void;
  /** Set the pattern-pool ordering strategy. */
  setPatternOrdering: (ordering: PatternOrdering) => void;
  /**
   * Set the per-drill patternDisplay override. Pass null to clear
   * the override (drill follows user-global setting). Pass a
   * specific value to pin the drill to that display mode.
   */
  setPatternDisplay: (display: PatternDisplay | null) => void;
  /** Replace every config field with values from a loaded Drill. */
  loadConfig: (config: PracticeConfig) => void;
  resetToDefaults: () => void;
};

export const usePracticeConfig = create<PracticeConfigStore>()(
  persist(
    (set) => ({
      ...DEFAULT_PRACTICE_CONFIG,
      loadedDrillId: null,
      setLoadedDrillId: (loadedDrillId) => set({ loadedDrillId }),
      addChord: (chord) =>
        set((state) => {
          if (state.chordPool.length >= POOL_MAX) return {};
          const newChord: Chord =
            chord ??
            (state.chordPool.length > 0
              ? { ...state.chordPool[state.chordPool.length - 1] }
              : { root: "A", quality: "min7" });
          return {
            chordPool: [...state.chordPool, newChord],
            chordPoolIds: [...state.chordPoolIds, newChordSlotId()],
          };
        }),
      removeChordAt: (index) =>
        set((state) => {
          if (state.chordPool.length <= 1) return {};
          return {
            chordPool: state.chordPool.filter((_, i) => i !== index),
            chordPoolIds: state.chordPoolIds.filter((_, i) => i !== index),
          };
        }),
      setChordRootAt: (index, root) =>
        set((state) => ({
          chordPool: state.chordPool.map((c, i) =>
            i === index ? { ...c, root } : c,
          ),
          // ids unchanged — slot identity preserved across value edits
        })),
      setChordQualityAt: (index, quality) =>
        set((state) => ({
          chordPool: state.chordPool.map((c, i) =>
            i === index ? { ...c, quality } : c,
          ),
        })),
      replaceChordPool: (chords) =>
        set(() => {
          const next =
            chords.length > 0
              ? chords.slice(0, POOL_MAX)
              : DEFAULT_PRACTICE_CONFIG.chordPool;
          return {
            chordPool: next,
            chordPoolIds: next.map(() => newChordSlotId()),
          };
        }),
      appendChords: (chords) =>
        set((state) => {
          const room = POOL_MAX - state.chordPool.length;
          if (room <= 0) return {};
          const adding = chords.slice(0, room);
          return {
            chordPool: [...state.chordPool, ...adding],
            chordPoolIds: [
              ...state.chordPoolIds,
              ...adding.map(() => newChordSlotId()),
            ],
          };
        }),
      moveChord: (fromIndex, toIndex) =>
        set((state) => {
          if (
            fromIndex === toIndex ||
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= state.chordPool.length ||
            toIndex >= state.chordPool.length
          ) {
            return {};
          }
          const nextPool = [...state.chordPool];
          const [movedChord] = nextPool.splice(fromIndex, 1);
          nextPool.splice(toIndex, 0, movedChord);
          const nextIds = [...state.chordPoolIds];
          const [movedId] = nextIds.splice(fromIndex, 1);
          nextIds.splice(toIndex, 0, movedId);
          return { chordPool: nextPool, chordPoolIds: nextIds };
        }),
      setOrderingStrategy: (orderingStrategy) => set({ orderingStrategy }),
      setBpm: (bpm) =>
        set({ bpm: clamp(Math.round(bpm), BPM_MIN, BPM_MAX) }),
      setTimeSignature: (timeSignature) => set({ timeSignature }),
      setCountInMeasures: (countInMeasures) => set({ countInMeasures }),
      setDrillMeasures: (drillMeasures) =>
        set({
          drillMeasures: clamp(
            Math.round(drillMeasures),
            DRILL_MIN,
            DRILL_MAX,
          ),
        }),
      setRepetitions: (repetitions) =>
        set({
          repetitions: clamp(Math.round(repetitions), REPS_MIN, REPS_MAX),
        }),
      setRepeatIndefinitely: (repeatIndefinitely) =>
        set({ repeatIndefinitely }),
      setTransitionUnit: (transitionUnit) => set({ transitionUnit }),
      setTransitionCount: (transitionCount) =>
        set({
          transitionCount: clamp(
            Math.round(transitionCount),
            0,
            TRANSITION_MAX,
          ),
        }),
      setNotationStyle: (notationStyle) => set({ notationStyle }),
      setArpeggioPattern: (arpeggioPattern) =>
        set({
          arpeggioPattern,
          // Keep pool in lockstep — single-pattern drills are still
          // the common case, so the picker on /practice mirrors the
          // pool head.
          patternPool: [arpeggioPattern],
        }),
      togglePatternInPool: (pattern) =>
        set((state) => {
          const isPresent = state.patternPool.includes(pattern);
          let nextPool: ArpeggioPattern[];
          if (isPresent) {
            // Refuse to remove the last pattern — the drill needs
            // at least one to play.
            if (state.patternPool.length === 1) return {};
            nextPool = state.patternPool.filter((p) => p !== pattern);
          } else {
            nextPool = [...state.patternPool, pattern];
          }
          return {
            patternPool: nextPool,
            // arpeggioPattern tracks the first pool entry for backwards
            // compat with the legacy single-pattern UI + readers.
            arpeggioPattern: nextPool[0],
          };
        }),
      setPatternOrdering: (patternOrdering) => set({ patternOrdering }),
      setPatternDisplay: (patternDisplay) => set({ patternDisplay }),
      loadConfig: (config) =>
        // Spread defaults first so a drill saved under an older schema
        // (missing fields added later) still loads with sensible values.
        // Then ensure chordPoolIds is in lockstep with chordPool — a
        // drill saved before the parallel-id array existed will lack
        // them; mismatched length means we regenerate fresh. Same idea
        // for the pattern pool: pre-Phase-10 drills lacked patternPool,
        // so we synthesize it from the arpeggioPattern.
        set(() => {
          const merged: PracticeConfig = {
            ...DEFAULT_PRACTICE_CONFIG,
            ...config,
          };
          if (merged.chordPoolIds.length !== merged.chordPool.length) {
            merged.chordPoolIds = merged.chordPool.map(() =>
              newChordSlotId(),
            );
          }
          if (
            !Array.isArray(merged.patternPool) ||
            merged.patternPool.length === 0
          ) {
            merged.patternPool = [merged.arpeggioPattern];
          }
          return merged;
        }),
      resetToDefaults: () => set(DEFAULT_PRACTICE_CONFIG),
    }),
    {
      name: "practice-prodigy:practice-config:v1",
      storage: createJSONStorage(() => localStorage),
      version: 11,
      migrate: (persistedState, version) => {
        if (
          !persistedState ||
          typeof persistedState !== "object"
        ) {
          return persistedState;
        }
        const next = { ...persistedState } as Record<string, unknown>;

        // v1 → v2: single `chord` field became `chordPool` array.
        if (version === 1) {
          const oldChord = next.chord as Chord | undefined;
          delete next.chord;
          next.chordPool = oldChord
            ? [oldChord]
            : DEFAULT_PRACTICE_CONFIG.chordPool;
          next.orderingStrategy = DEFAULT_PRACTICE_CONFIG.orderingStrategy;
          next.measuresPerChord = DEFAULT_PRACTICE_CONFIG.measuresPerChord;
        }

        // v2 → v3: `sessionMeasures` renamed to `drillMeasures` and the
        // drill grew a `repetitions` × `drillMeasures` total-length
        // model. The v3 `randomizeChords` toggle is later removed in
        // v7 in favor of the full orderingStrategy enum — that
        // migration converts the boolean to the matching strategy.
        if (version <= 2) {
          const oldMeasures = (next.sessionMeasures as number | undefined) ??
            DEFAULT_PRACTICE_CONFIG.drillMeasures;
          delete next.sessionMeasures;
          next.drillMeasures = oldMeasures;
          next.repetitions = DEFAULT_PRACTICE_CONFIG.repetitions;
        }

        // v3 → v4: new `repeatIndefinitely` toggle; defaults to false
        // so existing setups behave identically.
        if (version <= 3) {
          next.repeatIndefinitely = DEFAULT_PRACTICE_CONFIG.repeatIndefinitely;
        }

        // v4 → v5: new `loadedDrillId` UI tracking (null when not
        // editing a saved Drill).
        if (version <= 4) {
          next.loadedDrillId = null;
        }

        // v5 → v6: inter-chord prep window — `transitionUnit` and
        // `transitionCount`. Defaults turn it off so existing setups
        // behave identically.
        if (version <= 5) {
          next.transitionUnit = DEFAULT_PRACTICE_CONFIG.transitionUnit;
          next.transitionCount = DEFAULT_PRACTICE_CONFIG.transitionCount;
        }

        // v6 → v7: replaced the boolean `randomizeChords` toggle with
        // the full `orderingStrategy` enum (8 named strategies).
        if (version <= 6) {
          if (next.randomizeChords === true) {
            next.orderingStrategy = "randomShuffleEachPass";
          }
          delete next.randomizeChords;
        }

        // v7 → v8: parallel `chordPoolIds` array for stable drag IDs.
        // Generate one ID per existing chord so the lengths match.
        if (version <= 7) {
          const pool = Array.isArray(next.chordPool)
            ? (next.chordPool as Chord[])
            : DEFAULT_PRACTICE_CONFIG.chordPool;
          next.chordPoolIds = pool.map(() => newChordSlotId());
        }

        // v8 → v9: pattern pool. Old drills had a single arpeggioPattern;
        // new model has patternPool + patternOrdering. Migrate by
        // wrapping the existing single pattern into a one-entry pool
        // with "custom" ordering — behavior identical to pre-v9.
        if (version <= 8) {
          const existingPattern =
            (next.arpeggioPattern as ArpeggioPattern | undefined) ??
            DEFAULT_PRACTICE_CONFIG.arpeggioPattern;
          next.patternPool = [existingPattern];
          next.patternOrdering = DEFAULT_PRACTICE_CONFIG.patternOrdering;
        }

        // v9 → v10: per-drill patternDisplay override (cascade over
        // the user-global setting). null = "use the global default";
        // existing drills get null so they continue to follow the
        // global. Set explicitly via setPatternDisplay on the setup
        // screen to pin a drill to a specific display mode.
        if (version <= 9) {
          next.patternDisplay = null;
        }

        // v10 → v11: Phase 14 collapsed the 4 built-in patterns down
        // to 2 ("7th-chords" and "triads"). Any legacy ID in a saved
        // drill gets remapped via remapLegacyPatternId so the user's
        // existing setups keep loading. Custom pattern IDs (prefix
        // "custom_") are passed through unchanged.
        if (version <= 10) {
          const isLegacy = (id: unknown): id is string =>
            typeof id === "string" &&
            (LEGACY_BUILT_IN_PATTERN_IDS as readonly string[]).includes(id);
          if (isLegacy(next.arpeggioPattern)) {
            next.arpeggioPattern = remapLegacyPatternId(
              next.arpeggioPattern as string,
            );
          }
          if (Array.isArray(next.patternPool)) {
            next.patternPool = (next.patternPool as unknown[]).map((p) =>
              isLegacy(p) ? remapLegacyPatternId(p as string) : p,
            );
          }
        }

        return next;
      },
    },
  ),
);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
