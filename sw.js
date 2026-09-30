/* ═══════════════════════════════════════════════════════════════════════
   Il lavoro dietro le quinte della web app.

   - La pagina, le librerie, i marchi e le anteprime si tengono sul
     dispositivo: l'archivio si apre anche senza rete.
   - Pagina, elenco e script si chiedono prima alla rete, cosi' dopo un
     aggiornamento si vede subito la versione nuova; la copia serve solo
     quando la rete non c'e'.
   - I modelli 3D si salvano la prima volta che li apri, e da li' in poi
     si aprono dal dispositivo, anche offline. Non si scarica niente in
     anticipo: l'archivio completo pesa centinaia di megabyte.

   Cambiando VERSIONE si butta la vecchia copia della pagina; i modelli
   restano, perche' non cambiano da un'edizione all'altra.
   ═══════════════════════════════════════════════════════════════════════ */
const VERSIONE = 'ce-4.9';
const GUSCIO = VERSIONE + '-guscio';
const MODELLI = 'ce-modelli';

const DI_BASE = [
  './', 'index.html', 'manifest.webmanifest', 'modelli.json', 'orientamenti.json',
  'lib/three.module.js', 'lib/OrbitControls.js', 'lib/OBJLoader.js', 'lib/MTLLoader.js',
  'lib/giochi.js', 'lib/lingue.js', 'lib/lingue-testi.js',
  'lib/font/dm-sans-latin-400-normal.woff2', 'lib/font/dm-sans-latin-500-normal.woff2',
  'lib/font/dm-sans-latin-700-normal.woff2', 'lib/font/dm-sans-latin-400-italic.woff2',
  'marchi/app-192.png', 'marchi/app-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(GUSCIO);
    // uno alla volta: se un file manca, gli altri si salvano lo stesso
    await Promise.allSettled(DI_BASE.map(u => c.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys())
      if (k !== GUSCIO && k !== MODELLI) await caches.delete(k);
    await self.clients.claim();
  })());
});

const senzaDomanda = u => { const x = new URL(u); x.search = ''; return x.href; };

async function primaLaRete(req){
  const c = await caches.open(GUSCIO);
  try{
    const r = await fetch(req);
    if (r.ok) c.put(senzaDomanda(req.url), r.clone());
    return r;
  }catch(err){
    const vecchia = await c.match(senzaDomanda(req.url)) ||
                    (req.mode === 'navigate' ? await c.match('index.html') : null);
    if (vecchia) return vecchia;
    throw err;
  }
}

async function primaLaCopia(req, nome){
  const c = await caches.open(nome);
  const vecchia = await c.match(req);
  if (vecchia) return vecchia;
  const r = await fetch(req);
  // la copia si salva mentre la pagina legge: la percentuale resta vera
  if (r.ok && r.status === 200) c.put(req, r.clone()).catch(() => { /* spazio finito: pazienza */ });
  return r;
}

async function copiaPoiRete(req){
  const c = await caches.open(GUSCIO);
  const vecchia = await c.match(req);
  const nuova = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
  return vecchia || (await nuova) || fetch(req);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const p = url.pathname;
  if (p.includes('/epigrafi/')) e.respondWith(primaLaCopia(req, MODELLI));
  else if (req.mode === 'navigate' || /\.(html|json|js|webmanifest)$/.test(p) || p.endsWith('/'))
    e.respondWith(primaLaRete(req));
  else e.respondWith(copiaPoiRete(req));
});
