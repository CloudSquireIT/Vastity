// Calcoli astronomici: corpi del Sistema Solare, sistemi di riferimento, luoghi di osservazione.
import * as A from 'astronomy-engine';
import { AU_IN_KM, PC_IN_KM, radecToVec } from '../data/catalog';
import { state } from '../state';

export type V3 = [number, number, number];

export const v3 = {
  sub: (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a: V3) => Math.hypot(a[0], a[1], a[2]),
  norm: (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};

const D2R = Math.PI / 180;

export interface BodyInfo {
  id: string;
  body?: A.Body;
  it: string;
  radiusKm: number;
  color: [number, number, number];
  kind: 'star' | 'planet' | 'dwarf' | 'moon';
  desc: string;
  /** Periodo orbitale in giorni (per disegnare le orbite). */
  period?: number;
  rings?: boolean;
}

export const BODIES: BodyInfo[] = [
  { id: 'sun', body: A.Body.Sun, it: 'Sole', radiusKm: 696340, color: [1, 0.95, 0.85], kind: 'star', desc: 'La nostra stella: una nana gialla di 4,6 miliardi di anni.' },
  { id: 'mercury', body: A.Body.Mercury, it: 'Mercurio', radiusKm: 2439.7, color: [0.62, 0.6, 0.58], kind: 'planet', period: 87.97, desc: 'Il pianeta più vicino al Sole: un anno dura solo 88 giorni.' },
  { id: 'venus', body: A.Body.Venus, it: 'Venere', radiusKm: 6051.8, color: [0.95, 0.88, 0.7], kind: 'planet', period: 224.7, desc: 'La "stella del mattino": avvolta da nubi di acido solforico, è il pianeta più caldo.' },
  { id: 'earth', body: A.Body.Earth, it: 'Terra', radiusKm: 6371, color: [0.3, 0.55, 0.95], kind: 'planet', period: 365.256, desc: 'Casa. L\'unico posto conosciuto con la vita.' },
  { id: 'moon', body: A.Body.Moon, it: 'Luna', radiusKm: 1737.4, color: [0.78, 0.77, 0.75], kind: 'moon', period: 27.32, desc: 'Il nostro satellite naturale, a circa 384.400 km.' },
  { id: 'mars', body: A.Body.Mars, it: 'Marte', radiusKm: 3389.5, color: [0.86, 0.45, 0.28], kind: 'planet', period: 686.98, desc: 'Il pianeta rosso, con il vulcano più alto del Sistema Solare.' },
  { id: 'jupiter', body: A.Body.Jupiter, it: 'Giove', radiusKm: 69911, color: [0.86, 0.76, 0.62], kind: 'planet', period: 4332.6, desc: 'Il gigante gassoso: potrebbe contenere oltre 1300 Terre.' },
  { id: 'saturn', body: A.Body.Saturn, it: 'Saturno', radiusKm: 58232, color: [0.92, 0.84, 0.62], kind: 'planet', period: 10759, rings: true, desc: 'Il signore degli anelli, fatti di ghiaccio e roccia.' },
  { id: 'uranus', body: A.Body.Uranus, it: 'Urano', radiusKm: 25362, color: [0.62, 0.85, 0.9], kind: 'planet', period: 30687, desc: 'Ruota "sdraiato" su un fianco, con un\'inclinazione di 98°.' },
  { id: 'neptune', body: A.Body.Neptune, it: 'Nettuno', radiusKm: 24622, color: [0.35, 0.5, 0.95], kind: 'planet', period: 60190, desc: 'Il pianeta più lontano, con venti fino a 2000 km/h.' },
  { id: 'pluto', body: A.Body.Pluto, it: 'Plutone', radiusKm: 1188.3, color: [0.8, 0.7, 0.6], kind: 'dwarf', period: 90560, desc: 'Pianeta nano con un cuore di ghiaccio di azoto.' },
];

export const bodyById = (id: string) => BODIES.find((b) => b.id === id);

// ---------------------------------------------------------------------------
// Luoghi di osservazione (idea 4: il cielo visto da un altro mondo)
// ---------------------------------------------------------------------------

export interface ExoPlanet { name: string; aAU: number; periodD: number; radiusEarth: number; color: [number, number, number] }
export interface ExoSystem {
  starName: string;
  /** Posizione della stella ospite (EQJ, parsec dal Sole). */
  raDeg: number; decDeg: number; distPc: number;
  starRadiusSun: number; starTemp: number; absmag: number;
  planets: ExoPlanet[];
  observerIndex: number;
}

export interface Place {
  id: string;
  it: string;
  sub: string;
  body?: A.Body;
  lat?: number;
  lon?: number;
  ground: [number, number, number];
  sky: [number, number, number];
  exo?: ExoSystem;
  note: string;
}

export const PLACES: Place[] = [
  { id: 'earth', it: 'Terra', sub: 'La tua posizione', body: A.Body.Earth, ground: [0.11, 0.12, 0.11], sky: [0.25, 0.5, 0.95], note: '' },
  { id: 'moon', it: 'Luna', sub: 'Mare della Tranquillità', body: A.Body.Moon, lat: 0.67, lon: 23.47, ground: [0.16, 0.16, 0.16], sky: [0, 0, 0], note: 'Nessuna atmosfera: le stelle si vedono anche di giorno. La Terra resta quasi ferma nel cielo.' },
  { id: 'mercury', it: 'Mercurio', sub: 'Bacino Caloris', body: A.Body.Mercury, lat: 30.5, lon: 170.2, ground: [0.14, 0.13, 0.12], sky: [0, 0, 0], note: 'Il Sole appare tre volte più grande che dalla Terra.' },
  { id: 'venus', it: 'Venere', sub: 'Sopra le nubi', body: A.Body.Venus, lat: 0, lon: 0, ground: [0.35, 0.28, 0.15], sky: [0.9, 0.7, 0.35], note: 'Dalla superficie le nubi nascondono tutto: qui sei sopra di esse. Venere ruota al contrario!' },
  { id: 'mars', it: 'Marte', sub: 'Cratere Jezero', body: A.Body.Mars, lat: 18.38, lon: 77.58, ground: [0.2, 0.09, 0.05], sky: [0.75, 0.55, 0.4], note: 'La Terra è una "stella del mattino" azzurra. Il tramonto su Marte è blu.' },
  { id: 'jupiter', it: 'Giove', sub: 'Sopra le nubi', body: A.Body.Jupiter, lat: 10, lon: 0, ground: [0.25, 0.18, 0.12], sky: [0.2, 0.15, 0.1], note: 'Un giorno dura meno di 10 ore: il cielo ruota velocissimo.' },
  { id: 'saturn', it: 'Saturno', sub: 'Sopra le nubi', body: A.Body.Saturn, lat: 20, lon: 0, ground: [0.3, 0.25, 0.15], sky: [0.2, 0.17, 0.1], note: 'Il Sole è 90 volte più debole che dalla Terra.' },
  { id: 'pluto', it: 'Plutone', sub: 'Sputnik Planitia', body: A.Body.Pluto, lat: 20, lon: 180, ground: [0.25, 0.22, 0.2], sky: [0, 0, 0], note: 'Il Sole è solo una stella molto brillante.' },
  {
    id: 'proxima', it: 'Proxima b', sub: 'Proxima Centauri · 4,2 al', ground: [0.12, 0.05, 0.04], sky: [0.25, 0.08, 0.04],
    note: 'Il pianeta più vicino fuori dal Sistema Solare. Probabilmente mostra sempre la stessa faccia alla sua stella. Guarda verso Cassiopea: il Sole è una stella in più.',
    exo: { starName: 'Proxima Centauri', raDeg: 217.4289, decDeg: -62.6795, distPc: 1.3012, starRadiusSun: 0.154, starTemp: 3042, absmag: 15.5, observerIndex: 0,
      planets: [
        { name: 'Proxima d', aAU: 0.02885, periodD: 5.12, radiusEarth: 0.8, color: [0.6, 0.5, 0.45] },
        { name: 'Proxima b', aAU: 0.04857, periodD: 11.19, radiusEarth: 1.07, color: [0.5, 0.35, 0.3] },
      ] },
  },
  {
    id: 'trappist', it: 'TRAPPIST-1e', sub: 'TRAPPIST-1 · 40 al', ground: [0.08, 0.05, 0.06], sky: [0.2, 0.06, 0.05],
    note: 'Sette pianeti rocciosi vicinissimi tra loro: dal cielo di TRAPPIST-1e gli altri appaiono come lune.',
    exo: { starName: 'TRAPPIST-1', raDeg: 346.6223, decDeg: -5.0414, distPc: 12.43, starRadiusSun: 0.119, starTemp: 2566, absmag: 18.4, observerIndex: 3,
      planets: [
        { name: 'TRAPPIST-1b', aAU: 0.01154, periodD: 1.5109, radiusEarth: 1.116, color: [0.6, 0.45, 0.4] },
        { name: 'TRAPPIST-1c', aAU: 0.0158, periodD: 2.4218, radiusEarth: 1.097, color: [0.65, 0.55, 0.45] },
        { name: 'TRAPPIST-1d', aAU: 0.02227, periodD: 4.0496, radiusEarth: 0.788, color: [0.55, 0.6, 0.7] },
        { name: 'TRAPPIST-1e', aAU: 0.02925, periodD: 6.0996, radiusEarth: 0.92, color: [0.5, 0.6, 0.75] },
        { name: 'TRAPPIST-1f', aAU: 0.03849, periodD: 9.2067, radiusEarth: 1.045, color: [0.7, 0.75, 0.85] },
        { name: 'TRAPPIST-1g', aAU: 0.04683, periodD: 12.3529, radiusEarth: 1.129, color: [0.75, 0.8, 0.9] },
        { name: 'TRAPPIST-1h', aAU: 0.06189, periodD: 18.7729, radiusEarth: 0.755, color: [0.8, 0.85, 0.9] },
      ] },
  },
  {
    id: 'kepler186', it: 'Kepler-186f', sub: 'Kepler-186 · 580 al', ground: [0.1, 0.07, 0.05], sky: [0.35, 0.15, 0.08],
    note: 'Il primo pianeta grande come la Terra trovato nella zona abitabile. Da qui le costellazioni sono già deformate.',
    exo: { starName: 'Kepler-186', raDeg: 298.6527, decDeg: 43.955, distPc: 177.6, starRadiusSun: 0.523, starTemp: 3755, absmag: 8.6, observerIndex: 4,
      planets: [
        { name: 'Kepler-186b', aAU: 0.0378, periodD: 3.887, radiusEarth: 1.07, color: [0.6, 0.5, 0.4] },
        { name: 'Kepler-186c', aAU: 0.0574, periodD: 7.267, radiusEarth: 1.25, color: [0.6, 0.55, 0.5] },
        { name: 'Kepler-186d', aAU: 0.0861, periodD: 13.343, radiusEarth: 1.4, color: [0.65, 0.55, 0.5] },
        { name: 'Kepler-186e', aAU: 0.1216, periodD: 22.408, radiusEarth: 1.27, color: [0.55, 0.6, 0.65] },
        { name: 'Kepler-186f', aAU: 0.432, periodD: 129.94, radiusEarth: 1.17, color: [0.45, 0.55, 0.5] },
      ] },
  },
];

export const placeById = (id: string) => PLACES.find((p) => p.id === id) ?? PLACES[0];

export function observer() {
  const l = state.location;
  return new A.Observer(l.lat, l.lon, l.height);
}

const toV = (v: A.Vector): V3 => [v.x, v.y, v.z];

// ---------------------------------------------------------------------------
// Sistema di riferimento del cielo locale.
// Restituisce le righe della matrice EQJ → "orizzonte three.js"
// (x = Est, y = Zenit, z = Sud), così la camera che guarda -z guarda a Nord.
// ---------------------------------------------------------------------------

export interface SkyFrame {
  rows: [V3, V3, V3];
  observerPc: V3;
  observerHelioAU: V3 | null;
  bodies: SkyBody[];
  sunDir: V3;
  /** Altezza del "Sole" locale in gradi. */
  sunAlt: number;
}

export interface SkyBody {
  id: string;
  name: string;
  dir: V3;          // direzione EQJ unitaria
  distKm: number;
  angRadius: number; // radianti
  mag: number;
  color: [number, number, number];
  lightDir: V3;     // dal corpo verso la stella che lo illumina (EQJ)
  isStar: boolean;
  temp?: number;
  rings?: boolean;
  kind: string;
}

function frameFromAxes(E: V3, N: V3, U: V3): [V3, V3, V3] {
  return [E, U, [-N[0], -N[1], -N[2]]];
}

function bodySurfaceFrame(body: A.Body, date: Date, latDeg: number, lonDeg: number) {
  const ax = A.RotationAxis(body, date);
  const pole = toV(ax.north);
  const a0 = ax.ra * 15 * D2R;
  const node: V3 = [-Math.sin(a0), Math.cos(a0), 0];
  const W = ax.spin * D2R;
  const pxn = v3.cross(pole, node);
  const X: V3 = v3.add(v3.scale(node, Math.cos(W)), v3.scale(pxn, Math.sin(W)));
  const Y = v3.cross(pole, X);
  const lat = latDeg * D2R, lon = lonDeg * D2R;
  const eq = v3.add(v3.scale(X, Math.cos(lon)), v3.scale(Y, Math.sin(lon)));
  const U = v3.add(v3.scale(eq, Math.cos(lat)), v3.scale(pole, Math.sin(lat)));
  const E = v3.norm(v3.add(v3.scale(X, -Math.sin(lon)), v3.scale(Y, Math.cos(lon))));
  const N = v3.cross(U, E);
  return { E, N, U };
}

function earthFrame(date: Date): [V3, V3, V3] {
  const rot = A.Rotation_EQJ_HOR(date, observer());
  // HOR: x = Nord, y = Ovest, z = Zenit
  const cols = [new A.Vector(1, 0, 0, A.MakeTime(date)), new A.Vector(0, 1, 0, A.MakeTime(date)), new A.Vector(0, 0, 1, A.MakeTime(date))]
    .map((e) => A.RotateVector(rot, e));
  // riga i della matrice = immagine dell'asse i del frame orizzontale espresso in EQJ
  const N: V3 = [cols[0].x, cols[1].x, cols[2].x];
  const Wst: V3 = [cols[0].y, cols[1].y, cols[2].y];
  const U: V3 = [cols[0].z, cols[1].z, cols[2].z];
  return frameFromAxes([-Wst[0], -Wst[1], -Wst[2]], N, U);
}

let frameCache: { key: string; rows: [V3, V3, V3] } | null = null;
export function earthRows(date: Date) {
  const key = `${Math.round(date.getTime() / 200)}|${state.location.lat}|${state.location.lon}`;
  if (frameCache?.key !== key) frameCache = { key, rows: earthFrame(date) };
  return frameCache.rows;
}

/** Altezza/azimut (gradi) di una direzione EQJ vista dalla posizione dell'utente sulla Terra. */
export function eqjToHor(dir: V3, date: Date) {
  const r = earthRows(date);
  const x = v3.dot(r[0], dir), y = v3.dot(r[1], dir), z = v3.dot(r[2], dir);
  const alt = Math.asin(Math.max(-1, Math.min(1, y))) / D2R;
  let az = Math.atan2(x, -z) / D2R;
  if (az < 0) az += 360;
  return { alt, az };
}

export function horToEqj(altDeg: number, azDeg: number, date: Date): V3 {
  const r = earthRows(date);
  const alt = altDeg * D2R, az = azDeg * D2R;
  const h: V3 = [Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)];
  // trasposta (matrice ortonormale)
  return [
    r[0][0] * h[0] + r[1][0] * h[1] + r[2][0] * h[2],
    r[0][1] * h[0] + r[1][1] * h[1] + r[2][1] * h[2],
    r[0][2] * h[0] + r[1][2] * h[1] + r[2][2] * h[2],
  ];
}

