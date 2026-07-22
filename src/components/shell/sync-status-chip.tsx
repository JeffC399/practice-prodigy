"use client";

import {
  AlertCircle,
  Check,
  CloudOff,
  Loader2,
} from "lucide-react";
import { useSyncStatus } from "@/lib/sync/use-sync-status";

/**
 * Sync status chip — subtle indicator in the site header.
 *
 * Slice A.3 (Phase 81). Only shows when there's something to say —
 * hidden entirely when idle + signed-out (avoids visual noise for
 * anonymous users). Aggregates status across all registered sync
 * engines via `useSyncStatus`.
 *
 * States:
 *   - signed-out → hidden
 *   - idle → shows a small "Synced" check for 1.5s after activity, else hidden
 *   - syncing → spinner + "Syncing…"
 *   - offline → cloud-off icon + "Offline"
 *   - error → alert + "Sync error"
 *
 * A.3 ships the basic visual; A.5 will wire actual stores through
 * so the chip does something meaningful.
 */
export function SyncStatusChip() {
  const status = useSyncStatus();

  if (status === "signed-out") return null;

  // Slice A.3 minimal — always render when signed in so users see
  // the chip exists. Once we have real per-store activity in A.5
  // we can auto-hide idle states after a delay.
  const { label, icon, tone } = describe(status);

  return (
    <div
      role="status"
      aria-label={`Sync ${status}`}
      title={`Sync status: ${label}`}
      className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${tone}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

function describe(status: Exclude<ReturnType<typeof useSyncStatus>, "signed-out">) {
  switch (status) {
    case "syncing":
      return {
        label: "Syncing",
        icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
        tone: "border-primary/30 bg-primary/5 text-primary",
      };
    case "offline":
      return {
        label: "Offline",
        icon: <CloudOff className="h-3 w-3" aria-hidden="true" />,
        tone: "border-muted-foreground/30 bg-muted/20 text-muted-foreground",
      };
    case "error":
      return {
        label: "Sync error",
        icon: <AlertCircle className="h-3 w-3" aria-hidden="true" />,
        tone: "border-rose-500/40 bg-rose-500/5 text-rose-500",
      };
    case "idle":
    default:
      return {
        label: "Synced",
        icon: <Check className="h-3 w-3" aria-hidden="true" />,
        tone: "border-border/60 bg-background text-muted-foreground",
      };
  }
}
