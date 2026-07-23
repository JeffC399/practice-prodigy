import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CategoryId, CustomCategory } from "@/lib/practice/categories";
import type {
  CategoryProficiency,
  LevelChangeLogEntry,
  ProficiencyLevel,
} from "@/lib/practice/proficiency";
import type { ChordNotationStyle } from "@/lib/music/render-chord";

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * User-global preferences store — the cross-module "User" layer of the
 * cascading-defaults architecture (PROJECT-DESIGN.md §3.2). These are
 * personal viewing / behavior choices that apply across every module,
 * NOT per-drill settings (those live in PracticeConfig).
 *
 * Phase 8.2 shipped the minimal version with just practice-screen
 * layout. Phase 9 (Settings page) extends it with theme, accent
 * palette, and notation default, all stored here and surfaced through
 * the /settings UI.
 *
 * Persisted to its own localStorage key so it survives independently
 * of drill / lead-sheet state.
 */

export type PracticeLayout =
  /** Single big chord centered with a small NEXT preview above. v1 default. */
  | "single-pane"
  /** Two equally-weighted side-by-side panels: Now and Next. */
  | "two-pane";

export const PRACTICE_LAYOUTS = ["single-pane", "two-pane"] as const;

export const PRACTICE_LAYOUT_DISPLAY_NAMES: Record<PracticeLayout, string> = {
  "single-pane": "Single pane",
  "two-pane": "Two pane",
};

export const PRACTICE_LAYOUT_DESCRIPTIONS: Record<PracticeLayout, string> = {
  "single-pane":
    "One big chord centered, with a small NEXT preview above. Focus mode.",
  "two-pane":
    "Equal-weight Now / Next chord panels side by side. Read-ahead mode for sight-reading-style practice.",
};

/** Theme choice — `system` follows the OS prefers-color-scheme. */
export type ThemeMode = "light" | "dark" | "system";
export const THEME_MODES = ["light", "dark", "system"] as const;
export const THEME_MODE_DISPLAY_NAMES: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/**
 * Accent palette. Each maps to a primary OKLCH color via CSS classes
 * defined in globals.css. Amber is the brand default.
 */
export type AccentPalette = "amber" | "indigo" | "emerald" | "rose";
export const ACCENT_PALETTES = [
  "amber",
  "indigo",
  "emerald",
  "rose",
] as const;
export const ACCENT_PALETTE_DISPLAY_NAMES: Record<AccentPalette, string> = {
  amber: "Amber (brand)",
  indigo: "Indigo",
  emerald: "Emerald",
  rose: "Rose",
};
/** Hex codes for swatch previews on the Settings page. */
export const ACCENT_PALETTE_SWATCHES: Record<AccentPalette, string> = {
  amber: "#f59e0b",
  indigo: "#6366f1",
  emerald: "#10b981",
  rose: "#f43f5e",
};

/**
 * Phase 34 — Predefined theme palettes. Each ships with a curated
 * dark AND light variant, applied via CSS classes on <html>.
 * `default` = the original amber/zinc practice-prodigy scheme.
 */
export type ThemePalette =
  | "default"
  | "nord"
  | "dracula"
  | "solarized"
  | "sepia"
  | "high-contrast"
  | "warm"
  | "cool";
export const THEME_PALETTES = [
  "default",
  "nord",
  "dracula",
  "solarized",
  "sepia",
  "high-contrast",
  "warm",
  "cool",
] as const;
export const THEME_PALETTE_DISPLAY_NAMES: Record<ThemePalette, string> = {
  default: "Practice Prodigy",
  nord: "Nord",
  dracula: "Dracula",
  solarized: "Solarized",
  sepia: "Sepia",
  "high-contrast": "High Contrast",
  warm: "Warm",
  cool: "Cool",
};

/** Text size scale — applied via CSS class + font-size-relative rem values. */
export type FontScale = "compact" | "normal" | "large";
export const FONT_SCALES = ["compact", "normal", "large"] as const;
export const FONT_SCALE_DISPLAY_NAMES: Record<FontScale, string> = {
  compact: "Compact",
  normal: "Normal",
  large: "Large",
};

/** UI density — adjusts padding + gap defaults. */
export type UiDensity = "compact" | "normal" | "roomy";
export const UI_DENSITIES = ["compact", "normal", "roomy"] as const;
export const UI_DENSITY_DISPLAY_NAMES: Record<UiDensity, string> = {
  compact: "Compact",
  normal: "Normal",
  roomy: "Roomy",
};

