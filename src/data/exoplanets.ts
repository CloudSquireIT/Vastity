// Esopianeti confermati (NASA Exoplanet Archive) con un render 3D generato dai dati reali:
// la classe (gioviano caldo, nettuniano, super-Terra, mondo di lava, oceano, ghiaccio…) dipende
// da raggio e temperatura di equilibrio; la texture è procedurale e varia per ogni pianeta.
import { dataFetch } from '../core/remote';
import * as THREE from 'three';
import { tx } from '../i18n';
import { radecToVec } from './catalog';

export interface ExoHost { name: string; ra: number; dec: number; distPc: number; teff: number; radiusSun: number; planets: number[] }
export interface Exoplanet {
  name: string; host: number; aAU: number; periodD: number; radiusEarth: number; massEarth: number;
  eqTempK: number; ecc: number; year: number; method: string; cls: ExoClass;
}
export type ExoClass = 'hotjupiter' | 'warmjupiter' | 'coldjupiter' | 'hotneptune' | 'neptune' | 'lava' | 'desert' | 'temperate' | 'ocean' | 'ice';

export let exoHosts: ExoHost[] = [];
export let exoplanets: Exoplanet[] = [];
let methods: string[] = [];

export async function loadExoplanets() {
  try {
    const d = await (await dataFetch('data/exoplanets.json')).json();
    methods = d.methods;
    exoHosts = d.hosts.map((h: any[]) => ({ name: h[0], ra: h[1], dec: h[2], distPc: h[3], teff: h[4], radiusSun: h[5], planets: [] }));
    exoplanets = d.planets.map((p: any[], i: number) => {
      exoHosts[p[1]].planets.push(i);
      return { name: p[0], host: p[1], aAU: p[2], periodD: p[3], radiusEarth: p[4], massEarth: p[5], eqTempK: p[6], ecc: p[7], year: p[8], method: methods[p[9]] ?? '', cls: classify(p[4], p[6]) };
    });
  } catch { /* senza dati: nessun esopianeta */ }
}

export function classify(R: number, T: number): ExoClass {
  if (R > 6) return T > 1000 ? 'hotjupiter' : T > 350 ? 'warmjupiter' : 'coldjupiter';
  if (R > 2) return T > 900 ? 'hotneptune' : 'neptune';
  if (T > 1100) return 'lava';
  if (T > 380) return 'desert';
  if (T > 240) return R > 1.4 ? 'ocean' : 'temperate';
  return 'ice';
}

export const EXO_CLASS_NAME = (c: ExoClass) => ({
  hotjupiter: tx('Gioviano caldo', 'Hot Jupiter', 'Jupiter chaud'),
  warmjupiter: tx('Gigante gassoso tiepido', 'Warm gas giant', 'Géante gazeuse tiède'),
  coldjupiter: tx('Gigante gassoso freddo', 'Cold gas giant', 'Géante gazeuse froide'),
  hotneptune: tx('Nettuniano caldo', 'Hot Neptune', 'Neptune chaud'),
  neptune: tx('Mini-Nettuno', 'Mini-Neptune', 'Mini-Neptune'),
  lava: tx('Mondo di lava', 'Lava world', 'Monde de lave'),
  desert: tx('Super-Terra rovente', 'Scorching super-Earth', 'Super-Terre brûlante'),
  temperate: tx('Pianeta roccioso temperato', 'Temperate rocky planet', 'Planète rocheuse tempérée'),
  ocean: tx('Possibile mondo oceanico', 'Possible ocean world', 'Monde océan possible'),
  ice: tx('Mondo ghiacciato', 'Icy world', 'Monde glacé'),
})[c];

