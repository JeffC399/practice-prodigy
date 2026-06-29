import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * User-global preferences store — the cross-module "User" layer of the
 * cascading-defaults architecture (PROJECT-DESIGN.md §3.2). These are
 * personal viewing / behavior choices that apply across every module,
 * NOT per-drill settings (those live in PracticeConfig).
 *
 * Phase 8.2 ships this minimal version with just the practice-screen
 * layout choice. Phase 9 (Settings page) extends it with theme,
 * accent palette, density, default notation style, accessibility
 * toggles, audio defaults, and so on — all stored here, surfaced
 * through the /settings UI.
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

export type UserPrefs = {
  practiceLayout: PracticeLayout;
};

export const DEFAULT_USER_PREFS: UserPrefs = {
  practiceLayout: "single-pane",
};

type UserPrefsStore = UserPrefs & {
  setPracticeLayout: (layout: PracticeLayout) => void;
  /** Reset all prefs to defaults. Used by the future Settings reset action. */
  resetAll: () => void;
};

export const useUserPrefs = create<UserPrefsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_USER_PREFS,
      setPracticeLayout: (practiceLayout) => set({ practiceLayout }),
      resetAll: () => set(DEFAULT_USER_PREFS),
    }),
    {
      name: "practice-prodigy:user-prefs:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
