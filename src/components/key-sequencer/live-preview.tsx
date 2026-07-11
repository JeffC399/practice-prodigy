"use client";

import { useMemo } from "react";
import { keyDisplay } from "@/lib/key-sequencer/display";
import { buildKeySequence } from "@/lib/key-sequencer/sequencer";
import type { KeySequencerConfig } from "@/lib/key-sequencer/types";

/**
 * Live preview of the first ~4 measures of a Key Sequencer drill.
 *
 * Renders a compact horizontal row of measure cards showing what a
 * player would actually see on Now / Next during the drill. Updates
 * on every config change so the user gets immediate feedback while
 * composing prompt rows.
 *
 * A stable seed keeps the random previews from re-rolling on every
 * keystroke — the user sees a consistent sample as they edit.
 */

const PREVIEW_MEASURES = 4;
const PREVIEW_SEED = 42;

export function KeySequencerLivePreview({
  config,
}: {
  config: KeySequencerConfig;
}) {
  const steps = useMemo(
    () =>
      buildKeySequence(config, {
        sessionSeed: PREVIEW_SEED,
        maxMeasures: PREVIEW_MEASURES,
      }),
    [config],
  );

  if (config.keyPool.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Pick at least one key above to see a live preview.
        </p>
      </div>
    );
  }

  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Live preview — first {steps.length}{" "}
          {steps.length === 1 ? "measure" : "measures"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((step, i) => (
          <MeasureCard
            key={i}
            step={step}
            enharmonicPreference={config.enharmonicPreference ?? "auto"}
            contextStrategy={config.keyOrdering}
            promptRowLabels={config.promptRows.map((r) => r.label || "")}
          />
        ))}
      </div>
    </div>
  );
}

function MeasureCard({
  step,
  enharmonicPreference,
  contextStrategy,
  promptRowLabels,
}: {
  step: import("@/lib/key-sequencer/sequencer").KeySequencerStep;
  enharmonicPreference: "auto" | "sharps" | "flats";
  contextStrategy: import("@/lib/state/practice-config").OrderingStrategy;
  promptRowLabels: string[];
}) {
  if (step.isRest) {
    return (
      <div className="flex min-h-[100px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/60 bg-background/20 p-3 text-muted-foreground/60">
        <span className="text-xs font-mono uppercase tracking-wider">
          Rest
        </span>
      </div>
    );
  }
  return (
    <div className="flex min-h-[100px] flex-col gap-1 rounded-md border border-border bg-card/60 p-3">
      <span className="text-2xl font-semibold text-foreground leading-none">
        {step.key
          ? keyDisplay(step.key, enharmonicPreference, contextStrategy)
          : "—"}
      </span>
      {step.rowWords.map((w, i) => (
        <span
          key={i}
          className="truncate text-xs text-muted-foreground"
          title={promptRowLabels[i] ? `${promptRowLabels[i]}: ${w}` : w}
        >
          {w || <span className="opacity-40">—</span>}
        </span>
      ))}
    </div>
  );
}
