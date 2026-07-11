/**
 * Keyboard-only "Skip to main content" link — the standard a11y
 * pattern for letting keyboard and screen-reader users bypass the
 * sticky header + module switcher and jump straight to the page's
 * primary content.
 *
 * Invisible until focused (first Tab press on any page reveals it).
 * When activated, focuses `#main-content` — every page's <main>
 * element carries that id.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only fixed left-4 top-4 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg focus:not-sr-only focus:outline-none"
    >
      Skip to main content
    </a>
  );
}
