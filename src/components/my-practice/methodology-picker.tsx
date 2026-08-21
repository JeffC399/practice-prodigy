"use client";

import {
  BUILTIN_METHODOLOGIES,
  getMethodology,
  getPerItemMethodologies,
  getPerRoutineMethodologies,
  type MethodologyEntry,
} from "@/lib/practice/methodologies";
import type { MethodologyId } from "@/lib/practice/routine-types";

/**
 * MethodologyPicker — Slice B.13 (Phase 113).
 *
 * Tiny dropdown for choosing a methodology on a RoutineItem or a
 * Routine. Uses a native `<select>` for now — it's a short list (8
 * entries), needs no search, and matches the visual weight of the
 * neighbouring category / minutes controls in the composer. When the
 * methodology library ships in Slice E we can upgrade to a richer
 * popover with descriptions + "learn more" links.
 *
 * ## Scope filter
 *
 * `scope="per-item"` shows the 5 item-level methodologies + the 1
 * "either" one (Deliberate Practice). `scope="per-routine"` shows the
 * 3 routine-level methodologies + Deliberate Practice. Callers can
 * omit the prop to show all 8 (used by the debug / all-methodologies
 * library once Slice E lands).
 *
 * ## Empty value
 *
 * Undefined = "no methodology chosen." The dropdown renders this as
 * "— None" at the top so users always have a way to clear the field.
 */
export function MethodologyPicker({
  value,
  onChange,
  scope,
  label = "Methodology",
  hint,
  id,
}: {
  value: MethodologyId | undefined;
  onChange: (next: MethodologyId | undefined) => void;
  scope?: "per-item" | "per-routine";
  label?: string;
  hint?: string;
  id?: string;
}) {
  const entries: MethodologyEntry[] =
    scope === "per-item"
      ? getPerItemMethodologies()
      : scope === "per-routine"
        ? getPerRoutineMethodologies()
        : BUILTIN_METHODOLOGIES;

  // Show whatever's currently picked, even if it's outside `scope` —
  // otherwise an item pre-populated with a stale choice would silently
  // reset on the first render. The user can then pick something in-scope.
  const currentEntry = getMethodology(value);
  const showOutOfScope =
    currentEntry !== null && !entries.some((e) => e.id === currentEntry.id);

  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        title={currentEntry?.summary}
      >
        <option value="">&mdash; None</option>
        {showOutOfScope && currentEntry && (
          <option value={currentEntry.id}>
            {currentEntry.name} (out of scope)
          </option>
        )}
        {entries.map((m) => (
          <option key={m.id} value={m.id} title={m.summary}>
            {m.name}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-muted-foreground/70">
        {hint ??
          (currentEntry?.summary ??
            "Optional. How you'll approach this activity.")}
      </span>
    </label>
  );
}
