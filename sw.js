// Service worker: deixa o app funcionar offline depois da primeira abertura online.
const CACHE = "fenatran-benchmark-v11";
const ASSETS = ["./", "./index.html", "./style.css", "./app.js", "./questionnaire.js", "./export.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  // cache: "reload" ignora o cache HTTP do navegador/servidor, para nunca guardar arquivos velhos
  // ao publicar uma versão nova (o GitHub Pages permite cache de alguns minutos).
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((u) =>
        fetch(new Request(u, { cache: "reload" })).then((r) => {
          if (!r.ok) throw new Error("Falha ao baixar " + u + ": " + r.status);
          return c.put(u, r);
        }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
