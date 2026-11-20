// Caricamento dei cataloghi (stelle HYG, costellazioni, Messier) e utilità.

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
  it: string;
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
    names: s.names,
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
  constellations = Object.entries(c).map(([id, v]: [string, any]) => ({ id, ...v }));
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
  gc: 'Ammasso globulare',
  oc: 'Ammasso aperto',
  pn: 'Nebulosa planetaria',
  en: 'Nebulosa a emissione',
  rn: 'Nebulosa a riflessione',
  bn: 'Nebulosa',
  snr: 'Resto di supernova',
  sg: 'Galassia spirale',
  s0: 'Galassia lenticolare',
  sd: 'Galassia spirale',
  i: 'Galassia irregolare',
  e: 'Galassia ellittica',
  ds: 'Stella doppia',
  ast: 'Asterismo',
  pos: 'Gruppo di stelle',
};

/** Distanze (anni luce) e nomi italiani degli oggetti di Messier più noti. */
export const MESSIER_EXTRA: Record<string, { it?: string; ly: number }> = {
  M1: { it: 'Nebulosa del Granchio', ly: 6500 },
  M8: { it: 'Nebulosa Laguna', ly: 4100 },
  M13: { it: 'Grande Ammasso di Ercole', ly: 22200 },
  M16: { it: 'Nebulosa Aquila', ly: 7000 },
  M17: { it: 'Nebulosa Omega', ly: 5500 },
  M20: { it: 'Nebulosa Trifida', ly: 4100 },
  M27: { it: 'Nebulosa Manubrio', ly: 1360 },
  M31: { it: 'Galassia di Andromeda', ly: 2537000 },
  M33: { it: 'Galassia del Triangolo', ly: 2730000 },
  M42: { it: 'Nebulosa di Orione', ly: 1344 },
  M44: { it: 'Presepe', ly: 577 },
  M45: { it: 'Pleiadi', ly: 444 },
  M51: { it: 'Galassia Vortice', ly: 23000000 },
  M57: { it: 'Nebulosa Anello', ly: 2570 },
  M81: { it: 'Galassia di Bode', ly: 11800000 },
  M82: { it: 'Galassia Sigaro', ly: 11500000 },
  M87: { it: 'Virgo A', ly: 53500000 },
  M101: { it: 'Galassia Girandola', ly: 20900000 },
  M104: { it: 'Galassia Sombrero', ly: 31100000 },
  M6: { it: 'Ammasso Farfalla', ly: 1600 },
  M7: { it: 'Ammasso di Tolomeo', ly: 980 },
  M22: { ly: 10600 },
  M3: { ly: 33900 },
  M5: { ly: 24500 },
  M92: { ly: 26700 },
  M11: { it: 'Ammasso Anatra Selvatica', ly: 6200 },
  M35: { ly: 2800 },
  M41: { ly: 2300 },
  M64: { it: 'Galassia Occhio Nero', ly: 17300000 },
  M97: { it: 'Nebulosa Civetta', ly: 2030 },
};

export function messierName(m: Messier) {
  return MESSIER_EXTRA[m.id]?.it ?? (m.alt || m.id);
}
