"use client";

import { CheckCircle2, CloudUpload, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getLocalCounts, pushAll } from "@/lib/sync/sync-registry";
import { useUser } from "@/lib/supabase/use-user";

/**
 * Migration prompt — Slice A.4 (Phase 82).
 *
 * Auto-appears once per (user × device) the first time a user signs
 * in on this device, IF they have existing local data to migrate.
 * Dismissal is remembered in localStorage keyed by user id, so the
 * prompt never re-appears for the same user on this device.
 *
 * Flow:
 *   1. User signs in for the first time on this device.
 *   2. This component checks: (a) is this user's key marked as
 *      "prompt shown"? (b) does this device have any local entities
 *      via `getLocalCounts()`?
 *   3. If (a) is unset AND (b) returns non-empty → show the modal
 *      with a per-store list ("12 drills · 3 lead sheets · settings").
 *   4. User picks: **Migrate** → calls `pushAll()` from the registry,
 *      which pushes all local entities to Supabase. **Keep local
 *      only** → dismisses without pushing.
 *   5. Either way, the "prompt shown" flag is set so we don't ask
 *      again for this user on this device.
 *
 * Slice A.4 ships the modal + detection + dismissal logic. Slice
 * A.5 registers the adapters that make `getLocalCounts()` return
 * real data. Between A.4 and A.5 the prompt is inert (no adapters
 * → no counts → no prompt).
 */

const SHOWN_STORAGE_PREFIX = "pp-migration-offered:";

function storageKey(userId: string): string {
  return `${SHOWN_STORAGE_PREFIX}${userId}`;
}

function hasBeenOffered(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return true; // If storage is inaccessible, don't show (fail safe).
  }
}

function markOffered(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), "1");
  } catch {
    // Ignore — user can dismiss again on next visit; harmless.
  }
}

export function MigrationPrompt() {
  const { user, loading } = useUser();
  const [status, setStatus] = useState<"hidden" | "shown" | "migrating" | "done">(
    "hidden",
  );
  const [counts, setCounts] = useState<Array<{ label: string; count: number }>>(
    [],
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Decide once auth state is settled whether to show the prompt.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Signed out — never show. Reset in case the user just signed out.
      setStatus("hidden");
      return;
    }
    if (hasBeenOffered(user.id)) {
      setStatus("hidden");
      return;
    }
    // Give registered adapters a moment to hydrate their Zustand
    // stores from localStorage before we count. One microtask is
    // usually enough; a small setTimeout is safer.
    const t = setTimeout(() => {
      const c = getLocalCounts();
      if (c.length === 0) {
        // Nothing to migrate. Mark as offered so we don't check
        // again on every route change.
        markOffered(user.id);
        setStatus("hidden");
        return;
      }
      setCounts(c);
      setStatus("shown");
    }, 250);
    return () => clearTimeout(t);
  }, [user, loading]);

  if (status === "hidden") return null;

  const handleMigrate = async () => {
    if (!user) return;
    setStatus("migrating");
    setErrorMsg(null);
    try {
      await pushAll();
      markOffered(user.id);
      setStatus("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed.";
      setErrorMsg(msg);
      setStatus("shown");
    }
  };

  const handleKeepLocal = () => {
    if (user) markOffered(user.id);
    setStatus("hidden");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="migration-title"
    >
      <div className="mt-16 flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CloudUpload
              className="h-5 w-5 text-primary"
              aria-hidden="true"
            />
            <h2
              id="migration-title"
              className="text-lg font-semibold text-foreground"
            >
              Migrate your data?
            </h2>
          </div>
          {status !== "migrating" && (
            <button
              type="button"
              onClick={handleKeepLocal}
              aria-label="Keep local only"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {status === "done" ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-6 text-center">
            <CheckCircle2
              className="h-8 w-8 text-emerald-500"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                Your data is now synced
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You can access it on any device you sign in from.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStatus("hidden")}
              className="mt-1 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We found data saved to this device. Want to sync it to
              your account so you can access it on other devices?
            </p>
            <ul className="flex flex-col divide-y divide-border/50 rounded-md border border-border/60 bg-background/40">
              {counts.map(({ label, count }) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="text-foreground">{label}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
            {errorMsg && (
              <p
                className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-500"
                role="alert"
              >
                {errorMsg}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Your local copy stays on this device either way. Syncing
              copies it up to your account &mdash; it doesn&rsquo;t
              move anything.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleKeepLocal}
                disabled={status === "migrating"}
                className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                Keep local only
              </button>
              <button
                type="button"
                onClick={handleMigrate}
                disabled={status === "migrating"}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "migrating" ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Syncing&hellip;
                  </>
                ) : (
                  <>
                    <CloudUpload className="h-4 w-4" aria-hidden="true" />
                    Sync to my account
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
