// Pannelli dell'interfaccia: scheda oggetto, ricerca, Stasera, Missioni, Avvisi, Mondi, Impostazioni, Macchina del tempo.
import { closeSheet, fmtDate, fmtTime, h, icon, iconButton, openSheet, sheetOpen, toast } from './dom';
import { ObjRef, info, refName, search } from '../features/objects';
import { formatLightTime, formatYear, lightJourney } from '../features/history';
import { computeTonight } from '../features/tonight';
import { BADGES, activeMissions, ensureDailyMissions, logObservation, progress, rankOf, visitPlace } from '../features/missions';
import { ALERT_TYPES, SkyEvent, computeEvents, downloadICS, fmtDay, notificationsEnabled, requestNotifications, scheduleNotifications } from '../features/alerts';
import { PLACES, SkyFrame } from '../astro/astro';
import { bus, saveSettings, setLocation, setTime, state } from '../state';
import { azName } from '../features/iss';

export interface AppApi {
  frame(): SkyFrame;
  centerSky(ref: ObjRef): void;
  selectSky(ref: ObjRef | null): void;
  flyTo(ref: ObjRef): void;
  teleport(ref: ObjRef): void;
  setPlace(id: string): void;
  setMode(m: 'sky' | 'ship'): void;
  share(): void;
  setAR(on: boolean): Promise<boolean>;
  ar(): boolean;
}

let api: AppApi;
export function initPanels(a: AppApi) { api = a; }

// ---------------------------------------------------------------------------
// Scheda dell'oggetto (con il "Viaggio della luce")
// ---------------------------------------------------------------------------
export function showInfo(ref: ObjRef) {
  const d = info(ref, api.frame());
  const body = h('div', { class: 'info' });
  if (d.subtitle) body.append(h('div', { class: 'info-sub' }, d.subtitle));
  if (d.desc) body.append(h('p', { class: 'info-desc' }, d.desc));

  const actions = h('div', { class: 'actions' });
  if (state.mode === 'sky') {
    actions.append(h('button', { class: 'btn', onclick: () => { api.centerSky(ref); closeSheet(); } }, icon('target'), 'Centra'));
    if (d.canFly) actions.append(h('button', { class: 'btn primary', onclick: () => { closeSheet(); api.flyTo(ref); } }, icon('ship'), 'Vola fin lì'));
  } else if (d.canFly) {
    actions.append(h('button', { class: 'btn primary', onclick: () => { closeSheet(); api.flyTo(ref); } }, icon('fly'), 'Pilota automatico'));
    actions.append(h('button', { class: 'btn', onclick: () => { closeSheet(); api.teleport(ref); } }, icon('place'), 'Teletrasporto'));
  }
  actions.append(h('button', { class: 'btn ghost', onclick: () => { logObservation(ref); toast(`${d.title} aggiunto al diario`); } }, icon('journal'), 'Diario'));
  body.append(actions);

  // Idea 2: viaggio della luce
  if (d.lightYears && d.lightYears > 0.5) {
    const lj = lightJourney(d.lightYears, new Date(state.time));
    const pct = Math.max(2, lj.timeline * 100);
    body.append(h('div', { class: 'journey' },
      h('div', { class: 'journey-k' }, 'Viaggio della luce'),
      h('div', { class: 'journey-big' }, `La luce che vedi è partita ${lj.departureText}`),
      h('p', {}, `${Math.abs(lj.eventYear - lj.departureYear) <= 3 ? 'In quel momento' : 'In quell\'epoca'} sulla Terra ${lj.event}${Math.abs(lj.eventYear - lj.departureYear) > 3 ? ` (${formatYear(lj.eventYear)})` : ''}.`),
      h('div', { class: 'timeline', 'aria-hidden': 'true' },
        h('div', { class: 'timeline-bar' }, h('div', { class: 'timeline-fill', style: { width: pct + '%' } })),
        h('div', { class: 'timeline-labels' }, h('span', {}, 'oggi'), h('span', {}, 'Big Bang'))),
      h('p', { class: 'muted' }, lj.mirror),
    ));
  } else if (d.lightSeconds) {
    body.append(h('div', { class: 'journey' },
      h('div', { class: 'journey-k' }, 'Viaggio della luce'),
      h('div', { class: 'journey-big' }, `La sua luce impiega ${formatLightTime(d.lightSeconds)} per arrivare a te`),
      h('p', { class: 'muted' }, `Quello che vedi è com'era ${d.lightSeconds < 60 ? 'un attimo' : formatLightTime(d.lightSeconds)} fa.`),
    ));
  }

  const facts = h('dl', { class: 'facts' });
  for (const [k, v] of d.facts) facts.append(h('dt', {}, k), h('dd', {}, v));
  body.append(facts);
  openSheet('info', d.title, body, { compact: true, onClose: () => { if (state.mode === 'sky') api.selectSky(null); } });
}

