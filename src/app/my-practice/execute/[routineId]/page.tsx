"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FullScreenPlayer } from "@/components/my-practice/full-screen-player";
import { RoutineOverview } from "@/components/my-practice/routine-overview";
import { isMyPracticeEnabled } from "@/lib/feature-flags";
import { useKeySequencerConfig } from "@/lib/key-sequencer/config-store";
import { useKeyDrillsLibrary } from "@/lib/key-sequencer/library-store";
import { useRoutineExecutor } from "@/lib/practice/routine-executor";
import { getRoutineById } from "@/lib/practice/routines-library";
import type { RoutineItem } from "@/lib/practice/routine-types";
import { useScaleDrillConfig } from "@/lib/scale-driller/config-store";
import { useScaleDrillsLibrary } from "@/lib/scale-driller/library-store";
import { usePracticeConfig } from "@/lib/state/practice-config";
import { useDrillsLibrary } from "@/lib/state/drills-library";
import { SHIPPED_DRILLS } from "@/lib/data/shipped-drills";

/**
 * Routine executor entry point — Slice B.9 (Phase 109), Slice B.14 (Phase 115).
 *
 * URL: `/my-practice/execute/[routineId]`.
 *
 * ## Flow
 *
 *   1. Feature-flag gate (same as /my-practice).
 *   2. 404 if the routineId doesn't resolve to a saved routine.
 *   3. If there IS an active execution for this routineId that isn't
 *      complete → skip the overview, jump straight into the player
 *      (resume case).
 *   4. Otherwise → show RoutineOverview. The user hits "Start routine"
 *      to actually begin, or "Not now" to bounce back to the routines
 *      tab.
 *   5. Once started, FullScreenPlayer drives the UI. Take-over items
 *      (drill / key-drill / scale-drill / metronome / leadsheet) push
 *      the module route; inline items (rest / custom) render in place.
 *   6. Exit navigates back to the builder for the same routine.
 *
 * The overview is a lightweight pre-run gate — not a decision hurdle.
 * It exists so accidental clicks on Launch don't blow away a resumable
 * run, and so users see what they signed up for before the timer starts.
 */
export default function ExecuteRoutinePage() {
  const params = useParams<{ routineId: string }>();
  const router = useRouter();
  const routineId = params.routineId;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Feature-flag gate.
  if (mounted && !isMyPracticeEnabled()) {
    notFound();
  }

  const routine = getRoutineById(routineId);
  const startExecution = useRoutineExecutor((s) => s.start);
  const exitExecution = useRoutineExecutor((s) => s.exit);
  const execution = useRoutineExecutor((s) => s.execution);

  // Are we resuming an in-progress run for this same routine? If so,
  // skip the overview. Note: a "complete" execution should NOT skip —
  // the user is starting a fresh run of a routine they finished before.
  const isResuming =
    !!execution &&
    execution.routineId === routineId &&
    execution.status !== "complete";

  // Auto-navigate to the drilling module's page when the current item
  // is a take-over type. Same as before, only fires once execution is
  // running (i.e. post-overview or on resume).
  useEffect(() => {
    if (!mounted || !execution || !routine) return;
    if (execution.status !== "running") return;
    const item = routine.items[execution.currentIndex];
    if (!item) return;
    const target = takeoverRouteFor(item);
    if (!target) return; // rest / custom → rendered inline by the player
    router.push(target);
  }, [mounted, execution, routine, router]);

  const handleStart = () => {
    if (!routine) return;
    startExecution(routineId);
  };

  const handleExit = () => {
    exitExecution();
    router.push(`/my-practice?tab=routines&routine=${routineId}`);
  };

  const handleCancelOverview = () => {
    router.push(`/my-practice?tab=routines`);
  };

  if (!mounted) return null;
  if (!routine) {
    notFound();
  }

  // Pre-run gate — only when there's no live execution for this routine.
  if (!isResuming) {
    return (
      <RoutineOverview
        routine={routine}
        onStart={handleStart}
        onCancel={handleCancelOverview}
      />
    );
  }

  return <FullScreenPlayer routine={routine} onExit={handleExit} />;
}

/**
 * Map an item to the module route that should take over rendering
 * for it, or null when the item is rendered inline by FullScreenPlayer
 * (rest / custom). Returns just the URL (with ?routineMode=1) — the
 * caller is responsible for pushing it.
 *
 * For drill types, this also pre-loads the drill config into the
 * module's Zustand store so the session page finds a ready config
 * on mount. This mutates the user's live config for the module,
 * which is a known tradeoff (documented on the plan risk register).
 */
function takeoverRouteFor(item: RoutineItem): string | null {
  switch (item.type) {
    case "drill": {
      // Load the drill's config into the live Bass Arpeggios config.
      // loadedDrillId is UI-tracking state on the store, not part of
      // PracticeConfig itself, so set it separately.
      const drill =
        useDrillsLibrary
          .getState()
          .drills.find((d) => d.id === item.drillId) ??
        SHIPPED_DRILLS.find((d) => d.id === item.drillId);
      if (drill) {
        const store = usePracticeConfig.getState();
        store.loadConfig(drill.config);
        store.setLoadedDrillId(drill.id);
      }
      return "/practice/session?routineMode=1";
    }
    case "key-drill": {
      const drill = useKeyDrillsLibrary
        .getState()
        .drills.find((d) => d.id === item.keyDrillId);
      if (drill) {
        useKeySequencerConfig.getState().loadConfig({
          ...drill.config,
          loadedKeyDrillId: drill.id,
        });
      }
      return "/practice/keys/session?routineMode=1";
    }
    case "scale-drill": {
      const drill = useScaleDrillsLibrary
        .getState()
        .drills.find((d) => d.id === item.scaleDrillId);
      if (drill) {
        useScaleDrillConfig.getState().loadConfig({
          ...drill.config,
          loadedScaleDrillId: drill.id,
        });
      }
      return "/practice/scales/session?routineMode=1";
    }
    case "metronome":
      // Metronome page reads bpm/ts from executor state directly.
      return "/metronome?routineMode=1";
    case "leadsheet":
      return `/sheets/${item.leadSheetId}?routineMode=1`;
    // Rendered inline by FullScreenPlayer:
    case "rest":
    case "custom":
    case "song":
    case "ear-training":
      return null;
  }
}
