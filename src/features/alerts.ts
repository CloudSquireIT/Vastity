// Idea 9 — Avvisi intelligenti: eventi del cielo calcolati per la tua posizione,
// incrociati con il meteo. Funziona senza server: notifiche locali mentre l'app è aperta
// ed esportazione nel calendario (.ics) per promemoria affidabili.
import { A, BODIES, observer } from '../astro/astro';
import { ObjRef } from './objects';
import { issPasses, loadISS, azName } from './iss';
import { effectiveCloud, getWeather, weatherAt } from './weather';
import { bus, state } from '../state';

export type AlertType = 'iss' | 'meteors' | 'conjunctions' | 'moon' | 'eclipses' | 'planets';

export const ALERT_TYPES: { id: AlertType; name: string }[] = [
  { id: 'iss', name: 'Passaggi della ISS' },
  { id: 'meteors', name: 'Sciami di meteore' },
  { id: 'conjunctions', name: 'Congiunzioni' },
  { id: 'planets', name: 'Pianeti (opposizioni, elongazioni)' },
  { id: 'moon', name: 'Fasi lunari' },
  { id: 'eclipses', name: 'Eclissi' },
];

export interface SkyEvent {
  id: string;
  type: AlertType;
  date: Date;
  end?: Date;
  title: string;
  desc: string;
  quality: 0 | 1 | 2; // scarso, buono, ottimo
  weather?: string;
  ref?: ObjRef;
}

const SHOWERS = [
  { name: 'Quadrantidi', m: 1, d: 3, zhr: 110, rad: 'Boote' },
  { name: 'Liridi', m: 4, d: 22, zhr: 18, rad: 'Lira' },
  { name: 'Eta Aquaridi', m: 5, d: 6, zhr: 50, rad: 'Acquario' },
  { name: 'Delta Aquaridi', m: 7, d: 30, zhr: 25, rad: 'Acquario' },
  { name: 'Perseidi', m: 8, d: 12, zhr: 100, rad: 'Perseo' },
  { name: 'Draconidi', m: 10, d: 8, zhr: 10, rad: 'Dragone' },
  { name: 'Orionidi', m: 10, d: 21, zhr: 20, rad: 'Orione' },
  { name: 'Leonidi', m: 11, d: 17, zhr: 15, rad: 'Leone' },
  { name: 'Geminidi', m: 12, d: 14, zhr: 150, rad: 'Gemelli' },
  { name: 'Ursidi', m: 12, d: 22, zhr: 10, rad: 'Orsa Minore' },
];

const fmtDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

function sep(a: A.Body, b: A.Body, t: Date) {
  return A.AngleBetween(A.GeoVector(a, t, true), A.GeoVector(b, t, true));
}

