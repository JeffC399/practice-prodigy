"use client";

import { ChevronDown, Music } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  activeModule,
  MODULES,
  STATUS_LABELS,
  type ModuleEntry,
} from "@/lib/modules/registry";

/**
 * Persistent shell header — sticky bar at the very top of every screen.
 * Left: brand link back to `/`. Right: module switcher showing the
 * active module + a dropdown listing all 9 platform modules with status
 * pills, so the user senses the full platform vision from day one.
 *
 * Sub-page headers (e.g. the drill-screen tempo nudge) sit BELOW this
 * shell — kept that way so each surface owns its own context. The
 * shell stays minimal and quiet (~48px tall) so it doesn't compete
 * with the drill screen's visual focus.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const current = activeModule(pathname);
  return (
    <header
      data-site-header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-2 sm:px-6"
    >
      <Link
        href="/"
        className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
        aria-label="Practice Prodigy home"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
          <Music className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        </span>
        <span className="font-mono text-xs uppercase tracking-wider">
          Practice Prodigy
        </span>
      </Link>
      <ModuleSwitcher current={current} />
    </header>
  );
}

function ModuleSwitcher({ current }: { current: ModuleEntry | null }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click-outside dismissal — keeps the menu feeling native without
  // pulling in a popover library for one screen.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const label = current?.shortName ?? "Modules";
  const CurrentIcon = current?.icon;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Practice Prodigy modules${current ? ` — currently ${current.shortName}` : ""}`}
        className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-background/80 transition-colors"
      >
        {CurrentIcon && (
          <CurrentIcon
            className="h-3.5 w-3.5 text-primary"
            aria-hidden="true"
          />
        )}
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 flex w-80 flex-col rounded-md border border-border bg-card shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              The platform vision
            </p>
            <p className="text-xs text-muted-foreground/80 leading-relaxed mt-0.5">
              9 modules planned. Live ones link; the rest are on the
              roadmap.
            </p>
          </div>
          <ul className="flex max-h-96 flex-col gap-0.5 overflow-y-auto py-1">
            {MODULES.map((m) => (
              <li key={m.id}>
                <ModuleSwitcherItem
                  module={m}
                  isActive={m.id === current?.id}
                  onNavigate={() => setOpen(false)}
                />
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-3 py-2">
            <Link
              href="/roadmap"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <span>Browse the full roadmap</span>
              <ChevronDown
                className="h-3 w-3 -rotate-90"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleSwitcherItem({
  module: m,
  isActive,
  onNavigate,
}: {
  module: ModuleEntry;
  isActive: boolean;
  onNavigate: () => void;
}) {
  const Icon = m.icon;
  const isLive = m.status === "live";
  const statusClass =
    m.status === "live"
      ? "bg-primary/20 text-primary border-primary/30"
      : m.status === "in-build"
        ? "bg-primary/10 text-primary/80 border-primary/20"
        : "bg-background border-border text-muted-foreground";

  const content = (
    <div
      className={`flex items-start gap-3 px-3 py-2 transition-colors ${
        isActive
          ? "bg-primary/10"
          : isLive
            ? "hover:bg-background/60"
            : ""
      }`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          isLive || isActive ? "text-primary" : "text-muted-foreground/70"
        }`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm font-medium truncate ${
              isLive ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {m.shortName}
          </span>
          <span
            className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${statusClass}`}
          >
            {STATUS_LABELS[m.status]}
          </span>
        </div>
        <p
          className={`mt-0.5 text-xs leading-relaxed line-clamp-2 ${
            isLive ? "text-muted-foreground" : "text-muted-foreground/60"
          }`}
        >
          {m.description}
        </p>
      </div>
    </div>
  );

  if (isLive && m.route) {
    return (
      <Link
        href={m.route}
        onClick={onNavigate}
        className="block"
        role="menuitem"
      >
        {content}
      </Link>
    );
  }
  return (
    <div
      className="cursor-not-allowed opacity-80"
      role="menuitem"
      aria-disabled="true"
      title={`${m.shortName} — ${STATUS_LABELS[m.status]}`}
    >
      {content}
    </div>
  );
}
