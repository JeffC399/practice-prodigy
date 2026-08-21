"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FullScreenPlayer } from "@/components/my-practice/full-screen-player";
import { isMyPracticeEnabled } from "@/lib/feature-flags";
import { getRoutineById } from "@/lib/practice/routines-library";
import { useRoutineExecutor } from "@/lib/practice/routine-executor";

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
