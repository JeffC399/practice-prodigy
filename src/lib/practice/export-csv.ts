import type { CustomCategory } from "./categories";
import { resolveCategoryMeta } from "./categories";
import { getMethodology } from "./methodologies";
import {
  NO_METHODOLOGY_KEY,
  REPORTS_RANGE_LABELS,
  localDayKey,
  secondsByCategory,
  secondsByDay,
  secondsByMethodology,
  secondsByModule,
  type ReportsRange,
} from "./reports-queries";
import type { Routine } from "./routine-types";
import { PRACTICE_MODULE_LABELS, type PracticeSession } from "./types";

/**
 * export-csv — Slice D.10 (Phase 126).
 *
 * Builds a single-file CSV export of the current Reports view. The
 * file contains four labeled sections:
 *
 *   [Range]           — what filter was applied
 *   [Daily totals]    — one row per day: date, total_minutes
 *   [By category]     — one row per category: category, minutes, pct
 *   [By methodology]  — one row per methodology: methodology, minutes, pct
 *   [By module]       — one row per module: module, minutes, pct
 *
 * Sections are separated by blank rows so Excel / Numbers / Sheets
 * can still make sense of the layout — most spreadsheet apps handle
 * mixed-shape CSVs by treating blank rows as section breaks.
 *
 * ## No PII
 *
 * Sessions never contain anything beyond what the user typed (drill
 * names, routine labels, etc.) and their own module usage. Nothing
 * device-fingerprinting or user-identifying leaks into the export.
 */
export function buildReportsCsv(input: {
  sessions: readonly PracticeSession[];
  routines: readonly Routine[];
  customCategories: readonly CustomCategory[];
  range: ReportsRange;
  generatedAt?: number;
}): string {
  const {
    sessions,
    routines,
    customCategories,
    range,
    generatedAt = Date.now(),
  } = input;

  const rows: string[][] = [];
  const push = (cells: (string | number)[]) =>
    rows.push(cells.map((c) => escapeCsvCell(String(c))));

  push(["Practice Prodigy — Reports export"]);
  push(["Range", REPORTS_RANGE_LABELS[range]]);
  push([
    "Generated",
    new Date(generatedAt).toISOString(),
  ]);
  push([]);

  // Daily totals
  push(["[Daily totals]"]);
  push(["date", "minutes"]);
  const byDay = secondsByDay(sessions);
  const dayKeys = Object.keys(byDay).sort();
  for (const k of dayKeys) push([k, secToMinRound(byDay[k])]);
  if (dayKeys.length === 0) push(["(no practice in range)"]);
  push([]);

  const totalSec = Object.values(byDay).reduce((s, n) => s + n, 0);

  // By category
  push(["[By category]"]);
  push(["category", "minutes", "percent"]);
  const byCat = secondsByCategory(sessions);
  const catEntries = Object.entries(byCat)
    .map(([catId, seconds]) => ({ catId, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
  for (const e of catEntries) {
    const meta = resolveCategoryMeta(e.catId, customCategories);
    push([
      meta?.label ?? e.catId,
      secToMinRound(e.seconds),
      pctRound(e.seconds, totalSec),
    ]);
  }
  if (catEntries.length === 0) push(["(no practice in range)"]);
  push([]);

  // By methodology
  push(["[By methodology]"]);
  push(["methodology", "minutes", "percent"]);
  const byMethod = secondsByMethodology(sessions, routines);
  const methodEntries = Object.entries(byMethod)
    .map(([key, seconds]) => ({ key, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
  for (const e of methodEntries) {
    const label =
      e.key === NO_METHODOLOGY_KEY
        ? "Unattributed"
        : getMethodology(e.key)?.name ?? e.key;
    push([label, secToMinRound(e.seconds), pctRound(e.seconds, totalSec)]);
  }
  if (methodEntries.length === 0) push(["(no practice in range)"]);
  push([]);

  // By module
  push(["[By module]"]);
  push(["module", "minutes", "percent"]);
  const byMod = secondsByModule(sessions);
  const modEntries = Object.entries(byMod)
    .map(([mod, seconds]) => ({ mod, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
  for (const e of modEntries) {
    const label =
      PRACTICE_MODULE_LABELS[e.mod as keyof typeof PRACTICE_MODULE_LABELS] ??
      e.mod;
    push([label, secToMinRound(e.seconds), pctRound(e.seconds, totalSec)]);
  }
  if (modEntries.length === 0) push(["(no practice in range)"]);

  return rows.map((r) => r.join(",")).join("\r\n") + "\r\n";
}

/**
 * Trigger a browser download of the given CSV string. Uses a Blob
 * URL + auto-clicked <a download> — the standard technique for
 * "save this dynamic content locally" without a server round-trip.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Free the ObjectURL on the next tick to avoid leaking blobs
  // when the user exports many times in a session.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** RFC-4180 CSV escaping — quote when the cell contains a comma, quote, or newline. */
function escapeCsvCell(s: string): string {
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function secToMinRound(sec: number): number {
  return Math.round(sec / 60);
}

function pctRound(sec: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((sec / total) * 100)}%`;
}

/**
 * Build a filename for the CSV. Format:
 *
 *   practice-prodigy-reports-YYYY-MM-DD-<range>.csv
 *
 * Uses local date so the file's timestamp lines up with the day the
 * user saw the report.
 */
export function buildCsvFilename(
  range: ReportsRange,
  now: number = Date.now(),
): string {
  return `practice-prodigy-reports-${localDayKey(now)}-${range}.csv`;
}
