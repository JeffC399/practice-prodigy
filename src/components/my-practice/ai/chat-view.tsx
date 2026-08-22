"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, MessageSquarePlus, Send, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  useAiCoachConfig,
  type AiModelId,
} from "@/lib/ai/ai-config";
import { useAiCoachHistory } from "@/lib/ai/coach-history";
import { buildContextBody } from "@/lib/ai/context-assembly";
import { parseRoutineDraft } from "@/lib/ai/routine-parser";
import { buildPassiveSystemPrompt } from "@/lib/ai/system-prompts";
import { RoutineDraftCard } from "./routine-draft-card";

/**
 * ChatView — Slice F.4 (Phase 140).
 *
 * The AI Coach chat surface. Uses AI SDK v6's `useChat` hook with a
 * DefaultChatTransport pointed at our /api/ai/chat route. Streams
 * assistant responses token-by-token; keeps the chat log in local
 * component state (Slice F.9 will persist + resume).
 *
 * ## Shortcut buttons
 *
 * A row of "quick asks" sits above the input to lower the blank-page
 * friction. Each button fills the composer with a pre-written prompt
 * the user can edit before sending. Wired minimally in F.4; the
 * proper routine-drafting response format lands in F.5 (routine
 * draft parser).
 *
 * ## Config plumbing
 *
 * The transport's `prepareSendMessagesRequest` merges the user's
 * model + BYOK key from `useAiCoachConfig` into the request body on
 * every send. That means switching model in Settings takes effect
 * immediately — no reload needed.
 */

const SHORTCUT_PROMPTS = [
  "Draft a 30-minute technique-focused routine.",
  "What should I work on today?",
  "Suggest an interleaved-practice routine mixing 3 skills.",
  "Which of my routines needs the most attention?",
] as const;

export function ChatView() {
  const model = useAiCoachConfig((s) => s.model);
  const byokKey = useAiCoachConfig((s) => s.byokKey);
  const authPath = useAiCoachConfig((s) => s.authPath);

  const conversations = useAiCoachHistory((s) => s.conversations);
  const activeConversationId = useAiCoachHistory(
    (s) => s.activeConversationId,
  );
  const ensureActive = useAiCoachHistory((s) => s.ensureActive);
  const saveMessages = useAiCoachHistory((s) => s.saveMessages);
  const createNewConversation = useAiCoachHistory((s) => s.createNew);
  const openConversation = useAiCoachHistory((s) => s.openConversation);
  const deleteConversation = useAiCoachHistory((s) => s.deleteConversation);

  // Seed the active conversation on first mount.
  useEffect(() => {
    ensureActive();
  }, [ensureActive]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  // Recreate the transport when model / byokKey change so subsequent
  // messages use the new config. Memo keeps referential stability
  // within a single config state. The system prompt + context body
  // are rebuilt fresh on every send (via prepareSendMessagesRequest)
  // so the AI always sees the current library snapshot, not one
  // frozen at transport-create time.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages,
            model,
            byokKey: byokKey || undefined,
            systemPrompt: buildPassiveSystemPrompt(buildContextBody()),
          },
        }),
      }),
    [model, byokKey],
  );

  // Key useChat by the active conversation id so switching or
  // creating one gets a fresh hook instance seeded with the stored
  // messages. Without the key, useChat's internal state would leak
  // across conversation switches.
  const { messages, sendMessage, status, error, regenerate, setMessages } =
    useChat({
      id: activeConversationId ?? undefined,
      transport,
      messages: activeConversation?.messages ?? [],
    });

  // Persist to history whenever the message log changes. Skips the
  // empty initial state so a freshly-created conversation doesn't
  // pointlessly re-persist on every mount.
  useEffect(() => {
    if (!activeConversationId) return;
    if (messages.length === 0) return;
    saveMessages(messages);
  }, [messages, activeConversationId, saveMessages]);

  const [composerText, setComposerText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isStreaming = status === "streaming" || status === "submitted";

  const handleNewChat = () => {
    createNewConversation();
    setMessages([]);
    setComposerText("");
  };

  const handleOpenConversation = (id: string) => {
    openConversation(id);
    setComposerText("");
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
    // If we deleted the active one, useChat will re-key on the new
    // activeConversationId and seed from that conversation's messages.
  };

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      sendMessage({ text: trimmed });
      setComposerText("");
      // Scroll to bottom on next tick so the user sees their message.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    },
    [sendMessage, isStreaming],
  );

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(composerText);
  };

  return (
    <section className="flex flex-col gap-4 h-[calc(100vh-16rem)] min-h-[24rem]">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-foreground">
            AI Coach
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Practice-planning helper. Ask for a routine, ideas, or a
            check-in.
          </p>
        </div>
        <AuthPathChip authPath={authPath} model={model} />
      </header>

      <HistoryStrip
        conversations={conversations}
        activeId={activeConversationId}
        onOpen={handleOpenConversation}
        onNew={handleNewChat}
        onDelete={handleDeleteConversation}
      />

      {/* Message log */}
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-md border border-border/60 bg-background/30 p-4"
      >
        {messages.length === 0 && !isStreaming && <EmptyState />}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isStreaming && messages.at(-1)?.role !== "assistant" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Thinking…
          </div>
        )}
        {error && (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <span className="font-medium">
              AI request failed
            </span>
            <span className="text-destructive/80">
              {error.message ??
                "Unknown error. If you added a BYOK key, double-check it. Otherwise the AI Gateway may need setup on Vercel."}
            </span>
            <button
              type="button"
              onClick={() => regenerate()}
              className="self-start rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] font-medium hover:bg-destructive/20"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Shortcut buttons */}
      <div className="flex flex-wrap gap-1.5">
        {SHORTCUT_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setComposerText(p)}
            disabled={isStreaming}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleFormSubmit}
        className="flex items-end gap-2 rounded-md border border-border bg-background p-2"
      >
        <textarea
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          onKeyDown={(e) => {
            // Enter to send; Shift+Enter for newline. Standard chat UX.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(composerText);
            }
          }}
          placeholder={
            isStreaming
              ? "AI is answering…"
              : "Ask for a routine, guidance, or a check-in…"
          }
          rows={2}
          disabled={isStreaming}
          className="flex-1 resize-none bg-transparent px-2 py-1 text-sm focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isStreaming || composerText.trim().length === 0}
          aria-label="Send message"
          className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStreaming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Send
        </button>
      </form>
    </section>
  );
}

