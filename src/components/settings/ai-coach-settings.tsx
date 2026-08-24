"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AI_AGENCY_DESCRIPTIONS,
  AI_AGENCY_LABELS,
  AI_MODEL_DESCRIPTIONS,
  AI_MODEL_LABELS,
  maskBYOKKey,
  useAiCoachConfig,
  type AiAgencyMode,
  type AiModelId,
} from "@/lib/ai/ai-config";

/**
 * ModelPickerField — Slice F.13 (Phase 145).
 *
 * Native <select> of the 5 Gateway-allow-listed models with a small
 * per-model description below. Users on the Gateway path see the
 * curated list; BYOK users can technically pick any model their
 * key supports, but this UI only surfaces the allow-list to keep
 * the picker simple (they can override in code if needed).
 */
export function ModelPickerField() {
  const model = useAiCoachConfig((s) => s.model);
  const setModel = useAiCoachConfig((s) => s.setModel);
  const modelIds = Object.keys(AI_MODEL_LABELS) as AiModelId[];

  return (
    <div className="flex flex-col gap-1">
      <select
        value={model}
        onChange={(e) => setModel(e.target.value as AiModelId)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      >
        {modelIds.map((id) => (
          <option key={id} value={id}>
            {AI_MODEL_LABELS[id]}
          </option>
        ))}
      </select>
      <span className="text-[11px] text-muted-foreground/70 leading-relaxed">
        {AI_MODEL_DESCRIPTIONS[model]}
      </span>
    </div>
  );
}

/**
 * ByokKeyField — Slice F.13 (Phase 145).
 *
 * Password-style input for the BYOK API key + show/hide toggle +
 * Remove button. The key never leaves the browser except in the
 * request body of an AI call over HTTPS (per Slice F.1's design).
 * Users who prefer server-managed keys just leave this empty.
 */
export function ByokKeyField() {
  const byokKey = useAiCoachConfig((s) => s.byokKey);
  const authPath = useAiCoachConfig((s) => s.authPath);
  const setByokKey = useAiCoachConfig((s) => s.setByokKey);
  const [reveal, setReveal] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(byokKey.length === 0);

  const commit = () => {
    setByokKey(draft);
    setDraft("");
    setEditing(false);
  };
  const clear = () => {
    setByokKey("");
    setDraft("");
    setEditing(true);
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono text-sm text-foreground">
            {maskBYOKKey(byokKey) || "(no key set)"}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
            Using: {authPath === "byok" ? "your key (BYOK)" : "Gateway"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Change
          </button>
          <button
            type="button"
            onClick={clear}
            aria-label="Remove BYOK key"
            title="Remove key + fall back to Gateway"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type={reveal ? "text" : "password"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-… (Anthropic or OpenAI key)"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          aria-label={reveal ? "Hide key" : "Reveal key"}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
        >
          {reveal ? (
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
      <div className="flex items-center justify-end gap-2">
        {byokKey.length > 0 && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={commit}
          disabled={draft.trim().length === 0}
          className="rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save key
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        Stored locally on this device only. Never synced to cloud,
        never logged server-side. Sent only in the request body of your
        AI calls, over HTTPS.
      </p>
    </div>
  );
}

/**
 * AgencyModePickerField — Slice F.13 (Phase 145).
 *
 * Two-button radio for Passive / Active. Active is disabled for now
 * (Phase 146 wires the tool calls that make it meaningful); the UI
 * shows the button as coming-soon so users see what's on the way.
 */
export function AgencyModePickerField() {
  const agencyMode = useAiCoachConfig((s) => s.agencyMode);
  const setAgencyMode = useAiCoachConfig((s) => s.setAgencyMode);
  const modes: AiAgencyMode[] = ["passive", "active"];
  // Slice F.10 (Phase 157) — Active mode shipped. Users can opt in.
  const ACTIVE_READY = true;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {modes.map((mode) => {
          const isSelected = agencyMode === mode;
          const disabled = mode === "active" && !ACTIVE_READY;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => !disabled && setAgencyMode(mode)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors ${
                isSelected
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-background hover:border-primary/40"
              } ${disabled ? "cursor-not-allowed opacity-50 hover:border-border" : ""}`}
            >
              <span
                className={`text-sm font-medium ${
                  isSelected ? "text-primary" : "text-foreground"
                }`}
              >
                {AI_AGENCY_LABELS[mode]}
                {disabled && (
                  <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    · coming soon
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                {AI_AGENCY_DESCRIPTIONS[mode]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
