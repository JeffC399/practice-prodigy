"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * First-visit onboarding welcome card.
 *
 * Shared across setup pages (Arpeggios /practice, Key Sequencer
 * /practice/keys) so every module gets the same look-and-feel with
 * module-specific copy. Phase 61 extracted this from the Arpeggios
 * setup page's inline block after we needed a second module-specific
 * version for Key Sequencer.
 *
 * Behavior:
 *   • Renders nothing when `visible` is false (caller controls the
 *     visibility gate — usually a `hasSeen*` boolean in user-prefs).
 *   • X in the top-right and a "Got it" button at the bottom both
 *     fire `onDismiss`. The caller wires that to a store action so
 *     the dismissal persists.
 *
 * The `bullets` prop takes a `{ heading, body }` list; each bullet
 * renders with a numbered primary-tint prefix. Copy is a ReactNode
 * so callers can inline strong / kbd / links freely.
 */
export type OnboardingBullet = {
  /** Bold-lead label — the "what to try" part in strong text. */
  heading: ReactNode;
  /** Rest of the sentence — the "so you can X" explanation. */
  body?: ReactNode;
};

export function OnboardingCard({
  visible,
  title,
  intro,
  bullets,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  intro: ReactNode;
  bullets: OnboardingBullet[];
  onDismiss: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="relative rounded-lg border border-primary/40 bg-primary/5 px-5 py-4">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        aria-label="Dismiss welcome message"
      >
        <X className="h-4 w-4" />
      </button>
      <h3 className="text-sm font-semibold text-primary pr-8">{title}</h3>
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
        {intro}
      </p>
      <ol className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono text-primary shrink-0">{i + 1}.</span>
            <span>
              <span className="font-medium text-foreground">{b.heading}</span>
              {b.body ? <> {b.body}</> : null}
            </span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
      >
        Got it
      </button>
    </div>
  );
}
