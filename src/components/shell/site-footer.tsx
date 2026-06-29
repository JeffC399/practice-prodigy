import Link from "next/link";

/**
 * Slim persistent footer — one row at the bottom of every screen.
 * Left: build label + tagline. Right: roadmap link + GitHub.
 *
 * Static (server-rendered). Lives at the bottom of the column layout
 * in app/layout.tsx; the page's <main> uses flex-1 so this lands at
 * the viewport bottom on short pages and below content on long ones.
 */
export function SiteFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/60 px-4 py-2 font-mono text-[11px] text-muted-foreground sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-foreground/70">Practice Prodigy</span>
        <span aria-hidden="true">·</span>
        <span>v0.1 pre-release</span>
        <span className="hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span className="hidden sm:inline">
          A platform for musicians.
        </span>
      </div>
      <div className="flex items-center gap-4">
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
