import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Supabase server client — for use in Server Components, Route
 * Handlers, and Server Actions.
 *
 * Reads/writes the session cookie so SSR renders reflect the signed-in
 * user. Follows the official Supabase Next.js App Router pattern
 * (https://supabase.com/docs/guides/auth/server-side/nextjs).
 *
 * Slice A.1 — used later in the auth callback route + any server
 * endpoint that needs to know the current user. Never uses the
 * service_role key here; that's for the admin client only (§4 below).
 *
 * Usage inside a Server Component / Route Handler:
 *
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component
            // (not from a Route Handler / Server Action). This is
            // ignorable — the session refresh middleware handles it.
          }
        },
      },
    },
  );
}

/**
 * Admin client — server-only. Uses SUPABASE_SECRET_KEY (formerly named
 * SUPABASE_SERVICE_ROLE_KEY), which bypasses Row-Level Security. USE
 * WITH CARE. Only call from server code that has already authenticated
 * + authorized the request; never expose this client's methods through
 * user-controlled API surfaces without careful gating.
 *
 * Slice A follow-ups (migrations, seed data, admin ops) can import
 * this without re-plumbing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "createAdminClient requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }
  return createServerClient<Database>(url, key, {
    cookies: {
      // Admin client doesn't need cookies — it's not user-scoped.
      getAll: () => [],
      setAll: () => {},
    },
  });
}
