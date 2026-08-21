"use client";

import { CalendarCheck, Construction, ListChecks, Plus } from "lucide-react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  coerceMyPracticeTab,
  MyPracticeTabsShell,
  type MyPracticeTabId,
} from "@/components/my-practice/tabs-shell";
import { isMyPracticeEnabled } from "@/lib/feature-flags";
import { useRoutinesLibrary } from "@/lib/practice/routines-library";

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

  const handleTabChange = useCallback(
    (t: MyPracticeTabId) => {
      // Push a new URL with the tab query param so refresh + back
      // button work correctly. Scroll preserved so the sidebar
      // doesn't jump on tab change.
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", t);
      router.push(`/my-practice?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
            My Practice
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
          {activeTab === "routines" && <RoutinesTab />}
          {activeTab === "songs" && (
            <ComingSoonTab
              title="Songs"
              slice="Slice C"
              blurb="Track the pieces you're learning or maintaining. Attach lead sheets, note the sections you're focused on, see per-song practice time roll up in Reports."
            />
          )}
          {activeTab === "reports" && (
            <ComingSoonTab
              title="Reports"
              slice="Slice D"
              blurb="Where did your practice time actually go? Category breakdowns, streaks, and per-song / per-routine time — all rolled up from the sessions that already accumulate silently in the background."
            />
          )}
          {activeTab === "methodology" && (
            <ComingSoonTab
              title="Methodology"
              slice="Slice E"
              blurb="A library of practice methods — Deliberate Practice, Slow Practice, Chunking, Interleaving, Pomodoro, Spaced Repetition, and more — each with a starter routine template you can adapt."
            />
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
 * Routines tab body. Phase 102 ships the empty state only — Phase
 * 103 (B.3) adds routine cards + real Build flow. Even the "Build
 * routine" button is a placeholder disabled state until B.4 wires
 * the routine builder.
 */
function RoutinesTab() {
  const routineCount = useRoutinesLibrary((s) => s.routines.length);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-foreground">
            Your routines
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {routineCount === 0
              ? "No routines yet. Build your first one below."
              : `${routineCount} saved routine${routineCount === 1 ? "" : "s"}.`}
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Routine builder ships in the next slice (B.4)."
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary opacity-50 cursor-not-allowed"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Build routine
        </button>
      </div>

      {/* Empty-state hero. Slice B.3 replaces with routine cards +
          a proper empty-state variant that only renders when the
          library is truly empty. */}
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
            cool-down. Build one, launch it, and Practice Prodigy walks
            you through item by item while the session tracker records
            what happened.
          </p>
          <p className="text-xs text-muted-foreground/70 italic">
            The routine builder + player land in the next few phases.
          </p>
        </div>
      </div>
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
