// Caricamento dei cataloghi (stelle HYG, costellazioni, Messier) e utilità.
import { lang, tx } from '../i18n';

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

export async function loadCatalogs() {
  const [s, c, m] = await Promise.all([
    fetch('data/stars.json').then((r) => r.json()),
    fetch('data/constellations.json').then((r) => r.json()),
    fetch('data/messier.json').then((r) => r.json()),
  ]);
  const rows: any[] = s.rows;
  const n = rows.length;
  const cat: StarCatalog = {
    count: n,
    pos: new Float32Array(n * 3),
    absmag: new Float32Array(n),
    ci: new Float32Array(n),
    temp: new Float32Array(n),
    name: new Int32Array(n),
    con: new Array(n),
    distUnknown: new Uint8Array(n),
    names: s.names.map((n: [string, string, string, string]) => [STAR_NAMES[n[0]]?.[lang] ?? n[0], n[1], n[2], n[3]]),
  };
  rows.forEach((r, i) => {
    cat.pos[i * 3] = r[0];
    cat.pos[i * 3 + 1] = r[1];
    cat.pos[i * 3 + 2] = r[2];
    cat.absmag[i] = r[3];
    cat.ci[i] = r[4];
    cat.temp[i] = bvToTemp(r[4]);
    cat.name[i] = r[5];
    cat.con[i] = r[6];
    cat.distUnknown[i] = r[7];
  });
  stars = cat;
  constellations = Object.entries(c).map(([id, v]: [string, any]) => ({ id, name: v[lang] || v.la, la: v.la, gen: v.gen, rank: v.rank, c: v.c, lines: v.lines }));
  messier = m;
}

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
  return MESSIER_EXTRA[m.id]?.name ?? (m.alt || m.id);
}
