"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  Clock,
  FolderTree,
  ListChecks,
  Music,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  listMethodologyTemplates,
  templateToRoutineItems,
  type MethodologyTemplate,
} from "@/lib/practice/methodology-library";
import { useRoutinesLibrary } from "@/lib/practice/routines-library";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * MyPracticeOnboardingWizard — Slice G.1 (Phase 159).
 *
 * Three-step first-visit wizard for /my-practice. Opens automatically
 * on the first visit (guarded by `hasSeenMyPracticeOnboarding` pref)
 * and never again once dismissed. Every step is skippable — the whole
 * modal has a persistent Skip link + X button so users who want to
 * self-explore can bail immediately.
 *
 * ## Steps
 *
 *   1. Welcome — what My Practice is + 4 bullet capabilities
 *   2. Try a template — pick from 4 curated starter methodologies
 *      (matches the plan's "try starter routine" step). Selecting
 *      creates a real routine + jumps to the builder on the last
 *      Next click.
 *   3. What's next — brief pointer at the 6 tabs + AI Coach
 *
 * Profile-depth step is deferred until the Profile tab ships — the
 * plan's Step 2 targets Standard-vs-Deep fields that don't exist
 * yet. When Profile lands (Slice E/F polish), the wizard can slot
 * a step in between 1 and 2.
 */

const FEATURED_TEMPLATE_IDS = [
  "slow-practice-30min",
  "chunking-repertoire-45min",
  "pomodoro-25-5-cycles",
  "interleaved-practice-60min",
] as const;

type WizardProps = {
  /** When set, the wizard hydrates + shows. The parent decides when. */
  open: boolean;
  onClose: () => void;
  /**
   * Called when the user picks a template to try. Parent creates the
   * routine + navigates to the builder. Kept as a prop so navigation
   * lives outside this component (avoids useRouter here).
   */
  onTryTemplate: (template: MethodologyTemplate) => void;
};

export function MyPracticeOnboardingWizard({
  open,
  onClose,
  onTryTemplate,
}: WizardProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  const templates = useMemo(() => {
    const all = listMethodologyTemplates();
    const featured = FEATURED_TEMPLATE_IDS.map((id) =>
      all.find((t) => t.id === id),
    ).filter((t): t is MethodologyTemplate => t !== undefined);
    return featured;
  }, []);

  if (!open) return null;

  const selectedTemplate =
    templates.find((t) => t.id === selectedTemplateId) ?? null;

  const next = () => {
    if (step === 2) {
      // Final step: launch the template if picked, then close.
      if (selectedTemplate) {
        onTryTemplate(selectedTemplate);
      }
      onClose();
      return;
    }
    setStep((s) => (s + 1) as 0 | 1 | 2);
  };

  const prev = () => {
    if (step === 0) return;
    setStep((s) => (s - 1) as 0 | 1 | 2);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-practice-onboarding-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col gap-4 overflow-hidden rounded-lg border-2 border-primary/40 bg-background shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-0.5">
              <span
                id="my-practice-onboarding-title"
                className="font-mono text-[10px] uppercase tracking-wider text-primary"
              >
                Welcome to My Practice
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Step {step + 1} of 3
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close onboarding"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {step === 0 && <WelcomeStep />}
          {step === 1 && (
            <TryTemplateStep
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
            />
          )}
          {step === 2 && (
            <WhatsNextStep hasSelectedTemplate={!!selectedTemplate} />
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={prev}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {step === 2 ? (
                selectedTemplate ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Load &ldquo;{selectedTemplate.name}&rdquo;
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Get started
                  </>
                )
              ) : (
                <>
                  Next
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function WelcomeStep() {
  const bullets = [
    {
      icon: <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />,
      title: "Build routines",
      body: "String together drills, sheets, custom activities, and rests. Run them end-to-end with a timer + auto-advance.",
    },
    {
      icon: <Music className="h-4 w-4 text-primary" aria-hidden="true" />,
      title: "Track songs",
      body: "The pieces you're learning, polishing, or maintaining. Per-song practice time rolls up automatically.",
    },
    {
      icon: <FolderTree className="h-4 w-4 text-primary" aria-hidden="true" />,
      title: "Organize with collections",
      body: "Group related drills and sheets under a theme (Fretboard, Bebop, Recital) across every module.",
    },
    {
      icon: <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />,
      title: "AI Coach",
      body: "Chat about what to practice today. Get a routine drafted from your library or a methodology suggested per item.",
    },
  ];

  return (
    <div className="flex flex-col gap-3 pt-3">
      <h2 className="text-xl font-semibold text-foreground">
        Your practice-planning hub
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        My Practice turns individual drill sessions into a coherent
        practice life. Everything you do across the app rolls up here:
        Bass Arpeggios, Key Sequencer, Scale Driller, Metronome, Lead
        Sheets.
      </p>
      <ul className="mt-1 flex flex-col gap-2.5">
        {bullets.map((b) => (
          <li
            key={b.title}
            className="flex items-start gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2"
          >
            <span className="mt-0.5 shrink-0">{b.icon}</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {b.title}
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                {b.body}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TryTemplateStep({
  templates,
  selectedTemplateId,
  onSelect,
}: {
  templates: readonly MethodologyTemplate[];
  selectedTemplateId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      <h2 className="text-xl font-semibold text-foreground">
        Try a starter routine
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Pick a methodology to start with. We&rsquo;ll create a real
        routine in your library — you can edit, launch it, or delete
        it later. Skipping is fine too.
      </p>
      <ul className="mt-1 flex flex-col gap-2">
        {templates.map((t) => {
          const active = selectedTemplateId === t.id;
          const mins = Math.round(t.estimatedTotalSeconds / 60);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                aria-pressed={active}
                className={`flex w-full flex-col gap-1 rounded-md border-2 px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-background/40 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t.name}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {mins} min
                  </span>
                </div>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  {t.description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WhatsNextStep({
  hasSelectedTemplate,
}: {
  hasSelectedTemplate: boolean;
}) {
  const tabs = [
    "Routines — build + run routines",
    "Songs — track your repertoire",
    "Collections — cross-module groups",
    "Reports — where your time went",
    "Methodology — 8 practice methods + templates",
    "Profile — proficiency levels (in progress)",
  ];
  return (
    <div className="flex flex-col gap-3 pt-3">
      <h2 className="text-xl font-semibold text-foreground">
        What&rsquo;s next
      </h2>
      {hasSelectedTemplate ? (
        <p className="text-sm text-foreground leading-relaxed">
          When you click <span className="font-medium">Load</span>{" "}
          below, we&rsquo;ll open the routine in the builder so you
          can tweak times or add items before hitting{" "}
          <span className="font-medium">Start</span>.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground leading-relaxed">
          You can always come back to a template — the{" "}
          <span className="font-medium">Methodology</span> tab has all
          eight, each with a full write-up and a &ldquo;Try this
          template&rdquo; button.
        </p>
      )}
      <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <CalendarCheck className="h-3 w-3" aria-hidden="true" />
          The 6 tabs
        </span>
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {tabs.map((t) => (
            <li key={t}>· {t}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground/80 leading-relaxed">
        The <span className="font-medium">AI Coach</span> pill in the
        header opens a chat that knows your library. Ask it for a
        routine, a methodology recommendation, or a check-in.
      </p>
    </div>
  );
}

/**
 * Convenience hook — reads the pref + dismisser. Kept out of the
 * component so the parent can decide when to mount the wizard
 * (typically on first mount of /my-practice).
 */
export function useMyPracticeOnboarding() {
  const seen = useUserPrefs((s) => s.hasSeenMyPracticeOnboarding);
  const dismiss = useUserPrefs((s) => s.dismissMyPracticeOnboarding);
  return { seen, dismiss };
}

/**
 * Convenience — creates a routine from a template + returns the id.
 * Parent uses this in its `onTryTemplate` handler before navigating.
 */
export function createRoutineFromTemplate(
  template: MethodologyTemplate,
): string {
  const items = templateToRoutineItems(template);
  return useRoutinesLibrary.getState().saveRoutine({
    name: template.name,
    notes: template.description,
    items,
    methodologyId: template.methodologyId,
    source: "template",
    sourceRef: template.id,
  });
}
