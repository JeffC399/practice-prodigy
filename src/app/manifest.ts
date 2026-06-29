import type { MetadataRoute } from "next";

/**
 * PWA Web App Manifest.
 *
 * Defines how Practice Prodigy presents itself when installed to home
 * screen / desktop:
 *   - `display: "standalone"` → no browser chrome; the app feels native
 *   - dark theme + dark background match the (currently dark-only) UI;
 *     once Phase 9 ships light/dark switching we can revisit
 *   - icons are generated from app/icon.tsx + app/apple-icon.tsx at
 *     build time via Next.js's ImageResponse, served at /icon.png and
 *     /apple-icon.png respectively. The size variants for the manifest
 *     come from app/icon.tsx (192) and app/icon0.tsx (512).
 *
 * Manifest is automatically linked into <head> by Next.js — no need
 * to add a <link rel="manifest"> tag manually.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Practice Prodigy",
    short_name: "Prodigy",
    description:
      "A pro-quality practice platform for musicians. Drill arpeggios over user-defined chord sequences with precision metronome, controllable look-ahead, and configurable count-in.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["music", "education", "productivity"],
    // Icon URLs deliberately omit the .png extension — Next.js's
    // programmatic icon convention (app/icon.tsx etc.) serves the
    // generated PNG at the route /icon (not /icon.png). The content
    // type is set on the response, so browsers handle these fine
    // despite the missing extension in the URL.
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon0",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Separate entry for the maskable purpose — Next.js's
      // typedef won't accept the spec's space-separated "any
      // maskable" string, but splitting into two entries with the
      // same file is functionally identical.
      {
        src: "/icon0",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
