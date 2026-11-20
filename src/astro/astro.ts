// Calcoli astronomici: corpi del Sistema Solare, sistemi di riferimento, luoghi di osservazione.
import * as A from 'astronomy-engine';
import { AU_IN_KM, PC_IN_KM, radecToVec } from '../data/catalog';
import { tx } from '../i18n';
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
  name: string;
  radiusKm: number;
  color: [number, number, number];
  kind: 'star' | 'planet' | 'dwarf' | 'moon';
  desc: string;
  /** Periodo orbitale in giorni (per disegnare le orbite). */
  period?: number;
  rings?: boolean;
}

export const BODIES: BodyInfo[] = [
  { id: 'sun', body: A.Body.Sun, name: tx('Sole', 'Sun', 'Soleil'), radiusKm: 696340, color: [1, 0.95, 0.85], kind: 'star', desc: tx('La nostra stella: una nana gialla di 4,6 miliardi di anni.', 'Our star: a 4.6-billion-year-old yellow dwarf.', 'Notre étoile : une naine jaune de 4,6 milliards d\'années.') },
  { id: 'mercury', body: A.Body.Mercury, name: tx('Mercurio', 'Mercury', 'Mercure'), radiusKm: 2439.7, color: [0.62, 0.6, 0.58], kind: 'planet', period: 87.97, desc: tx('Il pianeta più vicino al Sole: un anno dura solo 88 giorni.', 'The closest planet to the Sun: a year lasts only 88 days.', 'La planète la plus proche du Soleil : une année ne dure que 88 jours.') },
  { id: 'venus', body: A.Body.Venus, name: tx('Venere', 'Venus', 'Vénus'), radiusKm: 6051.8, color: [0.95, 0.88, 0.7], kind: 'planet', period: 224.7, desc: tx('La "stella del mattino": avvolta da nubi di acido solforico, è il pianeta più caldo.', 'The "morning star": wrapped in sulphuric acid clouds, it is the hottest planet.', 'L\'« étoile du berger » : enveloppée de nuages d\'acide sulfurique, c\'est la planète la plus chaude.') },
  { id: 'earth', body: A.Body.Earth, name: tx('Terra', 'Earth', 'Terre'), radiusKm: 6371, color: [0.3, 0.55, 0.95], kind: 'planet', period: 365.256, desc: tx('Casa. L\'unico posto conosciuto con la vita.', 'Home. The only place known to harbour life.', 'Notre maison. Le seul endroit connu abritant la vie.') },
  { id: 'moon', body: A.Body.Moon, name: tx('Luna', 'Moon', 'Lune'), radiusKm: 1737.4, color: [0.78, 0.77, 0.75], kind: 'moon', period: 27.32, desc: tx('Il nostro satellite naturale, a circa 384.400 km.', 'Our natural satellite, about 384,400 km away.', 'Notre satellite naturel, à environ 384 400 km.') },
  { id: 'mars', body: A.Body.Mars, name: tx('Marte', 'Mars', 'Mars'), radiusKm: 3389.5, color: [0.86, 0.45, 0.28], kind: 'planet', period: 686.98, desc: tx('Il pianeta rosso, con il vulcano più alto del Sistema Solare.', 'The red planet, home to the tallest volcano in the Solar System.', 'La planète rouge, avec le plus haut volcan du Système solaire.') },
  { id: 'jupiter', body: A.Body.Jupiter, name: tx('Giove', 'Jupiter', 'Jupiter'), radiusKm: 69911, color: [0.86, 0.76, 0.62], kind: 'planet', period: 4332.6, desc: tx('Il gigante gassoso: potrebbe contenere oltre 1300 Terre.', 'The gas giant: it could hold more than 1,300 Earths.', 'La géante gazeuse : elle pourrait contenir plus de 1 300 Terres.') },
  { id: 'saturn', body: A.Body.Saturn, name: tx('Saturno', 'Saturn', 'Saturne'), radiusKm: 58232, color: [0.92, 0.84, 0.62], kind: 'planet', period: 10759, rings: true, desc: tx('Il signore degli anelli, fatti di ghiaccio e roccia.', 'The lord of the rings, made of ice and rock.', 'Le seigneur des anneaux, faits de glace et de roche.') },
  { id: 'uranus', body: A.Body.Uranus, name: tx('Urano', 'Uranus', 'Uranus'), radiusKm: 25362, color: [0.62, 0.85, 0.9], kind: 'planet', period: 30687, desc: tx('Ruota "sdraiato" su un fianco, con un\'inclinazione di 98°.', 'It spins lying on its side, tilted by 98°.', 'Elle tourne couchée sur le côté, inclinée de 98°.') },
  { id: 'neptune', body: A.Body.Neptune, name: tx('Nettuno', 'Neptune', 'Neptune'), radiusKm: 24622, color: [0.35, 0.5, 0.95], kind: 'planet', period: 60190, desc: tx('Il pianeta più lontano, con venti fino a 2000 km/h.', 'The farthest planet, with winds up to 2,000 km/h.', 'La planète la plus lointaine, avec des vents jusqu\'à 2 000 km/h.') },
  { id: 'pluto', body: A.Body.Pluto, name: tx('Plutone', 'Pluto', 'Pluton'), radiusKm: 1188.3, color: [0.8, 0.7, 0.6], kind: 'dwarf', period: 90560, desc: tx('Pianeta nano con un cuore di ghiaccio di azoto.', 'A dwarf planet with a heart of nitrogen ice.', 'Une planète naine au cœur de glace d\'azote.') },
];