function MessageBubble({
  message,
}: {
  message: {
    id: string;
    role: string;
    parts: Array<{ type: string; text?: string }>;
  };
}) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");

  // Slice F.5 (Phase 142) — Look for a routine draft in assistant
  // messages. When found, render the draft card BELOW the raw text
  // so the user sees both what the AI said and the actionable draft.
  const draft = !isUser && text ? parseRoutineDraft(text) : null;

  return (
    <div
      className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {isUser ? "You" : "AI Coach"}
      </span>
      <div
        className={`max-w-[90%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "border border-primary/40 bg-primary/10 text-foreground"
            : "border border-border/60 bg-background/60 text-foreground"
        }`}
      >
        {text || (
          <span className="italic text-muted-foreground">(empty message)</span>
        )}
      </div>
      {draft && (
        <div className="w-full max-w-[90%]">
          <RoutineDraftCard draft={draft} />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <Sparkles className="h-8 w-8 text-primary/70" aria-hidden="true" />
      <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
        Say hi, ask for a routine draft, or tap a quick prompt below.
      </p>
    </div>
  );
}

function AuthPathChip({
  authPath,
  model,
}: {
  authPath: "gateway" | "byok";
  model: AiModelId;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      <span>{authPath === "byok" ? "BYOK" : "Gateway"}</span>
      <span className="text-muted-foreground/40">·</span>
      <span className="text-foreground">{model}</span>
    </div>
  );
}

function HistoryStrip({
  conversations,
  activeId,
  onOpen,
  onNew,
  onDelete,
}: {
  conversations: ReturnType<typeof useAiCoachHistory.getState>["conversations"];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  // Sort most-recent first for the strip. Preserves the strip's
  // "recent up top" mental model regardless of insertion order.
  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={onNew}
        title="Start a fresh conversation"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
      >
        <MessageSquarePlus className="h-3 w-3" aria-hidden="true" />
        New
      </button>
      {sorted.map((c) => {
        const active = c.id === activeId;
        return (
          <div
            key={c.id}
            className={`group inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              active
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              className="max-w-[10rem] truncate normal-case tracking-normal text-xs"
              title={c.title}
            >
              {c.title}
            </button>
            {conversations.length > 1 && (
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                aria-label={`Delete conversation ${c.title}`}
                title="Delete"
                className="rounded-md p-0.5 text-muted-foreground/70 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
