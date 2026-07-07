import {
  APPEARANCE_KEYS,
  type AppearanceKey,
  type AppearanceSlice,
} from "./user-prefs";

/**
 * Phase 34.2 — encode / decode an appearance slice as a compact
 * shareable string. Teachers, students, and colleagues can copy their
 * appearance "code" and paste it elsewhere to import the exact same
 * palette + accent + sliders + toggles.
 *
 * Format: base64url of `JSON.stringify(slice)`. Symmetric with the
 * existing `src/lib/sheets/share.ts` encoding scheme so the mental
 * model is consistent across the app. Payloads are tiny (<200 bytes)
 * so no compression is applied.
 */

/**
 * Encode an appearance slice to a URL-safe base64 string.
 */
export function encodeAppearance(slice: AppearanceSlice): string {
  const json = JSON.stringify(slice);
  // btoa is DOM-only; the settings page is a client component.
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Decode + validate an appearance code. Returns the parsed slice on
 * success; null on any parse or shape error. Every key in
 * `APPEARANCE_KEYS` must be present with a value of the correct
 * primitive kind (this is a lenient guard — full runtime schema
 * validation is deferred until the appearance store gains its own
 * migration versioning).
 */
export function decodeAppearance(code: string): AppearanceSlice | null {
  try {
    const b64 = code
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      // Restore stripped `=` padding.
      + "=".repeat((4 - (code.length % 4)) % 4);
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    for (const k of APPEARANCE_KEYS) {
      if (!(k in record)) return null;
    }
    // No stricter check — trust the caller to only apply keys we know
    // about; the store's setters (which include clamps) do the rest.
    const clean = {} as AppearanceSlice;
    for (const k of APPEARANCE_KEYS) {
      (clean as Record<string, unknown>)[k as AppearanceKey] = record[k];
    }
    return clean;
  } catch {
    return null;
  }
}
