"use client";

import { createContext, useContext } from "react";

/**
 * Density mode for library card layouts.
 *
 * - `comfortable` — the default. Full card with summary, notes, and
 *   the category / collection footer chips.
 * - `compact` — single-line row with just the title and the summary
 *   line. Meant for scanning through dozens of drills at once.
 *
 * Owned by `CollectionsSectionedList` (per-library, persisted). Each
 * card type reads this context and switches its own layout; cards
 * that haven't opted into compact rendering yet simply ignore it and
 * render their comfortable layout unchanged.
 */
export type LibraryDensity = "comfortable" | "compact";

const LibraryDensityContext = createContext<LibraryDensity>("comfortable");

export function LibraryDensityProvider({
  density,
  children,
}: {
  density: LibraryDensity;
  children: React.ReactNode;
}) {
  return (
    <LibraryDensityContext.Provider value={density}>
      {children}
    </LibraryDensityContext.Provider>
  );
}

export function useLibraryDensity(): LibraryDensity {
  return useContext(LibraryDensityContext);
}
