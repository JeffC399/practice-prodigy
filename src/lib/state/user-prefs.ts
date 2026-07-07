import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChordNotationStyle } from "@/lib/music/render-chord";

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
   * Has the user dismissed the first-visit onboarding hint on
   * /practice? Defaults false — the welcome card shows once until the
   * user clicks the "Got it" / X dismiss action, then never again.
   */
  hasSeenOnboarding: boolean;
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
};

export const DEFAULT_USER_PREFS: UserPrefs = {
  practiceLayout: "single-pane",
  theme: "dark",
  accent: "amber",
  notationDefault: "jazz-minus",
  patternDisplay: "name",
  hasSeenOnboarding: false,
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
  /** Mark the first-visit onboarding hint as dismissed. */
  dismissOnboarding: () => void;
  /** Reset all prefs to defaults. Used by the future Settings reset action. */
  resetAll: () => void;
  /** Reset ONLY the Phase 34 appearance fields to their defaults. */
  resetAppearance: () => void;
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
      dismissOnboarding: () => set({ hasSeenOnboarding: true }),
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
