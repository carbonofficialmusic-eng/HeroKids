const CACHE_NAME = "little-champs-deploy-fallback-v1";
const FALLBACK_URL = "/deploy-fallback.html";
const FALLBACK_ASSETS = [FALLBACK_URL, "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FALLBACK_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("little-champs-deploy-fallback-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).then(async (response) => {
      if (response.status < 500) return response;
      return (await caches.match(FALLBACK_URL)) || response;
    }).catch(async () => (
      (await caches.match(FALLBACK_URL))
      || new Response("Gleich zurück!", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    )),
  );
});