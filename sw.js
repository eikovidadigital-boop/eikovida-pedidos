// EikoVida Pedidos - service worker
const CACHE = "eiko-pedidos-v12";          // arquivos do app (troca a cada atualizacao)
const FOTOS = "eiko-fotos-v1";            // fotos dos produtos (permanece entre atualizacoes)
const SHELL = [
  "./", "./instalar.html", "./manifest.json",
  "./icon-192.png", "./icon-512.png", "./logo.png", "./simbolo.png",
  // bibliotecas do app: ficam guardadas no aparelho para o app abrir sem internet
  "./lib/firebase-app-compat.js", "./lib/firebase-database-compat.js", "./lib/firebase-auth-compat.js",
  "./lib/jspdf.umd.min.js", "./lib/xlsx.full.min.js", "./lib/qrcode.min.js",
];
const ESPERA_REDE = 5000;                  // com sinal fraco, usa a copia guardada depois de 5 s

const ehImagem = (url) =>
  /\/(img|logos)\//.test(url.pathname) || /\.(png|jpe?g|webp|gif|svg)$/i.test(url.pathname);
const ehLib = (url) => /\/lib\//.test(url.pathname);
// a chave ignora "?v=123": o mesmo arquivo ocupa um lugar so no cache
const chave = (url) => url.origin + url.pathname;
const RAIZ = new URL("./", self.location.href);

// uma resposta guardada nao pode levar a marca de "redirecionada":
// o navegador recusa esse tipo de resposta ao abrir uma pagina
async function limpa(r) {
  if (!r.redirected) return r;
  return new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers });
}
async function guardar(cache, k, r) {
  try { await cache.put(k, await limpa(r)); } catch (_) {}
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        SHELL.map(async (u) => {
          try {
            const r = await fetch(u, { cache: "reload" });
            // so guarda resposta boa: pagina de erro nunca entra no cache
            if (r && r.ok) await guardar(c, chave(new URL(u, self.location.href)), r);
          } catch (_) {}
        })
      )
    ).catch(() => {})
  );
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

// onde procurar a copia guardada de um endereco
function candidatos(url, navegacao) {
  const k = chave(url);
  const lista = [k];
  if (navegacao) {
    // o servidor pode servir a mesma pagina com ou sem ".html"
    if (/\.html$/i.test(k)) lista.push(k.replace(/\.html$/i, ""));
    else if (!k.endsWith("/")) lista.push(k + ".html");
    if (/\/index(\.html)?$/i.test(url.pathname)) lista.push(chave(RAIZ));
  }
  return lista;
}
async function copiaGuardada(cache, url, navegacao) {
  for (const k of candidatos(url, navegacao)) {
    const r = await cache.match(k);
    if (r) return r;
  }
  // ultima saida de uma navegacao: a tela principal do app
  if (navegacao) return (await cache.match(chave(RAIZ))) || (await cache.match(chave(RAIZ) + "index.html")) || null;
  return null;
}

// Arquivos do app: rede primeiro; se a rede falhar, demorar ou devolver erro, usa a copia guardada
async function redePrimeiro(req, url) {
  const navegacao = req.mode === "navigate";
  const cache = await caches.open(CACHE);
  const copia = await copiaGuardada(cache, url, navegacao);
  const rede = fetch(req).then((r) => {
    if (r && r.type === "opaqueredirect") return r;          // o navegador segue o redirecionamento
    if (r && r.ok) { guardar(cache, chave(url), r.clone()); return r; }
    return copia || r;                                       // erro do servidor: prefere a copia boa
  });
  if (!copia) return rede;
  const limite = new Promise((ok) => setTimeout(() => ok(copia), ESPERA_REDE));
  return Promise.race([rede, limite]).catch(() => copia);
}

// Bibliotecas: nunca mudam dentro de uma versao -> primeiro a copia guardada
async function cachePrimeiro(req, url) {
  const cache = await caches.open(CACHE);
  const k = chave(url);
  const copia = await cache.match(k);
  if (copia) return copia;
  const r = await fetch(req);
  if (r && r.ok) guardar(cache, k, r.clone());
  return r;
}

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

  if (ehLib(url)) { e.respondWith(cachePrimeiro(e.request, url)); return; }

  e.respondWith(redePrimeiro(e.request, url));
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
