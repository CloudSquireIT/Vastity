// Caricamento dei cataloghi (stelle HYG, costellazioni, Messier) e utilità.
import { lang, tx } from '../i18n';
import { EXTRA_STARS, GalaxyShape, deepObjects } from './deep';
import { localName } from './names';

export const PC_IN_LY = 3.26156;
export const PC_IN_KM = 3.0856775814913673e13;
export const AU_IN_KM = 149597870.7;
export const LY_IN_KM = 9.4607304725808e12;
export const C_KMS = 299792.458;

export interface StarCatalog {
  count: number;
  /** Posizioni eliocentriche EQJ in parsec. */
  pos: Float32Array;
  absmag: Float32Array;
  ci: Float32Array;
  temp: Float32Array;
  name: Int32Array;
  con: string[];
  distUnknown: Uint8Array;
  names: [string, string, string, string][]; // [nome proprio, designazione, hip, spettro]
}

export interface Constellation {
  id: string;
  /** Nome nella lingua dell'interfaccia. */
  name: string;
  la: string;
  gen: string;
  rank: number;
  c: [number, number];
  lines: [number, number][][];
}

export interface Messier {
  id: string;
  alt: string;
  type: string;
  /** Designazione NGC/IC (catalogo Caldwell). */
  ngc?: string;
  mag: number;
  ra: number;
  dec: number;
}

/** Temperatura effettiva dall'indice di colore B-V (formula di Ballesteros). */
export function bvToTemp(bv: number) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/** Nomi propri delle stelle che cambiano da lingua a lingua (il catalogo usa l'inglese). */
const STAR_NAMES: Record<string, Partial<Record<'it' | 'en' | 'fr', string>>> = {
  Sol: { it: 'Sole', fr: 'Soleil', en: 'Sun' },
  Polaris: { it: 'Stella Polare', fr: 'Étoile polaire' },
  'Rigil Kentaurus': { it: 'Alfa Centauri', en: 'Alpha Centauri', fr: 'Alpha du Centaure' },
  Toliman: { it: 'Alfa Centauri B', en: 'Alpha Centauri B', fr: 'Alpha du Centaure B' },
  'Proxima Centauri': { fr: 'Proxima du Centaure' },
  Sirius: { it: 'Sirio' },
  Arcturus: { it: 'Arturo' },
  Procyon: { it: 'Procione' },
  Canopus: { it: 'Canopo' },
  Regulus: { it: 'Regolo', fr: 'Régulus' },
  Castor: { it: 'Castore' },
  Pollux: { it: 'Polluce' },
  Aldebaran: { fr: 'Aldébaran' },
  Betelgeuse: { fr: 'Bételgeuse' },
  Antares: { fr: 'Antarès' },
  Deneb: { fr: 'Deneb' },
  Fomalhaut: { fr: 'Fomalhaut' },
  Spica: { fr: 'Spica' },
};

export let stars: StarCatalog;
export let constellations: Constellation[] = [];
export let messier: Messier[] = [];
/** Foto reali delle galassie (texture gal_<id>): tipo, rapporto assiale misurato e crediti. */
export interface GalaxyPhoto { kind: 'face' | 'edge'; q: number; file: string; license: string; credit: string; source: string }
export let galaxyPhotos: Record<string, GalaxyPhoto> = {};

/** Avanzamento del caricamento (0–1), per la schermata iniziale. */
export let onLoadProgress: ((p: number) => void) | null = null;
export function setLoadProgress(cb: (p: number) => void) { onLoadProgress = cb; }

/** Scarica un file riportando l'avanzamento (se il server indica la dimensione). */
async function fetchBuffer(url: string, weight: number, done: { v: number }): Promise<ArrayBuffer> {
  const r = await fetch(url);
  const total = +(r.headers.get('content-length') ?? 0);
  if (!r.body || !total) { const b = await r.arrayBuffer(); done.v += weight; onLoadProgress?.(done.v); return b; }
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    chunks.push(value);
    got += value.length;
    onLoadProgress?.(done.v + weight * Math.min(1, got / total));
  }
  done.v += weight;
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

