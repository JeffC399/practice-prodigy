import Link from "next/link";
import { AlertCircle } from "lucide-react";

/**
 * Auth error landing page — Slice A.2 (Phase 80).
 *
 * Reached when the magic-link callback (src/app/auth/callback/route.ts)
 * fails to exchange the code for a session. Common causes:
 *   • Link expired (Supabase default lifetime = 1 hour)
 *   • Link already used (magic links are single-use)
 *   • Code missing / malformed
 *   • Supabase auth service transient error
 *
 * The page shows the specific error message when the callback route
 * passes one along in `?message=...`. Otherwise it shows a generic
 * message. Either way it offers a way back to the app.
 */
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const errorText = message
    ? decodeURIComponent(message)
    : "Something went wrong signing you in.";

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center px-6 py-16"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-rose-500"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-foreground">
              Sign-in didn&rsquo;t work
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {errorText}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-xs text-muted-foreground/80">
          <p>
            Magic links expire after about an hour and can only be used
            once. If you clicked an old link, request a fresh one from
            the sign-in dialog.
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Back to app
          </Link>
        </div>
      </div>
    </main>
  );
}
