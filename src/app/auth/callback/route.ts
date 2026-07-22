import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link callback handler.
 *
 * Supabase's Auth service mails a confirmation link to
 * `/auth/callback?code=<token>&next=<optional-redirect>`. This route
 * exchanges that code for a session cookie, then redirects the user
 * to the `next` path (or `/` if omitted).
 *
 * Slice A.1 (Phase 78) — magic-link only. Slice G adds OAuth
 * providers (Google + Apple) which hit this same endpoint with a
 * `code` param sourced from the provider's OAuth response. The
 * exchange call handles both cases uniformly.
 *
 * Errors bounce to `/auth/error?message=...` (a Slice A.2 surface —
 * for now the route just logs + redirects home).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=missing-code`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/error?message=${encodeURIComponent(error.message)}`,
    );
  }

  // Success: land the user wherever they were headed.
  const safeNext = next.startsWith("/") ? next : "/";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
