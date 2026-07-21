// EikoVida Pedidos - service worker
const CACHE = "eiko-pedidos-v8";          // arquivos do app (troca a cada atualizacao)
const FOTOS = "eiko-fotos-v1";            // fotos dos produtos (permanece entre atualizacoes)
const SHELL = ["./", "./index.html", "./instalar.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./logo.png", "./simbolo.png"];

const ehImagem = (url) =>
  /\/(img|logos)\//.test(url.pathname) || /\.(png|jpe?g|webp|gif|svg)$/i.test(url.pathname);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) =>
      Promise.all(ks.filter((k) => k !== CACHE && k !== FOTOS).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.method !== "GET") return;

  // Imagens: primeiro o que ja esta guardado (funciona sem internet), depois atualiza por tras
  if (ehImagem(url)) {
    e.respondWith(
      caches.open(FOTOS).then((c) =>
        c.match(e.request).then((guardada) => {
          const rede = fetch(e.request)
            .then((r) => {
              if (r && r.ok) c.put(e.request, r.clone());
              return r;
            })
            .catch(() => guardada);
          return guardada || rede;
        })
      )
    );
    return;
  }

  // Arquivos do app: rede primeiro, cai no guardado se estiver sem internet
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});

// Guarda as fotos em lote quando o app pede
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.tipo !== "guardar-fotos" || !Array.isArray(d.urls)) return;
  e.waitUntil(
    caches.open(FOTOS).then(async (c) => {
      let ok = 0, falhou = 0;
      const lote = 6;
      for (let i = 0; i < d.urls.length; i += lote) {
        await Promise.all(
          d.urls.slice(i, i + lote).map(async (u) => {
            try {
              if (!d.forcar && (await c.match(u))) { ok++; return; }
              const r = await fetch(u, { cache: "reload" });
              if (r && r.ok) { await c.put(u, r.clone()); ok++; } else falhou++;
            } catch (_) { falhou++; }
          })
        );
        avisar({ tipo: "fotos-progresso", feitas: Math.min(i + lote, d.urls.length), total: d.urls.length });
      }
      avisar({ tipo: "fotos-prontas", ok, falhou, total: d.urls.length });
    })
  );
});

function avisar(msg) {
  self.clients.matchAll().then((cs) => cs.forEach((c) => c.postMessage(msg)));
}
