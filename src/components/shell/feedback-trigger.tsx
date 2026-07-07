"use client";

import { Bug, Lightbulb, Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BUILD_SHA, BUILD_SHA_SHORT } from "@/lib/build-info";

/**
 * Feedback affordance — footer pill that opens a modal with two CTAs:
 * email (mailto: with pre-filled subject + body including the current
 * URL and build SHA) and GitHub (link to a new-issue URL with a bug
 * template applied).
 *
 * Two-CTA design covers the spectrum:
 *  - Email: casual / one-line feedback, no GitHub account needed,
 *    works for anyone with a mail client. Best for non-technical
 *    testers and for "I just noticed X" comments.
 *  - GitHub: structured bug reports with reproduction steps for the
 *    technically-inclined. Public visibility means the report joins
 *    the project's tracked work.
 *
 * Zero infra: both paths open external apps / URLs. No backend
 * dependency. Replaceable later (Phase 9 or v1.1) with a custom form
 * + Supabase / Resend pipeline once accounts exist.
 */

const FEEDBACK_EMAIL = "jtcampbell399@gmail.com";
const GITHUB_REPO = "JeffC399/practice-prodigy";

export function FeedbackTrigger() {
  const [open, setOpen] = useState(false);

  // Esc closes the modal — same behavior as native dialogs.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Phase 34.7.1 — Kill every browser default that could shift
          the button's baseline off the surrounding <a> links: border,
          appearance, padding, extra font metrics. `inline-flex h-4
          items-center` matches the anchor sibling boxes exactly so
          all four footer items align on the same y-coordinate. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-4 items-center border-0 p-0 leading-none font-mono text-[11px] bg-transparent appearance-none hover:text-foreground transition-colors"
        aria-label="Send feedback"
      >
        feedback
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  // Capture the current URL + build SHA so reports tie to specific
  // deploys / surfaces. Computed in the modal body so it reflects
  // wherever the user clicked Feedback from.
  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "/";

  const emailBody = [
    "Tell us what you noticed — bug, idea, anything.",
    "",
    "",
    "---",
    `Build: ${BUILD_SHA}`,
    `Page: ${currentUrl}`,
    `User-Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "unknown"}`,
  ].join("\n");

  const emailHref = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    "Practice Prodigy feedback",
  )}&body=${encodeURIComponent(emailBody)}`;

  const githubBugTitle = encodeURIComponent("Bug: ");
  const githubBugBody = encodeURIComponent(
    [
      "**What happened**",
      "",
      "**What I expected**",
      "",
      "**Steps to reproduce**",
      "1. ",
      "2. ",
      "3. ",
      "",
      "---",
      `Build: \`${BUILD_SHA_SHORT}\``,
      `Page: ${currentUrl}`,
    ].join("\n"),
  );
  const githubBugHref = `https://github.com/${GITHUB_REPO}/issues/new?title=${githubBugTitle}&body=${githubBugBody}&labels=bug`;

  const githubIdeaTitle = encodeURIComponent("Idea: ");
  const githubIdeaBody = encodeURIComponent(
    [
      "**The idea**",
      "",
      "**Why it would help**",
      "",
      "**Where it would live**",
      "",
      "---",
      `Build: \`${BUILD_SHA_SHORT}\``,
      `Page: ${currentUrl}`,
    ].join("\n"),
  );
  const githubIdeaHref = `https://github.com/${GITHUB_REPO}/issues/new?title=${githubIdeaTitle}&body=${githubIdeaBody}&labels=enhancement`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="feedback-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              Send feedback
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Hit a bug or have an idea? Pick the channel that fits.
              Both paths pre-fill the build version and current page
              so we can trace what you saw.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close feedback"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <FeedbackOption
            href={emailHref}
            icon={Mail}
            title="Email a quick note"
            description="Opens your default email client. Best for casual feedback, no account needed."
            onSelect={onClose}
          />
          <FeedbackOption
            href={githubBugHref}
            icon={Bug}
            title="File a bug on GitHub"
            description="Structured report with reproduction steps. Requires a GitHub account."
            onSelect={onClose}
            external
          />
          <FeedbackOption
            href={githubIdeaHref}
            icon={Lightbulb}
            title="Suggest an idea on GitHub"
            description="Feature request or improvement. Requires a GitHub account."
            onSelect={onClose}
            external
          />
        </div>

        <p className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">
          Build: {BUILD_SHA_SHORT} · {currentUrl}
        </p>
      </div>
    </div>
  );
}

function FeedbackOption({
  href,
  icon: Icon,
  title,
  description,
  onSelect,
  external,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  onSelect: () => void;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      onClick={onSelect}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-3 hover:border-primary/40 hover:bg-background/60 transition-colors"
    >
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
        aria-hidden={true}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </span>
      </div>
    </a>
  );
}
