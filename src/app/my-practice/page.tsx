"use client";

import {
  CalendarCheck,
  Construction,
  ListChecks,
  Play,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  coerceMyPracticeTab,
  MyPracticeTabsShell,
  type MyPracticeTabId,
} from "@/components/my-practice/tabs-shell";
import { CollectionsTab } from "@/components/my-practice/collections-tab";
import { MethodologyTab } from "@/components/my-practice/methodology/methodology-tab";
import { ReportsTab } from "@/components/my-practice/reports/reports-tab";
import { RoutineBuilder } from "@/components/my-practice/routine-builder";
import { RoutineCard } from "@/components/my-practice/routine-card";
import { SongsTab } from "@/components/my-practice/songs-tab";
import {
  templateToRoutineItems,
  type MethodologyTemplate,
} from "@/lib/practice/methodology-library";
import { isMyPracticeEnabled } from "@/lib/feature-flags";
import { useRoutineExecutor } from "@/lib/practice/routine-executor";
import {
  getRoutineById,
  useRoutinesLibrary,
} from "@/lib/practice/routines-library";

/**
 * My Practice — flagship module landing page.
 *
 * Slice B.2 (Phase 102) — replaced the Phase 72 "Coming soon" stub
 * with the real 5-tab shell (Routines / Songs / Reports / Methodology
 * / Profile). Only Routines has content-in-progress; the other four
 * tabs render friendly placeholders naming the slice that will fill
 * them in.
 *
 * The active tab is persisted in the URL as `?tab=routines` so
 * refresh and deep-links preserve state. Unknown values fall back to
 * Routines.
 */
export default function MyPracticePage() {
  // Feature-flag gate. Guarded on the client because the flag reads
  // NEXT_PUBLIC_ envvars and this page is a client component; a
  // server-side 404 would defeat the flag's build-time inlining.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (mounted && !isMyPracticeEnabled()) {
    notFound();
  }

  // Next.js 16 requires useSearchParams() to sit under a Suspense
  // boundary on statically-prerendered pages. Fallback is a bare
  // main container so the layout doesn't jump when the client
  // hydrates and the real content mounts.
  return (
    <Suspense
      fallback={
        <main
          id="main-content"
          className="flex flex-1 flex-col items-center px-4 py-6 sm:px-6 sm:py-8"
        >
          <div className="w-full max-w-6xl h-64" aria-hidden="true" />
        </main>
      }
    >
      <MyPracticeContent />
    </Suspense>
  );
}

function MyPracticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = coerceMyPracticeTab(searchParams.get("tab"));
  const openRoutineId = searchParams.get("routine");

  // Look up the routine when a builder is open. Non-existent id →
  // silently clear the param (defensive against a stale deep link).
  const openRoutine = useRoutinesLibrary((s) =>
    openRoutineId ? s.routines.find((r) => r.id === openRoutineId) : undefined,
  );

  const handleTabChange = useCallback(
    (t: MyPracticeTabId) => {
      // Push a new URL with the tab query param so refresh + back
      // button work correctly. Scroll preserved so the sidebar
      // doesn't jump on tab change.
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", t);
      // Clear any open builder when the user switches tabs.
      params.delete("routine");
      router.push(`/my-practice?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleOpenRoutine = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "routines");
      params.set("routine", id);
      router.push(`/my-practice?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleCloseRoutine = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("routine");
    router.push(`/my-practice?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const handleTryTemplate = useCallback(
    (template: MethodologyTemplate) => {
      // Slice E.6 (Phase 137) — Load a methodology template as a
      // fresh routine, then jump to the builder so the user can
      // edit before running (or hit Launch directly).
      const items = templateToRoutineItems(template);
      const id = useRoutinesLibrary.getState().saveRoutine({
        name: template.name,
        notes: template.description,
        items,
        methodologyId: template.methodologyId,
        source: "template",
        sourceRef: template.id,
      });
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "routines");
      params.set("routine", id);
      router.push(`/my-practice?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Clear a stale ?routine= that points at a deleted routine.
  useEffect(() => {
    if (openRoutineId && !openRoutine) {
      handleCloseRoutine();
    }
  }, [openRoutineId, openRoutine, handleCloseRoutine]);

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
              My Practice
            </div>
            <Link
              href="/my-practice/coach"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
              title="Open the AI Coach chat"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              AI Coach
            </Link>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Build, run, and understand your practice
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Everything that turns practice sessions into progress —
            routines you can run, songs you&rsquo;re working on, reports
            that show where the time went, and the methods behind it all.
          </p>
        </header>

        <MyPracticeTabsShell
          activeTab={activeTab}
          onTabChange={handleTabChange}
        >
          {activeTab === "routines" &&
            (openRoutine ? (
              <RoutineBuilder
                routine={openRoutine}
                onClose={handleCloseRoutine}
              />
            ) : (
              <RoutinesTab onOpenRoutine={handleOpenRoutine} />
            ))}
          {activeTab === "songs" && <SongsTab />}
          {activeTab === "collections" && <CollectionsTab />}
          {activeTab === "reports" && <ReportsTab />}
          {activeTab === "methodology" && (
            <MethodologyTab onTryTemplate={handleTryTemplate} />
          )}
          {activeTab === "profile" && (
            <ComingSoonTab
              title="Profile"
              slice="Slice E / F"
              blurb="Self-rated proficiency per category (Level 1–5 + N/A), target levels, custom categories, and AI Coach settings (bring-your-own-key)."
            />
          )}
        </MyPracticeTabsShell>
      </div>
    </main>
  );
}

/**
 * Routines tab body — Slice B.3 (Phase 103).
 *
 * Two states:
 *   1. Empty (no routines saved): friendly hero + big Build button.
 *   2. Populated: grid of RoutineCards, sorted by lastRunAt desc
 *      (recently-run first) then updatedAt desc.
 *
 * The Build button in Phase 103 creates a fresh empty routine and
 * lets the user rename it inline on the resulting card. B.4 will
 * add a real builder (item picker, composer, save/discard flow);
 * the inline-edit path stays as the fast "just rename it" affordance.
 */
function RoutinesTab({
  onOpenRoutine,
}: {
  onOpenRoutine: (id: string) => void;
}) {
  const routines = useRoutinesLibrary((s) => s.routines);
  const saveRoutine = useRoutinesLibrary((s) => s.saveRoutine);
  const router = useRouter();
  const execution = useRoutineExecutor((s) => s.execution);
  const exitExecution = useRoutineExecutor((s) => s.exit);

  // Phase 111 — Resume-mid-routine banner. Rendered when a persisted
  // execution exists AND it's still in progress (not yet complete).
  // Resolves the routine name for display; if the routine got
  // deleted while a run was persisted, silently clears the stale
  // execution instead of showing a broken banner.
  const resumableRoutine =
    execution && execution.status !== "complete"
      ? getRoutineById(execution.routineId) ?? null
      : null;
  useEffect(() => {
    if (execution && execution.status !== "complete" && !resumableRoutine) {
      exitExecution();
    }
  }, [execution, resumableRoutine, exitExecution]);

  const sorted = [...routines].sort((a, b) => {
    // Recently-run > recently-modified > alphabetical.
    const lastRunDelta = (b.lastRunAt ?? 0) - (a.lastRunAt ?? 0);
    if (lastRunDelta !== 0) return lastRunDelta;
    const updatedDelta = b.updatedAt - a.updatedAt;
    if (updatedDelta !== 0) return updatedDelta;
    return a.name.localeCompare(b.name);
  });

  const handleBuild = () => {
    const id = saveRoutine({ name: "New routine" });
    // Phase 104 — Auto-open the builder on the freshly-created
    // routine so the user drops straight into edit mode. Matches
    // "click Build → build" natural flow.
    onOpenRoutine(id);
  };

  return (
    <section className="flex flex-col gap-4">
      {/* Phase 111 — Resume-mid-routine banner. */}
      {resumableRoutine && execution && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-primary/40 bg-primary/10 px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
              Routine in progress
            </span>
            <span className="text-sm text-foreground">
              <span className="font-medium">{resumableRoutine.name}</span>
              <span className="text-muted-foreground">
                {" — item "}
                {execution.currentIndex + 1} of{" "}
                {resumableRoutine.items.length}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exitExecution()}
              title="Discard the in-progress run"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Discard
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/my-practice/execute/${resumableRoutine.id}`,
                )
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Resume
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-foreground">
            Your routines
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {routines.length === 0
              ? "No routines yet. Build your first one to get started."
              : `${routines.length} saved routine${routines.length === 1 ? "" : "s"}. Recently run appear first.`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleBuild}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Build routine
        </button>
      </div>

      {routines.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/60 bg-background/30 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ListChecks className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex max-w-md flex-col gap-2">
            <h3 className="text-base font-medium text-foreground">
              Your routines will live here
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A routine is an ordered list of practice items — a warmup
              drill, then a scale study, then a song section, then a
              cool-down. Build one, launch it, and Practice Prodigy
              walks you through item by item while the session tracker
              records what happened.
            </p>
            <p className="text-xs text-muted-foreground/70 italic">
              Add items to the routine in the next slice (B.4–B.7);
              press play in Slice B.9.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onOpen={onOpenRoutine}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Placeholder shown on the four "not yet built" tabs. Names the
 * slice that will fill it in so it feels planful, not accidental.
 */
function ComingSoonTab({
  title,
  slice,
  blurb,
}: {
  title: string;
  slice: string;
  blurb: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="font-mono text-[10px] uppercase tracking-wider text-primary">
          Coming in {slice}
        </p>
      </div>
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/60 bg-background/30 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/20 text-muted-foreground">
          <Construction className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="max-w-lg text-sm text-muted-foreground leading-relaxed">
          {blurb}
        </p>
      </div>
    </section>
  );
}