export async function computeEvents(from = new Date(), days = 30): Promise<SkyEvent[]> {
  const [weather] = await Promise.all([getWeather(), loadISS().catch(() => undefined)]);
  const ev: SkyEvent[] = [];
  const until = new Date(from.getTime() + days * 86400e3);
  const obs = observer();

  // Fasi lunari
  try {
    let q = A.SearchMoonQuarter(from);
    while (q.time.date < until) {
      if (q.quarter === 0 || q.quarter === 2) {
        ev.push({
          id: `moon-${q.time.date.getTime()}`, type: 'moon', date: q.time.date,
          title: q.quarter === 0 ? 'Luna nuova' : 'Luna piena',
          desc: q.quarter === 0 ? 'Le notti più buie del mese: perfette per il profondo cielo.' : 'La Luna sorge al tramonto e illumina tutta la notte.',
          quality: q.quarter === 0 ? 2 : 1, ref: { kind: 'body', id: 'moon' },
        });
      }
      q = A.NextMoonQuarter(q);
    }
  } catch { /* */ }

  // Sciami di meteore
  for (const s of SHOWERS) {
    for (const y of [from.getFullYear(), from.getFullYear() + 1]) {
      const peak = new Date(y, s.m - 1, s.d, 3, 0, 0);
      if (peak < new Date(from.getTime() - 86400e3) || peak > until) continue;
      const ill = A.Illumination(A.Body.Moon, peak).phase_fraction;
      const q: 0 | 1 | 2 = s.zhr >= 50 && ill < 0.4 ? 2 : s.zhr >= 20 && ill < 0.7 ? 1 : 0;
      ev.push({
        id: `met-${s.name}-${y}`, type: 'meteors', date: peak, title: `Picco delle ${s.name}`,
        desc: `Fino a ${s.zhr} meteore/ora in condizioni ideali, dalla costellazione ${s.rad}. Luna illuminata al ${Math.round(ill * 100)}%${ill > 0.6 ? ': disturberà la visione' : ''}. Guarda dopo mezzanotte, lontano dalle luci.`,
        quality: q,
      });
    }
  }

  // Congiunzioni (Luna-pianeta < 4°, pianeta-pianeta < 2,5°)
  const list: [string, A.Body][] = [['Luna', A.Body.Moon], ['Mercurio', A.Body.Mercury], ['Venere', A.Body.Venus], ['Marte', A.Body.Mars], ['Giove', A.Body.Jupiter], ['Saturno', A.Body.Saturn]];
  const stepH = 3;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const lim = i === 0 ? 4 : 2.5;
      let prev2 = Infinity, prev = Infinity;
      for (let t = from.getTime(); t < until.getTime(); t += stepH * 3600e3) {
        const d = new Date(t);
        const s = sep(list[i][1], list[j][1], d);
        if (prev < prev2 && prev < s && prev < lim) {
          const td = new Date(t - stepH * 3600e3);
          const elong = Math.min(A.AngleFromSun(list[i][1], td), A.AngleFromSun(list[j][1], td));
          if (elong > 15) {
            const bodyId = BODIES.find((b) => b.body === list[j][1])?.id;
            ev.push({
              id: `conj-${i}-${j}-${td.getTime()}`, type: 'conjunctions', date: td,
              title: `${list[i][0]} e ${list[j][0]} vicini`,
              desc: `Separati di appena ${prev.toFixed(1).replace('.', ',')}° (meno di ${Math.max(1, Math.round(prev * 2))} lune piene affiancate). ${elong < 30 ? 'Bassi sull\'orizzonte vicino al Sole: cercali al crepuscolo.' : 'Ben visibili a occhio nudo.'}`,
              quality: prev < 1.5 ? 2 : 1, ref: bodyId ? { kind: 'body', id: bodyId } : undefined,
            });
          }
        }
        prev2 = prev; prev = s;
      }
    }
  }

  // Opposizioni ed elongazioni
  const outer: [string, string, A.Body][] = [['mars', 'Marte', A.Body.Mars], ['jupiter', 'Giove', A.Body.Jupiter], ['saturn', 'Saturno', A.Body.Saturn], ['uranus', 'Urano', A.Body.Uranus], ['neptune', 'Nettuno', A.Body.Neptune]];
  for (const [id, it, b] of outer) {
    try {
      const t = A.SearchRelativeLongitude(b, 0, from).date;
      if (t < until) ev.push({ id: `opp-${id}-${t.getTime()}`, type: 'planets', date: t, title: `${it} in opposizione`, desc: `${it} è dalla parte opposta al Sole: visibile tutta la notte, alla minima distanza e alla massima luminosità.`, quality: 2, ref: { kind: 'body', id } });
    } catch { /* */ }
  }
  for (const [id, it, b] of [['mercury', 'Mercurio', A.Body.Mercury], ['venus', 'Venere', A.Body.Venus]] as [string, string, A.Body][]) {
    try {
      const e = A.SearchMaxElongation(b, from);
      if (e.time.date < until) ev.push({
        id: `elo-${id}-${e.time.date.getTime()}`, type: 'planets', date: e.time.date, title: `${it} alla massima elongazione`,
        desc: `${it} è alla massima distanza apparente dal Sole (${e.elongation.toFixed(0)}°): il momento migliore per vederlo ${e.visibility === 'morning' ? 'prima dell\'alba, a est' : 'dopo il tramonto, a ovest'}.`,
        quality: id === 'mercury' ? 1 : 2, ref: { kind: 'body', id },
      });
    } catch { /* */ }
  }

  // Eclissi (nei prossimi 12 mesi)
  try {
    const le = A.SearchLunarEclipse(from);
    if (le.peak.date.getTime() - from.getTime() < 365 * 86400e3 && le.kind !== 'penumbral') {
      const mEq = A.Equator(A.Body.Moon, le.peak.date, obs, true, true);
      const alt = A.Horizon(le.peak.date, obs, mEq.ra, mEq.dec).altitude;
      ev.push({ id: `lecl-${le.peak.date.getTime()}`, type: 'eclipses', date: le.peak.date, title: `Eclissi ${le.kind === 'total' ? 'totale' : 'parziale'} di Luna`, desc: alt > 0 ? `Visibile dalla tua posizione (Luna alta ${Math.round(alt)}°).` : 'Non visibile da qui: la Luna sarà sotto l\'orizzonte.', quality: alt > 0 ? 2 : 0, ref: { kind: 'body', id: 'moon' } });
    }
  } catch { /* */ }
  try {
    const se = A.SearchLocalSolarEclipse(from, obs);
    if (se.peak.time.date.getTime() - from.getTime() < 365 * 86400e3) {
      ev.push({ id: `secl-${se.peak.time.date.getTime()}`, type: 'eclipses', date: se.peak.time.date, title: `Eclissi ${se.kind === 'total' ? 'totale' : se.kind === 'annular' ? 'anulare' : 'parziale'} di Sole`, desc: `Visibile dalla tua posizione: il Sole sarà coperto al ${Math.round(se.obscuration * 100)}%. Non guardarlo mai senza filtri certificati!`, quality: 2, ref: { kind: 'body', id: 'sun' } });
    }
  } catch { /* */ }

  // ISS
  for (const p of issPasses(from, 3)) {
    if (!p.visible || p.maxAlt < 25) continue;
    ev.push({
      id: `iss-${p.peak.getTime()}`, type: 'iss', date: p.start, end: p.end, title: 'Passaggio della ISS',
      desc: `Da ${azName(p.startAz)} verso ${azName(p.endAz)}, alta fino a ${Math.round(p.maxAlt)}°. Dura circa ${Math.max(1, Math.round((p.end.getTime() - p.start.getTime()) / 60000))} minuti.`,
      quality: p.maxAlt > 50 ? 2 : 1, ref: { kind: 'iss' },
    });
  }

  // meteo: correggi la qualità per gli eventi dei prossimi giorni
  for (const e of ev) {
    const w = weatherAt(weather, e.date.getTime());
    if (!w) continue;
    const c = effectiveCloud(w);
    if (c > 70) { e.weather = `Previsto nuvoloso (${Math.round(c)}%)`; e.quality = 0; }
    else if (c > 35) { e.weather = `Nuvole sparse (${Math.round(c)}%)`; if (e.quality === 2) e.quality = 1; }
    else e.weather = `Cielo sereno previsto (${Math.round(c)}% nuvole)`;
  }

  return ev.filter((e) => state.settings.alerts[e.type] !== false).sort((a, b) => a.date.getTime() - b.date.getTime());
}