export const bodyById = (id: string) => BODIES.find((b) => b.id === id);

// ---------------------------------------------------------------------------
// Luoghi di osservazione (idea 4: il cielo visto da un altro mondo)
// ---------------------------------------------------------------------------

export interface ExoPlanet { name: string; aAU: number; periodD: number; radiusEarth: number; color: [number, number, number] }
export interface ExoSystem {
  starName: string;
  /** Numero Hipparcos della stella ospite, se è nel catalogo. */
  hip?: string;
  /** Posizione della stella ospite (EQJ, parsec dal Sole). */
  raDeg: number; decDeg: number; distPc: number;
  starRadiusSun: number; starTemp: number; absmag: number;
  planets: ExoPlanet[];
  observerIndex: number;
}

export interface Place {
  id: string;
  name: string;
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
  { id: 'earth', name: tx('Terra', 'Earth', 'Terre'), sub: tx('La tua posizione', 'Your location', 'Votre position'), body: A.Body.Earth, ground: [0.11, 0.12, 0.11], sky: [0.25, 0.5, 0.95], note: '' },
  { id: 'moon', name: tx('Luna', 'Moon', 'Lune'), sub: tx('Mare della Tranquillità', 'Sea of Tranquillity', 'Mer de la Tranquillité'), body: A.Body.Moon, lat: 0.67, lon: 23.47, ground: [0.16, 0.16, 0.16], sky: [0, 0, 0], note: tx('Nessuna atmosfera: le stelle si vedono anche di giorno. La Terra resta quasi ferma nel cielo.', 'No atmosphere: stars are visible even by day. Earth stays almost still in the sky.', 'Pas d\'atmosphère : les étoiles sont visibles même le jour. La Terre reste presque immobile dans le ciel.') },
  { id: 'mercury', name: tx('Mercurio', 'Mercury', 'Mercure'), sub: tx('Bacino Caloris', 'Caloris Basin', 'Bassin Caloris'), body: A.Body.Mercury, lat: 30.5, lon: 170.2, ground: [0.14, 0.13, 0.12], sky: [0, 0, 0], note: tx('Il Sole appare tre volte più grande che dalla Terra.', 'The Sun looks three times larger than from Earth.', 'Le Soleil paraît trois fois plus grand que depuis la Terre.') },
  { id: 'venus', name: tx('Venere', 'Venus', 'Vénus'), sub: tx('Sopra le nubi', 'Above the clouds', 'Au-dessus des nuages'), body: A.Body.Venus, lat: 0, lon: 0, ground: [0.35, 0.28, 0.15], sky: [0.9, 0.7, 0.35], note: tx('Dalla superficie le nubi nascondono tutto: qui sei sopra di esse. Venere ruota al contrario!', 'From the surface the clouds hide everything: here you are above them. Venus spins backwards!', 'Depuis la surface, les nuages cachent tout : ici vous êtes au-dessus. Vénus tourne à l\'envers !') },
  { id: 'mars', name: tx('Marte', 'Mars', 'Mars'), sub: tx('Cratere Jezero', 'Jezero Crater', 'Cratère Jezero'), body: A.Body.Mars, lat: 18.38, lon: 77.58, ground: [0.2, 0.09, 0.05], sky: [0.75, 0.55, 0.4], note: tx('La Terra è una "stella del mattino" azzurra. Il tramonto su Marte è blu.', 'Earth is a blue "morning star". Sunsets on Mars are blue.', 'La Terre est une « étoile du matin » bleue. Les couchers de soleil sur Mars sont bleus.') },
  { id: 'jupiter', name: tx('Giove', 'Jupiter', 'Jupiter'), sub: tx('Sopra le nubi', 'Above the clouds', 'Au-dessus des nuages'), body: A.Body.Jupiter, lat: 10, lon: 0, ground: [0.25, 0.18, 0.12], sky: [0.2, 0.15, 0.1], note: tx('Un giorno dura meno di 10 ore: il cielo ruota velocissimo.', 'A day lasts less than 10 hours: the sky spins very fast.', 'Une journée dure moins de 10 heures : le ciel tourne très vite.') },
  { id: 'saturn', name: tx('Saturno', 'Saturn', 'Saturne'), sub: tx('Sopra le nubi', 'Above the clouds', 'Au-dessus des nuages'), body: A.Body.Saturn, lat: 20, lon: 0, ground: [0.3, 0.25, 0.15], sky: [0.2, 0.17, 0.1], note: tx('Il Sole è 90 volte più debole che dalla Terra.', 'The Sun is 90 times fainter than from Earth.', 'Le Soleil est 90 fois plus faible que depuis la Terre.') },
  { id: 'pluto', name: tx('Plutone', 'Pluto', 'Pluton'), sub: 'Sputnik Planitia', body: A.Body.Pluto, lat: 20, lon: 180, ground: [0.25, 0.22, 0.2], sky: [0, 0, 0], note: tx('Il Sole è solo una stella molto brillante.', 'The Sun is just a very bright star.', 'Le Soleil n\'est qu\'une étoile très brillante.') },
  {
    id: 'proxima', name: 'Proxima b', sub: tx('Proxima Centauri · 4,2 al', 'Proxima Centauri · 4.2 ly', 'Proxima du Centaure · 4,2 al'), ground: [0.12, 0.05, 0.04], sky: [0.25, 0.08, 0.04],
    note: tx('Il pianeta più vicino fuori dal Sistema Solare. Probabilmente mostra sempre la stessa faccia alla sua stella. Guarda verso Cassiopea: il Sole è una stella in più.', 'The nearest planet outside the Solar System. It probably always shows the same face to its star. Look towards Cassiopeia: the Sun is an extra star there.', 'La planète la plus proche hors du Système solaire. Elle montre sans doute toujours la même face à son étoile. Regardez vers Cassiopée : le Soleil y est une étoile de plus.'),
    exo: { starName: tx('Proxima Centauri', 'Proxima Centauri', 'Proxima du Centaure'), hip: '70890', raDeg: 217.4289, decDeg: -62.6795, distPc: 1.3012, starRadiusSun: 0.154, starTemp: 3042, absmag: 15.5, observerIndex: 0,
      planets: [
        { name: 'Proxima d', aAU: 0.02885, periodD: 5.12, radiusEarth: 0.8, color: [0.6, 0.5, 0.45] },
        { name: 'Proxima b', aAU: 0.04857, periodD: 11.19, radiusEarth: 1.07, color: [0.5, 0.35, 0.3] },
      ] },
  },
  {
    id: 'trappist', name: 'TRAPPIST-1e', sub: tx('TRAPPIST-1 · 40 al', 'TRAPPIST-1 · 40 ly', 'TRAPPIST-1 · 40 al'), ground: [0.08, 0.05, 0.06], sky: [0.2, 0.06, 0.05],
    note: tx('Sette pianeti rocciosi vicinissimi tra loro: dal cielo di TRAPPIST-1e gli altri appaiono come lune.', 'Seven rocky planets packed close together: from TRAPPIST-1e the others look like moons.', 'Sept planètes rocheuses très proches les unes des autres : depuis TRAPPIST-1e, les autres ressemblent à des lunes.'),
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
    id: 'kepler186', name: 'Kepler-186f', sub: tx('Kepler-186 · 580 al', 'Kepler-186 · 580 ly', 'Kepler-186 · 580 al'), ground: [0.1, 0.07, 0.05], sky: [0.35, 0.15, 0.08],
    note: tx('Il primo pianeta grande come la Terra trovato nella zona abitabile. Da qui le costellazioni sono già deformate.', 'The first Earth-sized planet found in a habitable zone. From here the constellations are already distorted.', 'La première planète de la taille de la Terre trouvée en zone habitable. D\'ici, les constellations sont déjà déformées.'),
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
        id: b.id, name: b.name, dir: v3.norm(vec), distKm: dist * AU_IN_KM,
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
        id: b.id, name: b.name, dir: v3.norm(rel), distKm: dist * AU_IN_KM,
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
  if (deg < 10 || deg > 350) return tx('Luna nuova', 'New Moon', 'Nouvelle lune');
  if (deg < 80) return tx('Luna crescente', 'Waxing crescent', 'Premier croissant');
  if (deg < 100) return tx('Primo quarto', 'First quarter', 'Premier quartier');
  if (deg < 170) return tx('Gibbosa crescente', 'Waxing gibbous', 'Gibbeuse croissante');
  if (deg < 190) return tx('Luna piena', 'Full Moon', 'Pleine lune');
  if (deg < 260) return tx('Gibbosa calante', 'Waning gibbous', 'Gibbeuse décroissante');
  if (deg < 280) return tx('Ultimo quarto', 'Last quarter', 'Dernier quartier');
  return tx('Luna calante', 'Waning crescent', 'Dernier croissant');
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
