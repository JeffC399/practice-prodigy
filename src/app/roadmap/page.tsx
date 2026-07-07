import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { BackButton } from "@/components/shell/back-button";
import {
  BUCKET_DESCRIPTIONS,
  BUCKET_LABELS,
  MODULES,
  STATUS_LABELS,
  type ModuleEntry,
  type RoadmapBucket,
} from "@/lib/modules/registry";

export const metadata: Metadata = {
  title: "Roadmap — Practice Prodigy",
  description:
    "Practice Prodigy is a 9-module practice platform shipped one module at a time. See what's live now, what's coming next, and what's sketched for the long run.",
};

/**
 * Public-facing roadmap surface. Mirrors the 9-item platform vision
 * from PROJECT-DESIGN.md §9 in three columns (Now / Next / Later), so
 * users can see the long-term shape without having to read internal
 * docs. Doubles as a credibility artifact — users coming to the v1
 * module see that there's a real plan behind it.
 *
 * Data is sourced from src/lib/modules/registry.ts so this page stays
 * in lockstep with the header's module switcher.
 */

const BUCKET_ORDER: RoadmapBucket[] = ["now", "next", "later"];

export default function RoadmapPage() {
  const byBucket = bucketize(MODULES);

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-3xl flex-col gap-10">
        <div className="flex flex-col gap-3">
          {/* Phase 34.7 — Back button so Roadmap isn't a dead-end from
              the footer link. Shared component with the Settings page. */}
          <BackButton />
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Roadmap
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Nine modules, one platform.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Practice Prodigy is a pro-quality practice platform for
            musicians, shipping one module at a time. The current launch
            module is the Bass Arpeggios trainer; the other eight modules
            are designed or sketched and ship across coming versions.
            This page is the long-term map.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {BUCKET_ORDER.map((bucket) => (
            <RoadmapColumn
              key={bucket}
              bucket={bucket}
              modules={byBucket[bucket]}
            />
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-md border border-border bg-card/40 p-5">
          <p className="text-sm font-medium text-foreground">
            How the columns work
          </p>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {BUCKET_ORDER.map((bucket) => (
              <div key={bucket} className="flex flex-col gap-1">
                <dt className="font-mono text-[11px] uppercase tracking-wider text-primary">
                  {BUCKET_LABELS[bucket]}
                </dt>
                <dd className="text-xs leading-relaxed text-muted-foreground">
                  {BUCKET_DESCRIPTIONS[bucket]}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <Link
            href="/practice"
            className="group inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:scale-[1.01] active:scale-[0.99] transition-transform"
          >
            <span>Use the live module</span>
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <a
            href="https://github.com/JeffC399/practice-prodigy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            Source on GitHub →
          </a>
        </div>
      </div>
    </main>
  );
}

function bucketize(
  modules: ModuleEntry[],
): Record<RoadmapBucket, ModuleEntry[]> {
  const out: Record<RoadmapBucket, ModuleEntry[]> = {
    now: [],
    next: [],
    later: [],
  };
  for (const m of modules) out[m.bucket].push(m);
  return out;
}

function RoadmapColumn({
  bucket,
  modules,
}: {
  bucket: RoadmapBucket;
  modules: ModuleEntry[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="font-mono text-sm uppercase tracking-wider text-foreground">
          {BUCKET_LABELS[bucket]}
        </h2>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {modules.length}
        </span>
      </header>
      <div className="flex flex-col gap-3">
        {modules.map((m) => (
          <ModuleCard key={m.id} module={m} />
        ))}
        {modules.length === 0 && (
          <p className="rounded-md border border-dashed border-border bg-background/30 px-4 py-6 text-center text-xs text-muted-foreground">
            Nothing in this column yet.
          </p>
        )}
      </div>
    </section>
  );
}

function ModuleCard({ module: m }: { module: ModuleEntry }) {
  const Icon = m.icon;
  const isLive = m.status === "live";
  const statusClass =
    m.status === "live"
      ? "bg-primary/20 text-primary border-primary/30"
      : m.status === "in-build"
        ? "bg-primary/10 text-primary/80 border-primary/20"
        : "bg-background border-border text-muted-foreground";

  const card = (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-4 transition-colors ${
        isLive
          ? "border-primary/30 bg-primary/5 hover:border-primary/60"
          : "border-border bg-background/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon
            className={`h-4 w-4 ${
              isLive ? "text-primary" : "text-muted-foreground"
            }`}
            aria-hidden="true"
          />
          <span
            className={`font-medium ${
              isLive ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {m.name}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${statusClass}`}
        >
          {STATUS_LABELS[m.status]}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {m.description}
      </p>
    </div>
  );

  if (isLive && m.route) {
    return (
      <Link href={m.route} aria-label={`Launch ${m.name}`}>
        {card}
      </Link>
    );
  }
  return card;
}
