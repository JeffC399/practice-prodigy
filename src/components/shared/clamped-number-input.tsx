"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

/**
 * Numeric input with visible ChevronUp / ChevronDown increment buttons,
 * min/max clamping, and keyboard arrow-key support.
 *
 * Extracted from the Arpeggios setup page (Phase 50) so both drilling
 * modules can share the same number-entry UX — no more relying on
 * native number-input up/down arrows that are visually invisible on
 * dark themes.
 *
 * Behavior:
 *   • Free-typing while focused so users can clear the field and
 *     enter a new value cleanly (draft state).
 *   • On blur / Enter, clamps to [min, max] and commits.
 *   • Chevron buttons on the right side step by ±1.
 *   • ArrowUp / ArrowDown while focused also step.
 *   • Buttons carry tabIndex={-1} so tab order stays clean.
 */
export function ClampedNumberInput({
  id,
  value,
  min,
  max,
  onChange,
  className,
  ariaLabel,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const display = focused && draft !== null ? draft : String(value);

  const step = (delta: number) => {
    const next = Math.max(min, Math.min(max, value + delta));
    if (next !== value) onChange(next);
  };

  return (
    <div
      className={`relative flex items-stretch rounded-md border border-border bg-background focus-within:border-primary transition-colors ${className ?? ""}`}
    >
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={display}
        aria-label={ariaLabel}
        onFocus={() => {
          setFocused(true);
          setDraft(String(value));
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, "");
          setDraft(v);
          const n = Number(v);
          if (v !== "" && !isNaN(n) && n >= min && n <= max) {
            onChange(n);
          }
        }}
        onBlur={() => {
          setFocused(false);
          if (draft === null) return;
          const n = Number(draft);
          const clamped =
            draft !== "" && !isNaN(n)
              ? Math.max(min, Math.min(max, n))
              : min;
          onChange(clamped);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp") {
            e.preventDefault();
            step(1);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            step(-1);
          }
        }}
        className="flex-1 min-w-0 rounded-l-md bg-transparent px-3 py-2 font-mono text-sm tabular-nums focus:outline-none"
      />
      <div className="flex flex-col border-l border-border">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => step(1)}
          disabled={value >= max}
          aria-label={`Increase ${ariaLabel ?? "value"} by 1`}
          className="flex h-1/2 w-6 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUp className="h-3 w-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => step(-1)}
          disabled={value <= min}
          aria-label={`Decrease ${ariaLabel ?? "value"} by 1`}
          className="flex h-1/2 w-6 items-center justify-center border-t border-border text-muted-foreground hover:text-foreground hover:bg-background/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
