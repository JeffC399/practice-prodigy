/**
 * Format a UNIX millisecond timestamp as a short relative-time string
 * for the current locale.
 *
 * "Just now" for anything under a minute, then minutes / hours /
 * days / weeks / months / years. Uses the built-in
 * `Intl.RelativeTimeFormat` API for locale-aware output ("2 days ago"
 * in English, "il y a 2 jours" in French, etc.).
 *
 * If `Intl.RelativeTimeFormat` isn't available (very old browsers),
 * falls back to a plain English string.
 */
export function formatRelativeTime(
  timestampMs: number,
  now: number = Date.now(),
): string {
  const diffMs = timestampMs - now;
  const absDiffSec = Math.abs(diffMs) / 1000;

  if (absDiffSec < 60) return "Just now";

  const rtf =
    typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl
      ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
      : null;

  const table: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];

  let value = diffMs / 1000;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [step, u] of table) {
    if (Math.abs(value) < step) {
      unit = u;
      break;
    }
    value /= step;
  }

  const rounded = Math.round(value);
  if (rtf) return rtf.format(rounded, unit);

  const abs = Math.abs(rounded);
  const plural = abs === 1 ? unit : `${unit}s`;
  return diffMs < 0 ? `${abs} ${plural} ago` : `in ${abs} ${plural}`;
}
