import { ImageResponse } from "next/og";

/**
 * 512x512 PWA icon — the large variant referenced by the manifest as
 * `/icon0.png`. Required by Chrome's PWA install criteria (alongside
 * the 192x192 in icon.tsx). Marked `purpose: "any maskable"` in the
 * manifest so Android adaptive icons crop cleanly to the safe zone.
 *
 * The inner amber tile is intentionally inset further than the 192
 * variant so when Android crops to a circle, the music note still
 * reads centered with comfortable margin.
 */

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon0() {
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
            width: 320,
            height: 320,
            borderRadius: 64,
            background: "#f59e0b22",
            border: "4px solid #f59e0b66",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="200"
            height="200"
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
