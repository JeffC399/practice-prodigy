import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
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
        {children}
      </body>
    </html>
  );
}
