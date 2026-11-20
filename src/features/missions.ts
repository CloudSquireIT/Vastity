// Idea 5 — Caccia al tesoro celeste: missioni quotidiane, diario, badge e livelli.
import { A, BODIES, eqjToHor, observer, v3 } from '../astro/astro';
import { constellations, messier, radecToVec, starRaDec, stars } from '../data/catalog';
import { rng } from '../render/background';
import { ObjRef, refName, sameRef } from './objects';
import { issPasses } from './iss';
import { bus, save, state } from '../state';

export interface Mission { id: string; ref: ObjRef; title: string; hint: string; xp: number; done?: number }
export interface JournalEntry { t: number; ref: ObjRef; name: string; live: boolean; gyro: boolean; place: string; lat: number; lon: number; note?: string }
export interface Badge { id: string; name: string; desc: string; icon: string }

interface Progress {
  day: string;
  missions: Mission[];
  journal: JournalEntry[];
  xp: number;
  badges: Record<string, number>;
  days: string[];
  places: string[];
  flags: Record<string, number>;
}

const KEY = 'vastity.missions.v1';

export const BADGES: Badge[] = [
  { id: 'first', name: 'Prima luce', desc: 'Completa la tua prima missione', icon: '✦' },
  { id: 'planets', name: 'Cacciatore di pianeti', desc: 'Osserva 5 pianeti diversi', icon: '◐' },
  { id: 'moon', name: 'Lunatico', desc: 'Osserva la Luna in 4 fasi diverse', icon: '☾' },
  { id: 'iss', name: 'Stazione in vista', desc: 'Osserva un passaggio della ISS', icon: '⌁' },
  { id: 'deep', name: 'Profondo cielo', desc: 'Osserva 5 oggetti di Messier', icon: '✺' },
  { id: 'cons', name: 'Cartografo del cielo', desc: 'Trova 12 costellazioni', icon: '✧' },
  { id: 'owl', name: 'Gufo notturno', desc: 'Osserva qualcosa tra mezzanotte e le 4', icon: '◉' },
  { id: 'streak3', name: 'Costanza', desc: 'Osserva per 3 giorni di fila', icon: '③' },
  { id: 'streak7', name: 'Una settimana di stelle', desc: 'Osserva per 7 giorni di fila', icon: '⑦' },
  { id: 'worlds', name: 'Turista cosmico', desc: 'Guarda il cielo da 5 mondi diversi', icon: '⊕' },
  { id: 'light', name: 'Quasi luce', desc: 'Raggiungi il 99% della velocità della luce', icon: 'c' },
  { id: 'star', name: 'Interstellare', desc: 'Arriva con la navicella a un\'altra stella', icon: '✶' },
  { id: 'andromeda', name: 'Fuori dalla galassia', desc: 'Raggiungi la Galassia di Andromeda', icon: '◎' },
];

export const RANKS: [number, string][] = [
  [0, 'Curioso'], [100, 'Osservatore'], [300, 'Astrofilo'], [700, 'Astronomo'], [1500, 'Esploratore stellare'], [3000, 'Navigatore cosmico'],
];

export function rankOf(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++;
  const next = RANKS[i + 1];
  return { name: RANKS[i][1], next: next?.[1] ?? null, progress: next ? (xp - RANKS[i][0]) / (next[0] - RANKS[i][0]) : 1, toNext: next ? next[0] - xp : 0 };
}

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function load(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p) return { flags: {}, places: [], days: [], badges: {}, journal: [], missions: [], xp: 0, day: '', ...p };
  } catch { /* */ }
  return { day: '', missions: [], journal: [], xp: 0, badges: {}, days: [], places: [], flags: {} };
}

export const progress = load();
const persist = () => save(KEY, progress);

/** Sera di riferimento: le 22 di oggi (o adesso se è già notte). */
function eveningTime() {
  const now = new Date();
  const t = new Date(now);
  if (now.getHours() >= 20 || now.getHours() < 5) return now;
  t.setHours(22, 0, 0, 0);
  return t;
}

