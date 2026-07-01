import type { Sheet } from "@/lib/sheets/types";

/**
 * Phase 33 — Share sheets via URL.
 *
 * Encodes a `Sheet` as a base64url-safe JSON string that fits in a
 * URL query parameter. Recipients open the URL and see the sheet
 * (read-only), with a "Save to my library" button that clones the
 * sheet into their local store.
 *
 * v1 scope: plain base64 of the JSON. No compression. Typical sheets
 * fit well within a URL (a 32-bar chord chart is ~2-4 KB encoded;
 * one with full melody + lyrics is ~5-15 KB). For sheets that exceed
 * a soft cap of ~20 KB, the share modal falls back to a JSON file
 * download.
 *
 * A future v2 could gzip via the browser's `CompressionStream` API
 * to shrink encoded sizes by ~70%; deferred until we see real sheets
 * hitting the URL cap.
 */

const SHARE_URL_SOFT_CAP = 20_000;

function base64UrlEncode(str: string): string {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  const pad = (4 - (str.length % 4)) % 4;
  const b64 =
    str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return decodeURIComponent(escape(atob(b64)));
}

/** Encode a sheet into a URL-safe string. Same in the browser + on the server. */
export function encodeSheet(sheet: Sheet): string {
  return base64UrlEncode(JSON.stringify(sheet));
}

/**
 * Decode a URL-safe string back into a Sheet. Returns `null` on any
 * parse failure — malformed / tampered / unrelated strings just fail
 * silently and the caller shows a "couldn't load this share" message.
 */
export function decodeSheet(encoded: string): Sheet | null {
  if (!encoded) return null;
  try {
    const json = base64UrlDecode(encoded);
    const parsed = JSON.parse(json);
    // Basic shape guard — real validation would use zod but this is
    // fine for MVP. We require the id + title fields at minimum.
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.id !== "string" ||
      typeof parsed.title !== "string" ||
      !Array.isArray(parsed.measures)
    ) {
      return null;
    }
    return parsed as Sheet;
  } catch {
    return null;
  }
}

export type ShareUrlResult = {
  /** Full share URL including origin. */
  url: string;
  /** Just the encoded payload — useful for the JSON download fallback. */
  encoded: string;
  /** True when the encoded payload exceeds the recommended URL cap. */
  tooBig: boolean;
};

/** Build a share URL for a sheet, using the current window origin. */
export function buildShareUrl(sheet: Sheet, origin: string): ShareUrlResult {
  const encoded = encodeSheet(sheet);
  return {
    url: `${origin}/sheets/shared?d=${encoded}`,
    encoded,
    tooBig: encoded.length > SHARE_URL_SOFT_CAP,
  };
}
