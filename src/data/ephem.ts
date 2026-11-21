// Lune dei pianeti e veicoli spaziali in tempo reale.
// - Lune: elementi orbitali da NASA/JPL Horizons (scripts/build-ephem.mjs), propagati come orbite kepleriane.
// - Veicoli nello spazio profondo (Tesla Roadster, James Webb, Voyager, New Horizons): tabelle di
//   posizione e velocità da Horizons, interpolate con spline di Hermite.
// - Satelliti in orbita terrestre (ISS, Tiangong, Hubble): elementi TLE aggiornati e modello SGP4.
import * as A from 'astronomy-engine';
import * as satTypes from 'satellite.js';
import * as satImpl from '../vendor/satellite';
import { V3 } from '../astro/astro';
import { AU_IN_KM } from './catalog';
import { dataFetch } from '../core/remote';
import { tx } from '../i18n';
const sat = satImpl as unknown as typeof satTypes;

export interface MoonEl { id: string; name: string; planet: string; r: number; e: number; a: number; i: number; node: number; peri: number; M: number; n: number }
interface CraftTab { id: string; name: string; jd0: number; step: number; n: number; data: number[] }

export interface Craft {
  id: string; name: string; kind: 'leo' | 'deep';
  /** Dimensione caratteristica in km (per l'avvicinamento e il disegno). */
  sizeKm: number; desc: string; catnr?: number;
}

export const CRAFT: Craft[] = [
  { id: 'iss', name: tx('Stazione Spaziale Internazionale', 'International Space Station', 'Station spatiale internationale'), kind: 'leo', sizeKm: 0.109, catnr: 25544,
    desc: tx('Il laboratorio orbitante abitato dal 2000: gira intorno alla Terra in 92 minuti a 420 km di quota.', 'The orbiting laboratory inhabited since 2000: it circles Earth every 92 minutes, 420 km up.', 'Le laboratoire orbital habité depuis 2000 : il fait le tour de la Terre en 92 minutes, à 420 km d\'altitude.') },
  { id: 'tiangong', name: 'Tiangong', kind: 'leo', sizeKm: 0.055, catnr: 48274,
    desc: tx('La stazione spaziale cinese, abitata dal 2021, in orbita a circa 390 km.', 'The Chinese space station, inhabited since 2021, orbiting about 390 km up.', 'La station spatiale chinoise, habitée depuis 2021, en orbite à environ 390 km.') },
  { id: 'hubble', name: tx('Telescopio Hubble', 'Hubble Space Telescope', 'Télescope Hubble'), kind: 'leo', sizeKm: 0.0132, catnr: 20580,
    desc: tx('In orbita dal 1990 a circa 530 km: ha misurato l\'età dell\'universo e fotografato galassie lontanissime.', 'In orbit since 1990, about 530 km up: it measured the age of the universe and imaged extremely distant galaxies.', 'En orbite depuis 1990 à environ 530 km : il a mesuré l\'âge de l\'univers et photographié des galaxies très lointaines.') },
  { id: 'jwst', name: tx('Telescopio James Webb', 'James Webb Space Telescope', 'Télescope James Webb'), kind: 'deep', sizeKm: 0.021,
    desc: tx('Il più grande telescopio spaziale, a 1,5 milioni di km dalla Terra nel punto L2, dietro uno scudo grande come un campo da tennis.', 'The largest space telescope, 1.5 million km from Earth at L2, behind a sunshield the size of a tennis court.', 'Le plus grand télescope spatial, à 1,5 million de km de la Terre au point L2, derrière un pare-soleil grand comme un court de tennis.') },
  { id: 'tesla', name: 'Tesla Roadster', kind: 'deep', sizeKm: 0.004,
    desc: tx('L\'auto lanciata nel 2018 dal primo Falcon Heavy, con il manichino «Starman» al volante: gira intorno al Sole tra la Terra e Marte.', 'The car launched in 2018 on the first Falcon Heavy, with the “Starman” mannequin at the wheel: it orbits the Sun between Earth and Mars.', 'La voiture lancée en 2018 par le premier Falcon Heavy, avec le mannequin « Starman » au volant : elle tourne autour du Soleil entre la Terre et Mars.') },
  { id: 'voyager1', name: 'Voyager 1', kind: 'deep', sizeKm: 0.013,
    desc: tx('Lanciata nel 1977, è l\'oggetto umano più lontano: dal 2012 viaggia nello spazio interstellare.', 'Launched in 1977, it is the most distant human-made object: it has been in interstellar space since 2012.', 'Lancée en 1977, c\'est l\'objet humain le plus lointain : elle voyage dans l\'espace interstellaire depuis 2012.') },
  { id: 'voyager2', name: 'Voyager 2', kind: 'deep', sizeKm: 0.013,
    desc: tx('L\'unica sonda ad aver visitato Urano e Nettuno; nello spazio interstellare dal 2018.', 'The only probe to have visited Uranus and Neptune; in interstellar space since 2018.', 'La seule sonde à avoir visité Uranus et Neptune ; dans l\'espace interstellaire depuis 2018.') },
  { id: 'newhorizons', name: 'New Horizons', kind: 'deep', sizeKm: 0.003,
    desc: tx('Ha sorvolato Plutone nel 2015 e Arrokoth nel 2019; ora esplora la fascia di Kuiper.', 'It flew past Pluto in 2015 and Arrokoth in 2019; it is now exploring the Kuiper belt.', 'Elle a survolé Pluton en 2015 et Arrokoth en 2019 ; elle explore maintenant la ceinture de Kuiper.') },
];
export const craftById = (id: string) => CRAFT.find((c) => c.id === id);

