import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BUILTIN_METHODOLOGIES } from "@/lib/practice/methodologies";

/**
 * /api/ai/suggest-methodology — Slice F.7 + F.8 (Phase 143).
 *
 * Takes an array of item descriptors and returns one methodology id
 * per item. Uses AI SDK v7's `generateObject` with a Zod schema so
 * the model's output is validated + coerced into the exact shape the
 * client needs — no free-text parsing needed.
 *
 * ## Request shape
 *
 *   {
 *     items: [
 *       { itemId: string, label: string, category: string,
 *         type: string, existingMethodology?: string | null }
 *     ],
 *     model?: string       // Gateway allow-list model id
 *     byokKey?: string     // Optional BYOK
 *   }
 *
 * ## Response shape
 *
 *   {
 *     suggestions: [
 *       { itemId: string, methodologyId: string | null,
 *         confidence: "high" | "medium" | "low" | null }
 *     ]
 *   }
 *
 * `null` methodologyId = the AI decided no method fits (usually for
 * rests / warmups where prescribing Slow Practice would be silly).
 *
 * ## Model
 *
 * Defaults to Claude Haiku 4.5 — this is a small structured task,
 * doesn't need Sonnet-level reasoning, and cost matters when users
 * hit the bulk button on a 10-item routine.
 */

const GATEWAY_ALLOWED_MODELS = new Set([
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-haiku-4-5",
  "anthropic/claude-opus-4-6",
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
]);

const DEFAULT_MODEL = "anthropic/claude-haiku-4-5";

const ItemInputSchema = z.object({
  itemId: z.string().min(1),
  label: z.string(),
  category: z.string(),
  type: z.string(),
  existingMethodology: z.string().nullable().optional(),
});

const RequestSchema = z.object({
  items: z.array(ItemInputSchema).min(1).max(30),
  model: z.string().optional(),
  byokKey: z.string().optional(),
});

const METHODOLOGY_IDS = BUILTIN_METHODOLOGIES.map((m) => m.id);
const METHODOLOGY_ENUM = [
  ...METHODOLOGY_IDS,
  "none",
] as unknown as [string, ...string[]];

const SuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      itemId: z.string(),
      methodologyId: z.enum(METHODOLOGY_ENUM),
      confidence: z.enum(["high", "medium", "low"]).optional(),
    }),
  ),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { items, model = DEFAULT_MODEL, byokKey } = parsed.data;
  const usingBYOK = !!byokKey && byokKey.trim().length > 0;
  if (!usingBYOK && !GATEWAY_ALLOWED_MODELS.has(model)) {
    return NextResponse.json(
      { error: `Model ${model} not in Gateway allow-list` },
      { status: 400 },
    );
  }

  try {
    const { object } = await generateObject({
      model,
      schema: SuggestionSchema,
      headers: usingBYOK ? providerHeaders(model, byokKey!.trim()) : undefined,
      system:
        buildSuggestSystemPrompt(),
      prompt: buildSuggestUserPrompt(items),
    });

    // Normalize "none" → null on the way out so the client's picker
    // state matches its existing convention (undefined = no method).
    const suggestions = object.suggestions.map((s) => ({
      itemId: s.itemId,
      methodologyId:
        s.methodologyId === "none" ? null : (s.methodologyId as string),
      confidence: s.confidence ?? null,
    }));
    return NextResponse.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `AI provider error: ${msg}` },
      { status: 502 },
    );
  }
}

function buildSuggestSystemPrompt(): string {
  return `\
You are the AI Coach's methodology-assignment helper. For each practice item you
receive, pick the ONE methodology from this list that best fits how the item
should be practiced:

${BUILTIN_METHODOLOGIES.map(
  (m) => `- ${m.id} (${m.name}, scope:${m.scope}) — ${m.summary}`,
).join("\n")}

Rules:
- Return "none" for items where no method meaningfully applies (typically
  rests, warmups without a specific focus, or breaks).
- Prefer per-item methodologies (slow-practice, chunking, slow-loop,
  mental-practice) for individual technique / repertoire items. Per-routine
  methodologies (interleaved-practice, pomodoro, spaced-repetition) are
  structural and usually belong on the routine, not a single item.
- Deliberate-practice fits both scopes — use for items with a clear
  challenge focus and immediate feedback.
- Confidence: "high" = obvious fit, "medium" = reasonable fit, "low" = weak.

Respond as structured JSON matching the required schema. Do not include
prose commentary — the caller wires results into UI fields directly.`;
}

function buildSuggestUserPrompt(
  items: z.infer<typeof RequestSchema>["items"],
): string {
  const rows = items
    .map((it) => {
      const existing = it.existingMethodology
        ? ` (currently: ${it.existingMethodology})`
        : "";
      return `- itemId:${it.itemId} · type:${it.type} · category:${it.category} · label:"${it.label}"${existing}`;
    })
    .join("\n");
  return `Suggest a methodology for each of these items:\n\n${rows}`;
}

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
      return { authorization: `Bearer ${key}` };
  }
}
