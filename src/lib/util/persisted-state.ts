"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * usePersistedState — small localStorage-backed useState.
 *
 * Behaves exactly like `useState<T>(initial)` except the value is
 * read from localStorage on mount (falls back to `initial` when
 * absent) and written back on every change. Intended for pure UI
 * state (accordion open/closed, sidebar expanded, split-pane sizes)
 * that shouldn't clutter the user-prefs store but should still
 * survive navigation + reload.
 *
 * Keys are stored under `practice-prodigy:ui:<key>` so they can't
 * collide with any of the persisted Zustand stores.
 *
 * Not synced to cloud — UI state is per-device by design.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const storageKey = `practice-prodigy:ui:${key}`;

  // Start with `initial` on both server + first client render to
  // avoid hydration mismatch, then swap to the stored value in an
  // effect. Consumers get one "flicker" from initial → stored on
  // first mount if the two differ — acceptable for accordion state.
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // Ignore JSON parse errors / SSR / disabled storage.
    }
    // Only rehydrate once on mount — subsequent set calls own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPersisted = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (p: T) => T)(prev)
            : next;
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(resolved));
        } catch {
          // Ignore storage-quota-exceeded / disabled storage.
        }
        return resolved;
      });
    },
    [storageKey],
  );

  return [value, setPersisted];
}
