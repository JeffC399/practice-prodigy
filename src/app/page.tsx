import { Music } from "lucide-react";

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
            <span className="inline-block h-2 w-2 rounded-full bg-primary" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Status
            </span>
          </div>
          <p className="text-sm leading-relaxed">
            <span className="font-medium text-foreground">
              v0.1 — Bass Arpeggios module, scaffold ready.
            </span>{" "}
            <span className="text-muted-foreground">
              Design locked. Build begins next session.
            </span>
          </p>
        </div>

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
