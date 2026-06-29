"use client";

import { useEffect } from "react";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * Applies the user's theme (light / dark / system) and accent palette
 * to <html> as CSS classes. Runs as a client-side side effect since
 * Zustand state hydration only resolves after mount.
 *
 * No-flash limitation (v1): the initial server render uses the
 * hardcoded "dark" class (see layout.tsx); on first client render
 * this component swaps in the user's actual preference. There's a
 * brief flash if the user has chosen "light" while the SSR HTML is
 * dark. Acceptable for v1; can be eliminated later with a cookies-
 * based pre-render hint, or by moving theme into a server-readable
 * source.
 */
export function ThemeApplicator() {
  const theme = useUserPrefs((s) => s.theme);
  const accent = useUserPrefs((s) => s.accent);

  useEffect(() => {
    const root = document.documentElement;

    // Resolve "system" to the OS preference; for "light"/"dark" use
    // the explicit value. Listening to changes in the system
    // preference is handled below.
    const resolveDark = (mode: typeof theme): boolean => {
      if (mode === "dark") return true;
      if (mode === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    };

    const applyThemeClass = () => {
      if (resolveDark(theme)) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    applyThemeClass();

    // Accent: remove any prior accent-* class, then add the current.
    root.classList.remove(
      "accent-amber",
      "accent-indigo",
      "accent-emerald",
      "accent-rose",
    );
    root.classList.add(`accent-${accent}`);

    // System-preference change listener (only matters when theme="system").
    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyThemeClass();
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
  }, [theme, accent]);

  return null;
}
