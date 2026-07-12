"use client";

import {
  Accessibility,
  Database,
  ListMusic,
  Palette,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

/**
 * Settings tabs shell — Phase 63.
 *
 * A left-sidebar / right-content layout for the Settings page. Users
 * see one tab's contents at a time; the sidebar shows all tabs so
 * they can jump around freely. Matches the pattern from macOS System
 * Settings (Ventura+), Linear, Notion, and Vercel dashboard.
 *
 * Rationale: pre-Phase-63 Settings was a 1656-line single-scroll page
 * with 13 top-level sections. Users had to hunt for the control they
 * wanted. Tabs cluster related choices; collapsibles inside each tab
 * put the current state on-screen without opening the section.
 *
 * Context-driven filtering: each `SettingsSection` picks up the
 * active tab from `SettingsTabContext` and hides itself when its
 * `tab` prop doesn't match. This lets the existing flat list of
 * sections stay physically in file order — tagging is a one-word
 * addition per section instead of a wholesale reorganization.
 *
 * Mobile: below `sm` breakpoint, the sidebar becomes a select
 * dropdown at the top. Above `sm`, it's a sticky column on the left.
 */

export type SettingsTabId =
  | "appearance"
  | "music-display"
  | "practice"
  | "accessibility"
  | "data-account";

export type SettingsTabEntry = {
  id: SettingsTabId;
  label: string;
  icon: LucideIcon;
  /** One-line description shown in the tab card. */
  description: string;
};

export const SETTINGS_TABS: SettingsTabEntry[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "Theme, palette, accent, typography, and fine tuning.",
  },
  {
    id: "music-display",
    label: "Music display",
    icon: ListMusic,
    description:
      "Chord notation, pattern display, and lead-sheet appearance.",
  },
  {
    id: "practice",
    label: "Practice",
    icon: ListMusic,
    description: "Practice-screen layout and drill defaults.",
  },
  {
    id: "accessibility",
    label: "Accessibility",
    icon: Accessibility,
    description: "Motion, contrast, and larger touch targets.",
  },
  {
    id: "data-account",
    label: "Data & account",
    icon: Database,
    description: "Export / import your data; cloud sync (coming soon).",
  },
];

/**
 * Context that consumer sections read to decide whether to render.
 * SettingsSection reads this + its own `tab` prop; when they don't
 * match, the section returns null.
 */
const SettingsTabContext = createContext<SettingsTabId>("appearance");

export function useSettingsTab(): SettingsTabId {
  return useContext(SettingsTabContext);
}

export function SettingsTabsShell({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: SettingsTabId;
  onTabChange: (t: SettingsTabId) => void;
  children: ReactNode;
}) {
  return (
    <SettingsTabContext.Provider value={activeTab}>
      {/* Mobile — top-of-content select dropdown. sm:hidden. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Settings section
          </span>
          <select
            value={activeTab}
            onChange={(e) => onTabChange(e.target.value as SettingsTabId)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            {SETTINGS_TABS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Desktop — two-pane layout with sticky sidebar. */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[13rem_1fr]">
        <aside
          aria-label="Settings sections"
          className="hidden sm:flex sm:flex-col sm:sticky sm:top-4 sm:h-fit sm:gap-1"
        >
          {SETTINGS_TABS.map((t) => {
            const active = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </aside>

        <div className="flex flex-col gap-6">{children}</div>
      </div>
    </SettingsTabContext.Provider>
  );
}
