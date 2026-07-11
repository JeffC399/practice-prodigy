"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { RELEASE_NOTES } from "@/lib/data/release-notes";
import { useUserPrefs } from "@/lib/state/user-prefs";

/**
 * "What's new" release-notes modal + trigger.
 *
 * Phase 44 — Two behaviors bundled into one component:
 *
 * (1) Auto-open on first mount when the top entry in RELEASE_NOTES
 *     has a different id than the persisted `lastSeenReleaseId`. This
 *     is the "you missed a deploy — here's what changed" flow.
 *     Suppressed when `lastSeenReleaseId` is undefined (first-ever
 *     install) so brand-new users don't get bombarded on their first
 *     visit — the onboarding hint on /practice handles that surface.
 *
 * (2) Manual open via a small "what's new" button in the footer, so
 *     users can revisit the recent-changes list any time.
 *
 * Dismissing (X, backdrop click, Escape, or "Got it") stamps the top
 * entry's id so the modal doesn't reappear until the next release
 * bumps the top of the RELEASE_NOTES array.
 *
 * The modal shows the last 3 entries as a recap so users returning
 * after multiple deploys catch up on what they missed in one glance.
 */

const RECAP_COUNT = 3;

export function WhatsNewTrigger() {
  const lastSeenReleaseId = useUserPrefs((s) => s.lastSeenReleaseId);
  const markReleaseNoteSeen = useUserPrefs((s) => s.markReleaseNoteSeen);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-open on first mount when there's an unseen new release.
  useEffect(() => {
    if (!mounted) return;
    const top = RELEASE_NOTES[0];
    if (!top) return;
    // First-ever install: don't auto-open. The onboarding flow
    // already handles first-run guidance.
    if (lastSeenReleaseId === undefined) {
      markReleaseNoteSeen(top.id);
      return;
    }
    if (lastSeenReleaseId !== top.id) {
      setOpen(true);
    }
  }, [mounted, lastSeenReleaseId, markReleaseNoteSeen]);

  const close = () => {
    const top = RELEASE_NOTES[0];
    if (top) markReleaseNoteSeen(top.id);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="What's new"
        title="What's new"
        className="inline-flex h-4 items-center gap-1 leading-none transition-colors hover:text-foreground"
      >
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        <span>what&rsquo;s new</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="whats-new-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="mt-16 flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="whats-new-title"
                  className="flex items-center gap-2 text-lg font-semibold text-foreground"
                >
                  <Sparkles
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  What&rsquo;s new
                </h2>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Recent updates to Practice Prodigy — the most recent
                  release is at the top.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              {RELEASE_NOTES.slice(0, RECAP_COUNT).map((note) => (
                <article
                  key={note.id}
                  className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 p-4"
                >
                  <header className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {note.headline}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {note.date}
                    </span>
                  </header>
                  <ul className="flex flex-col gap-1.5">
                    {note.bullets.map((b, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/70"
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={close}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