export function ensureDailyMissions() {
  const key = dayKey();
  if (progress.day === key && progress.missions.length) return progress.missions;
  const t = eveningTime();
  const seed = key.split('-').reduce((a, b) => a * 31 + +b, 7) + Math.round(state.location.lat * 10);
  const r = rng(seed);
  const pickFrom = <T>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const obs = observer();
  const up = (dir: [number, number, number], min = 20) => eqjToHor(dir, t).alt > min;
  const out: Mission[] = [];

  const planets = BODIES.filter((b) => b.body && ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'moon'].includes(b.id)).filter((b) => {
    const e = A.Equator(b.body!, t, obs, false, true);
    return up(v3.norm([e.vec.x, e.vec.y, e.vec.z]), 12) && A.AngleFromSun(b.body!, t) > 18;
  });
  if (planets.length) {
    const p = pickFrom(planets);
    out.push({ id: `${key}-p`, ref: { kind: 'body', id: p.id }, title: `Trova ${p.it}`, hint: p.id === 'moon' ? 'Facile: inquadrala e tienila al centro.' : 'Sembra una stella che non brilla a intermittenza.', xp: p.id === 'moon' ? 10 : 30 });
  }
  const brightStars: number[] = [];
  for (let i = 0; i < 120 && i < stars.count; i++) {
    const ni = stars.name[i];
    if (ni >= 0 && stars.names[ni][0]) {
      const { ra, dec } = starRaDec(i);
      if (up(radecToVec(ra, dec), 20)) brightStars.push(i);
    }
  }
  if (brightStars.length) {
    const s = pickFrom(brightStars.slice(0, 25));
    out.push({ id: `${key}-s`, ref: { kind: 'star', index: s }, title: `Trova ${refName({ kind: 'star', index: s })}`, hint: 'Usa la ricerca o segui la freccia ai bordi dello schermo.', xp: 20 });
  }
  const cons = constellations.filter((c) => c.rank <= 2 && up(radecToVec(c.c[0], c.c[1]), 25));
  if (cons.length) {
    const c = pickFrom(cons);
    out.push({ id: `${key}-c`, ref: { kind: 'constellation', id: c.id }, title: `Riconosci ${c.it}`, hint: 'Centra la costellazione nel mirino.', xp: 25 });
  }
  const dsos = messier.filter((m) => m.mag < 6.5 && up(radecToVec(m.ra, m.dec), 25));
  if (dsos.length) {
    const m = pickFrom(dsos);
    out.push({ id: `${key}-m`, ref: { kind: 'messier', id: m.id }, title: `Scova ${refName({ kind: 'messier', id: m.id })}`, hint: 'Oggetto del profondo cielo: con un binocolo è ancora meglio.', xp: 40 });
  }
  const pass = issPasses(new Date(), 1).find((p) => p.visible && p.maxAlt > 20);
  if (pass) out.push({ id: `${key}-iss`, ref: { kind: 'iss' }, title: 'Avvista la Stazione Spaziale', hint: `Passa alle ${pass.peak.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}: inquadrala mentre attraversa il cielo.`, xp: 60 });

  progress.day = key;
  progress.missions = out;
  persist();
  return out;
}

export function activeMissions() { return progress.missions.filter((m) => !m.done); }

function award(id: string) {
  if (progress.badges[id]) return;
  progress.badges[id] = Date.now();
  const b = BADGES.find((x) => x.id === id);
  if (b) bus.emit('toast', `Nuovo badge: ${b.icon} ${b.name}`, 'badge');
}

function checkBadges() {
  const j = progress.journal;
  const ids = (k: string) => new Set(j.filter((e) => e.ref.kind === k).map((e) => JSON.stringify(e.ref)));
  if (progress.missions.some((m) => m.done) || j.length) award('first');
  const planets = new Set(j.filter((e) => e.ref.kind === 'body' && !['moon', 'sun'].includes((e.ref as any).id)).map((e) => (e.ref as any).id));
  if (planets.size >= 5) award('planets');
  const phases = new Set(j.filter((e) => e.ref.kind === 'body' && (e.ref as any).id === 'moon').map((e) => Math.floor(A.MoonPhase(new Date(e.t)) / 90)));
  if (phases.size >= 4) award('moon');
  if (j.some((e) => e.ref.kind === 'iss')) award('iss');
  if (ids('messier').size >= 5) award('deep');
  if (ids('constellation').size >= 12) award('cons');
  if (j.some((e) => new Date(e.t).getHours() < 4)) award('owl');
  const days = progress.days.slice().sort();
  let streak = 1, best = days.length ? 1 : 0;
  for (let i = 1; i < days.length; i++) {
    const a = new Date(days[i - 1]), b = new Date(days[i]);
    streak = Math.round((b.getTime() - a.getTime()) / 86400e3) === 1 ? streak + 1 : 1;
    best = Math.max(best, streak);
  }
  if (best >= 3) award('streak3');
  if (best >= 7) award('streak7');
  if (progress.places.length >= 5) award('worlds');
}

export function logObservation(ref: ObjRef, note?: string) {
  const name = refName(ref);
  const entry: JournalEntry = { t: Date.now(), ref, name, live: state.live, gyro: state.gyro, place: state.placeId, lat: state.location.lat, lon: state.location.lon, note };
  progress.journal.unshift(entry);
  const d = new Date();
  const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (!progress.days.includes(dk)) progress.days.push(dk);
  progress.xp += 5;
  checkBadges();
  persist();
  bus.emit('progress');
}

/** Chiamata dalla vista cielo: completa una missione se il suo oggetto è nel mirino. */
export function tryComplete(ref: ObjRef): Mission | null {
  const m = progress.missions.find((x) => !x.done && sameRef(x.ref, ref));
  if (!m) return null;
  m.done = Date.now();
  const mult = state.gyro ? 2 : 1;
  progress.xp += m.xp * mult;
  logObservation(ref, 'Missione completata');
  bus.emit('toast', `Missione completata: ${m.title} · +${m.xp * mult} XP${mult > 1 ? ' (cielo vero ×2)' : ''}`, 'mission');
  bus.emit('progress');
  return m;
}

export function flag(id: 'light' | 'star' | 'andromeda') {
  if (!progress.flags[id]) { progress.flags[id] = Date.now(); progress.xp += 50; }
  award(id);
  persist();
  bus.emit('progress');
}

export function visitPlace(id: string) {
  if (!progress.places.includes(id)) {
    progress.places.push(id);
    checkBadges();
    persist();
  }
}