/** Sheet paper color. */
export type PaperColor = "cream" | "white" | "off-white" | "gray";
export const PAPER_COLORS = ["cream", "white", "off-white", "gray"] as const;
export const PAPER_COLOR_DISPLAY_NAMES: Record<PaperColor, string> = {
  cream: "Cream",
  white: "White",
  "off-white": "Off-white",
  gray: "Light gray",
};
export const PAPER_COLOR_SWATCHES: Record<PaperColor, string> = {
  cream: "#f6f1e6",
  white: "#ffffff",
  "off-white": "#faf8f3",
  gray: "#eeece8",
};

/** UI font family. */
export type UiFont = "geist" | "inter" | "system" | "serif";
export const UI_FONTS = ["geist", "inter", "system", "serif"] as const;
export const UI_FONT_DISPLAY_NAMES: Record<UiFont, string> = {
  geist: "Geist Sans (default)",
  inter: "Inter",
  system: "System UI",
  serif: "Serif",
};

/** Chord font family. */
export type ChordFont = "serif" | "handwritten" | "sans" | "mono";
export const CHORD_FONTS = ["serif", "handwritten", "sans", "mono"] as const;
export const CHORD_FONT_DISPLAY_NAMES: Record<ChordFont, string> = {
  serif: "Serif (Georgia)",
  handwritten: "Handwritten",
  sans: "Sans-serif",
  mono: "Monospace",
};

/** Note pitch coloring. */
export type NoteColoring = "off" | "boomwhacker";
export const NOTE_COLORINGS = ["off", "boomwhacker"] as const;
export const NOTE_COLORING_DISPLAY_NAMES: Record<NoteColoring, string> = {
  off: "Off",
  boomwhacker: "Boomwhacker (C=red, D=orange, …)",
};

/** Corner-radius scale — sharp / normal / round via --radius CSS var. */
export type CornerRadius = "sharp" | "normal" | "round";
export const CORNER_RADII = ["sharp", "normal", "round"] as const;
export const CORNER_RADIUS_DISPLAY_NAMES: Record<CornerRadius, string> = {
  sharp: "Sharp",
  normal: "Normal",
  round: "Round",
};

/**
 * Theme intensity + saturation slider bounds. Values are stored as
 * percentages. Both default to 100 = the palette's full natural
 * strength (no filter effect applied).
 *
 * Phase 34.3 — `uiBrightness` is a misnomer we're keeping for
 * persistence continuity; semantics changed to "theme intensity."
 * 100 = full palette, 50 = maximally shifted toward mid-gray in
 * either light or dark mode (they converge). See globals.css for the
 * mode-aware filter formula.
 */
export const UI_BRIGHTNESS_MIN = 50;
export const UI_BRIGHTNESS_MAX = 100;
export const UI_BRIGHTNESS_DEFAULT = 100;
export const UI_SATURATION_MIN = 60;
export const UI_SATURATION_MAX = 140;
export const UI_SATURATION_DEFAULT = 100;

/**
 * Phase 34.2 — Preset "mood" bundles. Each mood is a partial appearance
 * slice the user can apply in one click. Non-appearance fields are left
 * alone. All values below use the same units as the corresponding pref.
 */
export type AppearanceMood =
  | "late-night"
  | "bright-classroom"
  | "focus"
  | "boomwhacker-classroom";
export const APPEARANCE_MOODS = [
  "late-night",
  "bright-classroom",
  "focus",
  "boomwhacker-classroom",
] as const;
export const APPEARANCE_MOOD_DISPLAY_NAMES: Record<AppearanceMood, string> = {
  "late-night": "Late Night Practice",
  "bright-classroom": "Bright Classroom",
  focus: "Focus",
  "boomwhacker-classroom": "Boomwhacker Classroom",
};
export const APPEARANCE_MOOD_DESCRIPTIONS: Record<AppearanceMood, string> = {
  "late-night":
    "Dark warm palette, dimmed UI, reduced motion. For 11pm practice.",
  "bright-classroom":
    "Light theme, high contrast, larger targets, larger font.",
  focus:
    "Muted saturation, serif UI font, high contrast. Reduces visual noise.",
  "boomwhacker-classroom":
    "Light theme with Boomwhacker note coloring on. High contrast, larger targets, for teaching kids.",
};

/**
 * How the arpeggio pattern label is shown on the drill screen, below
 * each displayed chord. Independent of which pattern is being drilled
 * — purely a visual preference.
 */
