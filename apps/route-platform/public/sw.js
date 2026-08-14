const CACHE = "automatex-route-shell-v3";
// Only the driver shell is safe to keep for offline boot. API responses,
// admin pages and customer portals can contain personal or tenant data and are
// intentionally never written to the Cache Storage API.
const SHELL = ["/driver", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
  )));
  self.clients.claim();
});

function isPrivatePath(pathname) {
  return pathname === "/admin"
    || pathname.startsWith("/admin/")
    || pathname.startsWith("/api/")
    || pathname.startsWith("/p/");
}

function isSafeStatic(request, url) {
  return url.origin === self.location.origin
    && (url.pathname.startsWith("/_next/static/")
      || url.pathname === "/manifest.webmanifest"
      || url.pathname === "/icon.svg");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || isPrivatePath(url.pathname)) return;

  // Driver navigation is network-first so a fresh authenticated shell wins;
  // only the static shell is used when the device is offline.
  if (event.request.mode === "navigate" && url.pathname === "/driver") {
    event.respondWith(fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/driver", copy));
        }
        return response;
      })
      .catch(() => caches.match("/driver").then((cached) => cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })));
    return;
  }

  if (isSafeStatic(event.request, url)) {
    // A cache-first Next.js chunk can belong to an older deployment while the
    // HTML already references the new application. The page then renders, but
    // React never hydrates and every event handler appears broken. Always use
    // the network version when available and retain the cache only as an
    // offline fallback for the driver app.
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || new Response("Offline", { status: 503 }))));
  }
});

// Background Sync cannot access page localStorage. It wakes the page and lets
// the React driver flush its durable outbox with the authenticated session.
self.addEventListener("sync", (event) => {
  if (event.tag !== "automatex-driver-outbox") return;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => client.postMessage({ type: "automatex:sync-outbox" }));
  }));
});
