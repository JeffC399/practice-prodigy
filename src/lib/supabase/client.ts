"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Supabase browser client — for use in Client Components + hooks.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * at build time (Vercel inlines these). Never uses the secret key
 * client-side; only server code should ever touch that.
 *
 * Key naming (updated Phase 83): Supabase migrated from JWT-format keys
 * (anon / service_role) to sb_publishable_… / sb_secret_… format. Both
 * env vars accept either format transparently — the string is passed
 * through to Supabase's HTTP layer unchanged. New projects have legacy
 * keys auto-disabled after ~90 days of inactivity.
 *
 * Slice A.1 (Phase 78) — first Supabase wiring for the platform.
 * See ROUTINE-DESIGN.md §13 for the full cloud-sync architecture.
 *
 * Usage:
 *   const supabase = createClient();
 *   const { data, error } = await supabase.auth.getUser();
 *
 * The `Database` generic type comes from `database.types.ts` (regenerated
 * by `supabase gen types typescript --project-id <ref>` whenever schema
 * changes).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
