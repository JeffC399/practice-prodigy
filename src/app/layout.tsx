import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Patrick_Hand } from "next/font/google";
import { MigrationPrompt } from "@/components/shell/migration-prompt";
import { ServiceWorkerRegister } from "@/components/shell/service-worker-register";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { SkipLink } from "@/components/shell/skip-link";
import { ThemeApplicator } from "@/components/shell/theme-applicator";
import "./globals.css";

/**
 * Phase 25.0.2 — Patrick Hand for the "handwritten" lead-sheet font
 * style option. Closest Google Fonts match to the Real Book / iReal
 * Pro / Inkpen2 block-print handwritten aesthetic. Loaded once at the
 * layout level so SheetSurface can switch via CSS variable without an
 * additional roundtrip.
 */
const patrickHand = Patrick_Hand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-patrick-hand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Practice Prodigy",
  description:
    "A pro-quality musician's practice platform. v1: Bass Arpeggios trainer with controllable look-ahead, count-in, and tempo over user-defined chord sequences.",
  applicationName: "Practice Prodigy",
  authors: [{ name: "Practice Prodigy" }],
  keywords: [
    "bass",
    "arpeggios",
    "practice",
    "metronome",
    "music education",
    "jazz",
  ],
  // PWA: ensures iOS treats this as an installable app and uses the
  // standalone window chrome (no Safari bar) when launched from Home
  // Screen. Android reads display: standalone from the manifest, but
  // iOS Safari still needs these apple-mobile-* hints.
  appleWebApp: {
    capable: true,
    title: "Practice Prodigy",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  // Allow user-scaling for accessibility; do not lock zoom.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Dark by default per design system. A future ThemeProvider will
      // toggle this class based on stored user preference + system
      // preference; for now we ship dark.
      //
      // Phase 34.7.3 — Removed the `antialiased` Tailwind class. It
      // sets `-webkit-font-smoothing: antialiased` which force-disables
      // ClearType subpixel rendering on Windows/Chrome and switches
      // ALL text to grayscale antialiasing. Small text looks fine
      // either way, but larger bold text (like the "Practice Prodigy"
      // preview heading) rendered visibly soft compared to native
      // subpixel AA. Letting the browser default rules apply gives
      // Windows users ClearType (sharpest) and macOS users the OS
      // default, which is what design systems generally want.
      className={`dark ${GeistSans.variable} ${GeistMono.variable} ${patrickHand.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeApplicator />
        {/* Phase 39 — a11y: keyboard-only skip link. First Tab press
            on any page reveals it; clicking / Enter focuses the
            #main-content anchor on each page's <main> element. */}
        <SkipLink />
        <SiteHeader />
        {children}
        <SiteFooter />
        <MigrationPrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
