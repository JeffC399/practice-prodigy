"use client";

import { ChevronDown, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/supabase/auth";
import { useUser } from "@/lib/supabase/use-user";
import { SignInModal } from "./sign-in-modal";

/**
 * Account chip — small header control that shows sign-in status.
 *
 * Slice A.2 (Phase 80). Two states:
 *
 *   • Signed out — "Sign in" pill. Opens the SignInModal on click.
 *   • Signed in  — a small circle with the user's initial + a
 *                  chevron; opens a dropdown with the user's email
 *                  and a Sign out button.
 *
 * During the initial auth check we render a compact skeleton so the
 * header doesn't jump when the user's state resolves.
 *
 * Rendering is client-side because auth state changes over time.
 * Server-rendered pages hydrate to whichever state matches the
 * cookie once the middleware refresh finishes.
 */
export function AccountChip() {
  const { user, loading } = useUser();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click-outside dismissal for the signed-in menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  if (loading) {
    return (
      <div
        aria-hidden="true"
        className="h-7 w-14 rounded-md border border-border bg-background/40"
      />
    );
  }

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-background/80"
        >
          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Sign in</span>
        </button>
        <SignInModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  const initial = deriveInitial(user.email);
  const displayEmail = user.email ?? "signed in";

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setMenuOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={`Account menu for ${displayEmail}`}
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-1.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-background/80"
      >
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary"
        >
          {initial}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${
            menuOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 flex w-64 flex-col rounded-md border border-border bg-card shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Signed in as
            </p>
            <p className="mt-0.5 truncate text-sm text-foreground">
              {displayEmail}
            </p>
          </div>
          <div className="flex flex-col py-1">
            {/* Slice A.3+ will add: Profile link, Data export link. For A.2 we ship just Sign out. */}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-background/60 disabled:opacity-60"
              role="menuitem"
            >
              <LogOut className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span>{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Derive the initial character shown in the avatar circle. Prefers
 * the email's local-part first letter. Falls back to a generic icon
 * character when no email is available.
 */
function deriveInitial(email: string | undefined): React.ReactNode {
  if (!email) return <UserIcon className="h-3 w-3" aria-hidden="true" />;
  const local = email.split("@")[0] ?? "";
  const first = local.charAt(0).toUpperCase();
  return first || <UserIcon className="h-3 w-3" aria-hidden="true" />;
}