// ---------------------------------------------------------------------------
// Ricerca
// ---------------------------------------------------------------------------
export function openSearch(onPick?: (r: ObjRef) => void) {
  const input = h('input', { class: 'search-input', type: 'search', placeholder: 'Pianeti, stelle, costellazioni, galassie…', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const list = h('div', { class: 'list' });
  const quick = ['Luna', 'Giove', 'Saturno', 'Marte', 'Sirio', 'Betelgeuse', 'Orione', 'Andromeda', 'Pleiadi', 'Stella Polare', 'Proxima Centauri', 'ISS'];
  const pick = (r: ObjRef) => {
    closeSheet();
    if (onPick) return onPick(r);
    if (state.mode === 'sky') { api.selectSky(r); api.centerSky(r); setTimeout(() => showInfo(r), 1150); }
    else showInfo(r);
  };
  const render = () => {
    const q = input.value;
    list.replaceChildren();
    if (!q.trim()) {
      list.append(h('div', { class: 'chips' }, ...quick.map((t) => h('button', { class: 'chip', onclick: () => { input.value = t; render(); } }, t))));
      return;
    }
    const res = search(q);
    if (!res.length) list.append(h('p', { class: 'muted pad' }, 'Nessun risultato.'));
    for (const it of res) list.append(h('button', { class: 'row', onclick: () => pick(it.ref) }, h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, it.name), h('div', { class: 'row-s' }, it.sub))));
  };
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const r = search(input.value)[0]; if (r) pick(r.ref); } });
  render();
  openSheet('search', state.mode === 'ship' ? 'Dove vuoi andare?' : 'Cerca nel cielo', h('div', {}, input, list));
  setTimeout(() => input.focus(), 250);
}

