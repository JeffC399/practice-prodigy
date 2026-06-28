import { Music, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="flex w-full max-w-xl flex-col gap-10">
        {/* Brand mark */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <Music className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <span className="font-mono text-sm tracking-wider text-muted-foreground uppercase">
            Practice Prodigy
          </span>
        </div>

        {/* Headline */}
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
              v1 build in progress — single-chord drills are live.
            </span>{" "}
            <span className="text-muted-foreground">
              Configurable chord (all 20 qualities), tempo (30–300 BPM), time
              signature (all 10), count-in, and session length. Sequences,
              arpeggio patterns, and additional notation styles next.
            </span>
          </p>
        </div>

        {/* Practice CTA */}
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

        {/* Footer links */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground">
          <a
            href="https://github.com/JeffC399/practice-prodigy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            github
          </a>
          <span>Next.js 16 · React 19 · Tailwind 4 · shadcn/ui</span>
          <span>Tone.js · tonal · Dexie · Zustand · Framer Motion</span>
        </div>
      </div>
    </main>
  );
}
