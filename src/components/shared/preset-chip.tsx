"use client";

/**
 * Small pill button used above checkbox / toggle grids to apply a
 * musically meaningful subset in one click. Consistent look across
 * the Scale Driller pool builder (Phase 66) and the Key Sequencer
 * key pool (Phase 67) so both modules feel like siblings.
 *
 * Two variants:
 *   • default (primary tint) — "All", "Church modes", etc.
 *   • muted — "None" / clear-like actions. Less visually loud so
 *     the primary presets read as the main path.
 */
export function PresetChip({
  label,
  onClick,
  muted,
  title,
}: {
  label: string;
  onClick: () => void;
  muted?: boolean;
  /** Optional native tooltip for keyboard / touch discovery. */
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors ${
        muted
          ? "border-border/60 bg-transparent text-muted-foreground/70 hover:border-border hover:text-foreground"
          : "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
      }`}
    >
      {label}
    </button>
  );
}