// ---------------------------------------------------------------------------
// Idea 1: Stasera vale la pena?
// ---------------------------------------------------------------------------
export async function openTonight() {
  const body = h('div', { class: 'tonight' }, h('div', { class: 'loading' }, 'Controllo meteo, Luna e cielo…'));
  openSheet('tonight', 'Stasera vale la pena?', body, { wide: true });
  try {
    const t = await computeTonight(new Date());
    if (!sheetOpen('tonight')) return;
    const ring = h('div', { class: 'score', style: { '--p': String(t.score) } as any },
      h('div', { class: 'score-n' }, String(t.score)), h('div', { class: 'score-of' }, '/100'));
    const head = h('div', { class: 'tonight-head' }, ring, h('div', {}, h('div', { class: 'tonight-label' }, t.label), h('p', { class: 'muted' }, t.summary),
      h('div', { class: 'muted small' }, `Notte: ${fmtTime(t.start)} – ${fmtTime(t.end)} · ${state.location.name}`)));
    // andamento della notte (punteggio ogni mezz'ora)
    const maxS = Math.max(1, ...t.hours.map((x) => x.score));
    const bars = h('div', { class: 'bars', role: 'img', 'aria-label': 'Punteggio della notte ora per ora' });
    for (const hs of t.hours) {
      const isBest = hs.t === t.best.getTime();
      const label = `${fmtTime(new Date(hs.t))} · ${Math.round(hs.score)}/100${hs.cloud != null ? ` · nuvole ${Math.round(hs.cloud)}%` : ''}${hs.moonUp ? ' · Luna alta' : ''}`;
      bars.append(h('div', { class: 'bar' + (isBest ? ' best' : ''), title: label, 'data-tip': label, style: { height: `${Math.max(4, (hs.score / Math.max(maxS, 60)) * 100)}%` } }));
    }
    const tip = h('div', { class: 'bars-tip muted small' }, `Migliore: ${fmtTime(t.best)} · tocca una barra per i dettagli`);
    bars.addEventListener('pointermove', (e) => { const el = (e.target as HTMLElement).closest('.bar') as HTMLElement | null; if (el) tip.textContent = el.dataset.tip ?? ''; });
    bars.addEventListener('click', (e) => { const el = (e.target as HTMLElement).closest('.bar') as HTMLElement | null; if (el) tip.textContent = el.dataset.tip ?? ''; });
    const axis = h('div', { class: 'bars-axis muted small' }, h('span', {}, fmtTime(t.start)), h('span', {}, fmtTime(t.end)));

    const factors = h('div', { class: 'factors' }, ...t.factors.map((f) => h('div', { class: 'factor ' + (f.ok ? 'ok' : 'bad') }, h('span', { class: 'dot' }), h('span', { class: 'f-n' }, f.name), h('span', { class: 'f-v' }, f.value))));

    const sugg = h('div', { class: 'list' });
    if (!t.suggestions.length) sugg.append(h('p', { class: 'muted' }, 'Niente di particolare in alto stasera.'));
    for (const s of t.suggestions) {
      sugg.append(h('button', { class: 'row', onclick: () => { closeSheet(); setTime(s.when.getTime()); bus.emit('time-ui'); api.selectSky(s.ref); api.centerSky(s.ref); } },
        h('div', { class: 'row-ico' }, icon(s.icon === 'moon' ? 'tonight' : s.icon === 'planet' ? 'worlds' : s.icon === 'cons' ? 'light' : 'eye')),
        h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, s.name), h('div', { class: 'row-s' }, `${fmtTime(s.when)} · ${Math.round(s.alt)}° verso ${azName(s.az)} · ${s.note}`))));
    }
    for (const p of t.iss) {
      sugg.append(h('button', { class: 'row', onclick: () => { closeSheet(); setTime(p.peak.getTime()); bus.emit('time-ui'); api.selectSky({ kind: 'iss' }); api.centerSky({ kind: 'iss' }); } },
        h('div', { class: 'row-ico' }, icon('target')),
        h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, 'Passaggio della ISS'), h('div', { class: 'row-s' }, `${fmtTime(p.start)}–${fmtTime(p.end)} · da ${azName(p.startAz)} a ${azName(p.endAz)} · max ${Math.round(p.maxAlt)}°`))));
    }
    const moon = h('p', { class: 'muted small' }, `Luna: ${t.moon.phase} (${Math.round(t.moon.illum * 100)}%)${t.moon.rise ? ` · sorge ${fmtTime(t.moon.rise)}` : ''}${t.moon.set ? ` · tramonta ${fmtTime(t.moon.set)}` : ''}`);
    const go = h('button', { class: 'btn primary block', onclick: () => { closeSheet(); setTime(t.best.getTime()); bus.emit('time-ui'); } }, icon('clock'), `Mostrami il cielo delle ${fmtTime(t.best)}`);
    body.replaceChildren(head, h('div', { class: 'chart' }, bars, axis, tip), factors, h('h3', {}, 'Cosa guardare'), sugg, moon, go);
  } catch (e) {
    body.replaceChildren(h('p', { class: 'muted' }, 'Non riesco a calcolare la serata in questo momento.'));
    console.error(e);
  }
}

