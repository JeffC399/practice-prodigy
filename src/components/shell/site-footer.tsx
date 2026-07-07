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
    <footer
      data-site-footer
      className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/85 px-4 py-2 font-mono text-[11px] text-muted-foreground backdrop-blur-md sm:px-6"
    >
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
      {/* Phase 34.7.1 — Give every right-side item an identical box
          (inline-flex + fixed h-4 + items-center) so the button's
          intrinsic browser-default border / appearance / font metrics
          can't nudge it off-baseline from the anchors. Uniform height
          + items-center on the parent guarantees all four sit on the
          same y-coordinate regardless of the underlying element type. */}
      <div className="flex flex-nowrap items-center gap-4 whitespace-nowrap leading-none">
        <FeedbackTrigger />
        <Link
          href="/settings"
          className="inline-flex h-4 items-center leading-none hover:text-foreground transition-colors"
        >
          settings
        </Link>
        <Link
          href="/roadmap"
          className="inline-flex h-4 items-center leading-none hover:text-foreground transition-colors"
        >
          roadmap
        </Link>
        <a
          href="https://github.com/JeffC399/practice-prodigy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-4 items-center leading-none hover:text-foreground transition-colors"
        >
          github
        </a>
      </div>
    </footer>
  );
}