function sunMagAt(distAU: number) { return -26.74 + 5 * Math.log10(distAU); }

function planetMag(b: BodyInfo, date: Date, distFromObsAU: number) {
  if (!b.body) return 99;
  if (b.id === 'earth') {
    const r = v3.len(toV(A.HelioVector(A.Body.Earth, date)));
    return -3.99 + 5 * Math.log10(r * distFromObsAU);
  }
  try {
    const ill = A.Illumination(b.body, date);
    const geo = v3.len(toV(A.GeoVector(b.body, date, false)));
    return ill.mag + 5 * Math.log10(distFromObsAU / geo);
  } catch { return 99; }
}

/** Calcola il cielo visto da un luogo (Terra, altri pianeti, esopianeti) in un istante. */
export function skyFrame(place: Place, date: Date): SkyFrame {
  if (place.exo) return exoFrame(place, date);
  const bodies: SkyBody[] = [];
  let rows: [V3, V3, V3];
  let obsHelio: V3;
  if (place.id === 'earth') {
    rows = earthRows(date);
    const obs = observer();
    const earthH = toV(A.HelioVector(A.Body.Earth, date));
    const ov = toV(A.ObserverVector(date, obs, false));
    obsHelio = v3.add(earthH, ov);
    for (const b of BODIES) {
      if (b.id === 'earth' || !b.body) continue;
      const eq = A.Equator(b.body, date, obs, false, true);
      const vec = toV(eq.vec);
      const dist = eq.dist;
      const helio = b.id === 'sun' ? [0, 0, 0] as V3 : toV(A.HelioVector(b.body, date));
      const isSun = b.id === 'sun';
      bodies.push({
        id: b.id, name: b.it, dir: v3.norm(vec), distKm: dist * AU_IN_KM,
        angRadius: Math.atan(b.radiusKm / (dist * AU_IN_KM)),
        mag: isSun ? sunMagAt(dist) : planetMag(b, date, dist),
        color: b.color, lightDir: isSun ? [0, 0, 1] : v3.norm(v3.scale(helio, -1)),
        isStar: isSun, temp: isSun ? 5772 : undefined, rings: b.rings, kind: b.kind,
      });
    }
  } else {
    const body = place.body!;
    const f = bodySurfaceFrame(body, date, place.lat ?? 0, place.lon ?? 0);
    rows = frameFromAxes(f.E, f.N, f.U);
    const info = BODIES.find((b) => b.body === body)!;
    obsHelio = v3.add(toV(A.HelioVector(body, date)), v3.scale(f.U, (info.radiusKm * 1.0005) / AU_IN_KM));
    for (const b of BODIES) {
      if (!b.body || b.body === body) continue;
      const helio: V3 = b.id === 'sun' ? [0, 0, 0] : toV(A.HelioVector(b.body, date));
      const rel = v3.sub(helio, obsHelio);
      const dist = v3.len(rel);
      const isSun = b.id === 'sun';
      bodies.push({
        id: b.id, name: b.it, dir: v3.norm(rel), distKm: dist * AU_IN_KM,
        angRadius: Math.atan(b.radiusKm / (dist * AU_IN_KM)),
        mag: isSun ? sunMagAt(dist) : planetMag(b, date, dist),
        color: b.color, lightDir: isSun ? [0, 0, 1] : v3.norm(v3.scale(helio, -1)),
        isStar: isSun, temp: isSun ? 5772 : undefined, rings: b.rings, kind: b.kind,
      });
    }
  }
  const sun = bodies.find((b) => b.id === 'sun')!;
  const sunAlt = Math.asin(v3.dot(rows[1], sun.dir)) / D2R;
  return { rows, observerPc: v3.scale(obsHelio, AU_IN_KM / PC_IN_KM), observerHelioAU: obsHelio, bodies, sunDir: sun.dir, sunAlt };
}