// ---------------------------------------------------------------------------
// Idea 5: Missioni, badge e diario
// ---------------------------------------------------------------------------
export function openMissions() {
  const ms = ensureDailyMissions();
  const r = rankOf(progress.xp);
  const body = h('div', { class: 'missions' });
  body.append(h('div', { class: 'rank' },
    h('div', { class: 'rank-n' }, r.name), h('div', { class: 'muted small' }, `${progress.xp} XP${r.next ? ` · ${r.toNext} XP per diventare ${r.next}` : ''}`),
    h('div', { class: 'progress' }, h('div', { style: { width: `${Math.round(r.progress * 100)}%` } }))));
  body.append(h('h3', {}, 'Missioni di oggi'));
  const list = h('div', { class: 'list' });
  if (!ms.length) list.append(h('p', { class: 'muted' }, 'Nessuna missione disponibile oggi dalla tua posizione.'));
  for (const m of ms) {
    list.append(h('button', { class: 'row mission' + (m.done ? ' done' : ''), onclick: () => { if (m.done) return; closeSheet(); api.setMode('sky'); api.selectSky(m.ref); bus.emit('mission-focus'); } },
      h('div', { class: 'row-ico' }, m.done ? '✓' : icon('missions')),
      h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, m.title), h('div', { class: 'row-s' }, m.done ? `Completata alle ${fmtTime(new Date(m.done))}` : m.hint)),
      h('div', { class: 'xp' }, `+${m.xp}`)));
  }
  body.append(list, h('p', { class: 'muted small' }, 'Tieni l\'oggetto nel mirino al centro per qualche istante. Con il giroscopio (cielo vero) ottieni il doppio dei punti.'));
  body.append(h('h3', {}, 'Badge'));
  body.append(h('div', { class: 'badges' }, ...BADGES.map((b) => h('div', { class: 'badge' + (progress.badges[b.id] ? ' got' : ''), title: b.desc }, h('div', { class: 'badge-i' }, b.icon), h('div', { class: 'badge-n' }, b.name), h('div', { class: 'badge-d' }, b.desc)))));
  body.append(h('h3', {}, 'Diario delle osservazioni'));
  const j = h('div', { class: 'list' });
  if (!progress.journal.length) j.append(h('p', { class: 'muted' }, 'Ancora vuoto. Ogni oggetto trovato finisce qui.'));
  for (const e of progress.journal.slice(0, 60)) {
    j.append(h('div', { class: 'row static' }, h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, e.name),
      h('div', { class: 'row-s' }, `${fmtDate(new Date(e.t))} ${fmtTime(new Date(e.t))}${e.gyro ? ' · cielo vero' : ''}${e.place !== 'earth' ? ' · da ' + (PLACES.find((p) => p.id === e.place)?.it ?? '') : ''}${e.note ? ' · ' + e.note : ''}`))));
  }
  body.append(j);
  openSheet('missions', 'Caccia al tesoro celeste', body, { wide: true });
}

// ---------------------------------------------------------------------------
// Idea 9: Avvisi intelligenti
// ---------------------------------------------------------------------------
let lastEvents: SkyEvent[] = [];
export async function refreshAlerts() {
  try {
    lastEvents = await computeEvents(new Date(), 30);
    scheduleNotifications(lastEvents);
    bus.emit('alerts', lastEvents);
  } catch (e) { console.error(e); }
  return lastEvents;
}

export async function openAlerts() {
  const body = h('div', { class: 'alerts' }, h('div', { class: 'loading' }, 'Calcolo gli eventi dei prossimi 30 giorni…'));
  openSheet('alerts', 'Avvisi del cielo', body, { wide: true });
  const ev = await refreshAlerts();
  if (!sheetOpen('alerts')) return;
  const notifBtn = h('button', { class: 'btn' + (notificationsEnabled() ? ' on' : ''), onclick: async () => {
    const ok = await requestNotifications();
    toast(ok ? 'Notifiche attive mentre Vastity è aperta' : 'Notifiche non consentite dal browser');
    notifBtn.classList.toggle('on', ok);
    if (ok) scheduleNotifications(lastEvents);
  } }, icon('bell'), notificationsEnabled() ? 'Notifiche attive' : 'Attiva notifiche');
  const ics = h('button', { class: 'btn', onclick: () => downloadICS(ev.filter((e) => e.quality > 0)) }, icon('calendar'), 'Aggiungi tutti al calendario');
  const list = h('div', { class: 'list' });
  if (!ev.length) list.append(h('p', { class: 'muted' }, 'Nessun evento nei prossimi giorni per i tipi selezionati.'));
  const q = ['scarso', 'buono', 'ottimo'];
  for (const e of ev) {
    const row = h('div', { class: `event q${e.quality}` },
      h('div', { class: 'event-when' }, h('div', {}, fmtDay(e.date)), h('div', { class: 'muted small' }, fmtTime(e.date))),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-t' }, e.title, h('span', { class: `qtag q${e.quality}` }, q[e.quality])),
        h('div', { class: 'row-s' }, e.desc),
        e.weather ? h('div', { class: 'row-s weather' }, e.weather) : null,
        h('div', { class: 'event-actions' },
          h('button', { class: 'link', onclick: () => { closeSheet(); api.setMode('sky'); setTime(e.date.getTime()); bus.emit('time-ui'); if (e.ref) { api.selectSky(e.ref); api.centerSky(e.ref); } } }, 'Mostra nel cielo'),
          h('button', { class: 'link', onclick: () => downloadICS([e], `${e.id}.ics`) }, 'Promemoria'))));
    list.append(row);
  }
  const types = h('div', { class: 'toggles' }, ...ALERT_TYPES.map((t) => toggle(t.name, state.settings.alerts[t.id] !== false, (v) => { state.settings.alerts[t.id] = v; saveSettings(); openAlerts(); })));
  body.replaceChildren(
    h('p', { class: 'muted' }, 'Eventi calcolati per la tua posizione e incrociati con il meteo: ti avvisiamo solo quando vale la pena guardare.'),
    h('div', { class: 'actions' }, notifBtn, ics), list, h('h3', {}, 'Tipi di avviso'), types,
    h('p', { class: 'muted small' }, 'Le notifiche funzionano mentre l\'app è aperta; il calendario ti avvisa sempre. Nella versione app (iOS/Android) diventeranno notifiche di sistema.'));
}

