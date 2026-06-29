/**
 * Build identity — surfaced in the footer and pre-filled into feedback
 * reports so a tester saying "this is broken" can be tied back to the
 * exact deploy that produced the bug.
 *
 * On Vercel: NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is injected automatically
 * at build time, giving us the full 40-char SHA. We display the short
 * 7-char prefix (standard git short form) in the UI and include the
 * full SHA in feedback prefills.
 *
 * Local dev: falls back to "dev" since there's no commit SHA to read.
 */

const RAW_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "";

export const BUILD_SHA: string = RAW_SHA || "dev";

/** First 7 chars of the SHA — the standard git short-hash form. */
export const BUILD_SHA_SHORT: string = RAW_SHA
  ? RAW_SHA.slice(0, 7)
  : "dev";

export const APP_VERSION = "0.1.0-pre";