export const EXO_CLASS_DESC = (c: ExoClass) => ({
  hotjupiter: tx('Un gigante gassoso così vicino alla sua stella da superare i 1000 °C: il lato diurno brilla di rosso.', 'A gas giant so close to its star that it exceeds 1,000 °C: its day side glows red.', 'Une géante gazeuse si proche de son étoile qu\'elle dépasse 1 000 °C : sa face diurne rougeoie.'),
  warmjupiter: tx('Un gigante gassoso con nubi di vapori e sali, più caldo di Giove.', 'A gas giant with clouds of vapours and salts, warmer than Jupiter.', 'Une géante gazeuse aux nuages de vapeurs et de sels, plus chaude que Jupiter.'),
  coldjupiter: tx('Un gigante gassoso lontano dalla sua stella, con bande di nubi come Giove.', 'A gas giant far from its star, with cloud bands like Jupiter.', 'Une géante gazeuse loin de son étoile, avec des bandes nuageuses comme Jupiter.'),
  hotneptune: tx('Un pianeta di gas e ghiacci molto caldo, la cui atmosfera evapora lentamente.', 'A very hot world of gas and ices whose atmosphere slowly evaporates.', 'Un monde de gaz et de glaces très chaud dont l\'atmosphère s\'évapore lentement.'),
  neptune: tx('Più piccolo di Nettuno ma con un\'atmosfera densa: il tipo di pianeta più comune nella galassia, assente nel Sistema Solare.', 'Smaller than Neptune but with a thick atmosphere: the most common kind of planet in the galaxy, missing from the Solar System.', 'Plus petit que Neptune mais avec une atmosphère dense : le type de planète le plus courant, absent du Système solaire.'),
  lava: tx('Un pianeta roccioso così caldo che la superficie è probabilmente un oceano di magma.', 'A rocky planet so hot that its surface is probably an ocean of magma.', 'Une planète rocheuse si chaude que sa surface est sans doute un océan de magma.'),
  desert: tx('Una roccia arroventata, troppo calda per l\'acqua liquida.', 'A scorching rock, too hot for liquid water.', 'Une roche brûlante, trop chaude pour l\'eau liquide.'),
  temperate: tx('Un pianeta roccioso a una temperatura che potrebbe permettere acqua liquida.', 'A rocky planet at a temperature that could allow liquid water.', 'Une planète rocheuse à une température qui pourrait permettre l\'eau liquide.'),
  ocean: tx('Più grande della Terra e temperato: potrebbe essere coperto da un oceano profondo.', 'Larger than Earth and temperate: it could be covered by a deep ocean.', 'Plus grande que la Terre et tempérée : elle pourrait être couverte d\'un océan profond.'),
  ice: tx('Un mondo freddissimo, coperto di ghiacci.', 'A frigid world covered in ice.', 'Un monde glacial couvert de glaces.'),
})[c];

const PC_IN_AU = 206264.806;
function hash(s: string) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; }

/** Posizione della stella ospite (parsec, EQJ eliocentrico). */
export function hostPosPc(h: ExoHost): [number, number, number] {
  const v = radecToVec(h.ra, h.dec);
  return [v[0] * h.distPc, v[1] * h.distPc, v[2] * h.distPc];
}