// ---------------------------------------------------------------------------
// Idea 4: il cielo da un altro mondo
// ---------------------------------------------------------------------------
export function openWorlds() {
  const grid = h('div', { class: 'worlds' });
  for (const p of PLACES) {
    const active = state.placeId === p.id;
    grid.append(h('button', { class: 'world' + (active ? ' active' : ''), onclick: () => {
      api.setMode('sky');
      api.setPlace(p.id);
      visitPlace(p.id);
      closeSheet();
      if (p.note) toast(p.note);
    } },
    h('div', { class: 'world-dot', style: { background: `rgb(${p.ground.map((c) => Math.round(Math.min(1, c * 2.6 + 0.12) * 255)).join(',')})` } }),
    h('div', { class: 'world-n' }, p.it), h('div', { class: 'world-s' }, p.sub)));
  }
  openSheet('worlds', 'Guarda il cielo da…', h('div', {}, h('p', { class: 'muted' }, 'Le stelle sono nelle loro vere posizioni in 3D: dagli esopianeti le costellazioni si deformano e il Sole diventa una stella tra le altre.'), grid), { wide: true });
}

// ---------------------------------------------------------------------------
// Impostazioni
// ---------------------------------------------------------------------------
function toggle(label: string, value: boolean, on: (v: boolean) => void) {
  const inp = h('input', { type: 'checkbox' }) as HTMLInputElement;
  inp.checked = value;
  inp.addEventListener('change', () => on(inp.checked));
  return h('label', { class: 'toggle' }, h('span', {}, label), inp, h('span', { class: 'switch' }));
}

export function openSettings() {
  const st = state.settings;
  const set = (k: keyof typeof st) => (v: boolean) => { (st as any)[k] = v; saveSettings(); };
  const loc = state.location;
  const lat = h('input', { type: 'number', step: '0.0001', value: loc.lat.toFixed(4), class: 'num' }) as HTMLInputElement;
  const lon = h('input', { type: 'number', step: '0.0001', value: loc.lon.toFixed(4), class: 'num' }) as HTMLInputElement;
  const name = h('input', { type: 'text', value: loc.name, class: 'txt' }) as HTMLInputElement;
  const bortle = h('input', { type: 'range', min: '1', max: '9', step: '1', value: String(st.bortle) }) as HTMLInputElement;
  const bortleLbl = h('span', { class: 'muted small' }, bortleName(st.bortle));
  bortle.addEventListener('input', () => { st.bortle = +bortle.value; bortleLbl.textContent = bortleName(st.bortle); saveSettings(); });
  const body = h('div', { class: 'settings' },
    h('h3', {}, 'Posizione'),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => locate(true) }, icon('place'), 'Usa il GPS')),
    h('div', { class: 'grid2' }, h('label', {}, 'Latitudine', lat), h('label', {}, 'Longitudine', lon)),
    h('label', { class: 'full' }, 'Nome del luogo', name),
    h('button', { class: 'btn ghost', onclick: () => { setLocation({ lat: +lat.value, lon: +lon.value, height: 0, name: name.value || 'Personalizzata', source: 'manual' }); toast('Posizione aggiornata'); } }, 'Salva posizione'),
    h('h3', {}, 'Cielo'),
    toggle('Costellazioni e orbite', st.constellations, set('constellations')),
    toggle('Nomi', st.labels, set('labels')),
    toggle('Via Lattea', st.milkyWay, set('milkyWay')),
    toggle('Terreno', st.ground, set('ground')),
    toggle('Atmosfera e luce del giorno', st.atmosphere, set('atmosphere')),
    toggle('Cielo realistico per la mia zona', st.realisticSky, set('realisticSky')),
    h('label', { class: 'full' }, h('span', {}, 'Inquinamento luminoso (scala di Bortle) '), bortleLbl, bortle),
    h('h3', {}, 'Immersione'),
    toggle('Modalità notte (rossa, protegge la vista al buio)', st.nightMode, set('nightMode')),
    toggle('Realtà aumentata con la fotocamera', api.ar(), async (v) => { const ok = await api.setAR(v); if (!ok && v) toast('Fotocamera non disponibile'); }),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); } }, icon('fullscreen'), 'Schermo intero'),
      h('button', { class: 'btn', onclick: () => api.share() }, icon('share'), 'Condividi questa vista')),
    h('h3', {}, 'Informazioni'),
    h('p', { class: 'muted small' }, 'Vastity · catalogo stellare HYG v4.1 (CC BY-SA 4.0, astronexus), costellazioni e Messier da d3-celestial (BSD-3), calcoli con Astronomy Engine (MIT), meteo da Open-Meteo, orbita della ISS da CelesTrak.'),
  );
  openSheet('settings', 'Impostazioni', body, { wide: true });
}

