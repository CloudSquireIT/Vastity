// Idea 5 — Caccia al tesoro celeste: missioni quotidiane, diario, badge e livelli.
import { A, BODIES, eqjToHor, observer, v3 } from '../astro/astro';
import { constellations, messier, radecToVec, starRaDec, stars } from '../data/catalog';
import { rng } from '../render/background';
import { ObjRef, refName, sameRef } from './objects';
import { issPasses } from './iss';
import { bus, save, state } from '../state';
import { LOCALE, lang, tx } from '../i18n';

function issHint(t: Date) {
  const h = t.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  return tx(`Passa alle ${h}: inquadrala mentre attraversa il cielo.`, `It passes at ${h}: frame it as it crosses the sky.`, `Elle passe à ${h} : cadrez-la pendant qu'elle traverse le ciel.`);
}

export interface Mission { id: string; ref: ObjRef; title: string; hint: string; xp: number; done?: number }
export interface JournalEntry { t: number; ref: ObjRef; name: string; live: boolean; gyro: boolean; place: string; lat: number; lon: number; note?: string; /** distanza dalla Terra al momento della visita */ dist?: string; /** nota personale */ text?: string }
export interface Badge { id: string; name: string; desc: string; icon: string; secret?: boolean }

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
  { id: 'first', name: tx('Prima luce', 'First light', 'Première lumière'), desc: tx('Completa la tua prima missione', 'Complete your first mission', 'Accomplissez votre première mission'), icon: '✦' },
  { id: 'planets', name: tx('Cacciatore di pianeti', 'Planet hunter', 'Chasseur de planètes'), desc: tx('Osserva 5 pianeti diversi', 'Observe 5 different planets', 'Observez 5 planètes différentes'), icon: '◐' },
  { id: 'moon', name: tx('Lunatico', 'Moonstruck', 'Lunatique'), desc: tx('Osserva la Luna in 4 fasi diverse', 'Observe the Moon in 4 different phases', 'Observez la Lune dans 4 phases différentes'), icon: '☾' },
  { id: 'iss', name: tx('Stazione in vista', 'Station in sight', 'Station en vue'), desc: tx('Osserva un passaggio della ISS', 'Watch an ISS pass', 'Observez un passage de l\'ISS'), icon: '⌁' },
  { id: 'deep', name: tx('Profondo cielo', 'Deep sky', 'Ciel profond'), desc: tx('Osserva 5 oggetti di Messier', 'Observe 5 Messier objects', 'Observez 5 objets de Messier'), icon: '✺' },
  { id: 'cons', name: tx('Cartografo del cielo', 'Sky cartographer', 'Cartographe du ciel'), desc: tx('Trova 12 costellazioni', 'Find 12 constellations', 'Trouvez 12 constellations'), icon: '✧' },
  { id: 'owl', name: tx('Gufo notturno', 'Night owl', 'Oiseau de nuit'), desc: tx('Osserva qualcosa tra mezzanotte e le 4', 'Observe something between midnight and 4 am', 'Observez quelque chose entre minuit et 4 h'), icon: '◉' },
  { id: 'streak3', name: tx('Costanza', 'Consistency', 'Persévérance'), desc: tx('Osserva per 3 giorni di fila', 'Observe 3 days in a row', 'Observez 3 jours de suite'), icon: '③' },
  { id: 'streak7', name: tx('Una settimana di stelle', 'A week of stars', 'Une semaine d\'étoiles'), desc: tx('Osserva per 7 giorni di fila', 'Observe 7 days in a row', 'Observez 7 jours de suite'), icon: '⑦' },
  { id: 'worlds', name: tx('Turista cosmico', 'Cosmic tourist', 'Touriste cosmique'), desc: tx('Guarda il cielo da 5 mondi diversi', 'View the sky from 5 different worlds', 'Regardez le ciel depuis 5 mondes différents'), icon: '⊕' },
  { id: 'light', name: tx('Quasi luce', 'Almost light', 'Presque la lumière'), desc: tx('Raggiungi il 99% della velocità della luce', 'Reach 99% of the speed of light', 'Atteignez 99 % de la vitesse de la lumière'), icon: 'c' },
  { id: 'star', name: tx('Interstellare', 'Interstellar', 'Interstellaire'), desc: tx('Arriva con la navicella a un\'altra stella', 'Fly the spaceship to another star', 'Rejoignez une autre étoile avec le vaisseau'), icon: '✶' },
  { id: 'wish', name: tx('Esprimi un desiderio', 'Make a wish', 'Faites un vœu'), desc: tx('Tocca una stella cadente prima che svanisca', 'Tap a shooting star before it fades', 'Touchez une étoile filante avant qu\'elle disparaisse'), icon: '☄', secret: true },
  { id: 'trip', name: tx('Primo viaggio', 'First voyage', 'Premier voyage'), desc: tx('Dalla Luna a fuori dalla galassia', 'From the Moon to beyond the galaxy', 'De la Lune jusqu\'au-delà de la galaxie'), icon: '➶' },
  { id: 'andromeda', name: tx('Fuori dalla galassia', 'Beyond the galaxy', 'Hors de la galaxie'), desc: tx('Raggiungi la Galassia di Andromeda', 'Reach the Andromeda Galaxy', 'Atteignez la galaxie d\'Andromède'), icon: '◎' },
  { id: 'missions10', name: tx('Cacciatore di missioni', 'Mission hunter', 'Chasseur de missions'), desc: tx('Completa 10 missioni', 'Complete 10 missions', 'Accomplissez 10 missions'), icon: '◈' },
  // segreti: si scoprono solo sbloccandoli
  { id: 'smallstep', name: tx('Un piccolo passo', 'One small step', 'Un petit pas'), desc: tx('Atterra sulla Luna con la navicella', 'Land on the Moon with the spaceship', 'Posez-vous sur la Lune avec le vaisseau'), icon: '⚑', secret: true },
  { id: 'ancient', name: tx('Luce antica', 'Ancient light', 'Lumière ancienne'), desc: tx('Raggiungi un quasar, a miliardi di anni luce', 'Reach a quasar, billions of light years away', 'Atteignez un quasar, à des milliards d\'années-lumière'), icon: '✹', secret: true },
];

