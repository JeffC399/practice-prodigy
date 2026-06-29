import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PracticeConfig } from "./practice-config";
import type { SequenceBeat } from "@/lib/music/sequence";

/**
 * Resume-session store — captures in-flight drill state so a user who
 * loses their tab (browser crash, accidental close, OS sleep) can pick
 * up where they left off instead of restarting the whole drill from
 * the count-in.
 *
 * Lifecycle:
 *   - SAVED on each play-measure boundary while the drill is running.
 *   - CLEARED when the user presses Stop, when the drill ends naturally,
 *     or when the saved blob is older than RESUME_MAX_AGE_MS.
 *   - PRESERVED when the tab closes (no event fires; the last saved
 *     snapshot persists in localStorage and shows up as a Resume banner
 *     on the next visit to /practice).
 *
 * The full SequenceBeat[] is persisted alongside the config so random
 * strategies don't re-roll on resume — the user lands on the exact same
 * chord at the exact same beat. Sequences longer than
 * SEQUENCE_PERSIST_CAP (only happens for very-long indefinite-loop
 * drills) are truncated; resume of those just runs out earlier, which
 * is acceptable given the user can always Start fresh.
 */

/** Resume blobs older than this are stale — banner suppresses them. */
export const RESUME_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Hard cap on persisted sequence length. ~2048 beats covers any
 * reasonable fixed-length drill many times over, and bounds the
 * localStorage write cost for indefinite-loop sessions.
 */
const SEQUENCE_PERSIST_CAP = 2048;

export type ResumeSession = {
  /** Full PracticeConfig snapshot — loaded into the live store on resume. */
  config: PracticeConfig;
  /** Display name for the banner. Null when not launched from a drill card. */
  drillName: string | null;
  /** Re-applied on resume so the editing-state UI matches. */
  loadedDrillId: string | null;
  /** 0-indexed beat in the sequence where the user was interrupted. */
  beatIndex: number;
  /** 1-indexed play measure for human-readable banner copy. */
  measureNumber: number;
  /** Total play measures (null when looping indefinitely). */
  totalMeasures: number | null;
  /** Pre-rolled sequence so random strategies don't re-shuffle. */
  sequence: SequenceBeat[];
  /** Wall-clock ms — drives the staleness expiry. */
  savedAt: number;
};

type ResumeStore = {
  active: ResumeSession | null;
  save: (snapshot: Omit<ResumeSession, "savedAt">) => void;
  clear: () => void;
};

export const useResumeSession = create<ResumeStore>()(
  persist(
    (set) => ({
      active: null,
      save: (snapshot) =>
        set({
          active: {
            ...snapshot,
            sequence: snapshot.sequence.slice(0, SEQUENCE_PERSIST_CAP),
            savedAt: Date.now(),
          },
        }),
      clear: () => set({ active: null }),
    }),
    {
      name: "practice-prodigy:resume-session:v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** True when the snapshot is recent enough to offer for resume. */
export function isResumable(
  session: ResumeSession | null,
): session is ResumeSession {
  return session !== null && Date.now() - session.savedAt < RESUME_MAX_AGE_MS;
}