/** Piano orbitale del sistema: per i pianeti in transito la linea di vista verso la Terra giace nel piano. */
function orbitBasis(h: ExoHost): [number[], number[]] {
  const los = radecToVec(h.ra, h.dec);
  const ref = Math.abs(los[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let u = [los[1] * ref[2] - los[2] * ref[1], los[2] * ref[0] - los[0] * ref[2], los[0] * ref[1] - los[1] * ref[0]];
  const lu = Math.hypot(u[0], u[1], u[2]); u = u.map((x) => x / lu);
  const w = [los[1] * u[2] - los[2] * u[1], los[2] * u[0] - los[0] * u[2], los[0] * u[1] - los[1] * u[0]];
  const t = hash(h.name) * Math.PI * 2;
  const n = u.map((x, i) => x * Math.cos(t) + w[i] * Math.sin(t)); // normale ⟂ linea di vista
  const a = los;
  const b = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
  return [a, b];
}

/** Posizione del pianeta in parsec alla data (orbita circolare nel piano del sistema). */
export function exoPosPc(i: number, timeMs: number): [number, number, number] {
  const p = exoplanets[i];
  const h = exoHosts[p.host];
  const c = hostPosPc(h);
  const [a, b] = orbitBasis(h);
  const ph = ((timeMs / 86400000) / p.periodD) * Math.PI * 2 + hash(p.name) * Math.PI * 2;
  const r = p.aAU / PC_IN_AU;
  return [c[0] + (a[0] * Math.cos(ph) + b[0] * Math.sin(ph)) * r, c[1] + (a[1] * Math.cos(ph) + b[1] * Math.sin(ph)) * r, c[2] + (a[2] * Math.cos(ph) + b[2] * Math.sin(ph)) * r];
}

// ----------------------------------------------------------------------------- texture procedurali
function rng(seed: number) { let s = (seed * 4294967296) >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

type RGB = [number, number, number];
const PALETTES: Record<ExoClass, RGB[]> = {
  hotjupiter: [[60, 22, 18], [140, 50, 30], [200, 90, 50], [90, 35, 30]],
  warmjupiter: [[150, 120, 95], [205, 180, 145], [120, 95, 80], [230, 210, 180]],
  coldjupiter: [[190, 160, 125], [225, 205, 170], [160, 120, 90], [240, 230, 210]],
  hotneptune: [[150, 160, 175], [190, 200, 210], [120, 135, 160], [220, 225, 230]],
  neptune: [[70, 120, 200], [110, 165, 225], [55, 95, 170], [150, 200, 235]],
  lava: [[25, 18, 16], [55, 35, 28], [240, 110, 30], [255, 200, 80]],
  desert: [[150, 100, 65], [190, 140, 95], [120, 80, 55], [215, 175, 130]],
  temperate: [[40, 80, 140], [70, 120, 70], [150, 130, 95], [235, 240, 245]],
  ocean: [[20, 60, 130], [35, 90, 160], [60, 130, 190], [235, 240, 250]],
  ice: [[205, 220, 235], [175, 195, 220], [235, 242, 250], [140, 165, 195]],
};
const lerp = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const texCache = new Map<string, THREE.CanvasTexture>();
/** Texture equirettangolare 512×256 generata dal tipo di pianeta e dal suo nome (ogni pianeta è diverso). */
/** Rumore a reticolo 3D (valori casuali ai vertici, interpolazione morbida), in [0, 1]. */
function noise3(seed: number) {
  const hv = (x: number, y: number, z: number) => {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = sm(x - xi), v = sm(y - yi), w = sm(z - zi);
    const L = (a: number, b: number, t: number) => a + (b - a) * t;
    return L(
      L(L(hv(xi, yi, zi), hv(xi + 1, yi, zi), u), L(hv(xi, yi + 1, zi), hv(xi + 1, yi + 1, zi), u), v),
      L(L(hv(xi, yi, zi + 1), hv(xi + 1, yi, zi + 1), u), L(hv(xi, yi + 1, zi + 1), hv(xi + 1, yi + 1, zi + 1), u), v), w);
  };
}

export function exoTexture(i: number): THREE.CanvasTexture {
  const p = exoplanets[i];
  const key = p.name;
  const hit = texCache.get(key);
  if (hit) return hit;
  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const r = rng(hash(p.name) + 0.001);
  const pal = PALETTES[p.cls].map((c) => c.map((v) => Math.min(255, v * (0.85 + r() * 0.3))) as RGB);
  // rumore campionato sulla sfera (non sulla mappa piatta): niente "raggiera" ai poli né cucitura
  const seed = Math.floor(r() * 1e6);
  const N1 = noise3(seed), N2 = noise3(seed + 17), N3 = noise3(seed + 131);
  const SX = new Float32Array(W * H), SY = new Float32Array(W * H), SZ = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const la = (0.5 - (y + 0.5) / H) * Math.PI, cl = Math.cos(la), sl = Math.sin(la);
    for (let x = 0; x < W; x++) { const lo = ((x + 0.5) / W) * Math.PI * 2; const k = y * W + x; SX[k] = cl * Math.cos(lo); SY[k] = cl * Math.sin(lo); SZ[k] = sl; }
  }
  const at = (N: (a: number, b: number, c: number) => number, f: number) => (x: number, y: number) => { const k = y * W + x; return N(SX[k] * f, SY[k] * f, SZ[k] * f); };
  const n1 = at(N1, 2.4), n2 = at(N2, 7), n3 = at(N3, 18);
  const gas = /jupiter|neptune/.test(p.cls);
  const bands = 6 + Math.floor(r() * 10);
  const tilt = (r() - 0.5) * 0.15;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const lat = y / H - 0.5;
      const turb = n2(x, y) * 0.6 + n3(x, y) * 0.4;
      let c: RGB;
      if (gas) {
        // bande di nubi con turbolenze e qualche vortice
        const b = Math.sin((lat + tilt * Math.sin((x / W) * Math.PI * 2)) * bands * Math.PI + (turb - 0.5) * 2.2 + n1(x, y) * 1.5);
        const t = 0.5 + 0.5 * b;
        c = lerp(lerp(pal[0], pal[1], t), lerp(pal[2], pal[3], n2(x, y)), 0.35 * turb);
        if (p.cls === 'hotjupiter') c = lerp(c, pal[2], Math.max(0, 1 - Math.abs(lat) * 3) * 0.4);
        if (p.cls === 'neptune' || p.cls === 'hotneptune') c = lerp(c, pal[3], Math.max(0, n3(x, y) - 0.72) * 2.5);
      } else {
        const h = n1(x, y) * 0.55 + n2(x, y) * 0.3 + n3(x, y) * 0.15;
        if (p.cls === 'lava') {
          // crosta scura con fessure incandescenti
          const crack = Math.pow(Math.max(0, 1 - Math.abs(n2(x, y) - 0.5) * 9), 2);
          c = lerp(lerp(pal[0], pal[1], h), lerp(pal[2], pal[3], n3(x, y)), Math.min(1, crack + Math.max(0, 0.45 - h) * 1.5));
        } else if (p.cls === 'temperate' || p.cls === 'ocean') {
          const sea = p.cls === 'ocean' ? 0.72 : 0.55;
          c = h < sea ? lerp(pal[0], pal[2], h / sea) : lerp(pal[1], pal[2], (h - sea) * 3);
          const cloud = Math.max(0, n3(x, y) * 0.6 + n2(x, y) * 0.4 - 0.55) * 2.6;
          c = lerp(c, pal[3], Math.min(0.9, cloud));
          if (Math.abs(lat) > 0.41 + (n2(x, y) - 0.5) * 0.1) c = lerp(c, pal[3], 0.85);
        } else {
          c = lerp(lerp(pal[0], pal[1], h), lerp(pal[2], pal[3], turb), 0.4);
          if (p.cls === 'ice') c = lerp(c, pal[2], Math.max(0, Math.abs(lat) * 2.2 - 0.5));
        }
      }
      const o = (y * W + x) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  texCache.set(key, tex);
  if (texCache.size > 40) { const k = texCache.keys().next().value!; texCache.get(k)?.dispose(); texCache.delete(k); }
  return tex;
}
