"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createClient } from "./client";

/**
 * `useUser` — React hook that subscribes to Supabase auth state.
 *
 * Slice A.2 (Phase 80). Returns the current user or null, plus a
 * `loading` flag that stays true until the initial `getUser()` call
 * resolves. Consumers should render skeleton state during `loading`
 * so the UI doesn't flash "Sign in" for a signed-in user before the
 * auth check completes.
 *
 * Behavior:
 *   • Calls `getUser()` on mount to hydrate initial state.
 *   • Subscribes to `onAuthStateChange` so sign-in / sign-out / token
 *     refresh events update the state reactively.
 *   • Cleans up the subscription on unmount.
 *
 * Usage:
 *   const { user, loading } = useUser();
 *   if (loading) return <SkeletonChip />;
 *   return user ? <SignedInChip user={user} /> : <SignInChip />;
 *
 * Prefer `getUser()` semantics (revalidates against Supabase) over
 * `getSession()` (reads local storage; can be forged). This hook
 * uses the safer path.
 */
export function useUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Hydrate initial state.
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setLoading(false);
      });

    // Subscribe to auth changes (sign-in / sign-out / token refresh).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
