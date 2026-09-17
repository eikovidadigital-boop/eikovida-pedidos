// EikoVida Pedidos - service worker
const CACHE = "eiko-pedidos-v6";

// Arquivos do próprio site (pré-carregados na instalação)
const SHELL = [
  "./", "./index.html", "./catalogo.html", "./manifest.json",
  "./icon-192.png", "./icon-512.png", "./logo.png", "./simbolo.png"
];

// Bibliotecas externas que o app PRECISA para funcionar offline
// (Firebase SDK e gerador de PDF). Ficam em cache "para sempre".
const LIBS = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

// Domínios de DADOS em tempo real — nunca cachear (sempre rede)
function ehDadoAoVivo(url) {
  return url.hostname.endsWith("firebaseio.com") ||
         url.hostname.endsWith("firebasedatabase.app") ||
         url.hostname.endsWith("brasilapi.com.br") ||
         url.hostname.endsWith("google.com") ||
         url.hostname.endsWith("googleapis.com");
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map((u) => c.add(u).catch(() => {})));
    await Promise.all(LIBS.map((u) => c.add(u).catch(() => {})));
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // 1) Dados em tempo real: sempre rede, nunca cache
  if (ehDadoAoVivo(url)) return;

  // 2) Bibliotecas externas (Firebase SDK, jsPDF): CACHE PRIMEIRO
  if (url.origin !== location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      try {
        const r = await fetch(e.request);
        if (r && r.ok) cache.put(e.request, r.clone());
        return r;
      } catch (err) {
        return hit || Response.error();
      }
    })());
    return;
  }

  // 3) Arquivos do próprio site: rede primeiro, cai no cache offline
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request);
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    } catch (err) {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      if (e.request.mode === "navigate") {
        const home = await cache.match("./index.html");
        if (home) return home;
      }
      return Response.error();
    }
  })());
});
