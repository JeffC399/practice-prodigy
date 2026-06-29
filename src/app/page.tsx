import { ArrowRight, Map } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="flex w-full max-w-xl flex-col gap-10">
        {/* Headline. Brand mark sits in the persistent shell header
            above — no need to repeat it here. */}
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            A pro-quality practice platform for musicians.
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Drill arpeggios over any chord sequence with precision metronome,
            controllable look-ahead, and configurable count-in. Starting with
            bass; built to scale.
          </p>
        </div>

        {/* Status badge */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-5">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Status
            </span>
          </div>
          <p className="text-sm leading-relaxed">
            <span className="font-medium text-foreground">
              v1 build in progress — multi-chord sequence drilling is live.
            </span>{" "}
            <span className="text-muted-foreground">
              Build a chord pool, pick a pattern, and drill. Cycles chords
              measure by measure with a NEXT preview, all four notation
              styles, four arpeggio patterns, and audible Preview before
              you start.
            </span>
          </p>
        </div>

        {/* Primary CTA + secondary roadmap link. Identical box
            geometry (same padding, text size, icon size) so they
            read as paired actions; the only visual difference is
            the background fill — primary amber for the main action,
            border-only for the secondary. */}
        <div className="flex flex-col gap-3">
          <Link
            href="/practice"
            className="group flex items-center justify-between gap-3 rounded-lg bg-primary px-6 py-4 text-base font-medium text-primary-foreground shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <span>Set up a drill</span>
            <ArrowRight
              className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <Link
            href="/roadmap"
            className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-6 py-4 text-base font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Map className="h-5 w-5" aria-hidden="true" />
              See the 9-module roadmap
            </span>
            <ArrowRight
              className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </main>
  );
}