export type PatternDisplay =
  /** Pattern name: "Arp 7ths", "Scale Tones", etc. v1 default. */
  | "name"
  /** Scale degrees: "1-3-5-7", "8-7-5-3", etc. */
  | "degrees"
  /** Don't show the subtitle at all. Maximum focus on the chord. */
  | "hidden";

export const PATTERN_DISPLAYS = ["name", "degrees", "hidden"] as const;

export const PATTERN_DISPLAY_LABELS: Record<PatternDisplay, string> = {
  name: "Pattern name",
  degrees: "Scale degrees",
  hidden: "Hidden",
};

export const PATTERN_DISPLAY_DESCRIPTIONS: Record<PatternDisplay, string> = {
  name: "Shows the pattern name (Arp 7ths, Scale Tones, etc.). Best for jazz-style pedagogy.",
  degrees:
    "Shows the chord-tone positions (1-3-5-7, 8-7-5-3, etc.). Best for theory-first practice.",
  hidden:
    "No pattern subtitle. Maximum focus on the chord display.",
};

export type UserPrefs = {
  practiceLayout: PracticeLayout;
  theme: ThemeMode;
  accent: AccentPalette;
  /**
   * Global default notation style. The Setup screen's notation picker
   * remains an override (currently per-drill via PracticeConfig); this
   * is the value the picker falls back to for new drills.
   */
  notationDefault: ChordNotationStyle;
  /** How the arpeggio pattern label renders on the drill screen. */
  patternDisplay: PatternDisplay;
  /**
   * Has the user dismissed the first-visit onboarding hint on the
   * Arpeggios setup page (/practice)? Defaults false — the welcome
   * card shows once until the user clicks "Got it" / X, then never
   * again. Kept as `hasSeenOnboarding` (rather than the more precise
   * `hasSeenArpeggiosOnboarding`) so already-dismissed users don't
   * see the card reappear after Phase 61.
   */
  hasSeenOnboarding: boolean;
  /**
   * Phase 61 — Has the user dismissed the first-visit onboarding
   * hint on the Key Sequencer setup page (/practice/keys)? Parallel
   * to `hasSeenOnboarding` — each module has its own onboarding card
   * with module-specific copy, and each is dismissed independently.
   */
  hasSeenKeySequencerOnboarding: boolean;
  /**
   * Phase 62 — Same idea for the Scale Driller setup page
   * (/practice/scales). Parallel and independent.
   */
  hasSeenScaleDrillerOnboarding: boolean;
  /**
   * Phase 44 — id of the last release note the user dismissed. When
   * the top entry in RELEASE_NOTES has a different id, the "What's
   * new" modal auto-opens on first mount. Undefined = first-ever
   * install; we DON'T auto-open in that case (the onboarding hint
   * already covers first-run guidance).
   */
  lastSeenReleaseId?: string;
  // Phase 34 — Appearance overhaul.
  /** Predefined palette; `default` = the original brand scheme. */
  themePalette: ThemePalette;
  /**
   * Custom accent color as a CSS-parseable string (hex `#f59e0b`,
   * `oklch(...)`, `rgb(...)`, etc.). When null, the palette-defined
   * accent is used. When set, overrides the palette + accent picks.
   */
  customAccent: string | null;
  fontScale: FontScale;
  uiDensity: UiDensity;
  paperColor: PaperColor;
  uiFont: UiFont;
  chordFontDefault: ChordFont;
  noteColoring: NoteColoring;
  reduceMotion: boolean;
  largerTargets: boolean;
  /**
   * When true, `theme` cycles automatically based on wall time —
   * light during the day (06:00–18:00 local), dark at night. Overrides
   * the manual `theme` setting for the applied class.
   */
  autoThemeByTime: boolean;
  // Phase 34.1 — polish bundle.
  /** UI-chrome brightness filter (60–100). 100 = neutral. Sheet stays 100. */
  uiBrightness: number;
  /** UI-chrome saturation filter (60–140). 100 = neutral. Sheet stays 100. */
  uiSaturation: number;
  /** Corner-radius scale for all rounded UI. */
  cornerRadius: CornerRadius;
  /** High-contrast override — boosts fg/bg separation for readability. */
  highContrast: boolean;
  /**
   * Slice A.9 (Phase 89) — User-defined practice categories layered
   * on top of the 10 built-ins. See ROUTINE-DESIGN.md §4.2. Managed
   * via a Settings UI in Slice E; empty by default. Custom category
   * ids use the `custom:` prefix so they never collide with built-ins.
   */
  customCategories: CustomCategory[];
  /**
   * Slice A.14 (Phase 95) — Self-rated proficiency per category.
   * See ROUTINE-DESIGN.md §4.3. Only categories the user has
   * explicitly rated appear here; categories without an entry are
   * treated as "unrated" (no level shown, no AI weighting).
   * Keyed by CategoryId so lookups are O(1).
   *
   * Managed via a Profile → Levels UI in Slice E (v1 self-rated
   * only; automated grading is v2 backlog).
   */
  proficiency: Record<CategoryId, CategoryProficiency>;
  /**
   * Slice A.14 (Phase 95) — Append-only log of level changes for
   * Reports' progression narratives ("Ear Training: Level 2 → 3 ·
   * Sep 12"). Bounded locally to the most recent N entries; full
   * history lives in the cloud (or is derivable at query time).
   */
  levelHistory: LevelChangeLogEntry[];
};

