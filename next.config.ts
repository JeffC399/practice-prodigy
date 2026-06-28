import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project directory so Next.js
  // doesn't accidentally pick up an unrelated lockfile from a parent folder.
  // (There is an empty stray package-lock.json in the parent "2026 Projects"
  // workspace that confuses Next.js's auto-detection.)
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
