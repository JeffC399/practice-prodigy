"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Supabase browser client — for use in Client Components + hooks.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY at
 * build time (Vercel inlines these). Never uses the service_role key
 * client-side; only server code should ever touch that.
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
 * changes). For A.1 the type is a placeholder — Slice A migrations will
 * fill it in.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
