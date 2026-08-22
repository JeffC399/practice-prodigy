"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import {
  useAiCoachConfig,
  type AiModelId,
} from "@/lib/ai/ai-config";

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

  // Recreate the transport when model / byokKey change so subsequent
  // messages use the new config. Memo keeps referential stability
  // within a single config state.
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
          },
        }),
      }),
    [model, byokKey],
  );

  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport,
  });

  const [composerText, setComposerText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isStreaming = status === "streaming" || status === "submitted";

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

  return (
    <div
      className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
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
