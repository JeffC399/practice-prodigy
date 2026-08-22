"use client";

import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatView } from "@/components/my-practice/ai/chat-view";
import { isMyPracticeEnabled } from "@/lib/feature-flags";

/**
 * /my-practice/coach — Slice F.4 (Phase 140).
 *
 * Dedicated route for the AI Coach chat. Kept as its own page rather
 * than a modal so the URL is shareable and refresh-safe, and so the
 * chat log has room to breathe on desktop.
 *
 * Feature-flagged behind the same isMyPracticeEnabled gate as the
 * /my-practice landing page — the AI Coach doesn't ship separately
 * from the flagship module.
 *
 * ## Coming soon (later F phases)
 *
 *   - F.5 routine draft parser + preview
 *   - F.6 "Why this?" transparency panel
 *   - F.9 conversation history + resume across page loads
 *   - F.10 Active mode with tool calls
 *   - F.12 usage indicator
 *   - F.13 model / provider picker inline
 */
export default function AiCoachPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (mounted && !isMyPracticeEnabled()) {
    notFound();
  }
  if (!mounted) return null;

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href="/my-practice?tab=routines"
            className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to My Practice
          </Link>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            AI Coach · alpha
          </span>
        </div>

        <ChatView />
      </div>
    </main>
  );
}
