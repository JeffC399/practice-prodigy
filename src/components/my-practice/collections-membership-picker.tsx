"use client";

import { Check, FolderTree, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCollections,
  type CollectionMember,
} from "@/lib/practice/collections";

/**
 * CollectionsMembershipPicker — Slice I.3 (Phase 150).
 *
 * Popover for editing which collections a given library item belongs
 * to. Renders a checkbox per collection + a "New collection" quick-
 * create field at the bottom.
 *
 * Membership is many-to-many — a single drill can belong to zero,
 * one, or several collections. Toggling a checkbox calls
 * addMember / removeMember on the collections store, which auto-
 * bumps updatedAt so the sync engine flushes the change.
 *
 * The picker positions itself relative to whatever trigger opened
 * it — the parent uses standard absolute + top-full patterns. This
 * component only owns the popover CONTENTS.
 */
export function CollectionsMembershipPicker({
  member,
  onDismiss,
}: {
  member: CollectionMember;
  onDismiss: () => void;
}) {
  const collections = useCollections((s) => s.collections);
  const addMember = useCollections((s) => s.addMember);
  const removeMember = useCollections((s) => s.removeMember);
  const saveCollection = useCollections((s) => s.saveCollection);

  const [newName, setNewName] = useState("");

  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onDismiss]);

  // Auto-focus the "new collection" input when the picker opens with
  // no collections yet — that's the ONLY productive action from the
  // empty state, so we put the caret there so typing just works.
  useEffect(() => {
    if (collections.length === 0) inputRef.current?.focus();
  }, [collections.length]);

  const sorted = useMemo(
    () =>
      [...collections].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [collections],
  );

  const isMemberIn = (id: string) =>
    collections
      .find((c) => c.id === id)
      ?.members.some((m) => m.type === member.type && m.id === member.id) ??
    false;

  const toggle = (id: string) => {
    if (isMemberIn(id)) {
      removeMember(id, member);
    } else {
      addMember(id, member);
    }
  };

  const createAndAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = saveCollection({ name, members: [member] });
    // saveCollection returns the new id; membership is set atomically
    // via the `members` initial value, so no extra addMember call.
    setNewName("");
    void id;
  };

  return (
    <div
      ref={ref}
      className="z-30 flex w-64 flex-col gap-2 rounded-md border border-border bg-background/95 p-2.5 shadow-lg backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Add to collections
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-background/60 hover:text-foreground"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {sorted.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="flex flex-col items-center gap-1 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-3 text-center transition-colors hover:border-primary/60 hover:bg-primary/10"
        >
          <FolderTree
            className="h-4 w-4 text-primary"
            aria-hidden="true"
          />
          <span className="text-[11px] font-medium text-foreground">
            Create your first collection
          </span>
          <span className="text-[10px] text-muted-foreground">
            Type a name below — this drill will be added to it.
          </span>
        </button>
      ) : (
        <ul className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
          {sorted.map((c) => {
            const checked = isMemberIn(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
                    checked
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
                    style={{
                      backgroundColor: checked
                        ? "var(--primary)"
                        : "transparent",
                      borderColor: checked
                        ? "var(--primary)"
                        : "var(--border)",
                    }}
                    aria-hidden="true"
                  >
                    {checked && (
                      <Check
                        className="h-2.5 w-2.5 text-primary-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  {c.emoji ? (
                    <span
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-xs"
                      aria-hidden="true"
                    >
                      {c.emoji}
                    </span>
                  ) : (
                    <FolderTree
                      className="h-3.5 w-3.5 shrink-0"
                      style={{
                        color: c.color ?? "currentColor",
                      }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="flex-1 truncate text-xs">{c.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createAndAdd();
        }}
        className="flex items-center gap-1 border-t border-border/40 pt-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="+ New collection"
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={newName.trim().length === 0}
          aria-label="Create + add"
          title="Create + add to this item"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
