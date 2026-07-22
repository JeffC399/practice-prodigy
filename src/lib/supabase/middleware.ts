import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

/**
 * Supabase session-refresh middleware helper.
 *
 * Called by the root `src/middleware.ts` on every request that matches
 * its config. Refreshes the Supabase auth session cookie so tokens
 * don't expire mid-navigation. Also lets Server Components read a
 * fresh session via `createClient()` in `server.ts`.
 *
 * Per Supabase's official Next.js App Router pattern. Do NOT run
 * business logic here — this file's job is session bookkeeping only.
 * See https://supabase.com/docs/guides/auth/server-side/nextjs.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: `getUser()` refreshes the session token. Do not remove
  // this call — omitting it will cause the session to become stale.
  await supabase.auth.getUser();

  return supabaseResponse;
}