export async function loadCatalogs() {
  const prog = { v: 0 };
  const json = async (url: string, w: number) => JSON.parse(new TextDecoder().decode(await fetchBuffer(url, w, prog)));
  const [bin, meta, c, m, wiki] = await Promise.all([
    fetchBuffer('data/stars.bin.json', 0.45, prog),
    json('data/stars-meta.json', 0.3),
    json('data/constellations.json', 0.05),
    json('data/messier.json', 0.02),
    json('data/deepsky.json', 0.02).catch(() => ({ messier: {}, caldwell: [] })),
    json('data/galaxy-photos.json', 0.02).then((g) => { galaxyPhotos = g; }).catch(() => {}),
  ]);
  // catalogo binario: Float32 x,y,z,absmag,ci · Int32 nome · Uint8 costellazione · Uint8 distanza ignota
  const N0: number = meta.count;
  const f32 = new Float32Array(bin, 0, N0 * 5);
  const i32 = new Int32Array(bin, N0 * 20, N0);
  const u8 = new Uint8Array(bin, N0 * 24, N0 * 2);
  const names: [string, string, string, string][] = [...meta.names];
  const n = N0 + EXTRA_STARS.length;
  const cat: StarCatalog = {
    count: n,
    pos: new Float32Array(n * 3),
    absmag: new Float32Array(n),
    ci: new Float32Array(n),
    temp: new Float32Array(n),
    name: new Int32Array(n),
    con: new Array(n),
    distUnknown: new Uint8Array(n),
    names: [],
  };
  for (let i = 0; i < N0; i++) {
    cat.pos[i * 3] = f32[i * 5]; cat.pos[i * 3 + 1] = f32[i * 5 + 1]; cat.pos[i * 3 + 2] = f32[i * 5 + 2];
    cat.absmag[i] = f32[i * 5 + 3];
    cat.ci[i] = f32[i * 5 + 4];
    cat.temp[i] = bvToTemp(f32[i * 5 + 4]);
    cat.name[i] = i32[i];
    cat.con[i] = u8[i] ? meta.cons[u8[i] - 1] : '';
    cat.distUnknown[i] = u8[N0 + i];
  }
  // stelle estreme non presenti in HYG (supergiganti, Wolf-Rayet, LBV)
  EXTRA_STARS.forEach((x, k) => {
    const i = N0 + k;
    const d = x.ly / PC_IN_LY;
    const v = radecToVec(x.ra, x.dec);
    names.push([x.name, x.desig, '', x.spect]);
    cat.pos[i * 3] = v[0] * d; cat.pos[i * 3 + 1] = v[1] * d; cat.pos[i * 3 + 2] = v[2] * d;
    cat.absmag[i] = x.absmag; cat.ci[i] = 1.5; cat.temp[i] = x.temp; cat.name[i] = names.length - 1; cat.con[i] = ''; cat.distUnknown[i] = 0;
  });
  cat.names = names.map((nm) => [STAR_NAMES[nm[0]]?.[lang] ?? nm[0], nm[1], nm[2], nm[3]]);
  stars = cat;
  constellations = Object.entries(c).map(([id, v]: [string, any]) => ({ id, name: v[lang] || v.la, la: v.la, gen: v.gen, rank: v.rank, c: v.c, lines: v.lines }));
  messier = m;
  mergeWikiCatalog(wiki);
}

