import { ImageResponse } from "next/og";

/**
 * 192x192 PWA icon. Used as the favicon AND as the small-size manifest
 * icon (referenced from app/manifest.ts as /icon.png). Generated at
 * build time by Next.js's ImageResponse — no external image tooling.
 *
 * Design: amber-on-near-black rounded square with the same music-note
 * glyph used in the SiteHeader brand mark. Brand-consistent across
 * favicon, home-screen install, and the in-app header all at once.
 */

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          borderRadius: 36,
          // Inner amber tile matches the SiteHeader brand mark's
          // ring + tinted background so the install icon reads as
          // the same brand as the in-app chrome.
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 28,
            background: "#f59e0b22",
            border: "2px solid #f59e0b66",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Lucide Music icon as inline SVG so Satori can render it
              without needing a font for unicode music glyphs. */}
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