function exoFrame(place: Place, date: Date): SkyFrame {
  const sys = place.exo!;
  const starPos = v3.scale(radecToVec(sys.raDeg, sys.decDeg), sys.distPc);
  const los = v3.norm(starPos);
  // piano orbitale "di taglio" rispetto alla Terra (i pianeti transitano)
  const pole = v3.norm(v3.cross(los, [0, 0, 1]));
  const u = los;
  const w = v3.cross(pole, u);
  const days = date.getTime() / 86400000;
  const pPos = sys.planets.map((p, i) => {
    const th = (2 * Math.PI * days) / p.periodD + i * 1.7;
    return v3.add(v3.scale(u, p.aAU * Math.cos(th)), v3.scale(w, p.aAU * Math.sin(th)));
  });
  const me = pPos[sys.observerIndex];
  const toStar = v3.norm(v3.scale(me, -1));
  // pianeta in rotazione sincrona: la stella resta ferma a 25° sull'orizzonte
  const zen = 65 * D2R;
  const U = v3.norm(v3.add(v3.scale(toStar, Math.cos(zen)), v3.scale(pole, Math.sin(zen))));
  const N = v3.norm(v3.sub(pole, v3.scale(U, v3.dot(pole, U))));
  const E = v3.cross(N, U);
  const rows = frameFromAxes(E, N, U);
  const bodies: SkyBody[] = [];
  const meDist = v3.len(me);
  bodies.push({
    id: 'host', name: sys.starName, dir: toStar, distKm: meDist * AU_IN_KM,
    angRadius: Math.atan((sys.starRadiusSun * 696340) / (meDist * AU_IN_KM)),
    mag: sys.absmag + 5 * Math.log10((meDist * AU_IN_KM) / PC_IN_KM) - 5,
    color: [1, 0.6, 0.4], lightDir: [0, 0, 1], isStar: true, temp: sys.starTemp, kind: 'star',
  });
  sys.planets.forEach((p, i) => {
    if (i === sys.observerIndex) return;
    const rel = v3.sub(pPos[i], me);
    const d = v3.len(rel);
    const R = p.radiusEarth * 6371;
    const lum = Math.pow(10, -0.4 * (sys.absmag - 4.83));
    // magnitudine approssimata di un pianeta roccioso (albedo 0.3)
    const flux = (lum * 0.3 * Math.pow(R / AU_IN_KM, 2)) / (4 * Math.pow(v3.len(pPos[i]), 2) * Math.pow(d, 2));
    bodies.push({
      id: `exo-${i}`, name: p.name, dir: v3.norm(rel), distKm: d * AU_IN_KM,
      angRadius: Math.atan(R / (d * AU_IN_KM)), mag: -26.74 - 2.5 * Math.log10(Math.max(flux, 1e-30)),
      color: p.color, lightDir: v3.norm(v3.scale(pPos[i], -1)), isStar: false, kind: 'planet',
    });
  });
  const sunAlt = Math.asin(v3.dot(rows[1], toStar)) / D2R;
  return { rows, observerPc: starPos, observerHelioAU: null, bodies, sunDir: toStar, sunAlt };
}

