"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Phase 31.6 — Keyboard shortcuts help modal.
 *
 * Opens on `?` (Shift + /) anywhere in the editor. Categorised
 * reference of every editor shortcut so the user doesn't have to
 * remember them.
 *
 * Pure presentational: `open` + `onClose` from the parent. Escape
 * closes.
 */

export type ShortcutsOverlayProps = {
  open: boolean;
  onClose: () => void;
};

type ShortcutRow = {
  keys: string[];
  description: string;
};

type ShortcutSection = {
  title: string;
  rows: ShortcutRow[];
};

const SECTIONS: ShortcutSection[] = [
  {
    title: "General",
    rows: [
      { keys: ["?"], description: "Show this shortcut reference" },
      { keys: ["F"], description: "Toggle focus mode (hide site chrome)" },
      {
        keys: ["Cmd/Ctrl + S"],
        description: "Flash the Saved indicator (auto-save always on)",
      },
      { keys: ["Cmd/Ctrl + Z"], description: "Undo" },
      {
        keys: ["Cmd/Ctrl + Shift + Z", "Cmd/Ctrl + Y"],
        description: "Redo",
      },
      { keys: ["Cmd/Ctrl + =", "Cmd/Ctrl + -"], description: "Zoom in / out" },
      { keys: ["Cmd/Ctrl + 0"], description: "Reset zoom to 100%" },
      { keys: ["Esc"], description: "Exit the current editor mode" },
    ],
  },
  {
    title: "Click-entry mode (melody notes)",
    rows: [
      {
        keys: ["Click staff"],
        description: "Place a note at that pitch + anchor the caret",
      },
      { keys: ["A – G"], description: "Place a note at the caret pitch" },
      { keys: ["R"], description: "Place a rest at the caret" },
      { keys: ["↑ / ↓"], description: "Nudge the last placed note by one step" },
      { keys: ["← / →"], description: "Move caret by current rhythm value" },
      {
        keys: ["1 / 2 / 3 / 4 / 5"],
        description: "Rhythm: whole / half / quarter / eighth / sixteenth",
      },
      { keys: ["."], description: "Toggle dotted note" },
    ],
  },
  {
    title: "MIDI input (in click-entry mode)",
    rows: [
      {
        keys: ["Toggle MIDI"],
        description: "In the click-entry side panel — allow browser access",
      },
      {
        keys: ["Play any key"],
        description: "Places a note at the caret with current rhythm setting",
      },
    ],
  },
  {
    title: "Chord entry mode",
    rows: [
      {
        keys: ["Click beat"],
        description: "Anchor the chord cursor at a beat position",
      },
      {
        keys: ["Type"],
        description: "Type a chord symbol; use / for slash chords (C/E)",
      },
      { keys: ["Tab / Enter"], description: "Commit + advance to next beat" },
      { keys: ["Shift + Tab"], description: "Commit + retreat" },
    ],
  },
  {
    title: "Lyric entry mode",
    rows: [
      { keys: ["Click note"], description: "Anchor cursor at a pitched note" },
      { keys: ["Type"], description: "Type the syllable text" },
      { keys: ["Space"], description: "Commit + advance to next note" },
      {
        keys: ["-"],
        description: "Hyphen continuation into the next syllable",
      },
      { keys: ["_"], description: "Melisma (extends the syllable)" },
      { keys: ["Backspace"], description: "Retreat when input is empty" },
    ],
  },
  {
    title: "Select mode",
    rows: [
      { keys: ["Click note"], description: "Select a single note" },
      { keys: ["Shift + click"], description: "Toggle in / out of selection" },
      { keys: ["Click + drag"], description: "Marquee selection" },
      { keys: ["Del / Backspace"], description: "Delete selected notes" },
      {
        keys: ["↑ / ↓"],
        description: "Transpose by one staff step (Shift = one octave)",
      },
      { keys: ["Cmd/Ctrl + C"], description: "Copy selection" },
      { keys: ["Cmd/Ctrl + X"], description: "Cut selection" },
      {
        keys: ["Cmd/Ctrl + V"],
        description: "Paste after the last selected note",
      },
      {
        keys: ["8va / 8vb"],
        description:
          "Buttons in the status bar apply an ottava to every selected measure",
      },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
      {children}
    </kbd>
  );
}

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm print:hidden"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="my-8 w-full max-w-3xl rounded-lg border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-lg font-semibold">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.title} className="flex flex-col gap-2">
              <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <ul className="flex flex-col gap-1.5 text-[12px]">
                {section.rows.map((row, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="flex-1 text-muted-foreground">
                      {row.description}
                    </span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {row.keys.map((k, ki) => (
                        <Kbd key={ki}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span>
            Press{" "}
            <Kbd>?</Kbd> any time to reopen this reference.
          </span>
          <span>
            Close with{" "}
            <Kbd>Esc</Kbd>.
          </span>
        </div>
      </div>
    </div>
  );
}
