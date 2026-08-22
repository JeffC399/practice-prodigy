"use client";

import { useMemo } from "react";

/**
 * ArticleBody — Slice E.3 (Phase 136).
 *
 * Lightweight markdown renderer scoped to the constructs actually
 * used across the 8 authored methodology articles:
 *
 *   #  / ##            → h1 / h2
 *   > text             → blockquote (single-line)
 *   - text             → unordered list item
 *   **bold**            → <strong>
 *   *italic*            → <em>
 *   `code`             → <code>
 *   [text](url)        → external link (opens new tab)
 *   \n\n paragraph     → <p>
 *
 * ## Why not react-markdown / marked?
 *
 * Those add 40-60KB gzipped for features these articles don't use
 * (tables, code blocks, HTML pass-through, GFM). Custom renderer
 * fits in <200 LOC and matches the app's tight bundle policy.
 * If future articles need a construct we don't handle, add it here.
 *
 * The parser is intentionally line-based and non-recursive — inline
 * spans inside list items and paragraphs get the full inline pass,
 * but nested blocks (lists in blockquotes, etc.) aren't supported.
 * None of the shipping content needs them.
 */
export function ArticleBody({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);
  return (
    <article className="flex flex-col gap-4 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block, i) => renderBlock(block, i))}
    </article>
  );
}

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "blockquote"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "p"; text: string };

function parseBlocks(source: string): Block[] {
  const lines = source.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "p", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push({ kind: "ul", items: list });
    list = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "h1", text: line.slice(2).trim() });
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "blockquote", text: line.slice(2).trim() });
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2).trim());
      continue;
    }
    // Otherwise it's paragraph text. If a list was open, flush it
    // first so the paragraph starts a fresh block.
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();

  return blocks;
}

function renderBlock(block: Block, key: number) {
  switch (block.kind) {
    case "h1":
      return (
        <h2
          key={key}
          className="text-xl font-semibold text-foreground"
        >
          {renderInline(block.text)}
        </h2>
      );
    case "h2":
      return (
        <h3
          key={key}
          className="mt-2 text-base font-semibold text-foreground"
        >
          {renderInline(block.text)}
        </h3>
      );
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="border-l-4 border-primary/50 pl-3 italic text-foreground/80"
        >
          {renderInline(block.text)}
        </blockquote>
      );
    case "ul":
      return (
        <ul key={key} className="ml-4 flex flex-col gap-1 list-disc list-outside">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "p":
      return (
        <p key={key} className="text-foreground/90">
          {renderInline(block.text)}
        </p>
      );
  }
}

/**
 * Inline pass — handles bold / italic / code / links using a single
 * combined regex tokenizer. Order matters: bold (**...**) matched
 * before italic (*...*) so **strong** isn't mis-parsed as *emphasis*
 * of *phasis*. Simple left-to-right scanning; no nesting.
 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex =
    /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      parts.push(<em key={key++}>{match[2]}</em>);
    } else if (match[3] !== undefined) {
      parts.push(
        <code
          key={key++}
          className="rounded-sm bg-background/60 px-1 py-0.5 font-mono text-[0.9em]"
        >
          {match[3]}
        </code>,
      );
    } else if (match[4] !== undefined && match[5] !== undefined) {
      const label = match[4];
      const href = match[5];
      const isExternal = /^https?:\/\//i.test(href);
      parts.push(
        <a
          key={key++}
          href={href}
          {...(isExternal
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {label}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
