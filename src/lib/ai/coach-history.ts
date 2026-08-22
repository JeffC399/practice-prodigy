import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { UIMessage } from "ai";

/**
 * useAiCoachHistory — Slice F.9 (Phase 144).
 *
 * Persisted conversation history for the AI Coach. Stores the full
 * message log per conversation so users can resume any past chat by
 * clicking its pill in the history strip.
 *
 * ## Storage
 *
 * Local-only for MVP (matches the ai-config store's pattern). Cloud
 * sync of conversation history is deferred — it needs a bigger
 * think about privacy (chat contents are more sensitive than
 * user prefs) and cost (100 conversations × ~10 messages × ~2KB
 * each = ~2MB per user).
 *
 * ## Auto-title
 *
 * A fresh conversation gets a placeholder title ("New chat"). The
 * first user message is used to auto-title it, truncated to 40
 * chars. Users can rename via a right-click / edit affordance
 * (deferred to a later polish pass).
 *
 * ## History cap
 *
 * We cap at 30 conversations locally — beyond that, oldest-touched
 * conversation is evicted. Prevents unbounded localStorage growth.
 */

const MAX_CONVERSATIONS = 30;
const AUTO_TITLE_MAX_CHARS = 40;

export type CoachConversation = {
  id: string;
  title: string;
  /** UIMessage[] from @ai-sdk/react — the exact shape useChat consumes. */
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
};

type CoachHistoryStore = {
  conversations: CoachConversation[];
  activeConversationId: string | null;

  /** Return the currently-active conversation, creating one if none exists. */
  ensureActive: () => CoachConversation;

  /** Save the given messages onto the active conversation (writes updatedAt). */
  saveMessages: (messages: UIMessage[]) => void;

  /**
   * Start a fresh conversation and make it active. Returns the new
   * conversation id so the caller can seed its useChat instance.
   */
  createNew: () => string;

  /** Switch the active conversation. Silently no-op on unknown id. */
  openConversation: (id: string) => void;

  /** Delete a conversation. If it was active, another becomes active. */
  deleteConversation: (id: string) => void;
};

function newConversationId(): string {
  return `conv_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function makeFreshConversation(): CoachConversation {
  const now = Date.now();
  return {
    id: newConversationId(),
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Derive a title from the first user message; fall back to placeholder. */
function autoTitle(messages: readonly UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text = firstUser.parts
    .filter((p) => p.type === "text")
    .map((p) => ("text" in p ? p.text : ""))
    .join("");
  const trimmed = text.trim();
  if (!trimmed) return "New chat";
  return trimmed.length > AUTO_TITLE_MAX_CHARS
    ? `${trimmed.slice(0, AUTO_TITLE_MAX_CHARS).trimEnd()}…`
    : trimmed;
}

export const useAiCoachHistory = create<CoachHistoryStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,

      ensureActive: () => {
        const state = get();
        const existing = state.conversations.find(
          (c) => c.id === state.activeConversationId,
        );
        if (existing) return existing;
        const fresh = makeFreshConversation();
        set({
          conversations: [fresh, ...state.conversations],
          activeConversationId: fresh.id,
        });
        return fresh;
      },

      saveMessages: (messages) => {
        set((state) => {
          const id = state.activeConversationId;
          if (!id) return state;
          const idx = state.conversations.findIndex((c) => c.id === id);
          if (idx === -1) return state;
          const now = Date.now();
          const updated: CoachConversation = {
            ...state.conversations[idx],
            messages,
            title:
              state.conversations[idx].title === "New chat"
                ? autoTitle(messages)
                : state.conversations[idx].title,
            updatedAt: now,
          };
          const next = [...state.conversations];
          next[idx] = updated;
          return { conversations: next };
        });
      },

      createNew: () => {
        const fresh = makeFreshConversation();
        set((state) => {
          const capped = [fresh, ...state.conversations].slice(
            0,
            MAX_CONVERSATIONS,
          );
          return {
            conversations: capped,
            activeConversationId: fresh.id,
          };
        });
        return fresh.id;
      },

      openConversation: (id) => {
        const state = get();
        if (!state.conversations.some((c) => c.id === id)) return;
        set({ activeConversationId: id });
      },

      deleteConversation: (id) => {
        set((state) => {
          const remaining = state.conversations.filter((c) => c.id !== id);
          const nextActive =
            state.activeConversationId === id
              ? (remaining[0]?.id ?? null)
              : state.activeConversationId;
          return {
            conversations: remaining,
            activeConversationId: nextActive,
          };
        });
      },
    }),
    {
      name: "practice-prodigy:ai-coach-history:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
