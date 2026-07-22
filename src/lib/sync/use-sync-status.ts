"use client";

import { useEffect, useState } from "react";
import { subscribeAggregateStatus } from "./sync-registry";
import type { SyncStatus } from "./types";

/**
 * React hook — reads the aggregate sync status from the registry.
 *
 * Slice A.3 (Phase 81). Consumed by the SyncStatusChip in the
 * header (Slice A.3) and later by any surface that wants to show
 * sync state (e.g. Settings → Account, per-store status labels).
 *
 * Value is `"signed-out"` when no engines are registered OR the
 * user isn't signed in.
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>("signed-out");
  useEffect(() => {
    return subscribeAggregateStatus(setStatus);
  }, []);
  return status;
}