const MOON_NAMES: Record<string, [string, string]> = {
  phobos: ['Fobos', 'Phobos'], deimos: ['Deimos', 'Deimos'], io: ['Io', 'Io'], europa: ['Europa', 'Europe'], ganymede: ['Ganimede', 'Ganymède'], callisto: ['Callisto', 'Callisto'],
  mimas: ['Mimas', 'Mimas'], enceladus: ['Encelado', 'Encelade'], tethys: ['Teti', 'Téthys'], dione: ['Dione', 'Dioné'], rhea: ['Rea', 'Rhéa'], titan: ['Titano', 'Titan'], iapetus: ['Giapeto', 'Japet'],
  miranda: ['Miranda', 'Miranda'], ariel: ['Ariel', 'Ariel'], umbriel: ['Umbriel', 'Umbriel'], titania: ['Titania', 'Titania'], oberon: ['Oberon', 'Obéron'], triton: ['Tritone', 'Triton'], charon: ['Caronte', 'Charon'],
};

let moons: MoonEl[] = [];
let tabs: CraftTab[] = [];
let epochMs = 0;
let loaded: Promise<void> | null = null;

export function loadEphem(): Promise<void> {
  if (loaded) return loaded;
  loaded = (async () => {
    try {
      const d = await (await dataFetch('data/ephem.json')).json();
      epochMs = Date.parse(d.epoch);
      moons = d.moons.map((m: MoonEl) => ({ ...m, name: tx(MOON_NAMES[m.id]?.[0] ?? m.name, m.name, MOON_NAMES[m.id]?.[1] ?? m.name) }));
      tabs = d.craft;
    } catch { /* senza dati: niente lune extra e niente veicoli lontani */ }
    loadTLEs();
  })();
  return loaded;
}

export const allMoons = () => moons;
export const moonsOf = (planet: string) => moons.filter((m) => m.planet === planet);
export const moonById = (id: string) => moons.find((m) => m.id === id);

const D2R = Math.PI / 180;
/** Posizione della luna rispetto al centro del pianeta (km, EQJ). */
export function moonOffsetKm(m: MoonEl, t: number): V3 {
  const M = (m.M + m.n * ((t - epochMs) / 1000)) * D2R;
  let E = M;
  for (let k = 0; k < 6; k++) E -= (E - m.e * Math.sin(E) - M) / (1 - m.e * Math.cos(E));
  const xv = m.a * (Math.cos(E) - m.e), yv = m.a * Math.sqrt(1 - m.e * m.e) * Math.sin(E);
  return orbitToEqj(m, xv, yv);
}
function orbitToEqj(m: MoonEl, xv: number, yv: number): V3 {
  const O = m.node * D2R, w = m.peri * D2R, i = m.i * D2R;
  const cO = Math.cos(O), sO = Math.sin(O), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
  return [
    (cO * cw - sO * sw * ci) * xv + (-cO * sw - sO * cw * ci) * yv,
    (sO * cw + cO * sw * ci) * xv + (-sO * sw + cO * cw * ci) * yv,
    (sw * si) * xv + (cw * si) * yv,
  ];
}
/** Punti dell'orbita (km rispetto al pianeta), a partire dalla posizione attuale della luna. */
export function moonOrbitKm(m: MoonEl, t: number, n = 128): V3[] {
  const M0 = (m.M + m.n * ((t - epochMs) / 1000)) * D2R;
  const pts: V3[] = [];
  for (let k = 0; k <= n; k++) {
    const M = M0 - (k / n) * Math.PI * 2; // all'indietro: la scia segue la luna
    let E = M;
    for (let j = 0; j < 6; j++) E -= (E - m.e * Math.sin(E) - M) / (1 - m.e * Math.cos(E));
    pts.push(orbitToEqj(m, m.a * (Math.cos(E) - m.e), m.a * Math.sqrt(1 - m.e * m.e) * Math.sin(E)));
  }
  return pts;
}

