import Link from "next/link";
import { APP_VERSION, BUILD_SHA_SHORT } from "@/lib/build-info";
import { FeedbackTrigger } from "./feedback-trigger";

/**
 * Slim persistent footer — one row at the bottom of every screen.
 * Left: build label + tagline + commit SHA (so a tester reporting a
 * bug can say "I'm on build 5e10154" and we can trace it precisely).
 * Right: Feedback / Roadmap / GitHub links.
 *
 * Static markup; the FeedbackTrigger child opens a client-side modal.
 */
export function SiteFooter() {
  return (
    <footer className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/85 px-4 py-2 font-mono text-[11px] text-muted-foreground backdrop-blur-md sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-foreground/70">Practice Prodigy</span>
        <span aria-hidden="true">·</span>
        <span>v{APP_VERSION}</span>
        <span aria-hidden="true">·</span>
        <span
          title={`Build: ${BUILD_SHA_SHORT}`}
          className="text-muted-foreground/70"
        >
          {BUILD_SHA_SHORT}
        </span>
        <span className="hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span className="hidden sm:inline">
          A platform for musicians.
        </span>
      </div>
      <div className="flex items-center gap-4">
        <FeedbackTrigger />
        <Link
          href="/settings"
          className="hover:text-foreground transition-colors"
        >
          settings
        </Link>
        <Link
          href="/roadmap"
          className="hover:text-foreground transition-colors"
        >
          roadmap
        </Link>
        <a
          href="https://github.com/JeffC399/practice-prodigy"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          github
        </a>
      </div>
    </footer>
  );
}
