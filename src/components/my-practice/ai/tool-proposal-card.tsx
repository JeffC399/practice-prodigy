"use client";

import {
  ArrowRight,
  Check,
  FolderTree,
  Loader2,
  ListChecks,
  Music,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CategoryChip } from "@/components/practice/category-chip";
import type { CategoryId } from "@/lib/practice/categories";
import { useCollections } from "@/lib/practice/collections";
import { getMethodology } from "@/lib/practice/methodologies";
import {
  newRoutineItemId,
  type RoutineItem,
} from "@/lib/practice/routine-types";
import { useRoutinesLibrary } from "@/lib/practice/routines-library";
import { useSongsLibrary } from "@/lib/practice/songs-library";
import type {
  ProposeCollectionInput,
  ProposeRoutineInput,
  ProposeSongInput,
} from "@/lib/ai/tools";

/**
 * ToolProposalCard — Slice F.11 (Phase 158).
 *
 * Renders an assistant tool call as a confirmation card. The user
 * clicks Accept or Reject; the parent's onResolved callback is fired
 * with the outcome so the ChatView can feed the tool result back
 * into useChat via addToolResult.
 *
 * Each supported tool has its own visual — songs get title + artist
 * summary, collections get emoji + description, routines get an
 * item preview. Mutations dispatch to the local Zustand stores when
 * the user accepts.
 */

export type ToolProposalResolution =
  | {
      status: "accepted";
      summary: string;
      /** Optional deep-link the accepted-state card links to. */
      href?: string;
      /** Optional label for the deep-link (defaults to "Open"). */
      hrefLabel?: string;
    }
  | { status: "rejected"; reason?: string };

type BaseProps = {
  toolCallId: string;
  onResolved: (resolution: ToolProposalResolution) => void;
};

