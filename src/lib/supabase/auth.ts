"use client";

import { createClient } from "./client";

/**
 * Auth helpers — thin wrappers around Supabase's auth methods so the
 * rest of the app has one place to import from.
 *
 * Slice A.1 (Phase 78) — ships magic-link sign-in + sign-out + a
 * lightweight `getUser()` for use in Client Components. Google + Apple
 * OAuth land in Slice G; the shape here already accommodates them.
 *
 * Design decisions:
 * - Magic-link sign-in: no password. User enters email; Supabase mails
 *   a link with a token. Clicking the link hits our `/auth/callback`
 *   route which exchanges the token for a session.
 * - `getUser()` is preferred over `getSession()` — it revalidates the
 *   session against the Supabase server (session cookies can be
 *   forged; user records cannot).
 * - Errors are returned, not thrown. Callers surface them to the user
 *   through the sign-in UI (Slice A.2).
 */

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Send a magic-link email to `email`. Supabase's Auth service mails
 * a confirmation link that redirects to `/auth/callback?code=...`
 * once clicked. That callback handler exchanges the code for a
 * session and lands the user on the app.
 */
export async function signInWithMagicLink(
  email: string,
  options?: { redirectTo?: string },
): Promise<AuthResult> {
  const supabase = createClient();
  const emailRedirectTo = options?.redirectTo
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        options.redirectTo,
      )}`
    : `${window.location.origin}/auth/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      // Create the user if they don't exist yet. First sign-in doubles
      // as sign-up — same UX Supabase's docs recommend.
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Sign out. Clears the local session + tells Supabase to invalidate.
 */
export async function signOut(): Promise<AuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Get the currently signed-in user (or null if not signed in).
 * Revalidates against the Supabase server; safer than `getSession()`.
 * Callers should generally use this via a React hook (Slice A.2) so
 * the UI reacts to sign-in / sign-out events.
 */
export async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
