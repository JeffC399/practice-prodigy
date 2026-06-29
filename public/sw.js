// Practice Prodigy — minimal service worker.
//
// Purpose: satisfy Chrome's PWA install criteria. Chrome requires a
// registered service worker that handles fetch events in order to
// surface the "Install app" prompt. This worker provides exactly
// that — and nothing more.
//
// Intentionally NOT caching anything yet. Aggressive offline caching
// is a polish item for a later phase; doing it half-right tends to
// cause stale-content bugs (users seeing yesterday's bundle after a
// deploy) that erode trust faster than offline support builds it.
//
// When we DO add caching, the natural next steps are:
//   1. Cache the Next.js static chunks (immutable, hashed filenames)
//      for instant subsequent loads.
//   2. Network-first for HTML so deploys propagate immediately.
//   3. Cache-first for the JS/CSS chunks referenced by the cached HTML.

self.addEventListener("install", () => {
  // Activate the new worker as soon as it's installed, replacing
  // any old worker without waiting for tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of all open clients immediately so the new worker
  // is in charge on the very first navigation after activation.
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch handler. The mere presence of this listener
// is enough to satisfy Chrome's install criteria; we don't need
// to actually intercept or modify any requests yet.
self.addEventListener("fetch", () => {
  // Intentionally empty — browser handles all requests normally.
});
