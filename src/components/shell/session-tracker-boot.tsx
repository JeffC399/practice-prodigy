"use client";

import { useEffect } from "react";
import {
  INACTIVITY_CHECK_INTERVAL_MS,
  useSessionTracker,
} from "@/lib/tracking/session-tracker";

/**
 * SessionTrackerBoot — Slice A.6 (Phase 86).
 *
 * Client-only component that starts the background inactivity ticker
 * for the session tracker. Mounted once globally in the root layout.
 *
 * The ticker calls `checkInactivity()` every INACTIVITY_CHECK_INTERVAL_MS
 * (30s). If the current session hasn't seen activity in 5 min, the
 * tracker auto-ends it. Independent of user navigation — even sitting
 * idle on `/settings` closes an inactive drilling session.
 *
 * StrictMode-safe: the setInterval cleanup fires on unmount, and
 * re-mounting installs a fresh interval. No leaked timers.
 *
 * Renders nothing.
 */
export function SessionTrackerBoot(): null {
  useEffect(() => {
    const id = setInterval(() => {
      useSessionTracker.getState().checkInactivity();
    }, INACTIVITY_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}
