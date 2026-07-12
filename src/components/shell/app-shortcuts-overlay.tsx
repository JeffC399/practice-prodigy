"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

/**
 * App-wide keyboard shortcuts overlay.
 *
 * Phase 43 — pro-tool table-stakes: `?` opens this from anywhere in
 * the app to show the shortcuts that work globally + point users at
 * the Lead Sheet editor's own detailed overlay (Phase 31.6) when
 * relevant. The Lead Sheet editor's `?` shortcut takes precedence
 * within that surface because it opens a richer editor-specific list.
 *
 * Phase 60 — per-route adaptation: the overlay now takes a pathname
 * and shows the Global section plus whichever module-specific section
 * matches. Each Section carries a `matches(pathname)` predicate so
 * "which shortcuts are relevant right now" is a data-model concern,
 * not a caller concern. Fallback: on unmatched routes the overlay
 * still shows the Global section + a compact "Other surfaces" summary
 * so users can discover shortcuts they haven't found yet.
 */

type Shortcut = {
  keys: string[];
  description: string;
};

export type ShortcutsSection = {
  title: string;
  shortcuts: Shortcut[];
  /**
   * Route predicate. Return true if this section is relevant to the
   * given pathname. The Global section always matches.
   */
  matches: (pathname: string) => boolean;
  /**
   * When true, this section is always shown regardless of pathname.
   * Used for the Global section.
   */
  always?: boolean;
};

const GLOBAL_SECTION: ShortcutsSection = {
  title: "Global",
  always: true,
  matches: () => true,
  shortcuts: [
    { keys: ["?"], description: "Open this shortcuts help" },
    { keys: ["Esc"], description: "Close any open modal or overlay" },
  ],
};

const MODULE_SECTIONS: ShortcutsSection[] = [
  {
    title: "Arpeggios · Setup",
    matches: (p) => p === "/practice",
    shortcuts: [
      { keys: ["Cmd/Ctrl + Enter"], description: "Start the drill" },
    ],
  },
  {
    title: "Arpeggios · Session",
    matches: (p) => p.startsWith("/practice/session"),
    shortcuts: [
      { keys: ["Space"], description: "Start / Stop the drill" },
    ],
  },
  {
    title: "Key Sequencer · Setup",
    matches: (p) => p === "/practice/keys",
    shortcuts: [
      { keys: ["Cmd/Ctrl + Enter"], description: "Start the drill" },
    ],
  },
  {
    title: "Key Sequencer · Session",
    matches: (p) => p.startsWith("/practice/keys/session"),
    shortcuts: [
      { keys: ["Space"], description: "Start / Stop the drill" },
    ],
  },
  {
    title: "Metronome",
    matches: (p) => p.startsWith("/metronome"),
    shortcuts: [
      { keys: ["Space"], description: "Start / Stop" },
      { keys: ["↑", "→"], description: "Increase tempo by 5 BPM" },
      { keys: ["↓", "←"], description: "Decrease tempo by 5 BPM" },
      { keys: ["T"], description: "Tap tempo" },
    ],
  },
  {
    title: "Tuner",
    matches: (p) => p.startsWith("/tuner"),
    shortcuts: [
      // Reserved: currently no page-specific shortcuts. Kept as an
      // explicit section so users on /tuner see "no shortcuts yet"
      // rather than wondering if they're missing something.
    ],
  },
  {
    title: "Lead Sheet editor",
    matches: (p) => p.includes("/sheets/") && p.endsWith("/edit"),
    shortcuts: [
      {
        keys: ["?"],
        description:
          "Open the editor's own detailed shortcuts (click-entry, MIDI, chord-entry, lyrics, selection)",
      },
      { keys: ["Cmd/Ctrl + S"], description: "Flash 'Saved' (auto-saves already)" },
      { keys: ["Cmd/Ctrl + Z"], description: "Undo" },
      {
        keys: ["Cmd/Ctrl + Shift + Z", "Cmd/Ctrl + Y"],
        description: "Redo",
      },
      {
        keys: ["Cmd/Ctrl + =", "Cmd/Ctrl + -"],
        description: "Zoom in / out",
      },
      { keys: ["Cmd/Ctrl + 0"], description: "Reset zoom to 100%" },
      { keys: ["F"], description: "Toggle focus mode (hides header + footer)" },
    ],
  },
];

/**
 * Public helper — resolves which sections to render for a given path.
 * Global is always first; module sections follow in registry order.
 * On routes with no match (e.g. `/roadmap`), only Global is shown
 * plus an "Other surfaces" compact summary listing the module names
 * so users learn that shortcuts exist elsewhere.
 */
function sectionsForPathname(pathname: string): ShortcutsSection[] {
  const matched = MODULE_SECTIONS.filter((s) => s.matches(pathname));
  return [GLOBAL_SECTION, ...matched];
}

function keyChip(k: string) {
  return (
    <kbd
      key={k}
      className="inline-flex items-center rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-foreground"
    >
      {k}
    </kbd>
  );
}

export function AppShortcutsOverlay({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Phase 60 — required so per-screen shortcut sections can be picked
   * from the registry. The trigger passes usePathname() through.
   */
  pathname: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sections = sectionsForPathname(pathname);
  const hasModuleSection = sections.length > 1;

  // Other-surfaces summary when no module matched (e.g. /roadmap, /,
  // /settings). Lets users discover that per-module shortcuts exist.
  const otherSurfaces = hasModuleSection
    ? []
    : MODULE_SECTIONS.filter((s) => s.shortcuts.length > 0).map((s) => s.title);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-shortcuts-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mt-16 flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="app-shortcuts-title"
              className="text-lg font-semibold text-foreground"
            >
              Keyboard shortcuts
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {hasModuleSection ? (
                <>
                  Global shortcuts + shortcuts for the current screen.
                  Some surfaces (like the Lead Sheet editor) have their
                  own richer shortcut sets — press{" "}
                  <kbd className="inline-flex items-center rounded border border-border bg-card px-1 font-mono text-[10px]">
                    ?
                  </kbd>{" "}
                  inside them to see those.
                </>
              ) : (
                <>
                  Global shortcuts that work everywhere in Practice
                  Prodigy. Navigate to a module (Arpeggios, Key
                  Sequencer, Metronome, Lead Sheet editor) to see its
                  page-specific shortcuts here.
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-2">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              {section.shortcuts.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-2 text-xs text-muted-foreground/70">
                  No page-specific shortcuts yet.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border/50 rounded-md border border-border/60 bg-background/40">
                  {section.shortcuts.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="text-foreground">{s.description}</span>
                      <span className="flex items-center gap-1.5">
                        {s.keys.map((k, ki) => (
                          <span key={ki} className="flex items-center gap-1">
                            {ki > 0 && (
                              <span className="text-[10px] text-muted-foreground/60">
                                or
                              </span>
                            )}
                            {keyChip(k)}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {otherSurfaces.length > 0 && (
            <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Other surfaces with shortcuts
              </span>
              <span>{otherSurfaces.join(" · ")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
