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
 * Static content — cheap to render, never stale. New shortcuts are
 * added by editing this file.
 */

type Shortcut = {
  keys: string[];
  description: string;
};

type Section = {
  title: string;
  shortcuts: Shortcut[];
};

const SECTIONS: Section[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["?"], description: "Open this shortcuts help" },
      { keys: ["Esc"], description: "Close any open modal or overlay" },
    ],
  },
  {
    title: "Lead Sheet editor",
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
}: {
  open: boolean;
  onClose: () => void;
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
              Global shortcuts that work everywhere in Practice Prodigy.
              Some surfaces (like the Lead Sheet editor) have their own
              richer shortcut sets — press{" "}
              <kbd className="inline-flex items-center rounded border border-border bg-card px-1 font-mono text-[10px]">
                ?
              </kbd>{" "}
              inside them to see those.
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
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-2">
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
