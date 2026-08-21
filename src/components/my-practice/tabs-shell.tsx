"use client";

import {
  BarChart3,
  BookOpen,
  ListChecks,
  Music,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

/**
 * My Practice tab shell — Slice B.2 (Phase 102).
 *
 * The 5-tab navigation for the flagship module. Sidebar on desktop
 * (matches Settings' pattern for consistency); select dropdown on
 * mobile. Active tab is owned by the parent page (usually mapped to
 * `?tab=` URL param) so refresh / deep-linking preserves state.
 *
 * The five tabs — deliberately in this order so the primary "do
 * loop" (Routines → Songs → Reports) reads left-to-right, with
 * meta-work (Methodology, Profile) trailing:
 *
 *   1. Routines     — build + run practice routines (Slice B — live)
 *   2. Songs        — repertoire library (Slice C)
 *   3. Reports      — practice history + analytics (Slice D)
 *   4. Methodology  — practice-method library (Slice E)
 *   5. Profile      — proficiency levels + AI settings (Slice E/F)
 */

export type MyPracticeTabId =
  | "routines"
  | "songs"
  | "reports"
  | "methodology"
  | "profile";

export type MyPracticeTabEntry = {
  id: MyPracticeTabId;
  label: string;
  icon: LucideIcon;
  /** One-line hint shown in the mobile dropdown + as a title attr on desktop. */
  description: string;
};

export const MY_PRACTICE_TABS: MyPracticeTabEntry[] = [
  {
    id: "routines",
    label: "Routines",
    icon: ListChecks,
    description: "Build + run your practice routines.",
  },
  {
    id: "songs",
    label: "Songs",
    icon: Music,
    description: "Your repertoire — songs you're learning or maintaining.",
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    description: "Practice history, category time, and progression.",
  },
  {
    id: "methodology",
    label: "Methodology",
    icon: BookOpen,
    description: "Practice-method library + starter templates.",
  },
  {
    id: "profile",
    label: "Profile",
    icon: UserCircle,
    description: "Proficiency levels, categories, AI coach settings.",
  },
];

export const DEFAULT_MY_PRACTICE_TAB: MyPracticeTabId = "routines";

/**
 * Type guard for URL query-param safety — clamp arbitrary strings to
 * a known tab id, falling back to the default. Callers use this after
 * reading `?tab=` from useSearchParams so invalid values don't crash.
 */
export function coerceMyPracticeTab(raw: string | null): MyPracticeTabId {
  if (!raw) return DEFAULT_MY_PRACTICE_TAB;
  const found = MY_PRACTICE_TABS.find((t) => t.id === raw);
  return found ? found.id : DEFAULT_MY_PRACTICE_TAB;
}

export function MyPracticeTabsShell({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: MyPracticeTabId;
  onTabChange: (t: MyPracticeTabId) => void;
  children: ReactNode;
}) {
  return (
    <>
      {/* Mobile — select dropdown at the top of the content. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            My Practice section
          </span>
          <select
            value={activeTab}
            onChange={(e) => onTabChange(e.target.value as MyPracticeTabId)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            {MY_PRACTICE_TABS.map((t) => (
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
          aria-label="My Practice sections"
          className="hidden sm:flex sm:flex-col sm:sticky sm:top-4 sm:h-fit sm:gap-1"
        >
          {MY_PRACTICE_TABS.map((t) => {
            const active = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                aria-current={active ? "page" : undefined}
                title={t.description}
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
    </>
  );
}
