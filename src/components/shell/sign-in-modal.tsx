"use client";

import { Loader2, Mail, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signInWithMagicLink } from "@/lib/supabase/auth";

/**
 * Sign-in modal — Slice A.2 (Phase 80).
 *
 * Magic-link only in v1. Google + Apple OAuth land in Slice G.
 *
 * States:
 *   • idle      — email input + Send button.
 *   • sending   — button spins; input disabled.
 *   • sent      — "Check your inbox" success state; option to send again.
 *   • error     — shows the Supabase error message; user can retry.
 *
 * The modal dismisses on:
 *   • Clicking the X button
 *   • Pressing Escape
 *   • Clicking outside the card (overlay click)
 */
export function SignInModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus the email input on open.
  useEffect(() => {
    if (open) {
      // Defer one tick so the input has actually mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      // Reset state whenever the modal closes.
      setEmail("");
      setStatus("idle");
      setErrorMsg(null);
    }
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setErrorMsg(null);
    const result = await signInWithMagicLink(email.trim(), {
      redirectTo: window.location.pathname,
    });
    if (result.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setErrorMsg(result.error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mt-16 flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="sign-in-title"
              className="text-lg font-semibold text-foreground"
            >
              Sign in to sync
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              We&rsquo;ll email you a magic link. No password. One tap in
              your inbox and you&rsquo;re in.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign-in"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {status === "sent" ? (
          <div className="flex flex-col gap-3 rounded-md border border-primary/40 bg-primary/5 px-4 py-4">
            <div className="flex items-center gap-2 text-primary">
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">Check your inbox</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We sent a magic link to <strong>{email}</strong>. Open the
              email and tap the link to finish signing in. You can close
              this window &mdash; the sign-in will complete when you
              click the link.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setErrorMsg(null);
              }}
              className="mt-1 self-start text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                Email
              </span>
              <input
                ref={inputRef}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "sending"}
                placeholder="you@example.com"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-60"
              />
            </label>
            {status === "error" && errorMsg && (
              <p
                className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-500"
                role="alert"
              >
                {errorMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={status === "sending" || !email.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "sending" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Sending&hellip;
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Send magic link
                </>
              )}
            </button>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Signing in enables cross-device sync for your drills,
              sheets, and preferences. You can keep using the app without
              an account &mdash; everything works local-only until you
              sign in.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
