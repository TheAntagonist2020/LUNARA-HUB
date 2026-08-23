// Pass-through service worker: exists so the hub installs as an app on
// Android/Chrome. Deliberately caches nothing — the hub always shows live
// state, and a caching worker would serve stale dashboards.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
