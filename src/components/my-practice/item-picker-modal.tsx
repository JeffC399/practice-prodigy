"use client";

import { ArrowLeft, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Coffee,
  FileText,
  ListChecks,
  Music,
  Pencil,
  Repeat,
  Rows3,
  Timer,
} from "lucide-react";
import { CustomItemComposer } from "@/components/my-practice/item-composer/custom-item-composer";
import { DrillItemComposer } from "@/components/my-practice/item-composer/drill-item-composer";
import { KeyDrillItemComposer } from "@/components/my-practice/item-composer/key-drill-item-composer";
import { LeadsheetItemComposer } from "@/components/my-practice/item-composer/leadsheet-item-composer";
import { MetronomeItemComposer } from "@/components/my-practice/item-composer/metronome-item-composer";
import { RestItemComposer } from "@/components/my-practice/item-composer/rest-item-composer";
import { ScaleDrillItemComposer } from "@/components/my-practice/item-composer/scale-drill-item-composer";
import {
  ROUTINE_ITEM_TYPE_DESCRIPTIONS,
  ROUTINE_ITEM_TYPE_LABELS,
  type RoutineItem,
  type RoutineItemType,
} from "@/lib/practice/routine-types";

/**
 * ItemPickerModal — Slice B.5 (Phase 105).
 *
 * Two-step modal: pick a type → compose the item → save. Opened
 * from the RoutineBuilder's "+ Add item" button.
 *
 * ## Steps
 *
 *   Step 1 (type-picker): grid of the 8 item types. Types with a
 *   real composer (drill / key-drill / scale-drill in B.5) are
 *   selectable. Types deferred to B.6 (metronome / leadsheet /
 *   custom / rest) or future modules (song / ear-training) are
 *   rendered dimmed with a tooltip naming the slice.
 *
 *   Step 2 (composer): the type-specific composer form. Cancel /
 *   back returns to step 1; Save commits and closes the modal.
 *
 * ## Not shipped in Phase 105
 *
 * - Metronome / leadsheet / custom / rest composers → B.6
 * - Song composer → Slice C
 * - Ear-training composer → future module
 *
 * The modal itself has no external dependency — parents pass an
 * onSubmit that receives the constructed RoutineItem and appends
 * it to the routine's items[].
 */

type Step =
  | { kind: "picker" }
  | { kind: "composer"; type: RoutineItemType };

const TYPE_ICONS: Record<RoutineItemType, LucideIcon> = {
  drill: ListChecks,
  "key-drill": Music,
  "scale-drill": Rows3,
  metronome: Timer,
  leadsheet: FileText,
  song: Music,
  "ear-training": Music,
  custom: Pencil,
  rest: Coffee,
};

/**
 * Types whose composer is live. Extended per slice.
 *   Phase 105 (B.5): drill / key-drill / scale-drill.
 *   Phase 106 (B.6): + metronome / leadsheet / custom / rest.
 *   Slice C: + song.
 *   Future module: + ear-training.
 */
const READY_TYPES: readonly RoutineItemType[] = [
  "drill",
  "key-drill",
  "scale-drill",
  "metronome",
  "leadsheet",
  "custom",
  "rest",
];

const DEFERRED_TOOLTIPS: Partial<Record<RoutineItemType, string>> = {
  song: "Songs library ships in Slice C.",
  "ear-training": "Ear training is a future module.",
};

export function ItemPickerModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (item: RoutineItem) => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "picker" });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Reset to the picker step whenever the modal opens fresh.
  useEffect(() => {
    if (open) setStep({ kind: "picker" });
  }, [open]);

  // Escape closes the modal; click outside the card closes too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleTypeChosen = (type: RoutineItemType) => {
    setStep({ kind: "composer", type });
  };

  const handleBackToPicker = () => setStep({ kind: "picker" });

  const handleSubmit = (item: RoutineItem) => {
    onSubmit(item);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-picker-title"
      onMouseDown={(e) => {
        // Close on backdrop click (mousedown on the outer div only —
        // not on the inner card, so drag-selecting text inside doesn't
        // dismiss).
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className="mt-16 flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {step.kind === "composer" && (
              <button
                type="button"
                onClick={handleBackToPicker}
                aria-label="Back to item type picker"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <h2
              id="item-picker-title"
              className="text-lg font-semibold text-foreground"
            >
              {step.kind === "picker"
                ? "Add an item"
                : `Add ${ROUTINE_ITEM_TYPE_LABELS[step.type].toLowerCase()}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {step.kind === "picker" && (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pick what to add to your routine. Deferred types are
              coming in later slices.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(ROUTINE_ITEM_TYPE_LABELS) as RoutineItemType[])
                // Order per the type union: drilling → metronome →
                // leadsheet → song → ear-training → custom → rest.
                // ROUTINE_ITEM_TYPES from routine-types has the order;
                // we import from labels to reuse the record.
                .sort(
                  (a, b) =>
                    ROUTINE_ITEM_TYPES_ORDER.indexOf(a) -
                    ROUTINE_ITEM_TYPES_ORDER.indexOf(b),
                )
                .map((type) => {
                  const ready = READY_TYPES.includes(type);
                  const Icon = TYPE_ICONS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => ready && handleTypeChosen(type)}
                      disabled={!ready}
                      title={
                        ready
                          ? ROUTINE_ITEM_TYPE_DESCRIPTIONS[type]
                          : DEFERRED_TOOLTIPS[type]
                      }
                      className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors ${
                        ready
                          ? "border-border bg-background/40 hover:border-primary/50 hover:bg-primary/5"
                          : "border-dashed border-border/40 bg-background/20 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className="h-4 w-4 text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-medium text-foreground">
                          {ROUTINE_ITEM_TYPE_LABELS[type]}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        {ROUTINE_ITEM_TYPE_DESCRIPTIONS[type]}
                      </span>
                    </button>
                  );
                })}
            </div>
          </>
        )}

        {step.kind === "composer" && step.type === "drill" && (
          <DrillItemComposer
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        )}
        {step.kind === "composer" && step.type === "key-drill" && (
          <KeyDrillItemComposer
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        )}
        {step.kind === "composer" && step.type === "scale-drill" && (
          <ScaleDrillItemComposer
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        )}
        {step.kind === "composer" && step.type === "metronome" && (
          <MetronomeItemComposer
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        )}
        {step.kind === "composer" && step.type === "leadsheet" && (
          <LeadsheetItemComposer
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        )}
        {step.kind === "composer" && step.type === "custom" && (
          <CustomItemComposer
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        )}
        {step.kind === "composer" && step.type === "rest" && (
          <RestItemComposer
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}

/** Ordered list of all 8 types — matches ROUTINE_ITEM_TYPES from
 * routine-types. Kept as a local constant to avoid an extra import. */
const ROUTINE_ITEM_TYPES_ORDER: readonly RoutineItemType[] = [
  "drill",
  "key-drill",
  "scale-drill",
  "metronome",
  "leadsheet",
  "song",
  "ear-training",
  "custom",
  "rest",
] as const;

// Repeat import unused-warning suppressor. The unused Repeat icon
// slot is intentional; ensuring the icon exists so B.7's drag handle
// (Repeat / GripVertical variant) can drop in without another edit.
void Repeat;
