// Idea 9 — Avvisi intelligenti: eventi del cielo calcolati per la tua posizione,
// incrociati con il meteo. Funziona senza server: notifiche locali mentre l'app è aperta
// ed esportazione nel calendario (.ics) per promemoria affidabili.
import { A, bodyById, observer } from '../astro/astro';
import { ObjRef } from './objects';
import { issPasses, loadISS, azName } from './iss';
import { effectiveCloud, getWeather, weatherAt } from './weather';
import { bus, state } from '../state';
import { LOCALE, lang, num, tx } from '../i18n';
import { constellationById } from '../data/catalog';

export type AlertType = 'iss' | 'meteors' | 'conjunctions' | 'moon' | 'eclipses' | 'planets';

export const ALERT_TYPES: { id: AlertType; name: string }[] = [
  { id: 'iss', name: tx('Passaggi della ISS', 'ISS passes', 'Passages de l\'ISS') },
  { id: 'meteors', name: tx('Sciami di meteore', 'Meteor showers', 'Pluies de météores') },
  { id: 'conjunctions', name: tx('Congiunzioni', 'Conjunctions', 'Conjonctions') },
  { id: 'planets', name: tx('Pianeti (opposizioni, elongazioni)', 'Planets (oppositions, elongations)', 'Planètes (oppositions, élongations)') },
  { id: 'moon', name: tx('Fasi lunari', 'Moon phases', 'Phases de la Lune') },
  { id: 'eclipses', name: tx('Eclissi', 'Eclipses', 'Éclipses') },
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

const SHOWERS: { name: [string, string, string]; m: number; d: number; zhr: number; con: string }[] = [
  { name: ['Quadrantidi', 'Quadrantids', 'Quadrantides'], m: 1, d: 3, zhr: 110, con: 'Boo' },
  { name: ['Liridi', 'Lyrids', 'Lyrides'], m: 4, d: 22, zhr: 18, con: 'Lyr' },
  { name: ['Eta Aquaridi', 'Eta Aquariids', 'Êta Aquarides'], m: 5, d: 6, zhr: 50, con: 'Aqr' },
  { name: ['Delta Aquaridi', 'Delta Aquariids', 'Delta Aquarides'], m: 7, d: 30, zhr: 25, con: 'Aqr' },
  { name: ['Perseidi', 'Perseids', 'Perséides'], m: 8, d: 12, zhr: 100, con: 'Per' },
  { name: ['Draconidi', 'Draconids', 'Draconides'], m: 10, d: 8, zhr: 10, con: 'Dra' },
  { name: ['Orionidi', 'Orionids', 'Orionides'], m: 10, d: 21, zhr: 20, con: 'Ori' },
  { name: ['Leonidi', 'Leonids', 'Léonides'], m: 11, d: 17, zhr: 15, con: 'Leo' },
  { name: ['Geminidi', 'Geminids', 'Géminides'], m: 12, d: 14, zhr: 150, con: 'Gem' },
  { name: ['Ursidi', 'Ursids', 'Ursides'], m: 12, d: 22, zhr: 10, con: 'UMi' },
];

const fmtDay = (d: Date) => d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (d: Date) => d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
const pick = (n: [string, string, string]) => (lang === 'it' ? n[0] : lang === 'fr' ? n[2] : n[1]);
const bname = (id: string) => bodyById(id)?.name ?? id;

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
        const isNew = q.quarter === 0;
        ev.push({
          id: `moon-${q.time.date.getTime()}`, type: 'moon', date: q.time.date,
          title: isNew ? tx('Luna nuova', 'New Moon', 'Nouvelle lune') : tx('Luna piena', 'Full Moon', 'Pleine lune'),
          desc: isNew
            ? tx('Le notti più buie del mese: perfette per il profondo cielo.', 'The darkest nights of the month: perfect for deep-sky objects.', 'Les nuits les plus noires du mois : parfaites pour le ciel profond.')
            : tx('La Luna sorge al tramonto e illumina tutta la notte.', 'The Moon rises at sunset and lights up the whole night.', 'La Lune se lève au coucher du Soleil et éclaire toute la nuit.'),
          quality: isNew ? 2 : 1, ref: { kind: 'body', id: 'moon' },
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
      const pct = Math.round(ill * 100);
      const q: 0 | 1 | 2 = s.zhr >= 50 && ill < 0.4 ? 2 : s.zhr >= 20 && ill < 0.7 ? 1 : 0;
      const n = pick(s.name);
      const con = constellationById(s.con)?.name ?? s.con;
      const moonBad = ill > 0.6;
      ev.push({
        id: `met-${s.con}-${s.m}-${y}`, type: 'meteors', date: peak,
        title: tx(`Picco delle ${n}`, `${n} peak`, `Pic des ${n}`),
        desc: tx(
          `Fino a ${s.zhr} meteore/ora in condizioni ideali, dalla costellazione ${con}. Luna illuminata al ${pct}%${moonBad ? ': disturberà la visione' : ''}. Guarda dopo mezzanotte, lontano dalle luci.`,
          `Up to ${s.zhr} meteors per hour in ideal conditions, radiating from ${con}. Moon ${pct}% illuminated${moonBad ? ': it will spoil the view' : ''}. Look after midnight, away from lights.`,
          `Jusqu'à ${s.zhr} météores par heure dans des conditions idéales, depuis la constellation ${con}. Lune éclairée à ${pct} %${moonBad ? ' : elle gênera l\'observation' : ''}. Regardez après minuit, loin des lumières.`),
        quality: q,
      });
    }
  }

  // Congiunzioni (Luna-pianeta < 4°, pianeta-pianeta < 2,5°)
  const list: [string, A.Body][] = [['moon', A.Body.Moon], ['mercury', A.Body.Mercury], ['venus', A.Body.Venus], ['mars', A.Body.Mars], ['jupiter', A.Body.Jupiter], ['saturn', A.Body.Saturn]];
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
            const a = bname(list[i][0]), b = bname(list[j][0]);
            const deg = num(prev, 1, 1);
            const moons = Math.max(1, Math.round(prev * 2));
            const low = elong < 30;
            ev.push({
              id: `conj-${i}-${j}-${td.getTime()}`, type: 'conjunctions', date: td,
              title: tx(`${a} e ${b} vicini`, `${a} and ${b} close together`, `${a} et ${b} rapprochés`),
              desc: tx(
                `Separati di appena ${deg}° (meno di ${moons} lune piene affiancate). ${low ? 'Bassi sull\'orizzonte vicino al Sole: cercali al crepuscolo.' : 'Ben visibili a occhio nudo.'}`,
                `Just ${deg}° apart (less than ${moons} full Moons side by side). ${low ? 'Low on the horizon near the Sun: look for them at twilight.' : 'Easy to see with the naked eye.'}`,
                `Séparés d'à peine ${deg}° (moins de ${moons} pleines lunes côte à côte). ${low ? 'Bas sur l\'horizon près du Soleil : cherchez-les au crépuscule.' : 'Bien visibles à l\'œil nu.'}`),
              quality: prev < 1.5 ? 2 : 1, ref: { kind: 'body', id: list[j][0] },
            });
          }
        }
        prev2 = prev; prev = s;
      }
    }
  }

  // Opposizioni ed elongazioni
  const outer: [string, A.Body][] = [['mars', A.Body.Mars], ['jupiter', A.Body.Jupiter], ['saturn', A.Body.Saturn], ['uranus', A.Body.Uranus], ['neptune', A.Body.Neptune]];
  for (const [id, b] of outer) {
    try {
      const t = A.SearchRelativeLongitude(b, 0, from).date;
      const n = bname(id);
      if (t < until) ev.push({
        id: `opp-${id}-${t.getTime()}`, type: 'planets', date: t,
        title: tx(`${n} in opposizione`, `${n} at opposition`, `${n} à l'opposition`),
        desc: tx(
          `${n} è dalla parte opposta al Sole: visibile tutta la notte, alla minima distanza e alla massima luminosità.`,
          `${n} is opposite the Sun: visible all night, at its closest and brightest.`,
          `${n} est à l'opposé du Soleil : visible toute la nuit, au plus près et au plus brillant.`),
        quality: 2, ref: { kind: 'body', id },
      });
    } catch { /* */ }
  }
  for (const [id, b] of [['mercury', A.Body.Mercury], ['venus', A.Body.Venus]] as [string, A.Body][]) {
    try {
      const e = A.SearchMaxElongation(b, from);
      const n = bname(id);
      const deg = e.elongation.toFixed(0);
      const morning = e.visibility === 'morning';
      if (e.time.date < until) ev.push({
        id: `elo-${id}-${e.time.date.getTime()}`, type: 'planets', date: e.time.date,
        title: tx(`${n} alla massima elongazione`, `${n} at greatest elongation`, `${n} à son élongation maximale`),
        desc: tx(
          `${n} è alla massima distanza apparente dal Sole (${deg}°): il momento migliore per vederlo ${morning ? 'prima dell\'alba, a est' : 'dopo il tramonto, a ovest'}.`,
          `${n} is at its greatest apparent distance from the Sun (${deg}°): the best time to see it ${morning ? 'before dawn, in the east' : 'after sunset, in the west'}.`,
          `${n} est à sa plus grande distance apparente du Soleil (${deg}°) : le meilleur moment pour l'observer ${morning ? 'avant l\'aube, à l\'est' : 'après le coucher du Soleil, à l\'ouest'}.`),
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
      const total = le.kind === 'total';
      ev.push({
        id: `lecl-${le.peak.date.getTime()}`, type: 'eclipses', date: le.peak.date,
        title: total ? tx('Eclissi totale di Luna', 'Total lunar eclipse', 'Éclipse totale de Lune') : tx('Eclissi parziale di Luna', 'Partial lunar eclipse', 'Éclipse partielle de Lune'),
        desc: alt > 0
          ? tx(`Visibile dalla tua posizione (Luna alta ${Math.round(alt)}°).`, `Visible from your location (Moon ${Math.round(alt)}° high).`, `Visible depuis votre position (Lune à ${Math.round(alt)}° de hauteur).`)
          : tx('Non visibile da qui: la Luna sarà sotto l\'orizzonte.', 'Not visible from here: the Moon will be below the horizon.', 'Invisible d\'ici : la Lune sera sous l\'horizon.'),
        quality: alt > 0 ? 2 : 0, ref: { kind: 'body', id: 'moon' },
      });
    }
  } catch { /* */ }
  try {
    const se = A.SearchLocalSolarEclipse(from, obs);
    if (se.peak.time.date.getTime() - from.getTime() < 365 * 86400e3) {
      const pct = Math.round(se.obscuration * 100);
      const title = se.kind === 'total' ? tx('Eclissi totale di Sole', 'Total solar eclipse', 'Éclipse totale de Soleil')
        : se.kind === 'annular' ? tx('Eclissi anulare di Sole', 'Annular solar eclipse', 'Éclipse annulaire de Soleil')
        : tx('Eclissi parziale di Sole', 'Partial solar eclipse', 'Éclipse partielle de Soleil');
      ev.push({
        id: `secl-${se.peak.time.date.getTime()}`, type: 'eclipses', date: se.peak.time.date, title,
        desc: tx(
          `Visibile dalla tua posizione: il Sole sarà coperto al ${pct}%. Non guardarlo mai senza filtri certificati!`,
          `Visible from your location: ${pct}% of the Sun will be covered. Never look at it without certified filters!`,
          `Visible depuis votre position : le Soleil sera masqué à ${pct} %. Ne le regardez jamais sans filtre certifié !`),
        quality: 2, ref: { kind: 'body', id: 'sun' },
      });
    }
  } catch { /* */ }

  // ISS
  for (const p of issPasses(from, 3)) {
    if (!p.visible || p.maxAlt < 25) continue;
    const a = azName(p.startAz), b = azName(p.endAz), h = Math.round(p.maxAlt);
    const min = Math.max(1, Math.round((p.end.getTime() - p.start.getTime()) / 60000));
    ev.push({
      id: `iss-${p.peak.getTime()}`, type: 'iss', date: p.start, end: p.end,
      title: tx('Passaggio della ISS', 'ISS pass', 'Passage de l\'ISS'),
      desc: tx(
        `Da ${a} verso ${b}, alta fino a ${h}°. Dura circa ${min} minuti.`,
        `From ${a} to ${b}, up to ${h}° high. Lasts about ${min} minutes.`,
        `De ${a} vers ${b}, jusqu'à ${h}° de hauteur. Dure environ ${min} minutes.`),
      quality: p.maxAlt > 50 ? 2 : 1, ref: { kind: 'iss' },
    });
  }

  // meteo: correggi la qualità per gli eventi dei prossimi giorni
  for (const e of ev) {
    const w = weatherAt(weather, e.date.getTime());
    if (!w) continue;
    const c = Math.round(effectiveCloud(w));
    if (c > 70) { e.weather = tx(`Previsto nuvoloso (${c}%)`, `Cloudy forecast (${c}%)`, `Ciel couvert prévu (${c} %)`); e.quality = 0; }
    else if (c > 35) { e.weather = tx(`Nuvole sparse (${c}%)`, `Scattered clouds (${c}%)`, `Nuages épars (${c} %)`); if (e.quality === 2) e.quality = 1; }
    else e.weather = tx(`Cielo sereno previsto (${c}% nuvole)`, `Clear skies forecast (${c}% cloud)`, `Ciel dégagé prévu (${c} % de nuages)`);
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
      const soon = e.type === 'iss' ? tx('Tra 5 minuti', 'In 5 minutes', 'Dans 5 minutes') : tx('Tra poco', 'Coming up soon', 'Bientôt');
      bus.emit('toast', `${e.title} — ${fmtTime(e.date)}`, 'alert');
      if (notificationsEnabled()) notify(e.title, `${soon} · ${e.desc}`);
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
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//Vastity//Sky//${lang.toUpperCase()}`, 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    const end = e.end ?? new Date(e.date.getTime() + (e.type === 'iss' ? 10 : 60) * 60e3);
    lines.push('BEGIN:VEVENT', `UID:${e.id}@vastity`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(e.date)}`, `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEsc('✦ ' + e.title)}`, `DESCRIPTION:${icsEsc(e.desc + (e.weather ? '\n' + e.weather : ''))}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${e.type === 'iss' ? 5 : 30}M`, `DESCRIPTION:${icsEsc(e.title)}`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(events: SkyEvent[], name = 'vastity.ics') {
  const blob = new Blob([eventsToICS(events)], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export { fmtDay, fmtTime };
