"use client";

import { useEffect } from "react";

/**
 * Registers the Practice Prodigy service worker on the first client
 * render. The SW (public/sw.js) is intentionally minimal — it exists
 * to satisfy Chrome's PWA install criteria, not to do aggressive
 * offline caching (see public/sw.js for the longer comment).
 *
 * No-op in development by default. The SW registration only fires in
 * production builds — registering in dev tends to interfere with Next
 * HMR (the SW caches old chunks that the dev server has since
 * invalidated, leading to confusing "why isn't my change showing"
 * loops). Production-only is the standard convention for SW work.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Defer registration until after the page is interactive so we
    // don't compete with the initial render for main-thread time.
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // SW registration failure isn't critical — the app works
          // without it; we just lose the install prompt. Log so a
          // dev hitting this can debug, but don't surface to the user.
          console.warn("Practice Prodigy SW registration failed:", err);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