export const RANKS: [number, string][] = [
  [0, tx('Curioso', 'Curious', 'Curieux')], [100, tx('Osservatore', 'Observer', 'Observateur')], [300, tx('Astrofilo', 'Stargazer', 'Astronome amateur')], [700, tx('Astronomo', 'Astronomer', 'Astronome')], [1500, tx('Esploratore stellare', 'Star explorer', 'Explorateur stellaire')], [3000, tx('Navigatore cosmico', 'Cosmic navigator', 'Navigateur cosmique')],
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
  const key = dayKey() + '-' + lang;
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
    out.push({ id: `${key}-p`, ref: { kind: 'body', id: p.id }, title: tx(`Trova ${p.name}`, `Find ${p.name}`, `Trouvez ${p.name}`), hint: p.id === 'moon' ? tx('Facile: inquadrala e tienila al centro.', 'Easy: frame it and keep it in the centre.', 'Facile : cadrez-la et gardez-la au centre.') : tx('Sembra una stella che non brilla a intermittenza.', 'It looks like a star that does not twinkle.', 'On dirait une étoile qui ne scintille pas.'), xp: p.id === 'moon' ? 10 : 30 });
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
    out.push({ id: `${key}-s`, ref: { kind: 'star', index: s }, title: tx(`Trova ${refName({ kind: 'star', index: s })}`, `Find ${refName({ kind: 'star', index: s })}`, `Trouvez ${refName({ kind: 'star', index: s })}`), hint: tx('Usa la ricerca o segui la freccia ai bordi dello schermo.', 'Use search or follow the arrow at the edge of the screen.', "Utilisez la recherche ou suivez la flèche au bord de l'écran."), xp: 20 });
  }
  const cons = constellations.filter((c) => c.rank <= 2 && up(radecToVec(c.c[0], c.c[1]), 25));
  if (cons.length) {
    const c = pickFrom(cons);
    out.push({ id: `${key}-c`, ref: { kind: 'constellation', id: c.id }, title: tx(`Riconosci ${c.name}`, `Recognise ${c.name}`, `Reconnaissez ${c.name}`), hint: tx('Centra la costellazione nel mirino.', 'Centre the constellation in the reticle.', 'Centrez la constellation dans le viseur.'), xp: 25 });
  }
  const dsos = messier.filter((m) => m.mag < 6.5 && up(radecToVec(m.ra, m.dec), 25));
  if (dsos.length) {
    const m = pickFrom(dsos);
    out.push({ id: `${key}-m`, ref: { kind: 'messier', id: m.id }, title: tx(`Scova ${refName({ kind: 'messier', id: m.id })}`, `Track down ${refName({ kind: 'messier', id: m.id })}`, `Dénichez ${refName({ kind: 'messier', id: m.id })}`), hint: tx('Oggetto del profondo cielo: con un binocolo è ancora meglio.', 'A deep-sky object: even better with binoculars.', 'Objet du ciel profond : encore mieux aux jumelles.'), xp: 40 });
  }
  const pass = issPasses(new Date(), 1).find((p) => p.visible && p.maxAlt > 20);
  if (pass) out.push({ id: `${key}-iss`, ref: { kind: 'iss' }, title: tx('Avvista la Stazione Spaziale', 'Spot the Space Station', 'Repérez la Station spatiale'), hint: issHint(pass.peak), xp: 60 });

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
  if (b) bus.emit('badge', b);
}

