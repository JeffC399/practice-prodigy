"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Small "Back" affordance used by non-hub pages (Settings, Roadmap) so
 * the user can return to where they were before clicking a footer /
 * shell link. Uses the browser history stack via `router.back()`; if
 * the page was opened directly (no history entry), falls back to a
 * configurable route.
 *
 * Client component wrapper so it can live inside server-component
 * pages (like Roadmap that exports `metadata`) without forcing the
 * whole page to be client-side.
 */
export function BackButton({
  fallbackHref = "/",
  label = "Back",
}: {
  fallbackHref?: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
