/**
 * Feature-flag helpers.
 *
 * v1 flags are simple boolean env vars read at build time via
 * `process.env.NEXT_PUBLIC_*`. This keeps the mechanism dead-simple
 * during the pre-cloud-sync era of the app. When cloud sync + user
 * accounts land (My Practice Slice A), we can layer per-user flags
 * on top without changing this API — call sites will keep working.
 *
 * Convention:
 *   - All flags start with `NEXT_PUBLIC_` so they're inlined at build
 *     time and safe to read in the browser.
 *   - The absence of a flag env var means "off" — a fresh install with
 *     no vars set has every gated feature disabled.
 *   - Flags default to the same value across all environments unless
 *     explicitly overridden in Vercel Project Settings → Environment
 *     Variables.
 */

/**
 * My Practice flagship module. Gates the /my-practice route + the
 * module-switcher entry + the header session/streak chip. Ships
 * default-off until Slice A is ready to dogfood.
 *
 * Set `NEXT_PUBLIC_MY_PRACTICE_ENABLED=true` in Vercel to turn on.
 * Preview + development builds should typically have this on so
 * work-in-progress is visible; production off until GA.
 */
export function isMyPracticeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MY_PRACTICE_ENABLED === "true";
}
