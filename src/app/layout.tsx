import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ServiceWorkerRegister } from "@/components/shell/service-worker-register";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import "./globals.css";

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
      className={`dark ${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteHeader />
        {children}
        <SiteFooter />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
