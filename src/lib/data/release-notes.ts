/**
 * Release notes shown in the "What's new" modal.
 *
 * Phase 44 — a small, easy-to-update array of user-visible release
 * notes. When the user's `lastSeenReleaseId` is older than the top
 * entry here, the modal auto-opens on first mount. Dismissing
 * stamps the current top entry as seen so it doesn't reappear.
 *
 * Format: newest at the top. `id` is a stable short string used by
 * the "already seen" comparison (semver-like ordering isn't
 * required — we just check "top entry id === lastSeenReleaseId").
 * When multiple releases stack up between visits, the modal only
 * shows the most recent one, but the panel lists the last ~5 as a
 * recap so returning users catch up on what they missed.
 *
 * Update this file when a shipped phase produces a user-visible
 * feature worth announcing. Keep bullets under 12 words each.
 */

export type ReleaseNote = {
  /** Stable id; used for "already seen" comparison. */
  id: string;
  /** Display date. Free-text so we can write "Today" during dev if we want. */
  date: string;
  /** Big headline. */
  headline: string;
  /** 2-4 short user-visible bullets of what changed. */
  bullets: string[];
};

/**
 * Newest at the top. The topmost entry auto-opens the modal for
 * users whose `lastSeenReleaseId` doesn't match.
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    id: "2026-07-11-basic-tier-complete",
    date: "July 11, 2026",
    headline: "Lead Sheet Builder Basic Tier is complete",
    bullets: [
      "Live-rendered thumbnails, hover-reveal actions, and 'Edited N ago' timestamps on the /sheets library",
      "Print now carries page numbers + copyright footer on every printed page",
      "Pickup measures (anacrusis) — jazz standards can now start with partial-bar leads",
      "Full-app keyboard shortcuts: press ? anywhere to open the cheat sheet",
      "Accessibility baseline: keyboard focus rings, skip link, and semantic landmarks",
    ],
  },
  {
    id: "2026-07-07-appearance-overhaul",
    date: "July 7, 2026",
    headline: "Appearance overhaul — mission-control for every visual preference",
    bullets: [
      "8 curated palettes with dark + light variants (Nord, Dracula, Solarized, Sepia, High Contrast, Warm, Cool, + brand default)",
      "Custom accent color picker, live preview with before/after Compare, revert-changes, and shareable appearance codes",
      "Preset moods (Late Night Practice, Bright Classroom, Focus, Boomwhacker Classroom)",
      "Boomwhacker pitch-class coloring on lead sheets — pitches show in their classroom-standard colors",
    ],
  },
];
