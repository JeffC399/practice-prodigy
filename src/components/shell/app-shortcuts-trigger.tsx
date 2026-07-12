"use client";

import { Keyboard } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShortcutsOverlay } from "./app-shortcuts-overlay";

/**
 * Client-side trigger for the app-wide keyboard shortcuts overlay.
 *
 * Phase 43 — pro-tool table-stakes:
 * • Renders a small keyboard-icon button in the footer that opens the
 *   overlay by click / touch (mobile-friendly discovery).
 * • Registers a global `?` keydown handler that opens the same overlay
 *   from anywhere in the app.
 *
 * Coexists with the Lead Sheet editor's own richer shortcuts overlay
 * (Phase 31.6): when the user is on `/sheets/[id]/edit`, we
 * intentionally do NOT hijack `?` — the editor's own handler fires
 * instead and shows its detailed editor-specific list. This global
 * overlay stays available via footer click on any surface.
 *
 * Guarded so `?` typed inside an input / textarea doesn't fire.
 */
export function AppShortcutsTrigger() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  // Lead Sheet editor owns `?` on its own surface.
  const isSheetEditor = pathname.includes("/sheets/") && pathname.endsWith("/edit");

  useEffect(() => {
    if (isSheetEditor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?") return;
      // Ignore when focus is in a text input so users can type ?
      // into their notes / titles / lyrics without the modal opening.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isSheetEditor]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Keyboard shortcuts (?)"
        title="Keyboard shortcuts"
        className="inline-flex h-4 items-center gap-1 leading-none transition-colors hover:text-foreground"
      >
        <Keyboard className="h-3 w-3" aria-hidden="true" />
        <span>shortcuts</span>
      </button>
      <AppShortcutsOverlay
        open={open}
        onClose={() => setOpen(false)}
        pathname={pathname}
      />
    </>
  );
}