export function ProposeSongCard({
  input,
  onResolved,
}: BaseProps & { input: ProposeSongInput }) {
  const saveSong = useSongsLibrary((s) => s.saveSong);
  const [resolved, setResolved] = useState<ToolProposalResolution | null>(null);

  const accept = () => {
    const id = saveSong({
      title: input.title,
      artist: input.artist,
      songKey: input.songKey,
      timeSignature: input.timeSignature,
      genre: input.genre,
      status: input.status,
      personalNotes: input.personalNotes,
      targetPerformanceDate: input.targetPerformanceDate,
    });
    const resolution: ToolProposalResolution = {
      status: "accepted",
      summary: `Added "${input.title}" to your songs library.`,
      href: `/my-practice?tab=songs`,
      hrefLabel: "Open Songs tab",
    };
    setResolved(resolution);
    onResolved({ ...resolution, summary: `${resolution.summary} id:${id}` });
  };

  const reject = () => {
    const resolution: ToolProposalResolution = {
      status: "rejected",
      reason: "User declined to add this song.",
    };
    setResolved(resolution);
    onResolved(resolution);
  };

  if (resolved) return <ResolvedCard resolution={resolved} />;

  const detailChips = [
    input.artist,
    input.songKey,
    input.timeSignature,
    input.genre,
    input.status,
  ].filter((v): v is string => Boolean(v));

  return (
    <ProposalShell
      icon={<Music className="h-4 w-4" aria-hidden="true" />}
      title="AI wants to add a song"
      subtitle={input.title}
      accept={accept}
      reject={reject}
      acceptLabel="Add song"
    >
      {detailChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {detailChips.map((chip, i) => (
            <span
              key={i}
              className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
      {input.personalNotes && (
        <p className="text-xs text-muted-foreground italic leading-relaxed">
          &ldquo;{input.personalNotes}&rdquo;
        </p>
      )}
      {input.targetPerformanceDate && (
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Target: {input.targetPerformanceDate}
        </p>
      )}
    </ProposalShell>
  );
}

export function ProposeCollectionCard({
  input,
  onResolved,
}: BaseProps & { input: ProposeCollectionInput }) {
  const saveCollection = useCollections((s) => s.saveCollection);
  const [resolved, setResolved] = useState<ToolProposalResolution | null>(null);

  const accept = () => {
    const id = saveCollection({
      name: input.name,
      emoji: input.emoji,
      color: input.color,
      description: input.description,
    });
    const resolution: ToolProposalResolution = {
      status: "accepted",
      summary: `Created collection "${input.name}".`,
      href: `/my-practice?tab=collections`,
      hrefLabel: "Open Collections tab",
    };
    setResolved(resolution);
    onResolved({ ...resolution, summary: `${resolution.summary} id:${id}` });
  };

  const reject = () => {
    const resolution: ToolProposalResolution = {
      status: "rejected",
      reason: "User declined to create this collection.",
    };
    setResolved(resolution);
    onResolved(resolution);
  };

  if (resolved) return <ResolvedCard resolution={resolved} />;

  return (
    <ProposalShell
      icon={
        input.emoji ? (
          <span className="text-base" aria-hidden="true">
            {input.emoji}
          </span>
        ) : (
          <FolderTree className="h-4 w-4" aria-hidden="true" />
        )
      }
      title="AI wants to create a collection"
      subtitle={input.name}
      accept={accept}
      reject={reject}
      acceptLabel="Create collection"
      accentColor={input.color}
    >
      {input.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {input.description}
        </p>
      )}
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Members can be added later from any library card.
      </p>
    </ProposalShell>
  );
}

export function ProposeRoutineCard({
  input,
  onResolved,
}: BaseProps & { input: ProposeRoutineInput }) {
  const saveRoutine = useRoutinesLibrary((s) => s.saveRoutine);
  const [resolved, setResolved] = useState<ToolProposalResolution | null>(null);

  const accept = () => {
    const items: RoutineItem[] = input.items
      .map((item): RoutineItem | null => {
        const base = {
          id: newRoutineItemId(),
          label: item.label,
          category: item.category as CategoryId,
          methodologyId: item.methodologyId,
          estimatedSeconds: item.estimatedSeconds,
        };
        switch (item.type) {
          case "drill":
            return item.drillId
              ? { ...base, type: "drill", drillId: item.drillId }
              : null;
          case "key-drill":
            return item.keyDrillId
              ? { ...base, type: "key-drill", keyDrillId: item.keyDrillId }
              : null;
          case "scale-drill":
            return item.scaleDrillId
              ? {
                  ...base,
                  type: "scale-drill",
                  scaleDrillId: item.scaleDrillId,
                }
              : null;
          case "leadsheet":
            return item.leadSheetId
              ? { ...base, type: "leadsheet", leadSheetId: item.leadSheetId }
              : null;
          case "song":
            return item.songId
              ? { ...base, type: "song", songId: item.songId }
              : null;
          case "metronome":
            return {
              ...base,
              type: "metronome",
              bpm: item.bpm ?? 60,
              beatsPerMeasure: item.beatsPerMeasure ?? 4,
              beatUnit: item.beatUnit ?? 4,
            };
          case "rest":
            return { ...base, type: "rest", guidanceText: item.guidanceText };
          case "custom":
            return {
              ...base,
              type: "custom",
              instruction: item.instruction ?? "",
            };
          default:
            return null;
        }
      })
      .filter((it): it is RoutineItem => it !== null);

    const id = saveRoutine({
      name: input.name,
      notes: input.notes,
      methodologyId: input.methodologyId,
      items,
      source: "ai-coach",
    });
    const resolution: ToolProposalResolution = {
      status: "accepted",
      summary: `Created routine "${input.name}" with ${items.length} items.`,
      href: `/my-practice?tab=routines&routine=${id}`,
      hrefLabel: "Open in builder",
    };
    setResolved(resolution);
    onResolved({ ...resolution, summary: `${resolution.summary} id:${id}` });
  };

  const reject = () => {
    const resolution: ToolProposalResolution = {
      status: "rejected",
      reason: "User declined to create this routine.",
    };
    setResolved(resolution);
    onResolved(resolution);
  };

  if (resolved) return <ResolvedCard resolution={resolved} />;

  const totalMins = Math.round(
    input.items.reduce((s, it) => s + it.estimatedSeconds, 0) / 60,
  );
  const methodology = getMethodology(input.methodologyId);

  return (
    <ProposalShell
      icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
      title="AI wants to create a routine"
      subtitle={input.name}
      accept={accept}
      reject={reject}
      acceptLabel="Create routine"
    >
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>
          {input.items.length} items · ~{totalMins} min
        </span>
        {methodology && (
          <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-primary">
            {methodology.name}
          </span>
        )}
      </div>
      <ol className="flex flex-col gap-1">
        {input.items.slice(0, 6).map((item, i) => (
          <li
            key={i}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[11px]"
          >
            <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground/70">
              {i + 1}.
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground">
              {item.label}
            </span>
            <CategoryChip categoryId={item.category as CategoryId} size="sm" />
            <span className="font-mono text-[9px] text-muted-foreground/70">
              {Math.round(item.estimatedSeconds / 60)}m
            </span>
          </li>
        ))}
        {input.items.length > 6 && (
          <li className="pl-6 font-mono text-[10px] text-muted-foreground/70">
            +{input.items.length - 6} more items
          </li>
        )}
      </ol>
      {input.notes && (
        <p className="text-xs text-muted-foreground italic leading-relaxed">
          &ldquo;{input.notes}&rdquo;
        </p>
      )}
    </ProposalShell>
  );
}

/** Shared shell around each proposal — icon + header + kids + buttons. */
function ProposalShell({
  icon,
  title,
  subtitle,
  accept,
  reject,
  acceptLabel,
  accentColor,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accept: () => void;
  reject: () => void;
  acceptLabel: string;
  accentColor?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const handleAccept = () => {
    if (busy) return;
    setBusy(true);
    accept();
  };
  const handleReject = () => {
    if (busy) return;
    setBusy(true);
    reject();
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-md border-2 border-primary/40 bg-primary/5 p-3"
      style={
        accentColor ? { borderColor: `${accentColor}66` } : undefined
      }
    >
      <div className="flex items-start gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
          style={
            accentColor
              ? { backgroundColor: `${accentColor}20`, color: accentColor }
              : undefined
          }
        >
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {title}
          </span>
          <span className="text-base font-semibold text-foreground">
            {subtitle}
          </span>
        </div>
      </div>
      {children && <div className="flex flex-col gap-2">{children}</div>}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleReject}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Reject
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {acceptLabel}
        </button>
      </div>
    </div>
  );
}

function ResolvedCard({ resolution }: { resolution: ToolProposalResolution }) {
  if (resolution.status === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 p-2 text-xs text-muted-foreground">
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Rejected. The AI won&rsquo;t apply this change.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
      <span className="inline-flex items-center gap-1 font-medium">
        <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {resolution.summary.split(" id:")[0]}
      </span>
      {resolution.href && (
        <Link
          href={resolution.href}
          className="inline-flex items-center gap-1 self-start rounded-md bg-primary px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
        >
          {resolution.hrefLabel ?? "Open"}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/**
 * Route a raw tool call name + input to the right card component.
 * The parent MessageBubble uses this to render tool-call parts.
 */
export function ToolProposalCard({
  toolName,
  toolCallId,
  input,
  onResolved,
}: {
  toolName: string;
  toolCallId: string;
  input: unknown;
  onResolved: (resolution: ToolProposalResolution) => void;
}) {
  switch (toolName) {
    case "propose_song":
      return (
        <ProposeSongCard
          toolCallId={toolCallId}
          input={input as ProposeSongInput}
          onResolved={onResolved}
        />
      );
    case "propose_collection":
      return (
        <ProposeCollectionCard
          toolCallId={toolCallId}
          input={input as ProposeCollectionInput}
          onResolved={onResolved}
        />
      );
    case "propose_routine":
      return (
        <ProposeRoutineCard
          toolCallId={toolCallId}
          input={input as ProposeRoutineInput}
          onResolved={onResolved}
        />
      );
    default:
      return (
        <div className="rounded-md border border-dashed border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          Unknown tool: {toolName}
        </div>
      );
  }
}

