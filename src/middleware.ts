import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js root middleware.
 *
 * Runs before every matching request. Slice A.1 (Phase 78) — only
 * responsibility is Supabase session refresh; if Slice A follow-ups
 * need other middleware behavior (redirects, geolocation, etc.) they
 * layer on here.
 *
 * See https://nextjs.org/docs/app/building-your-application/routing/middleware
 * and https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     *   - _next/static (static files)
     *   - _next/image (image optimization)
     *   - favicon.ico
     *   - Static assets in /public that end in image/font extensions
     *
     * Do NOT exclude /auth/* — those routes need session refresh too.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)",
  ],
};