export const DEFAULT_USER_PREFS: UserPrefs = {
  practiceLayout: "single-pane",
  theme: "dark",
  accent: "amber",
  notationDefault: "jazz-minus",
  patternDisplay: "name",
  hasSeenOnboarding: false,
  hasSeenKeySequencerOnboarding: false,
  hasSeenScaleDrillerOnboarding: false,
  // Phase 34 defaults preserve the original brand look.
  themePalette: "default",
  customAccent: null,
  fontScale: "normal",
  uiDensity: "normal",
  paperColor: "cream",
  uiFont: "geist",
  chordFontDefault: "serif",
  noteColoring: "off",
  reduceMotion: false,
  largerTargets: false,
  autoThemeByTime: false,
  uiBrightness: UI_BRIGHTNESS_DEFAULT,
  uiSaturation: UI_SATURATION_DEFAULT,
  cornerRadius: "normal",
  highContrast: false,
  customCategories: [],
  proficiency: {},
  levelHistory: [],
};

/** Local cap on retained level-history entries. Cloud is the source of truth. */
const MAX_LOCAL_LEVEL_HISTORY = 500;

/**
 * Phase 34.2 — every appearance-only field. Used by:
 *   - `getAppearanceSnapshot()` — captures the current appearance for
 *     the "Revert changes" and Compare functionality.
 *   - `applyAppearanceSnapshot()` — restores a saved snapshot.
 *   - the appearance-code encode/decode module (`share-appearance.ts`).
 *
 * Keep in sync with the Phase 34/34.1 pref additions. If a field is
 * appearance-facing (visible in Settings > Appearance), add it here.
 */
export const APPEARANCE_KEYS = [
  "theme",
  "accent",
  "themePalette",
  "customAccent",
  "fontScale",
  "uiDensity",
  "paperColor",
  "uiFont",
  "chordFontDefault",
  "noteColoring",
  "reduceMotion",
  "largerTargets",
  "autoThemeByTime",
  "uiBrightness",
  "uiSaturation",
  "cornerRadius",
  "highContrast",
] as const;
export type AppearanceKey = (typeof APPEARANCE_KEYS)[number];
export type AppearanceSlice = Pick<UserPrefs, AppearanceKey>;

/**
 * Preset mood → partial appearance slice. Applied atomically via
 * `applyAppearanceSlice`. Non-listed fields are left alone.
 */
export const APPEARANCE_MOOD_PRESETS: Record<
  AppearanceMood,
  Partial<AppearanceSlice>
> = {
  "late-night": {
    theme: "dark",
    themePalette: "warm",
    uiBrightness: 75,
    uiSaturation: 90,
    reduceMotion: true,
  },
  "bright-classroom": {
    theme: "light",
    themePalette: "default",
    highContrast: true,
    largerTargets: true,
    fontScale: "large",
    uiBrightness: 100,
    uiSaturation: 100,
  },
  focus: {
    themePalette: "solarized",
    uiFont: "serif",
    uiSaturation: 80,
    highContrast: false,
    reduceMotion: true,
  },
  "boomwhacker-classroom": {
    theme: "light",
    themePalette: "default",
    noteColoring: "boomwhacker",
    highContrast: true,
    largerTargets: true,
    fontScale: "large",
  },
};

