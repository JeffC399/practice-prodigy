"use client";

import {
  BUILTIN_CATEGORY_LIST,
  resolveCategoryMeta,
} from "@/lib/practice/categories";
import {
  BUILTIN_METHODOLOGIES,
  getMethodology,
} from "@/lib/practice/methodologies";
import {
  formatLevel,
  type CategoryProficiency,
} from "@/lib/practice/proficiency";
import {
  getSessionsInRange,
  secondsByCategory,
} from "@/lib/practice/reports-queries";
import { computeStreaks } from "@/lib/practice/streak";
import { useRoutinesLibrary } from "@/lib/practice/routines-library";
import { useSongsLibrary } from "@/lib/practice/songs-library";
import { useSheetsLibrary } from "@/lib/state/sheets-library";
import { useDrillsLibrary } from "@/lib/state/drills-library";
import { useKeyDrillsLibrary } from "@/lib/key-sequencer/library-store";
import { useScaleDrillsLibrary } from "@/lib/scale-driller/library-store";
import { useSessionTracker } from "@/lib/tracking/session-tracker";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * context-assembly — Slice F.3 (Phase 141).
 *
 * Walks the client-side Zustand stores and produces a text snapshot
 * of the user's library + recent practice + proficiency for the
 * system prompt. Kept as plain text (not JSON) so the model reads it
 * naturally — the ids remain machine-checkable but everything else
 * flows as English.
 *
 * ## Size budget
 *
 * The whole context aims to fit in ~4KB of prompt. That's:
 *   - ~20 routines (id + name + item count) → ~1KB
 *   - ~50 songs (title + artist + status) → ~1.5KB
 *   - ~30 drills across all modules → ~0.5KB
 *   - Levels + streaks + recent categories → ~0.5KB
 *
 * We cap noisy lists at reasonable ceilings to protect the budget
 * for users with big libraries.
 *
 * ## Freshness
 *
 * Called on every ChatView.sendMessage — no memoization. Rebuilding
 * a text snapshot from Zustand is O(items) and runs in <5ms even at
 * the caps. Cheaper than trying to cache freshness across sends.
 */

const MAX_ROUTINES = 20;
const MAX_SONGS = 50;
const MAX_DRILLS_PER_MODULE = 15;
const MAX_SHEETS = 20;

