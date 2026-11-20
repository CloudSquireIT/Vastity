// Service worker di Vastity: l'app funziona completamente offline.
// - "guscio" (codice, font, cataloghi): salvato all'installazione dall'elenco precache.json generato dalla build;
// - texture e foto: salvate la prima volta che servono, in una cache che sopravvive agli aggiornamenti;
// - meteo e orbite (altri domini): sempre dalla rete.
const MEDIA = 'vastity-media-v1';
let SHELL = 'vastity-shell';

async function manifest() {
  const r = await fetch('precache.json', { cache: 'no-store' });
  return r.json();
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const m = await manifest();
    const c = await caches.open('vastity-shell-' + m.version);
    await c.addAll(m.files);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const m = await manifest().catch(() => null);
    if (m) SHELL = 'vastity-shell-' + m.version;
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('vastity-') && k !== SHELL && k !== MEDIA).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isMedia = (p) => /\/(textures|photos)\//.test(p);

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (isMedia(url.pathname)) {
    // texture e foto: dalla cache se ci sono, altrimenti scarica e conserva
    e.respondWith(caches.open(MEDIA).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  // guscio: prima la cache (avvio istantaneo), con aggiornamento in background; offline → index
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' });
    const net = fetch(e.request).then(async (res) => {
      if (res.ok && !url.pathname.endsWith('precache.json')) {
        const keys = await caches.keys();
        const shell = keys.find((k) => k.startsWith('vastity-shell-'));
        if (shell) (await caches.open(shell)).put(e.request, res.clone());
      }
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (e.request.mode === 'navigate') return (await caches.match('index.html')) || Response.error();
    return Response.error();
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
