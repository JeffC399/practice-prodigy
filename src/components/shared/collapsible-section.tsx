"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { usePersistedState } from "@/lib/util/persisted-state";

/**
 * Bordered section that collapses to a compact header row with a
 * one-line "summary" of its current state (e.g. "Tempo & meter ·
 * ♩=100 · 4/4"). Expanded state reveals the children under a
 * horizontal rule.
 *
 * Shipped originally on the Arpeggios setup page (Phase 20 — collapse-
 * with-summary pattern). Phase 63 extracted it to shared so the
 * Settings page can use the same visual + interaction model — the
 * user recognizes the pattern from setup screens, and one collapse
 * behavior across the app keeps the interaction budget low.
 *
 * Controlled vs uncontrolled: pass `open` + `onOpenChange` for
 * controlled behavior; otherwise the section manages its own open
 * state, seeded from `defaultOpen`.
 */
export function CollapsibleSection({
  title,
  summary,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  className,
  persistKey,
}: {
  title: string;
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** When provided, the section becomes controlled by the parent. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /**
   * Optional stable id — when provided, open/closed state is persisted
   * across page navigation + reload via localStorage. Omit for
   * ephemeral sections (settings pages that already collapse on route
   * change, one-off panels).
   */
  persistKey?: string;
}) {
  // Split state hooks by mode so we don't pay for both. `usePersistedState`
  // reads from localStorage on mount; `useState` doesn't.
  const [persistedOpen, setPersistedOpen] = usePersistedState<boolean>(
    `collapsible:${persistKey ?? "__unused__"}`,
    defaultOpen,
  );
  const [ephemeralOpen, setEphemeralOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const uncontrolledOpen = persistKey ? persistedOpen : ephemeralOpen;
  const open = isControlled ? openProp : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) {
      if (persistKey) setPersistedOpen(next);
      else setEphemeralOpen(next);
    }
    onOpenChange?.(next);
  };
  return (
    <section
      className={`flex flex-col rounded-md border border-border bg-background/30 ${className ?? ""}`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background/60 transition-colors"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <span className="text-sm font-medium text-foreground">
            {summary}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
          {children}
        </div>
      )}
    </section>
  );
}
