"use client";

import type { PracticeSession } from "@/lib/practice/types";
import { useSessionTracker } from "@/lib/tracking/session-tracker";
import type { LocalRow, SyncAdapter } from "../types";

/**
 * SyncAdapter for practice_sessions — Slice A.12 (Phase 93).
 *
 * Wraps useSessionTracker.history so every completed PracticeSession
 * ends up in the Supabase `practice_sessions` table. This is what
 * makes cross-device Reports (Slice D) possible — a user can practice
 * on their laptop this morning, sign in on their tablet tonight, and
 * see today's session in their history.
 *
 * ## Which sessions sync
 *
 * ONLY the `history` array — sessions that have been closed (either
 * by the 5-min inactivity timer or explicit endSession). The live
 * `current` session stays local until it ends. Rationale:
 *   - Cloud writes are debounced 500ms — a mid-session tab crash
 *     would sometimes leave an "in progress" row that a second
 *     device might pick up and get confused about.
 *   - The tracker's onRehydrateStorage retroactively closes stale
 *     sessions at last-activity time on reopen, so any never-ended
 *     session becomes ended on the next mount and syncs then.
 *
 * ## Merge semantics on applyRemote
 *
 * Session ids are stable across devices (client-generated
 * `session_${base36}_${suffix}`). On pull, dedupe local + remote by
 * id, prefer remote's endedAt when both have one (assumed identical),
 * cap local retention at MAX_LOCAL_HISTORY entries newest-first.
 * The full history stays queryable server-side via Reports.
 *
 * ## What A.12 does NOT do
 *
 * - Per-session delete UI (Slice A.12 pt 2 / Phase 94).
 * - Bulk history export (Slice D+ scope).
 * - Live session sync (deferred — see above).
 */

/**
 * Local cap on hydrated history. Cloud is the source of truth; local
 * just needs enough for offline-viewable recent history + snappy
 * Reports rendering. Bumped from the tracker's 100 because with cloud
 * sync users may want to scroll further back offline. Adjust as
 * telemetry accumulates.
 */
const MAX_LOCAL_HISTORY = 500;

/** Set right before applyRemote does setState; consumed by next subscribe fire. */
let applyingRemote = false;

/**
 * Return true if a session is currently the tracker's `current` — we
 * never sync live sessions, only history.
 */
function isLive(sessionId: string): boolean {
  const cur = useSessionTracker.getState().current;
  return cur?.id === sessionId;
}

export const practiceSessionsSyncAdapter: SyncAdapter<PracticeSession> = {
  storeKey: "practice-sessions",
  tableName: "practice_sessions",
  displayLabel: "Practice history",

  extractLocal(): LocalRow<PracticeSession>[] {
    const { history } = useSessionTracker.getState();
    return history
      .filter((s) => s.endedAt !== null && !isLive(s.id))
      .map((s) => ({
        id: s.id,
        data: s,
        // Prefer endedAt for the LWW timestamp — a session's meaningful
        // "last write" is when it closed, not any post-hoc mutation.
        updatedAt: s.endedAt ?? s.startedAt,
      }));
  },

  subscribeLocal(onChange) {
    // Fire on any tracker state change; the engine debounces to 500ms
    // and the extractLocal filter drops non-ended sessions, so
    // per-tick reportActivity writes don't spam the network.
    return useSessionTracker.subscribe((state, prev) => {
      if (state.history === prev.history && state.current === prev.current) {
        return;
      }
      if (applyingRemote) {
        applyingRemote = false;
        return;
      }
      onChange();
    });
  },

  applyRemote(rows) {
    // Merge cloud rows into local history by id. Cloud wins on
    // conflict (LWW via engine's updated_at comparison). Preserve
    // any live current session — we never overwrite that from cloud.
    const remoteById = new Map<string, PracticeSession>();
    for (const r of rows) remoteById.set(r.id, r.data);

    const state = useSessionTracker.getState();
    const localById = new Map<string, PracticeSession>();
    for (const s of state.history) localById.set(s.id, s);

    // Union: remote overrides local for shared ids.
    const merged: PracticeSession[] = [];
    const seen = new Set<string>();
    for (const [id, s] of remoteById) {
      merged.push(s);
      seen.add(id);
    }
    for (const [id, s] of localById) {
      if (!seen.has(id)) merged.push(s);
    }

    // Newest first, capped.
    merged.sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
    const capped = merged.slice(0, MAX_LOCAL_HISTORY);

    applyingRemote = true;
    useSessionTracker.setState({ history: capped });
  },

  getLocalCount() {
    const { history } = useSessionTracker.getState();
    return history.filter((s) => s.endedAt !== null).length;
  },
};
