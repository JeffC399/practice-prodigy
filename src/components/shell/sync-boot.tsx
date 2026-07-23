"use client";

import { useEffect } from "react";
import { customPatternsSyncAdapter } from "@/lib/sync/adapters/custom-patterns";
import { drillsSyncAdapter } from "@/lib/sync/adapters/drills";
import { keyDrillsSyncAdapter } from "@/lib/sync/adapters/key-drills";
import { practiceSessionsSyncAdapter } from "@/lib/sync/adapters/practice-sessions";
import { scaleDrillsSyncAdapter } from "@/lib/sync/adapters/scale-drills";
import { sheetsSyncAdapter } from "@/lib/sync/adapters/sheets";
import { userPrefsSyncAdapter } from "@/lib/sync/adapters/user-prefs";
import { registerSyncAdapter } from "@/lib/sync/sync-registry";

/**
 * SyncBoot — Slice A.5 (Phase 84).
 *
 * Registers every store's SyncAdapter with the sync registry on client
 * mount. Mounted once, globally, in the root layout.
 *
 * Registration is idempotent — hot-reload safe. Adapters register
 * once per module load; the registry replaces prior engine instances.
 * Under React StrictMode (dev), the effect fires twice; the second
 * registration cleanly replaces the first.
 *
 * Runs only on the client (`"use client"` + `useEffect`). SSR renders
 * emit no adapter code; the sync engines never touch a server render.
 *
 * As more adapters ship (drills, sheets, key drills, scale drills,
 * custom patterns), each one gets added to the registration list.
 */
export function SyncBoot(): null {
  useEffect(() => {
    registerSyncAdapter(userPrefsSyncAdapter);
    registerSyncAdapter(drillsSyncAdapter);
    registerSyncAdapter(keyDrillsSyncAdapter);
    registerSyncAdapter(scaleDrillsSyncAdapter);
    registerSyncAdapter(sheetsSyncAdapter);
    registerSyncAdapter(customPatternsSyncAdapter);
    registerSyncAdapter(practiceSessionsSyncAdapter);
  }, []);
  return null;
}