// ---------------------------------------------------------------------------
// Utilità per alba/tramonto e crepuscolo
// ---------------------------------------------------------------------------

export function riseSet(body: A.Body, date: Date) {
  const obs = observer();
  const start = new Date(date.getTime() - 12 * 3600e3);
  const safe = (f: () => A.AstroTime | null) => { try { return f()?.date ?? null; } catch { return null; } };
  return {
    rise: safe(() => A.SearchRiseSet(body, obs, +1, start, 1.5)),
    set: safe(() => A.SearchRiseSet(body, obs, -1, start, 1.5)),
    transit: (() => { try { return A.SearchHourAngle(body, obs, 0, start).time.date; } catch { return null; } })(),
  };
}

/** Alba/transito/tramonto di una stella fissa (ra in gradi). */
export function starRiseSet(raDeg: number, decDeg: number, date: Date) {
  A.DefineStar(A.Body.Star1, raDeg / 15, decDeg, 1000);
  const r = riseSet(A.Body.Star1, date);
  const lat = state.location.lat;
  const circumpolar = lat >= 0 ? decDeg > 90 - lat : decDeg < -90 - lat;
  return { ...r, circumpolar, neverRises: lat >= 0 ? decDeg < lat - 90 : decDeg > 90 + lat };
}

export function moonPhaseName(deg: number) {
  if (deg < 10 || deg > 350) return 'Luna nuova';
  if (deg < 80) return 'Luna crescente';
  if (deg < 100) return 'Primo quarto';
  if (deg < 170) return 'Gibbosa crescente';
  if (deg < 190) return 'Luna piena';
  if (deg < 260) return 'Gibbosa calante';
  if (deg < 280) return 'Ultimo quarto';
  return 'Luna calante';
}

export function sunAltitude(date: Date) {
  const obs = observer();
  const eq = A.Equator(A.Body.Sun, date, obs, true, true);
  return A.Horizon(date, obs, eq.ra, eq.dec).altitude;
}

/** Inizio/fine della notte astronomica attorno a `date`. */
export function nightWindow(date: Date) {
  const obs = observer();
  const noon = new Date(date);
  if (noon.getHours() < 12) noon.setDate(noon.getDate() - 1);
  noon.setHours(12, 0, 0, 0);
  const find = (dir: number, alt: number, from: Date) => { try { return A.SearchAltitude(A.Body.Sun, obs, dir, from, 1, alt)?.date ?? null; } catch { return null; } };
  const dusk = find(-1, -18, noon) ?? find(-1, -12, noon) ?? find(-1, -6, noon);
  const dawn = dusk ? (find(+1, -18, dusk) ?? find(+1, -12, dusk) ?? find(+1, -6, dusk)) : null;
  const sunset = find(-1, -0.833, noon);
  return { sunset, dusk, dawn };
}

export { A };