export function buildContextBody(): string {
  const routines = useRoutinesLibrary.getState().routines;
  const songs = useSongsLibrary.getState().songs;
  const sheets = useSheetsLibrary.getState().sheets;
  const drills = useDrillsLibrary.getState().drills;
  const keyDrills = useKeyDrillsLibrary.getState().drills;
  const scaleDrills = useScaleDrillsLibrary.getState().drills;
  const proficiency = useUserPrefs.getState().proficiency;
  const customCategories = useUserPrefs.getState().customCategories;
  const history = useSessionTracker.getState().history;
  const current = useSessionTracker.getState().current;

  const parts: string[] = [];

  // ────────────────────── Practice pulse
  const allSessions = current ? [current, ...history] : history;
  const weekSessions = getSessionsInRange(allSessions, "week");
  const weekSecs = totalSecs(weekSessions);
  const monthSessions = getSessionsInRange(allSessions, "month");
  const monthSecs = totalSecs(monthSessions);
  const { current: currentStreak, longest: longestStreak } =
    computeStreaks(allSessions);

  parts.push("### Practice pulse");
  parts.push(
    `Week so far: ${fmtMin(weekSecs)}. Month so far: ${fmtMin(monthSecs)}.`,
  );
  parts.push(
    `Current streak: ${currentStreak} day${currentStreak === 1 ? "" : "s"}. Longest ever: ${longestStreak}.`,
  );
  const catBreakdown = secondsByCategory(weekSessions);
  const catEntries = Object.entries(catBreakdown)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);
  if (catEntries.length > 0) {
    const summary = catEntries
      .slice(0, 5)
      .map(([id, s]) => {
        const label = resolveCategoryMeta(id, customCategories)?.label ?? id;
        return `${label} ${fmtMin(s)}`;
      })
      .join(", ");
    parts.push(`This week's category mix: ${summary}.`);
  }

  // ────────────────────── Proficiency levels
  const ratedCats = Object.values(proficiency);
  if (ratedCats.length > 0) {
    parts.push("");
    parts.push("### Self-rated levels");
    for (const p of ratedCats) {
      parts.push(formatLevelLine(p, customCategories));
    }
  }

  // ────────────────────── Routines
  parts.push("");
  parts.push("### Saved routines");
  if (routines.length === 0) {
    parts.push("(none yet)");
  } else {
    const sortedRoutines = [...routines]
      .sort((a, b) => (b.lastRunAt ?? b.updatedAt) - (a.lastRunAt ?? a.updatedAt))
      .slice(0, MAX_ROUTINES);
    for (const r of sortedRoutines) {
      const methodChip = r.methodologyId
        ? ` [method:${r.methodologyId}]`
        : "";
      parts.push(
        `- id:${r.id} · "${r.name}" · ${r.items.length} items${methodChip}`,
      );
    }
    if (routines.length > MAX_ROUTINES) {
      parts.push(`(+${routines.length - MAX_ROUTINES} older routines omitted)`);
    }
  }

  // ────────────────────── Songs
  parts.push("");
  parts.push("### Repertoire (songs)");
  if (songs.length === 0) {
    parts.push("(none yet)");
  } else {
    const active = songs
      .filter((s) => s.status !== "retired")
      .sort(
        (a, b) => (b.lastPracticedAt ?? 0) - (a.lastPracticedAt ?? 0),
      )
      .slice(0, MAX_SONGS);
    for (const s of active) {
      const artist = s.artist ? ` — ${s.artist}` : "";
      const totalStr = s.totalPracticeSeconds > 0
        ? ` · ${fmtMin(s.totalPracticeSeconds)} logged`
        : "";
      parts.push(
        `- id:${s.id} · "${s.title}"${artist} · ${s.status}${totalStr}`,
      );
    }
    const retired = songs.filter((s) => s.status === "retired").length;
    if (retired > 0) parts.push(`(${retired} retired songs omitted)`);
  }

  // ────────────────────── Drills across the three drilling modules
  parts.push("");
  parts.push("### Saved drills");
  parts.push(
    formatDrillGroup("Bass Arpeggios (drill)", drills, MAX_DRILLS_PER_MODULE),
  );
  parts.push(
    formatDrillGroup(
      "Key Sequencer (key-drill)",
      keyDrills,
      MAX_DRILLS_PER_MODULE,
    ),
  );
  parts.push(
    formatDrillGroup(
      "Scale Driller (scale-drill)",
      scaleDrills,
      MAX_DRILLS_PER_MODULE,
    ),
  );

  // ────────────────────── Lead sheets
  parts.push("");
  parts.push("### Lead sheets");
  if (sheets.length === 0) {
    parts.push("(none yet)");
  } else {
    const shortlist = [...sheets]
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, MAX_SHEETS);
    for (const sh of shortlist) {
      const composer = sh.composer ? ` — ${sh.composer}` : "";
      parts.push(
        `- id:${sh.id} · "${sh.title || "Untitled sheet"}"${composer}`,
      );
    }
    if (sheets.length > MAX_SHEETS) {
      parts.push(`(+${sheets.length - MAX_SHEETS} older sheets omitted)`);
    }
  }

  // ────────────────────── Categories + methodologies (id references)
  parts.push("");
  parts.push("### Available categories (id references)");
  parts.push(
    BUILTIN_CATEGORY_LIST.map((c) => `${c.id} (${c.label})`).join(", "),
  );
  if (customCategories.length > 0) {
    parts.push(
      "Custom: " +
        customCategories.map((c) => `${c.id} (${c.label})`).join(", "),
    );
  }

  parts.push("");
  parts.push("### Available methodologies (id references)");
  for (const m of BUILTIN_METHODOLOGIES) {
    parts.push(`- ${m.id} (${m.name}, scope:${m.scope}) — ${m.summary}`);
  }

  return parts.join("\n");
}

function totalSecs(sessions: readonly { items: { durationSec: number }[] }[]): number {
  let sum = 0;
  for (const s of sessions) for (const it of s.items) sum += it.durationSec;
  return sum;
}

function fmtMin(sec: number): string {
  if (sec <= 0) return "0m";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function formatLevelLine(
  p: CategoryProficiency,
  customCategories: ReturnType<typeof useUserPrefs.getState>["customCategories"],
): string {
  const meta = resolveCategoryMeta(p.categoryId, customCategories);
  const label = meta?.label ?? p.categoryId;
  const target = p.target
    ? ` (target Level ${p.target})`
    : "";
  return `- ${label}: ${formatLevel(p.current)}${target}`;
}

function formatDrillGroup(
  header: string,
  items: readonly { id: string; name: string; category?: string }[],
  cap: number,
): string {
  if (items.length === 0) return `- ${header}: (none)`;
  const lines: string[] = [`- ${header}:`];
  const shortlist = items.slice(0, cap);
  for (const d of shortlist) {
    const cat = d.category ? ` [${d.category}]` : "";
    lines.push(`    - id:${d.id} "${d.name}"${cat}`);
  }
  if (items.length > cap) {
    lines.push(`    (+${items.length - cap} more omitted)`);
  }
  // Warm up the methodology getter so tree-shaking doesn't drop it —
  // system-prompts.ts references methodology ids in the passive-mode
  // constraints; the caller uses getMethodology to validate.
  void getMethodology;
  return lines.join("\n");
}
