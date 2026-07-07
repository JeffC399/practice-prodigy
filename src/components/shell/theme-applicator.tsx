"use client";

import { useEffect } from "react";
import {
  ACCENT_PALETTES,
  FONT_SCALES,
  PAPER_COLORS,
  THEME_PALETTES,
  UI_DENSITIES,
  UI_FONTS,
  useUserPrefs,
} from "@/lib/state/user-prefs";

/**
 * Applies the user's theme + palette + accent + a11y prefs to <html>
 * as CSS classes and custom properties. Runs as a client-side side
 * effect since Zustand state hydration only resolves after mount.
 *
 * Phase 34 (this pass): also applies theme palette, font scale, UI
 * density, paper color, UI font family, reduce-motion, larger-
 * targets, and the custom-accent override.
 *
 * No-flash limitation (v1): the initial server render uses the
 * hardcoded "dark" class (see layout.tsx); on first client render
 * this component swaps in the user's actual preferences. There's a
 * brief flash if the user has chosen a lighter theme while the SSR
 * HTML is dark. Acceptable for v1.
 */
export function ThemeApplicator() {
  const {
    theme,
    accent,
    themePalette,
    customAccent,
    fontScale,
    uiDensity,
    paperColor,
    uiFont,
    reduceMotion,
    largerTargets,
    autoThemeByTime,
  } = useUserPrefs();

  useEffect(() => {
    const root = document.documentElement;

    const resolveDark = (): boolean => {
      // Auto-by-time takes precedence. Local wall time between 6:00
      // and 18:00 -> light; otherwise dark.
      if (autoThemeByTime) {
        const hour = new Date().getHours();
        return hour < 6 || hour >= 18;
      }
      if (theme === "dark") return true;
      if (theme === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    };

    const applyThemeClass = () => {
      if (resolveDark()) root.classList.add("dark");
      else root.classList.remove("dark");
    };
    applyThemeClass();

    // Accent palette (existing).
    ACCENT_PALETTES.forEach((a) =>
      root.classList.remove(`accent-${a}`),
    );
    root.classList.add(`accent-${accent}`);

    // Phase 34 — theme palette.
    THEME_PALETTES.forEach((p) =>
      root.classList.remove(`palette-${p}`),
    );
    if (themePalette !== "default") {
      root.classList.add(`palette-${themePalette}`);
    }

    // Custom accent overrides both the accent-* class AND the palette.
    // Applied via inline CSS variables at document level so any
    // Tailwind primary / ring reference picks it up.
    if (customAccent) {
      root.style.setProperty("--primary", customAccent);
      root.style.setProperty("--ring", customAccent);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
    }

    // Font scale.
    FONT_SCALES.forEach((s) => root.classList.remove(`font-scale-${s}`));
    root.classList.add(`font-scale-${fontScale}`);

    // UI density.
    UI_DENSITIES.forEach((d) => root.classList.remove(`density-${d}`));
    root.classList.add(`density-${uiDensity}`);

    // Paper color.
    PAPER_COLORS.forEach((c) => root.classList.remove(`paper-${c}`));
    if (paperColor !== "cream") {
      root.classList.add(`paper-${paperColor}`);
    }

    // UI font family.
    UI_FONTS.forEach((f) => root.classList.remove(`ui-font-${f}`));
    if (uiFont !== "geist") {
      root.classList.add(`ui-font-${uiFont}`);
    }

    // Accessibility toggles.
    root.classList.toggle("reduce-motion", reduceMotion);
    root.classList.toggle("larger-targets", largerTargets);

    // System-preference change listener (only matters when theme ==
    // "system" AND autoThemeByTime is off).
    if (theme === "system" && !autoThemeByTime) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyThemeClass();
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }

    // Auto-theme-by-time re-eval every minute. Cheap; less code than
    // computing the exact next boundary and using setTimeout.
    if (autoThemeByTime) {
      const t = setInterval(applyThemeClass, 60_000);
      return () => clearInterval(t);
    }
  }, [
    theme,
    accent,
    themePalette,
    customAccent,
    fontScale,
    uiDensity,
    paperColor,
    uiFont,
    reduceMotion,
    largerTargets,
    autoThemeByTime,
  ]);

  return null;
}
