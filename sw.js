// Caches the app shell so VALTUNEZ opens offline. Songs are stored separately (IndexedDB).
const CACHE = "valtunez-shell-v3";
const SHELL = ["./","index.html","style.css","config.js","manifest.webmanifest","assets/icons/icon-192.png","assets/icons/icon-512.png","js/utils.js","js/sources.js","js/lyrics.js","js/offline.js","js/player.js","js/ui.js","js/app.js"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