/** Integra le distanze di Messier e il catalogo Caldwell importati da Wikipedia (CC BY-SA 4.0). */
function mergeWikiCatalog(wiki: { messier: Record<string, { ly: number }>; caldwell: (Messier & { ly: number })[] }) {
  for (const [id, v] of Object.entries(wiki.messier)) {
    if (!v.ly) continue;
    if (MESSIER_EXTRA[id]) continue;
    MESSIER_EXTRA[id] = { ly: v.ly };
  }
  const deep = deepObjects();
  const sep = (a: { ra: number; dec: number }, b: { ra: number; dec: number }) => {
    const va = radecToVec(a.ra, a.dec), vb = radecToVec(b.ra, b.dec);
    return Math.acos(Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])) * 180 / Math.PI;
  };
  const noRender = new Set<string>();
  for (const c of [...wiki.caldwell, ...CALDWELL_MISSING]) {
    // se coincide con un oggetto Messier o del catalogo esteso, lo si collega invece di duplicarlo
    const dup = messier.find((x) => x.id[0] === 'M' && sep(x, c) < 0.15);
    if (dup) continue;
    const d = deep.find((o) => !o.messier && o.id !== 'milkyway' && !['blackhole', 'pulsar', 'quasar'].includes(o.type) && (sep(o, c) < 0.12 || (sep(o, c) < 0.3 && Math.abs(Math.log10(o.ly / c.ly)) < 0.5)));
    if (d) { d.messier = c.id; }
    // stessa posizione di un oggetto già collegato (es. le due metà delle Antenne): niente render doppio
    const twin = !d && deep.find((o) => o.messier && sep(o, c) < 0.05);
    if (twin) noRender.add(c.id);
    messier.push({ id: c.id, alt: twin ? twin.name : c.alt, type: c.type, mag: c.mag, ra: c.ra, dec: c.dec, ngc: c.ngc });
    MESSIER_EXTRA[c.id] = { ly: c.ly, name: CALDWELL_NAMES[c.id] };
  }
  // ogni galassia del catalogo ha un render 3D (impostor procedurale), come quelle curate
  const SHAPE: Record<string, GalaxyShape> = { s: 'spiral', sg: 'spiral', sd: 'spiral', s0: 'lenticular', e: 'elliptical', i: 'irregular' };
  const linked = new Set(deep.map((o) => o.messier).filter(Boolean));
  for (const m of messier) {
    const shape = SHAPE[m.type];
    const ly = MESSIER_EXTRA[m.id]?.ly;
    if (!shape || !ly || linked.has(m.id) || noRender.has(m.id)) continue;
    let hsh = 0;
    for (const ch of m.id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = (k: number) => ((Math.sin(hsh * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    // dimensione e luminosità dalla magnitudine assoluta: le nane (M32, M110…) restano piccole e tenui
    const absMag = Math.min(m.mag, 14) - 5 * Math.log10((ly / PC_IN_LY) / 10);
    const lum = Math.pow(10, -0.4 * (absMag + 21));
    const radiusLy = Math.max(2500, Math.min(110000, 42000 * Math.pow(lum, 0.5) * (shape === 'elliptical' ? 0.7 : shape === 'irregular' ? 0.8 : 1)));
    const bright = Math.max(0.3, Math.min(1.15, Math.pow(lum, 0.25)));
    deep.push({
      id: m.id.toLowerCase() + 'g', name: messierName(m) === m.id ? `${m.id}${m.ngc ? ' · ' + m.ngc : ''}` : messierName(m),
      type: 'galaxy', ra: m.ra, dec: m.dec, ly, radiusLy, bright, messier: m.id, desc: GALAXY_DESC[shape],
      galaxy: { shape, incl: shape === 'elliptical' ? 40 : EDGE_ON.has(m.id) ? 87 : 15 + rnd(1) * 75, pa: rnd(2) * 180, arms: shape === 'spiral' ? 2 + Math.floor(rnd(3) * 2.2) : shape === 'lenticular' ? 2 : 1 },
    });
  }
}

/** Galassie famose viste di taglio. */
const EDGE_ON = new Set(['C23', 'C38', 'C32', 'C26', 'M102', 'C24', 'C52']);

const GALAXY_DESC: Record<GalaxyShape, string> = {
  spiral: tx('Una galassia a spirale: bracci di stelle giovani e polveri attorno a un nucleo di stelle antiche.', 'A spiral galaxy: arms of young stars and dust around a core of old stars.', 'Une galaxie spirale : des bras d\'étoiles jeunes et de poussières autour d\'un noyau d\'étoiles anciennes.'),
  barred: tx('Una spirale barrata: una barra di stelle attraversa il nucleo.', 'A barred spiral: a bar of stars crosses the core.', 'Une spirale barrée : une barre d\'étoiles traverse le noyau.'),
  elliptical: tx('Una galassia ellittica: miliardi di stelle antiche, poca polvere e quasi nessuna nuova stella.', 'An elliptical galaxy: billions of old stars, little dust and almost no new stars.', 'Une galaxie elliptique : des milliards d\'étoiles anciennes, peu de poussière et presque pas de nouvelles étoiles.'),
  lenticular: tx('Una galassia lenticolare: un disco senza bracci evidenti, a metà tra spirale ed ellittica.', 'A lenticular galaxy: a disk without obvious arms, halfway between spiral and elliptical.', 'Une galaxie lenticulaire : un disque sans bras marqués, entre spirale et elliptique.'),
  irregular: tx('Una galassia irregolare, senza una forma definita, spesso ricca di gas e stelle giovani.', 'An irregular galaxy with no defined shape, often rich in gas and young stars.', 'Une galaxie irrégulière, sans forme définie, souvent riche en gaz et en étoiles jeunes.'),
  ring: tx('Una galassia ad anello.', 'A ring galaxy.', 'Une galaxie annulaire.'),
};

const CALDWELL_MISSING: (Messier & { ly: number })[] = [
  { id: 'C9', alt: 'Cave Nebula', ngc: 'Sh2-155', type: 'en', mag: 7.7, ra: 344.2, dec: 62.617, ly: 2400 },
  { id: 'C97', alt: 'Pearl Cluster', ngc: 'NGC 3766', type: 'oc', mag: 5.3, ra: 174.06, dec: -61.608, ly: 5800 },
  { id: 'C99', alt: 'Coalsack Nebula', ngc: '', type: 'dn', mag: 99, ra: 192.5, dec: -62.5, ly: 600 },
];

const CALDWELL_NAMES: Record<string, string> = {
  C9: tx('Nebulosa Caverna', 'Cave Nebula', 'Nébuleuse de la Caverne'),
  C99: tx('Sacco di Carbone', 'Coalsack Nebula', 'Sac de Charbon'),
  C20: tx('Nebulosa Nord America', 'North America Nebula', 'Nébuleuse de l\'Amérique du Nord'),
  C49: tx('Nebulosa Rosetta', 'Rosette Nebula', 'Nébuleuse de la Rosette'),
  C41: tx('Iadi', 'Hyades', 'Hyades'),
  C55: tx('Nebulosa Saturno', 'Saturn Nebula', 'Nébuleuse Saturne'),
  C39: tx('Nebulosa Eschimese', 'Eskimo Nebula', 'Nébuleuse de l\'Esquimau'),
  C46: tx('Nebulosa Variabile di Hubble', 'Hubble\'s Variable Nebula', 'Nébuleuse variable de Hubble'),
  C27: tx('Nebulosa Crescente', 'Crescent Nebula', 'Nébuleuse du Croissant'),
  C5: tx('Galassia Nascosta', 'Hidden Galaxy', 'Galaxie cachée'),
  C23: tx('Galassia Ago d\'argento', 'Silver Needle Galaxy', 'Galaxie de l\'Aiguille d\'argent'),
  C38: tx('Galassia Ago', 'Needle Galaxy', 'Galaxie de l\'Aiguille'),
  C30: 'NGC 7331',
  C94: tx('Scrigno di gioielli', 'Jewel Box', 'Boîte à bijoux'),
  C76: tx('Ammasso Tavola', 'Table of Scorpius', 'Table du Scorpion'),
};

export function starDistPc(i: number) {
  const p = stars.pos;
  return Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
}

export function starAppMag(i: number) {
  return stars.absmag[i] + 5 * Math.log10(starDistPc(i)) - 5;
}

export function starRaDec(i: number) {
  const p = stars.pos;
  const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
  const d = Math.hypot(x, y, z);
  let ra = (Math.atan2(y, x) * 180) / Math.PI;
  if (ra < 0) ra += 360;
  return { ra, dec: (Math.asin(z / d) * 180) / Math.PI };
}

export function starName(i: number): string {
  const ni = stars.name[i];
  if (ni < 0) return `HYG ${i}`;
  const [proper, desig, hip] = stars.names[ni];
  return proper || desig || `HIP ${hip}`;
}

export function starSubtitle(i: number): string {
  const ni = stars.name[i];
  if (ni < 0) return '';
  const [proper, desig] = stars.names[ni];
  return proper && desig ? desig : '';
}

export function starSpectrum(i: number) {
  const ni = stars.name[i];
  return ni < 0 ? '' : stars.names[ni][3];
}

/** Luminosità (in L☉) e raggio (in R☉) stimati. */
export function starPhysical(i: number) {
  const L = Math.pow(10, -0.4 * (stars.absmag[i] - 4.83));
  const T = stars.temp[i];
  const R = Math.sqrt(L) / Math.pow(T / 5772, 2);
  return { L, R, T };
}

export function constellationById(id: string) {
  return constellations.find((c) => c.id === id);
}

export function radecToVec(raDeg: number, decDeg: number): [number, number, number] {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

export const MESSIER_TYPES: Record<string, string> = {
  gc: tx('Ammasso globulare', 'Globular cluster', 'Amas globulaire'),
  oc: tx('Ammasso aperto', 'Open cluster', 'Amas ouvert'),
  pn: tx('Nebulosa planetaria', 'Planetary nebula', 'Nébuleuse planétaire'),
  en: tx('Nebulosa a emissione', 'Emission nebula', 'Nébuleuse en émission'),
  rn: tx('Nebulosa a riflessione', 'Reflection nebula', 'Nébuleuse par réflexion'),
  bn: tx('Nebulosa', 'Nebula', 'Nébuleuse'),
  snr: tx('Resto di supernova', 'Supernova remnant', 'Rémanent de supernova'),
  s: tx('Galassia spirale', 'Spiral galaxy', 'Galaxie spirale'),
  sg: tx('Galassia spirale', 'Spiral galaxy', 'Galaxie spirale'),
  sfr: tx('Regione di formazione stellare', 'Star-forming region', 'Région de formation d\'étoiles'),
  s0: tx('Galassia lenticolare', 'Lenticular galaxy', 'Galaxie lenticulaire'),
  sd: tx('Galassia spirale', 'Spiral galaxy', 'Galaxie spirale'),
  i: tx('Galassia irregolare', 'Irregular galaxy', 'Galaxie irrégulière'),
  e: tx('Galassia ellittica', 'Elliptical galaxy', 'Galaxie elliptique'),
  ds: tx('Stella doppia', 'Double star', 'Étoile double'),
  ast: tx('Asterismo', 'Asterism', 'Astérisme'),
  pos: tx('Gruppo di stelle', 'Star group', 'Groupe d\'étoiles'),
  dn: tx('Nebulosa oscura', 'Dark nebula', 'Nébuleuse obscure'),
};

/** Distanze (anni luce) e nomi degli oggetti di Messier più noti. */
export const MESSIER_EXTRA: Record<string, { name?: string; ly: number }> = {
  M1: { name: tx('Nebulosa del Granchio', 'Crab Nebula', 'Nébuleuse du Crabe'), ly: 6500 },
  M8: { name: tx('Nebulosa Laguna', 'Lagoon Nebula', 'Nébuleuse de la Lagune'), ly: 4100 },
  M13: { name: tx('Grande Ammasso di Ercole', 'Great Hercules Cluster', 'Grand amas d\'Hercule'), ly: 22200 },
  M16: { name: tx('Nebulosa Aquila', 'Eagle Nebula', 'Nébuleuse de l\'Aigle'), ly: 7000 },
  M17: { name: tx('Nebulosa Omega', 'Omega Nebula', 'Nébuleuse Oméga'), ly: 5500 },
  M20: { name: tx('Nebulosa Trifida', 'Trifid Nebula', 'Nébuleuse Trifide'), ly: 4100 },
  M27: { name: tx('Nebulosa Manubrio', 'Dumbbell Nebula', 'Nébuleuse de l\'Haltère'), ly: 1360 },
  M31: { name: tx('Galassia di Andromeda', 'Andromeda Galaxy', 'Galaxie d\'Andromède'), ly: 2537000 },
  M33: { name: tx('Galassia del Triangolo', 'Triangulum Galaxy', 'Galaxie du Triangle'), ly: 2730000 },
  M42: { name: tx('Nebulosa di Orione', 'Orion Nebula', 'Nébuleuse d\'Orion'), ly: 1344 },
  M44: { name: tx('Presepe', 'Beehive Cluster', 'Amas de la Ruche'), ly: 577 },
  M45: { name: tx('Pleiadi', 'Pleiades', 'Pléiades'), ly: 444 },
  M51: { name: tx('Galassia Vortice', 'Whirlpool Galaxy', 'Galaxie du Tourbillon'), ly: 23000000 },
  M57: { name: tx('Nebulosa Anello', 'Ring Nebula', 'Nébuleuse de l\'Anneau'), ly: 2570 },
  M81: { name: tx('Galassia di Bode', 'Bode\'s Galaxy', 'Galaxie de Bode'), ly: 11800000 },
  M82: { name: tx('Galassia Sigaro', 'Cigar Galaxy', 'Galaxie du Cigare'), ly: 11500000 },
  M87: { name: 'Virgo A', ly: 53500000 },
  M101: { name: tx('Galassia Girandola', 'Pinwheel Galaxy', 'Galaxie du Moulinet'), ly: 20900000 },
  M104: { name: tx('Galassia Sombrero', 'Sombrero Galaxy', 'Galaxie du Sombrero'), ly: 31100000 },
  M6: { name: tx('Ammasso Farfalla', 'Butterfly Cluster', 'Amas du Papillon'), ly: 1600 },
  M7: { name: tx('Ammasso di Tolomeo', 'Ptolemy Cluster', 'Amas de Ptolémée'), ly: 980 },
  M22: { ly: 10600 },
  M3: { ly: 33900 },
  M5: { ly: 24500 },
  M92: { ly: 26700 },
  M11: { name: tx('Ammasso Anatra Selvatica', 'Wild Duck Cluster', 'Amas du Canard sauvage'), ly: 6200 },
  M35: { ly: 2800 },
  M41: { ly: 2300 },
  M64: { name: tx('Galassia Occhio Nero', 'Black Eye Galaxy', 'Galaxie de l\'Œil noir'), ly: 17300000 },
  M97: { name: tx('Nebulosa Civetta', 'Owl Nebula', 'Nébuleuse du Hibou'), ly: 2030 },
};

export function messierName(m: Messier) {
  return MESSIER_EXTRA[m.id]?.name ?? (m.alt ? localName(m.alt) : m.id);
}