type UserPrefsStore = UserPrefs & {
  setPracticeLayout: (layout: PracticeLayout) => void;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentPalette) => void;
  setNotationDefault: (style: ChordNotationStyle) => void;
  setPatternDisplay: (display: PatternDisplay) => void;
  // Phase 34 setters.
  setThemePalette: (palette: ThemePalette) => void;
  setCustomAccent: (color: string | null) => void;
  setFontScale: (scale: FontScale) => void;
  setUiDensity: (density: UiDensity) => void;
  setPaperColor: (color: PaperColor) => void;
  setUiFont: (font: UiFont) => void;
  setChordFontDefault: (font: ChordFont) => void;
  setNoteColoring: (coloring: NoteColoring) => void;
  setReduceMotion: (value: boolean) => void;
  setLargerTargets: (value: boolean) => void;
  setAutoThemeByTime: (value: boolean) => void;
  setUiBrightness: (value: number) => void;
  setUiSaturation: (value: number) => void;
  setCornerRadius: (value: CornerRadius) => void;
  setHighContrast: (value: boolean) => void;
  /** Mark the first-visit onboarding hint as dismissed. */
  dismissOnboarding: () => void;
  /**
   * Phase 61 — Mark the Key Sequencer's first-visit onboarding hint as
   * dismissed. Parallel to `dismissOnboarding` (which is Arpeggios-only).
   */
  dismissKeySequencerOnboarding: () => void;
  /** Phase 62 — Same for the Scale Driller onboarding. */
  dismissScaleDrillerOnboarding: () => void;
  /** Phase 44 — Stamp the id of the release note the user just saw. */
  markReleaseNoteSeen: (id: string) => void;
  /** Reset all prefs to defaults. Used by the future Settings reset action. */
  resetAll: () => void;
  /** Reset ONLY the Phase 34 appearance fields to their defaults. */
  resetAppearance: () => void;
  /** Phase 34.2 — apply a partial appearance slice atomically. */
  applyAppearanceSlice: (slice: Partial<AppearanceSlice>) => void;
  /** Phase 34.2 — apply a preset mood by name. */
  applyMood: (mood: AppearanceMood) => void;
  /**
   * Slice A.14 (Phase 95) — Set (or update) a category's current
   * proficiency level. Appends a LevelChangeLogEntry when the level
   * actually changes (skips log write on no-op).
   */
  setCategoryLevel: (
    categoryId: CategoryId,
    level: ProficiencyLevel,
  ) => void;
  /**
   * Slice A.14 (Phase 95) — Set (or clear with `undefined`) a
   * category's target aspiration level. Independent of current
   * level; can be set even for categories with no current rating.
   */
  setCategoryTarget: (
    categoryId: CategoryId,
    target: 1 | 2 | 3 | 4 | 5 | undefined,
  ) => void;
  /**
   * Slice A.14 (Phase 95) — Remove a category's proficiency entry
   * entirely (as opposed to setting current=n/a, which is a
   * different signal — "I've considered this and it doesn't apply
   * to me"). Used by category-delete flows and Settings reset.
   */
  clearCategoryProficiency: (categoryId: CategoryId) => void;
};

