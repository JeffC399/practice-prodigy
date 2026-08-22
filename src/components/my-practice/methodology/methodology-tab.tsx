"use client";

import { ArrowLeft, BookOpen, ChevronRight, Clock, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { ArticleBody } from "./article-body";
import { CategoryChip } from "@/components/practice/category-chip";
import type { CategoryId } from "@/lib/practice/categories";
import {
  listMethodologyBundles,
  type MethodologyBundle,
  type MethodologyTemplate,
} from "@/lib/practice/methodology-library";

/**
 * MethodologyTab — Slice E.2 (Phase 136).
 *
 * Two-view surface:
 *
 *   1. List view — all 8 methodology cards in a responsive grid.
 *      Each card shows name, per-item/per-routine scope, one-line
 *      summary, applicable-category chips, template count.
 *   2. Article view — full markdown article + inline "Try this
 *      template" cards for every linked template.
 *
 * Clicking a card opens its article; a Back button returns to the
 * list. The switch is client-side + local state — no URL routing
 * yet since the tab already lives at `?tab=methodology` and adding
 * a nested query param would fight the tab shell.
 *
 * ## Template flow
 *
 * The per-template "Try" button on the article view is wired in
 * Phase E.6 (Phase 137). Until then the button appears but its
 * click hook is prop-driven by the parent.
 */
export function MethodologyTab({
  onTryTemplate,
}: {
  /**
   * Called when a user clicks "Try this template" on an article's
   * template card. Wired to the create-routine-from-template flow
   * in Phase E.6. Optional so the tab renders standalone before
   * the flow lands.
   */
  onTryTemplate?: (template: MethodologyTemplate) => void;
}) {
  const bundles = useMemo(() => listMethodologyBundles(), []);
  const [openId, setOpenId] = useState<string | null>(null);

  const open = openId ? bundles.find((b) => b.entry.id === openId) : null;

  if (open) {
    return (
      <ArticleView
        bundle={open}
        onBack={() => setOpenId(null)}
        onTryTemplate={onTryTemplate}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Methodology</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Practice methods, when to use each, and one-click starter
          routines. Same 8 methodologies you tag routine items with.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {bundles.map((bundle) => (
          <li key={bundle.entry.id}>
            <MethodologyCard
              bundle={bundle}
              onOpen={() => setOpenId(bundle.entry.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MethodologyCard({
  bundle,
  onOpen,
}: {
  bundle: MethodologyBundle;
  onOpen: () => void;
}) {
  const { entry, article, templates } = bundle;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col gap-2 rounded-lg border-2 border-border bg-background/40 p-4 text-left transition-all hover:border-primary/60 hover:bg-primary/5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
            {entry.scope === "per-item"
              ? "Per-item method"
              : entry.scope === "per-routine"
                ? "Structural method"
                : "Either scope"}
          </span>
          <h3 className="text-base font-semibold text-foreground">
            {entry.name}
          </h3>
        </div>
        <ChevronRight
          className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {entry.summary}
      </p>
      {article && article.categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-1">
          {article.categories.map((catId) => (
            <CategoryChip
              key={catId}
              categoryId={catId as CategoryId}
              size="sm"
            />
          ))}
        </div>
      )}
      <div className="mt-1 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
        <span className="inline-flex items-center gap-1">
          <BookOpen className="h-3 w-3" aria-hidden="true" />
          {article ? "Article" : "No article"}
        </span>
        {templates.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {templates.length} template{templates.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </button>
  );
}

function ArticleView({
  bundle,
  onBack,
  onTryTemplate,
}: {
  bundle: MethodologyBundle;
  onBack: () => void;
  onTryTemplate?: (template: MethodologyTemplate) => void;
}) {
  const { entry, article, templates } = bundle;
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All methodologies
        </button>
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
          {entry.scope === "per-item"
            ? "Per-item method"
            : entry.scope === "per-routine"
              ? "Structural method"
              : "Either scope"}
        </span>
      </div>

      <header className="flex flex-col gap-2 rounded-lg border-2 border-primary/40 bg-primary/5 px-5 py-4">
        <h1 className="text-2xl font-semibold text-foreground">
          {entry.name}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {entry.summary}
        </p>
        {article && article.categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
              Works well for
            </span>
            {article.categories.map((catId) => (
              <CategoryChip
                key={catId}
                categoryId={catId as CategoryId}
                size="sm"
              />
            ))}
          </div>
        )}
      </header>

      {article ? (
        <div className="rounded-md border border-border/60 bg-background/30 px-5 py-5 sm:px-7 sm:py-6">
          <ArticleBody markdown={article.body} />
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border/60 bg-background/20 px-4 py-6 text-center text-sm italic text-muted-foreground">
          No article for this methodology yet.
        </p>
      )}

      {templates.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Try a starter routine
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {templates.map((tpl) => (
              <li key={tpl.id}>
                <TemplateCard
                  template={tpl}
                  onTry={onTryTemplate ? () => onTryTemplate(tpl) : undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function TemplateCard({
  template,
  onTry,
}: {
  template: MethodologyTemplate;
  onTry?: () => void;
}) {
  const mins = Math.round(template.estimatedTotalSeconds / 60);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">
          {template.name}
        </h3>
        <span className="inline-flex items-center gap-1 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {mins} min
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {template.description}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {template.items.length} item{template.items.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={onTry}
          disabled={!onTry}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          title={onTry ? "Load this template as a new routine" : "Wired in Phase E.6"}
        >
          Try this template
        </button>
      </div>
    </div>
  );
}
