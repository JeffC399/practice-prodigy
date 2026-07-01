"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import type { Sheet } from "@/lib/sheets/types";
import { buildShareUrl } from "@/lib/sheets/share";

/**
 * Phase 33 — Share-sheet modal.
 *
 * Two ways to share:
 *   1. Copy link — an encoded URL that recipients can open to see
 *      the sheet in a read-only view (with a "Save to my library"
 *      button).
 *   2. Download JSON — a .json file of the sheet, for cases where
 *      the sheet is too big for the URL or the user prefers a file
 *      transfer.
 */

export type ShareModalProps = {
  sheet: Sheet;
  open: boolean;
  onClose: () => void;
};

export function ShareModal({ sheet, open, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const share = useMemo(() => {
    if (!open) return null;
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://practice-prodigy.vercel.app";
    return buildShareUrl(sheet, origin);
  }, [sheet, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !share) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Some environments block clipboard writes — user can still
      // hand-select the URL from the text input.
    }
  };

  const onDownload = () => {
    const json = JSON.stringify(sheet, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.title || "sheet"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm print:hidden"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="my-8 w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="share-title" className="text-lg font-semibold">
            Share “{sheet.title}”
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Copy link */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="share-url"
              className="text-xs font-medium text-muted-foreground"
            >
              Shareable link
            </label>
            <div className="flex items-center gap-2">
              <input
                id="share-url"
                type="text"
                readOnly
                value={share.url}
                onFocus={(e) => e.target.select()}
                className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
              />
              <button
                type="button"
                onClick={onCopy}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  copied
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-500"
                    : "border-border bg-background text-foreground hover:border-primary/40"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Anyone with this link can view the sheet (read-only) and
              save a copy to their own library.
              {share.tooBig && (
                <>
                  {" "}
                  <span className="text-amber-500">
                    Heads up — this sheet is on the large side (
                    {(share.encoded.length / 1024).toFixed(1)} KB
                    encoded). Some messaging apps may reject long URLs;
                    use the JSON download below if the link doesn’t
                    paste cleanly.
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Download JSON */}
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <span className="text-xs font-medium text-muted-foreground">
              Or download a JSON file
            </span>
            <button
              type="button"
              onClick={onDownload}
              className="flex w-fit items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:border-primary/40 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download “{sheet.title || "sheet"}.json”
            </button>
            <p className="text-[11px] text-muted-foreground">
              Recipients can import the file from their library page.
              Also useful as a portable backup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