export const useUserPrefs = create<UserPrefsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_USER_PREFS,
      setPracticeLayout: (practiceLayout) => set({ practiceLayout }),
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setNotationDefault: (notationDefault) => set({ notationDefault }),
      setPatternDisplay: (patternDisplay) => set({ patternDisplay }),
      setThemePalette: (themePalette) => set({ themePalette }),
      setCustomAccent: (customAccent) => set({ customAccent }),
      setFontScale: (fontScale) => set({ fontScale }),
      setUiDensity: (uiDensity) => set({ uiDensity }),
      setPaperColor: (paperColor) => set({ paperColor }),
      setUiFont: (uiFont) => set({ uiFont }),
      setChordFontDefault: (chordFontDefault) =>
        set({ chordFontDefault }),
      setNoteColoring: (noteColoring) => set({ noteColoring }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setLargerTargets: (largerTargets) => set({ largerTargets }),
      setAutoThemeByTime: (autoThemeByTime) => set({ autoThemeByTime }),
      setUiBrightness: (uiBrightness) =>
        set({
          uiBrightness: clamp(
            uiBrightness,
            UI_BRIGHTNESS_MIN,
            UI_BRIGHTNESS_MAX,
          ),
        }),
      setUiSaturation: (uiSaturation) =>
        set({
          uiSaturation: clamp(
            uiSaturation,
            UI_SATURATION_MIN,
            UI_SATURATION_MAX,
          ),
        }),
      setCornerRadius: (cornerRadius) => set({ cornerRadius }),
      setHighContrast: (highContrast) => set({ highContrast }),
      dismissOnboarding: () => set({ hasSeenOnboarding: true }),
      dismissKeySequencerOnboarding: () =>
        set({ hasSeenKeySequencerOnboarding: true }),
      dismissScaleDrillerOnboarding: () =>
        set({ hasSeenScaleDrillerOnboarding: true }),
      markReleaseNoteSeen: (id) => set({ lastSeenReleaseId: id }),
      resetAll: () => set(DEFAULT_USER_PREFS),
      resetAppearance: () =>
        set({
          themePalette: DEFAULT_USER_PREFS.themePalette,
          customAccent: DEFAULT_USER_PREFS.customAccent,
          fontScale: DEFAULT_USER_PREFS.fontScale,
          uiDensity: DEFAULT_USER_PREFS.uiDensity,
          paperColor: DEFAULT_USER_PREFS.paperColor,
          uiFont: DEFAULT_USER_PREFS.uiFont,
          chordFontDefault: DEFAULT_USER_PREFS.chordFontDefault,
          noteColoring: DEFAULT_USER_PREFS.noteColoring,
          reduceMotion: DEFAULT_USER_PREFS.reduceMotion,
          largerTargets: DEFAULT_USER_PREFS.largerTargets,
          autoThemeByTime: DEFAULT_USER_PREFS.autoThemeByTime,
          uiBrightness: DEFAULT_USER_PREFS.uiBrightness,
          uiSaturation: DEFAULT_USER_PREFS.uiSaturation,
          cornerRadius: DEFAULT_USER_PREFS.cornerRadius,
          highContrast: DEFAULT_USER_PREFS.highContrast,
        }),
      applyAppearanceSlice: (slice) => set(slice),
      applyMood: (mood) => set(APPEARANCE_MOOD_PRESETS[mood]),
      setCategoryLevel: (categoryId, level) =>
        set((state) => {
          const now = Date.now();
          const existing = state.proficiency[categoryId];
          const from: ProficiencyLevel = existing?.current ?? "n/a";
          const noChange = existing?.current === level;
          const nextProficiency: Record<CategoryId, CategoryProficiency> = {
            ...state.proficiency,
            [categoryId]: {
              categoryId,
              current: level,
              target: existing?.target,
              updatedAt: now,
            },
          };
          if (noChange) {
            return { proficiency: nextProficiency };
          }
          const nextHistory = [
            ...state.levelHistory,
            { categoryId, from, to: level, at: now },
          ];
          const capped =
            nextHistory.length > MAX_LOCAL_LEVEL_HISTORY
              ? nextHistory.slice(nextHistory.length - MAX_LOCAL_LEVEL_HISTORY)
              : nextHistory;
          return { proficiency: nextProficiency, levelHistory: capped };
        }),
      setCategoryTarget: (categoryId, target) =>
        set((state) => {
          const existing = state.proficiency[categoryId];
          return {
            proficiency: {
              ...state.proficiency,
              [categoryId]: {
                categoryId,
                current: existing?.current ?? "n/a",
                target,
                updatedAt: Date.now(),
              },
            },
          };
        }),
      clearCategoryProficiency: (categoryId) =>
        set((state) => {
          if (!state.proficiency[categoryId]) return state;
          const next = { ...state.proficiency };
          delete next[categoryId];
          return { proficiency: next };
        }),
    }),
    {
      name: "practice-prodigy:user-prefs:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Existing users with v1 prefs (just `practiceLayout`) get the
      // new fields filled with defaults on read. No version bump
      // needed — the spread in the store initializer handles it.
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") {
          return DEFAULT_USER_PREFS;
        }
        return {
          ...DEFAULT_USER_PREFS,
          ...(persistedState as Partial<UserPrefs>),
        };
      },
    },
  ),
);

/**
 * Phase 34.2 — extract the appearance-only slice from a full prefs
 * object. Used by the Settings page to snapshot the user's appearance
 * on mount (for Revert changes) and to feed the Compare toggle's
 * "before" view.
 */
export function getAppearanceSnapshot(prefs: UserPrefs): AppearanceSlice {
  const out = {} as AppearanceSlice;
  for (const k of APPEARANCE_KEYS) {
    // Preserve `null` on customAccent; every other field is a value.
    (out as Record<string, unknown>)[k] = prefs[k];
  }
  return out;
}

/**
 * Shallow-compare two appearance slices. Returns true if every key
 * matches. Handles `customAccent`'s nullable case.
 */
export function appearanceSlicesEqual(
  a: AppearanceSlice,
  b: AppearanceSlice,
): boolean {
  for (const k of APPEARANCE_KEYS) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}
