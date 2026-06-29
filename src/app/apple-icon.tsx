import { ImageResponse } from "next/og";

/**
 * iOS apple-touch-icon (180x180). What iPhones / iPads use when the
 * user picks "Add to Home Screen." iOS doesn't read the PWA manifest
 * icons, so this dedicated file is essential for the icon to actually
 * look right on the home screen instead of falling back to a
 * screenshot of the page.
 *
 * Design parity with icon.tsx (192) — same amber-on-near-black
 * music-note mark. Slightly different inset so the icon fills iOS's
 * standard squircle crop without awkward whitespace.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 30,
            background: "#f59e0b22",
            border: "2px solid #f59e0b66",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
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
