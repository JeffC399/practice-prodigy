"use client";

import {
  DEFAULT_USER_PREFS,
  useUserPrefs,
  type UserPrefs,
} from "@/lib/state/user-prefs";
import type { LocalRow, SyncAdapter } from "../types";

/**
 * SyncAdapter for `useUserPrefs` — Slice A.5 (Phase 84).
 *
 * Singleton store (one row per user, id = user_id). Persists all
 * cross-module preferences (theme, palette, notation default,
 * onboarding-dismissed flags, appearance mood, etc.) to the
 * `user_prefs` table.
 *
 * ## Local ↔ cloud shape
 *
 * The Zustand store mixes prefs (values) with setters (functions).
 * `extractLocal()` filters to just the value-typed keys, giving a
 * plain `UserPrefs` blob that maps 1:1 to the `data jsonb` column.
 * `applyRemote()` merges the cloud blob back into the store, leaving
 * setters intact.
 *
 * ## The "applying-remote" flag
 *
 * When we pull cloud state and call `useUserPrefs.setState()` inside
 * `applyRemote`, that mutation fires our `subscribeLocal` callback,
 * which the engine debounces into a push — uploading state we just
 * downloaded. Not a loop (updatedAt monotonic) but wasteful. The
 * `applyingRemote` flag suppresses that first callback firing.
 *
 * ## getLocalCount()
 *
 * Returns 1 iff the user has ever touched the store (the persist key
 * exists in localStorage). This drives the migration prompt: no key
 * = no local changes = no prompt entry.
 *
 * ## Timestamps
 *
 * `updatedAt = Date.now()` on every extract. That means local always
 * wins on cross-device conflict — good enough for Slice A. Real LWW
 * with per-field / per-row change tracking is deferred to Slice A.15
 * polish (per MY-PRACTICE-BUILD-PLAN.md §2.7).
 */

const PERSIST_KEY = "practice-prodigy:user-prefs:v1";

/** Set right before applyRemote does setState; consumed by the next subscribe fire. */
let applyingRemote = false;

/** Extract just the value-typed pref fields from the mixed store. */
function extractPrefsOnly(): UserPrefs {
  const state = useUserPrefs.getState();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    if (typeof v !== "function") out[k] = v;
  }
  return out as UserPrefs;
}

export const userPrefsSyncAdapter: SyncAdapter<UserPrefs> = {
  storeKey: "user-prefs",
  tableName: "user_prefs",
  isSingleton: true,
  displayLabel: "Preferences",

  extractLocal(): LocalRow<UserPrefs>[] {
    return [
      {
        // id ignored by engine for singletons (overwritten with user_id).
        id: "",
        data: extractPrefsOnly(),
        updatedAt: Date.now(),
      },
    ];
  },

  subscribeLocal(onChange) {
    const unsub = useUserPrefs.subscribe(() => {
      if (applyingRemote) {
        applyingRemote = false;
        return;
      }
      onChange();
    });
    return unsub;
  },

  applyRemote(rows) {
    // Singleton: one row expected. If none, cloud is empty — do nothing
    // (local defaults or existing state stay in place).
    const row = rows[0];
    if (!row) return;
    const remote = row.data;
    if (!remote || typeof remote !== "object") return;
    applyingRemote = true;
    // Merge with defaults so any pref keys added in future migrations
    // (added-in-a-later-app-version, not yet in this cloud blob) fall
    // back to defaults rather than becoming undefined.
    useUserPrefs.setState({ ...DEFAULT_USER_PREFS, ...remote });
  },

  getLocalCount() {
    if (typeof window === "undefined") return 0;
    try {
      return window.localStorage.getItem(PERSIST_KEY) === null ? 0 : 1;
    } catch {
      return 0;
    }
  },
};
