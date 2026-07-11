"use client";

import { Plus, Shuffle, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  KEY_SEQUENCER_MAX_ROWS,
  KEY_SEQUENCER_MAX_WORDS_PER_ROW,
  KEY_SEQUENCER_MAX_WORD_LENGTH,
  PROMPT_ROW_ORDERINGS,
  PROMPT_ROW_ORDERING_DISPLAY_NAMES,
  newPromptRowId,
  type PromptRow,
  type PromptRowOrdering,
} from "@/lib/key-sequencer/types";

/**
 * Prompt-row editor for the Key Sequencer setup page.
 *
 * Users compose 0..3 rows. Each row has an optional label ("Quality",
 * "Pattern", "Direction", or anything), a chip list of free-text
 * words, and an ordering strategy. The setup page consumes this via
 * an onChange callback that pushes the new rows array to the config
 * store.
 */

export function PromptRowEditor({
  rows,
  onChange,
}: {
  rows: PromptRow[];
  onChange: (next: PromptRow[]) => void;
}) {
  const addRow = () => {
    if (rows.length >= KEY_SEQUENCER_MAX_ROWS) return;
    onChange([
      ...rows,
      {
        id: newPromptRowId(),
        label: "",
        words: [],
        ordering: "custom",
      },
    ]);
  };

  const updateRow = (id: string, patch: Partial<PromptRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && (
        <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            No prompt rows yet — the drill will just cycle keys. Add a row
            to prompt something extra each measure (Quality / Pattern /
            Direction / anything you type).
          </p>
        </div>
      )}

      {rows.map((row, idx) => (
        <PromptRowCard
          key={row.id}
          row={row}
          index={idx}
          onUpdate={(patch) => updateRow(row.id, patch)}
          onRemove={() => removeRow(row.id)}
        />
      ))}

      {rows.length < KEY_SEQUENCER_MAX_ROWS && (
        <button
          type="button"
          onClick={addRow}
          className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-background/30 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add prompt row
        </button>
      )}
      {rows.length >= KEY_SEQUENCER_MAX_ROWS && (
        <p className="text-center text-[11px] text-muted-foreground/70">
          Max {KEY_SEQUENCER_MAX_ROWS} rows in v1.
        </p>
      )}
    </div>
  );
}

function PromptRowCard({
  row,
  index,
  onUpdate,
  onRemove,
}: {
  row: PromptRow;
  index: number;
  onUpdate: (patch: Partial<PromptRow>) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState("");

  const addWord = () => {
    const trimmed = draft.trim().slice(0, KEY_SEQUENCER_MAX_WORD_LENGTH);
    if (!trimmed) return;
    if (row.words.length >= KEY_SEQUENCER_MAX_WORDS_PER_ROW) return;
    if (row.words.includes(trimmed)) {
      setDraft("");
      return;
    }
    onUpdate({ words: [...row.words, trimmed] });
    setDraft("");
  };

  const removeWord = (w: string) => {
    onUpdate({ words: row.words.filter((x) => x !== w) });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addWord();
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Row {index + 1}
          </span>
          <input
            type="text"
            value={row.label ?? ""}
            onChange={(e) => onUpdate({ label: e.target.value.slice(0, 24) })}
            placeholder="Label (optional) — e.g. Quality"
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            <Shuffle
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <select
              value={row.ordering}
              onChange={(e) =>
                onUpdate({ ordering: e.target.value as PromptRowOrdering })
              }
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              {PROMPT_ROW_ORDERINGS.map((o) => (
                <option key={o} value={o}>
                  {PROMPT_ROW_ORDERING_DISPLAY_NAMES[o]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove prompt row ${index + 1}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {row.words.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {row.words.map((w) => (
            <span
              key={w}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
            >
              {w}
              <button
                type="button"
                onClick={() => removeWord(w)}
                aria-label={`Remove word ${w}`}
                className="flex h-4 w-4 items-center justify-center rounded-full text-primary/60 transition-colors hover:bg-primary/20 hover:text-primary"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            row.words.length === 0
              ? "Type a word and press Enter — e.g. Major 7"
              : "Add another…"
          }
          maxLength={KEY_SEQUENCER_MAX_WORD_LENGTH}
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={addWord}
          disabled={
            !draft.trim() ||
            row.words.length >= KEY_SEQUENCER_MAX_WORDS_PER_ROW
          }
          className="inline-flex h-9 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add
        </button>
      </div>
      {row.words.length >= KEY_SEQUENCER_MAX_WORDS_PER_ROW && (
        <p className="text-[10px] text-muted-foreground/70">
          Max {KEY_SEQUENCER_MAX_WORDS_PER_ROW} words per row.
        </p>
      )}
    </div>
  );
}