function bortleName(b: number) {
  return ['1 · cielo perfetto', '2 · cielo buio', '3 · campagna', '4 · campagna/periferia', '5 · periferia', '6 · periferia luminosa', '7 · periferia/città', '8 · città', '9 · centro città'][b - 1];
}

export function locate(verbose = false) {
  if (!navigator.geolocation) { if (verbose) toast('Geolocalizzazione non disponibile'); return; }
  navigator.geolocation.getCurrentPosition((p) => {
    setLocation({ lat: p.coords.latitude, lon: p.coords.longitude, height: p.coords.altitude ?? 0, name: 'La tua posizione', source: 'gps' });
    if (verbose) { toast('Posizione aggiornata'); if (sheetOpen('settings')) openSettings(); }
  }, () => { if (verbose) toast('Non riesco a ottenere la posizione'); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}

// ---------------------------------------------------------------------------
// Macchina del tempo
// ---------------------------------------------------------------------------
export function openTime() {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date(state.time);
  const dt = h('input', { type: 'datetime-local', value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`, class: 'txt' }) as HTMLInputElement;
  dt.addEventListener('change', () => { const t = new Date(dt.value).getTime(); if (!isNaN(t)) { setTime(t); bus.emit('time-ui'); } });
  const step = (ms: number) => () => { setTime(state.time + ms); bus.emit('time-ui'); };
  const rates: [string, number][] = [['Pausa', 0], ['Reale', 1], ['1 min/s', 60], ['1 ora/s', 3600], ['1 giorno/s', 86400], ['−1 ora/s', -3600]];
  const chips = h('div', { class: 'chips' }, ...rates.map(([l, r]) => h('button', { class: 'chip' + (!state.live && state.timeRate === r ? ' on' : ''), onclick: () => {
    if (r === 1) { state.live = false; state.timeRate = 1; } else { state.live = false; state.timeRate = r; }
    bus.emit('time-ui'); openTime();
  } }, l)));
  const body = h('div', { class: 'time' },
    h('div', { class: 'actions' },
      iconButton('back', '−1 giorno', step(-86400e3), 'btn'), iconButton('back', '−1 ora', step(-3600e3), 'btn'),
      h('button', { class: 'btn primary', onclick: () => { setTime(Date.now(), true); bus.emit('time-ui'); closeSheet(); } }, 'Adesso'),
      iconButton('fwd', '+1 ora', step(3600e3), 'btn'), iconButton('fwd', '+1 giorno', step(86400e3), 'btn')),
    h('label', { class: 'full' }, 'Data e ora', dt),
    h('h3', {}, 'Velocità del tempo'), chips,
    h('p', { class: 'muted small' }, 'Suggerimento: trascina la barra del tempo in basso verso destra o sinistra per scorrere il cielo come un film.'));
  openSheet('time', 'Macchina del tempo', body, { compact: true });
}

// ---------------------------------------------------------------------------
// Missioni attive in sovrimpressione
// ---------------------------------------------------------------------------
export function missionHintText(): string | null {
  const a = activeMissions();
  return a.length ? a[0].title : null;
}

export { refName };
