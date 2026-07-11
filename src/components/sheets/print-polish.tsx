"use client";

/**
 * Print polish CSS injected on both the view (`/sheets/[id]`) and
 * edit (`/sheets/[id]/edit`) pages. Adds the standard professional-
 * chart footer to every printed page:
 *
 *   • Bottom-right: `Page N of M` via CSS @page counter(page)/counter(pages)
 *   • Bottom-left: sheet copyright text (when set on the sheet)
 *   • break-inside: avoid on .sheet-paper so single-page sheets never
 *     split awkwardly across two pages
 *
 * CSS @page margin boxes (`@bottom-right`, `@bottom-left`, etc.) are
 * a W3C Paged Media feature well-supported in Chrome/Edge/Safari.
 * `content:` strings are baked at render time via string
 * interpolation so per-sheet copyright text flows through without
 * needing CSS custom properties (which have flaky `content:` support).
 * Quotes in the copyright are pre-escaped to prevent CSS injection.
 *
 * Long-sheet caveat (documented as follow-up): SheetSurface renders
 * multi-line music as one monolithic SVG. When a sheet's rendered
 * height exceeds one page, the browser paginates but can cut staff
 * lines mid-line. A proper fix would split each staff line into its
 * own <div><svg> so the browser can page-break between lines. That
 * refactor is out of scope for this print-polish slice.
 */

function escapeCssString(s: string): string {
  // Strip characters that could close the CSS string or break the rule.
  // Backslash escapes double quotes for CSS `content:` syntax.
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

export function PrintPolish({ copyright }: { copyright?: string }) {
  const trimmed = (copyright ?? "").trim();
  const bottomLeft = trimmed
    ? `
      @bottom-left {
        content: "${escapeCssString(trimmed)}";
        font: 9pt Georgia, "Times New Roman", serif;
        color: #666;
        padding-bottom: 0.15in;
      }
    `
    : "";

  const css = `
    @media print {
      @page {
        size: letter;
        margin: 0.5in 0.5in 0.65in 0.5in;

        @bottom-right {
          content: "Page " counter(page) " of " counter(pages);
          font: 9pt Georgia, "Times New Roman", serif;
          color: #666;
          padding-bottom: 0.15in;
        }

        ${bottomLeft}
      }

      .sheet-paper {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
