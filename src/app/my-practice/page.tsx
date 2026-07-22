import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { isMyPracticeEnabled } from "@/lib/feature-flags";

/**
 * My Practice — flagship module landing page.
 *
 * Phase 72 stub: renders a "Coming soon" card behind the
 * `NEXT_PUBLIC_MY_PRACTICE_ENABLED` feature flag. When the flag is
 * off (production default until Slice A ships), the route 404s so
 * users don't hit a half-built surface.
 *
 * Slice B (My Practice Build Plan) replaces this with the real
 * 5-tab shell (Routines / Songs / Methodology / Reports / Profile).
 */
export default function MyPracticePage() {
  if (!isMyPracticeEnabled()) {
    notFound();
  }

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center px-6 py-16"
    >
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
            My Practice
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Coming soon
          </h1>
          <p className="text-sm text-muted-foreground leading-6">
            The flagship module is under construction. When it lands
            you&rsquo;ll build practice routines, get AI-coach
            recommendations, track every minute of practice by
            category, and use methodology-based templates from a
            curated library.
          </p>
        </div>

        <section className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 px-5 py-4">
          <h2 className="text-sm font-semibold text-primary">
            What&rsquo;s being built
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li>Manual routine builder + full-screen practice mode</li>
            <li>AI Coach (BYOK: your own Claude or OpenAI key)</li>
            <li>Methodology library (8 well-regarded methods)</li>
            <li>Songs library for repertoire tracking</li>
            <li>Time tracking + category reports + streak</li>
            <li>Cloud sync across devices</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Design + build plan locked. See{" "}
            <Link
              href="/roadmap"
              className="text-primary hover:underline"
            >
              the roadmap
            </Link>{" "}
            for milestone status.
          </p>
        </section>
      </div>
    </main>
  );
}
