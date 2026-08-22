import { streamText, type ModelMessage } from "ai";
import { NextResponse } from "next/server";

/**
 * /api/ai/chat — Slice F.1 (Phase 139).
 *
 * Streaming chat endpoint for the AI Coach. Accepts a POST with:
 *
 *   {
 *     messages: ModelMessage[]        // AI SDK v6 message format
 *     model: "provider/model"         // AI Gateway model id
 *     systemPrompt?: string           // Optional per-call override
 *     byokKey?: string                // Optional BYOK escape hatch
 *   }
 *
 * Returns a streaming text response (AI SDK v6 UI Message Stream) the
 * client renders progressively via useChat.
 *
 * ## Auth path
 *
 *   - BYOK: if `byokKey` is present + non-empty, we honor it FOR THIS
 *     CALL ONLY. The key never gets logged, cached, or persisted.
 *   - Gateway (default): the AI SDK v6 automatically uses the
 *     `AI_GATEWAY_API_KEY` env var (or OIDC token on Vercel) when no
 *     explicit provider is imported. Just passing a "provider/model"
 *     string works.
 *
 * ## Fluid Compute
 *
 * Runs on Fluid Compute (Node 24 default) so we can stream long
 * responses past the 300s limit. Streaming responses use graceful
 * shutdown; the client-side useChat handles disconnects.
 *
 * ## Model allow-list
 *
 * The Gateway path enforces a small allow-list to prevent runaway
 * cost from a malicious client requesting `openai/o1-pro` on every
 * message. BYOK bypasses (the user pays for their own choices).
 */

const GATEWAY_ALLOWED_MODELS = new Set([
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-haiku-4-5",
  "anthropic/claude-opus-4-6",
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
]);

/** Cap the message array so a runaway client can't blow the context. */
const MAX_MESSAGES = 40;
const MAX_MESSAGE_BYTES = 24_000;

type ChatRequestBody = {
  messages?: ModelMessage[];
  model?: string;
  systemPrompt?: string;
  byokKey?: string;
};

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const {
    messages,
    model = "anthropic/claude-sonnet-4-6",
    systemPrompt,
    byokKey,
  } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages must be a non-empty array" },
      { status: 400 },
    );
  }
  if (messages.length > MAX_MESSAGES) {
    return NextResponse.json(
      { error: `messages capped at ${MAX_MESSAGES}` },
      { status: 400 },
    );
  }
  for (const m of messages) {
    const bytes = JSON.stringify(m).length;
    if (bytes > MAX_MESSAGE_BYTES) {
      return NextResponse.json(
        { error: `individual message exceeds ${MAX_MESSAGE_BYTES} bytes` },
        { status: 400 },
      );
    }
  }

  // Gateway auth path: enforce allow-list. BYOK bypasses.
  const usingBYOK = typeof byokKey === "string" && byokKey.trim().length > 0;
  if (!usingBYOK && !GATEWAY_ALLOWED_MODELS.has(model)) {
    return NextResponse.json(
      { error: `Model ${model} not in Gateway allow-list` },
      { status: 400 },
    );
  }

  try {
    // AI SDK v6: `model` as "provider/model" string routes through
    // the Vercel AI Gateway automatically. For BYOK, we set the
    // per-request headers so the gateway forwards them to the
    // provider. If Vercel Gateway isn't reachable (e.g. missing
    // AI_GATEWAY_API_KEY in dev), the SDK will surface a clear
    // error the client can display.
    const result = streamText({
      model,
      messages,
      system: systemPrompt,
      // BYOK: The Gateway supports per-request "provider key" headers
      // that override the project's default key. Send the user's key
      // ONLY on this stream — never persist. If we later want a pure
      // direct-to-provider bypass, we'd import the provider SDK
      // directly here — for now, hybrid is simpler.
      headers: usingBYOK ? providerHeaders(model, byokKey.trim()) : undefined,
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `AI provider error: ${msg}` },
      { status: 502 },
    );
  }
}

/**
 * For the BYOK path, send the raw provider API key as the standard
 * provider auth header. The Vercel AI Gateway proxies this straight
 * through to the upstream provider.
 */
function providerHeaders(
  model: string,
  key: string,
): Record<string, string> {
  const [provider] = model.split("/");
  switch (provider) {
    case "anthropic":
      return { "x-api-key": key, "anthropic-version": "2023-06-01" };
    case "openai":
      return { authorization: `Bearer ${key}` };
    default:
      // Unknown provider — pass as bearer as a safe default. The
      // upstream will reject if wrong; user sees the 502.
      return { authorization: `Bearer ${key}` };
  }
}