// --- Notifiche locali --------------------------------------------------------
const timers: number[] = [];
const NOTIFIED = 'vastity.notified.v1';

export function notificationsEnabled() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export async function requestNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  const p = await Notification.requestPermission();
  return p === 'granted';
}

async function notify(title: string, body: string) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: title });
    else new Notification(title, { body, icon: 'icons/icon-192.png' });
  } catch { /* */ }
}

/** Programma gli avvisi delle prossime 12 ore (30 min prima, 5 min per la ISS). */
export function scheduleNotifications(events: SkyEvent[]) {
  timers.splice(0).forEach((t) => clearTimeout(t));
  let done: string[] = [];
  try { done = JSON.parse(localStorage.getItem(NOTIFIED) || '[]'); } catch { /* */ }
  const now = Date.now();
  for (const e of events) {
    if (e.quality === 0 || done.includes(e.id)) continue;
    const lead = e.type === 'iss' ? 5 * 60e3 : 30 * 60e3;
    const at = e.date.getTime() - lead;
    if (at - now > 12 * 3600e3 || e.date.getTime() < now) continue;
    const fire = () => {
      const body = `${e.type === 'iss' ? 'Tra 5 minuti' : 'Tra poco'} · ${e.desc}`;
      bus.emit('toast', `${e.title} — ${fmtTime(e.date)}`, 'alert');
      if (notificationsEnabled()) notify(e.title, body);
      done.push(e.id);
      try { localStorage.setItem(NOTIFIED, JSON.stringify(done.slice(-200))); } catch { /* */ }
    };
    timers.push(window.setTimeout(fire, Math.max(0, at - now)));
  }
}

// --- Calendario ---------------------------------------------------------------
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = (s: string) => s.replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');

export function eventsToICS(events: SkyEvent[]) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vastity//Cielo//IT', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    const end = e.end ?? new Date(e.date.getTime() + (e.type === 'iss' ? 10 : 60) * 60e3);
    lines.push('BEGIN:VEVENT', `UID:${e.id}@vastity`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(e.date)}`, `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEsc('✦ ' + e.title)}`, `DESCRIPTION:${icsEsc(e.desc + (e.weather ? '\n' + e.weather : ''))}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${e.type === 'iss' ? 5 : 30}M`, `DESCRIPTION:${icsEsc(e.title)}`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(events: SkyEvent[], name = 'vastity-eventi.ics') {
  const blob = new Blob([eventsToICS(events)], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export { fmtDay, fmtTime };