// ------------------------------------------------------------------ veicoli nello spazio profondo
const jdOf = (t: number) => t / 86400000 + 2440587.5;
function craftTabKm(tab: CraftTab, t: number): V3 | null {
  const x = (jdOf(t) - tab.jd0) / tab.step;
  if (x < 0 || x > tab.n - 1) return null;
  const k = Math.min(tab.n - 2, Math.floor(x)), u = x - k;
  const h = tab.step * 86400; // secondi
  const p0 = tab.data.slice(k * 6, k * 6 + 6), p1 = tab.data.slice(k * 6 + 6, k * 6 + 12);
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  return [0, 1, 2].map((j) => h00 * p0[j] + h10 * h * p0[j + 3] + h01 * p1[j] + h11 * h * p1[j + 3]) as V3;
}

// ------------------------------------------------------------------ satelliti in orbita terrestre (TLE)
const TLE_KEY = 'vastity.tle.v1';
const satrecs: Record<string, satTypes.SatRec> = {};
// elementi di riserva (novembre 2026, solo se mancano rete e cache: la posizione si degrada col tempo)
const FALLBACK: Record<string, [string, string]> = {};
async function fetchTLE(catnr: number): Promise<[string, string] | null> {
  try {
    const t = (await (await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}&FORMAT=TLE`)).text()).trim().split(/\r?\n/);
    if (t.length >= 3 && t[1].startsWith('1 ')) return [t[1].trim(), t[2].trim()];
  } catch { /* altra fonte */ }
  try { const j = await (await fetch(`https://tle.ivanstanojevic.me/api/tle/${catnr}`)).json(); if (j.line1) return [j.line1, j.line2]; } catch { /* offline */ }
  return null;
}
async function loadTLEs() {
  let cache: Record<string, { t: number; l1: string; l2: string }> = {};
  try { cache = JSON.parse(localStorage.getItem(TLE_KEY) || '{}'); } catch { /* */ }
  for (const c of CRAFT) {
    if (c.kind !== 'leo' || !c.catnr) continue;
    const hit = cache[c.id] ?? (FALLBACK[c.id] ? { t: 0, l1: FALLBACK[c.id][0], l2: FALLBACK[c.id][1] } : null);
    if (hit) satrecs[c.id] = sat.twoline2satrec(hit.l1, hit.l2);
    if (!hit || Date.now() - hit.t > 86400e3) {
      const t = await fetchTLE(c.catnr);
      if (t) { satrecs[c.id] = sat.twoline2satrec(t[0], t[1]); cache[c.id] = { t: Date.now(), l1: t[0], l2: t[1] }; }
    }
  }
  try { localStorage.setItem(TLE_KEY, JSON.stringify(cache)); } catch { /* */ }
}
/** Posizione geocentrica EQJ (km) di un satellite in orbita terrestre. */
export function leoGeoKm(id: string, date: Date): V3 | null {
  const s = satrecs[id];
  if (!s) return null;
  const pv = sat.propagate(s, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
  const p = pv.position as satTypes.EciVec3<number>;
  // TEME ≈ equatore e equinozio della data → J2000 (EQJ)
  const v = A.RotateVector(A.Rotation_EQD_EQJ(date), new A.Vector(p.x, p.y, p.z, A.MakeTime(date)));
  return [v.x, v.y, v.z];
}
/** Percorso del satellite (geocentrico EQJ, km) tra −min e +min minuti. */
export function leoTrackKm(id: string, t: number, minutes = 46, step = 1): V3[] {
  const out: V3[] = [];
  for (let m = -minutes; m <= minutes; m += step) { const p = leoGeoKm(id, new Date(t + m * 60000)); if (p) out.push(p); }
  return out;
}

/** Posizione eliocentrica EQJ (km) di un veicolo spaziale. */
export function craftHelioKm(id: string, t: number): V3 | null {
  const c = craftById(id);
  if (!c) return null;
  if (c.kind === 'leo') {
    const g = leoGeoKm(id, new Date(t));
    if (!g) return null;
    const e = A.HelioVector(A.Body.Earth, new Date(t));
    return [e.x * AU_IN_KM + g[0], e.y * AU_IN_KM + g[1], e.z * AU_IN_KM + g[2]];
  }
  const tab = tabs.find((x) => x.id === id);
  return tab ? craftTabKm(tab, t) : null;
}
export const craftAvailable = (id: string) => (craftById(id)?.kind === 'leo' ? !!satrecs[id] : tabs.some((x) => x.id === id));
