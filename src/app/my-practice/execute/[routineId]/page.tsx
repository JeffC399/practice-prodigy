"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FullScreenPlayer } from "@/components/my-practice/full-screen-player";
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
 * Routine executor entry point — Slice B.9 (Phase 109).
 *
 * URL: `/my-practice/execute/[routineId]`.
 *
 * Behavior:
 *   - Feature-flag gate (same as /my-practice).
 *   - If the routineId doesn't resolve to a saved routine → 404.
 *   - On mount, starts a fresh execution via useRoutineExecutor.start().
 *     If there's already an active execution for a different routine,
 *     it's replaced. The B.11 "Resume routine?" prompt will guard
 *     this at the my-practice-tab level so users don't accidentally
 *     blow away an in-progress run.
 *   - Renders <FullScreenPlayer/> which drives the actual UI.
 *   - Exit navigates back to the routine builder for the same routine
 *     (natural place to iterate on the routine after a run).
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

  // Start the run on mount (only when the routine exists + we're not
  // already running THIS routine).
  useEffect(() => {
    if (!mounted || !routine) return;
    if (
      execution &&
      execution.routineId === routineId &&
      execution.status !== "complete"
    ) {
      return;
    }
    startExecution(routineId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, routineId, routine]);

  // Phase 110 — Auto-navigate to the drilling module's page when the
  // current item is a take-over type. The module's page renders the
  // drill + a RoutineTakeoverChip. Advancing from the module route
  // comes back here for the next item.
  useEffect(() => {
    if (!mounted || !execution || !routine) return;
    if (execution.status !== "running") return;
    const item = routine.items[execution.currentIndex];
    if (!item) return;
    const target = takeoverRouteFor(item);
    if (!target) return; // rest / custom → rendered inline by the player
    router.push(target);
  }, [mounted, execution, routine, router]);

  const handleExit = () => {
    exitExecution();
    // Return to the routine builder so the user can tweak based on
    // how the run went. Preserves the tab query param via the router
    // history if they navigated in from there.
    router.push(`/my-practice?tab=routines&routine=${routineId}`);
  };

  if (!mounted) return null;
  if (!routine) {
    notFound();
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
