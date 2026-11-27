const CACHE_NAME = "recetario-saludable-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    !event.request.url.startsWith(self.location.origin) ||
    event.request.url.endsWith(".mp3")
  ) {
    return;
  }

  event.respondWith(fetch(event.request));
});