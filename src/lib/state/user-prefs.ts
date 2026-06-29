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
};

export const DEFAULT_USER_PREFS: UserPrefs = {
  practiceLayout: "single-pane",
  theme: "dark",
  accent: "amber",
  notationDefault: "jazz-minus",
  patternDisplay: "name",
};

type UserPrefsStore = UserPrefs & {
  setPracticeLayout: (layout: PracticeLayout) => void;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentPalette) => void;
  setNotationDefault: (style: ChordNotationStyle) => void;
  setPatternDisplay: (display: PatternDisplay) => void;
  /** Reset all prefs to defaults. Used by the future Settings reset action. */
  resetAll: () => void;
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
      resetAll: () => set(DEFAULT_USER_PREFS),
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