/** Badge "segreti" assegnati da eventi dell'interfaccia (es. stella cadente). */
export function awardSecret(id: string) {
  if (progress.badges[id]) return false;
  award(id);
  progress.xp += 20;
  persist();
  bus.emit('progress');
  return true;
}

/** Avanzamento di ogni achievement (valore attuale e obiettivo), per il pannello Missioni. */
function stats() {
  const j = progress.journal;
  const ids = (k: string) => new Set(j.filter((e) => e.ref.kind === k).map((e) => JSON.stringify(e.ref)));
  const planets = new Set(j.filter((e) => e.ref.kind === 'body' && !['moon', 'sun'].includes((e.ref as any).id)).map((e) => (e.ref as any).id));
  const phases = new Set(j.filter((e) => e.ref.kind === 'body' && (e.ref as any).id === 'moon').map((e) => Math.floor(A.MoonPhase(new Date(e.t)) / 90)));
  const days = progress.days.slice().sort();
  let streak = 1, best = days.length ? 1 : 0;
  for (let i = 1; i < days.length; i++) {
    const a = new Date(days[i - 1]), b = new Date(days[i]);
    streak = Math.round((b.getTime() - a.getTime()) / 86400e3) === 1 ? streak + 1 : 1;
    best = Math.max(best, streak);
  }
  const missionsDone = j.filter((e) => e.note === 'mission').length;
  return {
    first: [Math.min(1, missionsDone + j.length), 1], planets: [planets.size, 5], moon: [phases.size, 4],
    iss: [j.some((e) => e.ref.kind === 'iss') ? 1 : 0, 1], deep: [ids('messier').size, 5], cons: [ids('constellation').size, 12],
    owl: [j.some((e) => new Date(e.t).getHours() < 4) ? 1 : 0, 1], streak3: [best, 3], streak7: [best, 7],
    worlds: [progress.places.length, 5], missions10: [missionsDone, 10],
  } as Record<string, [number, number]>;
}

export interface AchievementState { b: Badge; cur: number; goal: number; got: boolean; k: number }
/** Tutti gli achievement con il loro avanzamento 0–1 e il completamento totale (0–100%). */
export function achievements(): { list: AchievementState[]; total: number } {
  const st = stats();
  const list = BADGES.map((b) => {
    const got = !!progress.badges[b.id];
    const [cur, goal] = st[b.id] ?? [got ? 1 : 0, 1];
    const k = got ? 1 : Math.max(0, Math.min(1, cur / goal));
    return { b, cur: Math.min(cur, goal), goal, got, k };
  });
  const total = Math.round((list.reduce((a, x) => a + x.k, 0) / list.length) * 100);
  return { list, total };
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
  if (j.filter((e) => e.note === 'mission').length >= 10) award('missions10');
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

/** L'oggetto è già nel diario (aggiunto a mano)? */
export function isLogged(ref: ObjRef) {
  return progress.journal.some((e) => !e.note && sameRef(e.ref, ref));
}

/** Toglie dal diario le voci aggiunte a mano per questo oggetto (le missioni restano). */
export function unlogObservation(ref: ObjRef) {
  const before = progress.journal.length;
  progress.journal = progress.journal.filter((e) => e.note || !sameRef(e.ref, ref));
  progress.xp = Math.max(0, progress.xp - 5 * (before - progress.journal.length));
  persist();
  bus.emit('progress');
}

/** Rimuove una singola voce del diario (dal pannello Missioni). */
/** Visita con la navicella: registrata nel diario con data e distanza (una sola volta ogni 10 minuti per oggetto). */
export function logVisit(ref: ObjRef, dist?: string) {
  const now = Date.now();
  if (progress.journal.some((e) => e.note === 'visit' && sameRef(e.ref, ref) && now - e.t < 10 * 60e3)) return;
  const entry: JournalEntry = { t: now, ref, name: refName(ref), live: state.live, gyro: false, place: 'ship', lat: 0, lon: 0, note: 'visit', dist };
  progress.journal.unshift(entry);
  const d = new Date();
  const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (!progress.days.includes(dk)) progress.days.push(dk);
  persist();
  bus.emit('progress');
}

/** Nota personale su una voce del diario. */
export function setJournalText(t: number, text: string) {
  const e = progress.journal.find((x) => x.t === t);
  if (!e) return;
  e.text = text.trim().slice(0, 280) || undefined;
  persist();
}

export function removeJournalEntry(t: number) {
  const i = progress.journal.findIndex((e) => e.t === t);
  if (i < 0) return;
  if (!progress.journal[i].note) progress.xp = Math.max(0, progress.xp - 5);
  progress.journal.splice(i, 1);
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
  logObservation(ref, 'mission');
  bus.emit('toast', `${tx('Missione completata', 'Mission complete', 'Mission accomplie')}: ${m.title} · +${m.xp * mult} XP${mult > 1 ? tx(' (cielo vero ×2)', ' (real sky ×2)', ' (vrai ciel ×2)') : ''}`, 'mission');
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
