import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * useAiCoachConfig — Slice F.1 (Phase 139).
 *
 * User's AI Coach configuration. Two auth paths supported by the
 * hybrid architecture:
 *
 *   1. Gateway (default) — the app calls its server-side /api/ai/chat
 *      route, which uses the Vercel AI Gateway with the project-owned
 *      key. Users see zero friction. The server route enforces rate
 *      limits and quota (F.14 polish).
 *
 *   2. BYOK (bring your own key) — advanced users can paste an
 *      Anthropic or OpenAI key. The client sends it in the request
 *      body to /api/ai/chat, which uses it FOR THAT CALL ONLY and
 *      immediately forgets it (never logs / persists / stores it).
 *
 * ## Where the key lives
 *
 * BYOK key is stored in localStorage ONLY. Never syncs to Supabase,
 * never leaves the browser except in the immediate request body of
 * an AI call over HTTPS. This is the least-friction storage that
 * doesn't require server-side encryption infrastructure. F.14
 * polish can upgrade to encrypted cloud storage.
 *
 * ## Model selection
 *
 * Uses the AI SDK v6 "provider/model" convention that routes through
 * the Vercel AI Gateway. Users pick a family (Claude / GPT / etc.)
 * and a tier (Sonnet default, Haiku for cheap iteration, Opus for
 * hard tasks). BYOK users can override to any model their key
 * supports; Gateway users get the curated allow-list from the
 * server route.
 */

/** AI Gateway "provider/model" strings the server accepts. */
export type AiModelId =
  | "anthropic/claude-sonnet-4-6"
  | "anthropic/claude-haiku-4-5"
  | "anthropic/claude-opus-4-6"
  | "openai/gpt-4o-mini"
  | "openai/gpt-4o";

export const AI_MODEL_LABELS: Record<AiModelId, string> = {
  "anthropic/claude-sonnet-4-6": "Claude Sonnet 4.6",
  "anthropic/claude-haiku-4-5": "Claude Haiku 4.5",
  "anthropic/claude-opus-4-6": "Claude Opus 4.6",
  "openai/gpt-4o-mini": "GPT-4o mini",
  "openai/gpt-4o": "GPT-4o",
};

export const AI_MODEL_DESCRIPTIONS: Record<AiModelId, string> = {
  "anthropic/claude-sonnet-4-6":
    "Balanced default. Best quality:cost for routine drafting.",
  "anthropic/claude-haiku-4-5":
    "Fastest + cheapest. Great for methodology suggestions and short chats.",
  "anthropic/claude-opus-4-6":
    "Most thoughtful. Use for complex profile analysis or long routines.",
  "openai/gpt-4o-mini": "OpenAI's fast tier.",
  "openai/gpt-4o": "OpenAI's flagship.",
};

/**
 * The default. Sonnet strikes the best balance across the three
 * things the Coach does (chat, routine drafting, methodology
 * assignment).
 */
export const DEFAULT_AI_MODEL: AiModelId = "anthropic/claude-sonnet-4-6";

/** Agency modes from ROUTINE-DESIGN.md — user picks per install. */
export type AiAgencyMode = "passive" | "active";

export const AI_AGENCY_LABELS: Record<AiAgencyMode, string> = {
  passive: "Passive — compose from library",
  active: "Active — can create + edit + suggest",
};

export const AI_AGENCY_DESCRIPTIONS: Record<AiAgencyMode, string> = {
  passive:
    "AI Coach only drafts routines from items you've already built. Safest — it can never invent or modify anything without you doing it manually.",
  active:
    "AI Coach can create new drills / sheets / songs, edit routines mid-flight, and propose profile updates. Every change requires your confirmation before it applies.",
};

/**
 * Auth path — Gateway = server-side, BYOK = client-provided key.
 * BYOK is only used when `byokKey` is non-empty; otherwise the
 * server-side Gateway path fires.
 */
export type AiAuthPath = "gateway" | "byok";

type AiConfigStore = {
  /** The model the Coach uses for chat + drafting. */
  model: AiModelId;
  /**
   * Which auth path to use. Set to "byok" as soon as the user pastes
   * a key; flips back to "gateway" if they clear it.
   */
  authPath: AiAuthPath;
  /**
   * BYOK: the raw API key. Empty string when unset. NEVER logged,
   * NEVER synced to cloud. Kept out of the sync adapter by design
   * — this store isn't registered.
   */
  byokKey: string;
  /**
   * Which agency mode the Coach operates under. Defaults to
   * "passive" per the plan's safety principle: user opts INTO
   * mutation, doesn't opt out.
   */
  agencyMode: AiAgencyMode;

  setModel: (model: AiModelId) => void;
  /**
   * Set (or clear with "") the BYOK key. Flips authPath automatically
   * so the app doesn't need to think about it.
   */
  setByokKey: (key: string) => void;
  setAgencyMode: (mode: AiAgencyMode) => void;
};

export const useAiCoachConfig = create<AiConfigStore>()(
  persist(
    (set) => ({
      model: DEFAULT_AI_MODEL,
      authPath: "gateway",
      byokKey: "",
      agencyMode: "passive",

      setModel: (model) => set({ model }),
      setByokKey: (key) => {
        const trimmed = key.trim();
        set({
          byokKey: trimmed,
          authPath: trimmed.length > 0 ? "byok" : "gateway",
        });
      },
      setAgencyMode: (agencyMode) => set({ agencyMode }),
    }),
    {
      name: "practice-prodigy:ai-coach-config:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Explicitly NOT registered with the sync engine. Keeps the
      // BYOK key browser-local by construction — you can't
      // accidentally sync what isn't hooked into the adapter list.
    },
  ),
);

/**
 * Convenience — returns a masked preview of the BYOK key for UI
 * display (e.g. "sk-…4a2f"). Returns "" when unset.
 */
export function maskBYOKKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
