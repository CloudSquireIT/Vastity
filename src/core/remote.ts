// Aggiornamenti dei dati senza un server nostro: i file del catalogo (esopianeti, profondo cielo,
// foto delle galassie) e le texture 4K stanno anche sul sito statico di Vastity (GitHub Pages),
// che un'azione programmata rigenera ogni mese dai dati NASA. L'app confronta le versioni, scarica
// in background solo i file cambiati e li usa dal prossimo avvio. Senza rete usa quelli inclusi.

export const REMOTE_BASE = 'https://cloudsquireit.github.io/Vastity/';
const CACHE = 'vastity-data-remote-v1';
const UPDATABLE = ['data/exoplanets.json', 'data/deepsky.json', 'data/galaxy-photos.json'];
const isRemoteOrigin = () => location.href.startsWith(REMOTE_BASE);

/** Legge un file di dati: prima la copia aggiornata scaricata, poi quella inclusa nell'app. */
export async function dataFetch(path: string): Promise<Response> {
  if (UPDATABLE.includes(path) && !isRemoteOrigin() && 'caches' in window) {
    try {
      const c = await caches.open(CACHE);
      const hit = await c.match(REMOTE_BASE + path);
      if (hit) return hit;
    } catch { /* cache non disponibile */ }
  }
  return fetch(path);
}

/** Controlla in background se il sito ha dati più nuovi e li scarica per il prossimo avvio. */
export async function checkDataUpdates(): Promise<string[]> {
  if (isRemoteOrigin() || !navigator.onLine || !('caches' in window)) return [];
  try {
    const [loc, rem] = await Promise.all([
      fetch('data/version.json').then((r) => r.json()),
      fetch(REMOTE_BASE + 'data/version.json', { cache: 'no-store' }).then((r) => r.json()),
    ]);
    const c = await caches.open(CACHE);
    const got: string[] = [];
    for (const p of UPDATABLE) {
      const cached = await c.match(REMOTE_BASE + p);
      const cachedVer = cached?.headers.get('x-vastity-ver');
      if (rem.files?.[p] && rem.files[p] !== loc.files?.[p] && rem.files[p] !== cachedVer) {
        const r = await fetch(REMOTE_BASE + p, { cache: 'no-store' });
        if (!r.ok) continue;
        const body = await r.blob();
        await c.put(REMOTE_BASE + p, new Response(body, { headers: { 'content-type': 'application/json', 'x-vastity-ver': rem.files[p] } }));
        got.push(p);
      }
    }
    return got;
  } catch { return []; }
}

/** Le texture 4K non sono incluse nell'app nativa (pacchetto più leggero): arrivano dal sito, se c'è rete. */
export function texture4kUrl(name: string) {
  // incluse nell'app (anche nativa): il sito statico può non essere attivo
  return `textures/4k/${name}.webp`;
}
