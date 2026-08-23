import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * useAiCoachUsage — Slice F.12 (Phase 155).
 *
 * Persisted per-conversation token accumulator. Every time the chat
 * receives an assistant message with `metadata.usage`, the client
 * calls `recordUsage(conversationId, usage)` to add to the
 * conversation's running totals.
 *
 * ## Local-only
 *
 * Same pattern as ai-config + coach-history: localStorage only, never
 * synced. Cost tracking is personal data that doesn't need to
 * round-trip through cloud.
 *
 * ## Rough cost estimate
 *
 * Not shipped in v1 — models change price, providers vary. The chip
 * shows raw token counts, which is enough for users to gauge "am I
 * chatting a lot" without pretending to be an invoice.
 */

export type UsageRecord = {
  /** Sum of input tokens across every assistant message in the conversation. */
  inputTokens: number;
  /** Sum of output tokens. */
  outputTokens: number;
  /** Sum of totalTokens. May be greater than input+output for models with reasoning tokens. */
  totalTokens: number;
  /** Number of assistant messages the running totals represent. */
  messageCount: number;
  /** Most-recent model id that contributed. Useful for the header hint. */
  lastModel?: string;
};

const EMPTY: UsageRecord = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  messageCount: 0,
};

type UsageStore = {
  /** Per-conversation accumulators keyed by conversation id. */
  byConversation: Record<string, UsageRecord>;

  /** Add a message's usage into the given conversation. No-op when all fields are zero/undefined. */
  recordUsage: (
    conversationId: string,
    usage: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      model?: string;
    },
  ) => void;

  /** Read a conversation's totals; returns EMPTY when unknown. */
  getUsage: (conversationId: string | null) => UsageRecord;

  /** All-time totals across every conversation. */
  getAllTime: () => UsageRecord;

  /** Clear a specific conversation's usage (paired with deleteConversation). */
  clearUsage: (conversationId: string) => void;
};

export const useAiCoachUsage = create<UsageStore>()(
  persist(
    (set, get) => ({
      byConversation: {},

      recordUsage: (conversationId, usage) => {
        const input = usage.inputTokens ?? 0;
        const output = usage.outputTokens ?? 0;
        const total = usage.totalTokens ?? input + output;
        if (input === 0 && output === 0 && total === 0) return;
        set((state) => {
          const existing = state.byConversation[conversationId] ?? EMPTY;
          const next: UsageRecord = {
            inputTokens: existing.inputTokens + input,
            outputTokens: existing.outputTokens + output,
            totalTokens: existing.totalTokens + total,
            messageCount: existing.messageCount + 1,
            lastModel: usage.model ?? existing.lastModel,
          };
          return {
            byConversation: {
              ...state.byConversation,
              [conversationId]: next,
            },
          };
        });
      },

      getUsage: (conversationId) => {
        if (!conversationId) return EMPTY;
        return get().byConversation[conversationId] ?? EMPTY;
      },

      getAllTime: () => {
        const buckets = Object.values(get().byConversation);
        const summed = buckets.reduce<UsageRecord>(
          (acc, r) => ({
            inputTokens: acc.inputTokens + r.inputTokens,
            outputTokens: acc.outputTokens + r.outputTokens,
            totalTokens: acc.totalTokens + r.totalTokens,
            messageCount: acc.messageCount + r.messageCount,
            lastModel: r.lastModel ?? acc.lastModel,
          }),
          EMPTY,
        );
        return summed;
      },

      clearUsage: (conversationId) => {
        set((state) => {
          if (!(conversationId in state.byConversation)) return state;
          const next = { ...state.byConversation };
          delete next[conversationId];
          return { byConversation: next };
        });
      },
    }),
    {
      name: "practice-prodigy:ai-coach-usage:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/** Compact display — "1.2K tokens" or "342 tokens". */
export function formatTokenCount(n: number): string {
  if (n < 1000) return `${n} tokens`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K tokens`;
  return `${(n / 1_000_000).toFixed(2)}M tokens`;
}
