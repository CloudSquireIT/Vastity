import { APP_VERSION, openFeedback } from './feedback';
import { AppIcon, native } from '../core/native';
import { openTours } from '../features/tours';
import { story } from '../data/stories';
// Pannelli dell'interfaccia: scheda oggetto, ricerca, Stasera, Missioni, Avvisi, Mondi, Impostazioni, Macchina del tempo.
import { closeSheet, fmtTime, h, icon, iconButton, openSheet, sheetOpen, toast } from './dom';
import { galaxyPhotos, stars } from '../data/catalog';
import { feel, reducedMotion } from '../core/feel';
import { diagnosticsReport, issueCount } from '../core/diagnostics';
import { detectedTier } from '../core/quality';
import { Category, ObjRef, SearchItem, SortKey, categories, filterItems, sortItems, info, refName, search } from '../features/objects';
import { formatLightTime, formatYear, lightJourney, nearestEvent, parallelAt, timelineEvents, timelinePos, timelineYears } from '../features/history';
import { computeTonight } from '../features/tonight';
import { achievements, activeMissions, ensureDailyMissions, isLogged, logObservation, progress, rankOf, removeJournalEntry, setJournalText, unlogObservation, visitPlace } from '../features/missions';
import { ALERT_TYPES, SkyEvent, computeEvents, downloadICS, fmtDay, notificationsEnabled, requestNotifications, scheduleNotifications } from '../features/alerts';
import { PLACES, SkyFrame } from '../astro/astro';
import { bus, saveSettings, setLocation, setTime, state } from '../state';
import { azName } from '../features/iss';
import { LANGS, LOCALE, lang, num, setLang, tx } from '../i18n';
import { objectThumb } from './thumb';
import { worldTransition } from './fx';

export interface AppApi {
  frame(): SkyFrame;
  centerSky(ref: ObjRef): void;
  selectSky(ref: ObjRef | null): void;
  flyTo(ref: ObjRef): void;
  teleport(ref: ObjRef): void;
  /** Durata stimata del pilota automatico (s) e distanza (km) dalla navicella. */
  trip(ref: ObjRef): { seconds: number; km: number } | null;
  setPlace(id: string): void;
  setMode(m: 'sky' | 'ship'): void;
  share(): void;
  tutorial(): void;
  opening(): void;
  setAR(on: boolean): Promise<boolean>;
  ar(): boolean;
  gl(): WebGL2RenderingContext;
  landSky(): void;
}

let api: AppApi;
export function initPanels(a: AppApi) { api = a; }

// ---------------------------------------------------------------------------
// Scheda dell'oggetto (con il "Viaggio della luce")
// ---------------------------------------------------------------------------
function storyKey(ref: ObjRef): string {
  switch (ref.kind) {
    case 'body': case 'deep': case 'messier': return `${ref.kind}:${ref.id}`;
    case 'constellation': return `cons:${ref.id}`;
    case 'iss': return 'iss';
    case 'star': { const ni = stars.name[ref.index]; return ni >= 0 ? `hip:${stars.names[ni][2]}` : ''; }
    default: return '';
  }
}

/**
 * Linea del tempo interattiva del «Viaggio della luce»: scala logaritmica da oggi al Big Bang (gli anni fa
 * coincidono con gli anni luce di distanza). Si trascina il cursore o si tocca un'epoca: sotto compaiono
 * l'evento sulla Terra e un oggetto noto la cui luce è partita in quel momento.
 */
function journeyTimeline(ly: number, pct: number) {
  const ev = timelineEvents();
  const out = h('div', { class: 'tl-out', 'aria-live': 'polite', 'data-hint': tx('Tocca o trascina la linea per esplorare le epoche.', 'Tap or drag the line to explore the epochs.', 'Touchez ou faites glisser la ligne pour explorer les époques.') });
  const knob = h('i', { class: 'tl-knob' });
  const bar = h('div', { class: 'timeline-bar' }, h('div', { class: 'timeline-fill photon', style: { '--w': pct + '%' } }, h('i', { class: 'photon-dot' })), knob);
  let lastPos = -1;
  for (const e of ev) if (e.pos - lastPos > 0.025) { lastPos = e.pos; bar.append(h('button', { class: 'tl-tick', style: { left: `${e.pos * 100}%` }, 'aria-label': `${formatYear(-e.ago)}: ${e.text}`, onclick: (x: Event) => { x.stopPropagation(); show(e.pos); } })); }
  const scale = h('div', { class: 'tl-scale' });
  for (const [v, l] of [[1, '1'], [1e3, '10³'], [1e6, '10⁶'], [1e9, '10⁹']] as [number, string][]) scale.append(h('span', { style: { left: `${timelinePos(v) * 100}%` } }, l));
  scale.append(h('em', {}, tx('anni fa = anni luce', 'years ago = light-years', 'années = années-lumière')));
  const show = (p: number) => {
    p = Math.max(0, Math.min(1, p));
    knob.style.left = `${p * 100}%`; knob.classList.add('on');
    const ago = timelineYears(p), e = nearestEvent(ago), par = parallelAt(ago);
    out.replaceChildren(
      h('b', {}, formatYear(-Math.max(1, ago))), ' · ', e.text,
      h('div', { class: 'tl-par' }, tx(`Luce partita allora: arriva oggi da ${par.name} (${formatLy(par.ly)}).`, `Light leaving then arrives today from ${par.name} (${formatLy(par.ly)}).`, `La lumière partie alors arrive aujourd'hui de ${par.name} (${formatLy(par.ly)}).`),
        ' ', ago > ly ? tx('Più lontano di questo oggetto.', 'Farther than this object.', 'Plus loin que cet objet.') : tx('Più vicino di questo oggetto.', 'Closer than this object.', 'Plus proche que cet objet.')));
  };
  const at = (x: number) => { const r = bar.getBoundingClientRect(); show((x - r.left) / r.width); };
  bar.addEventListener('pointerdown', (e) => { e.stopPropagation(); try { bar.setPointerCapture(e.pointerId); } catch { /* */ } at(e.clientX); });
  bar.addEventListener('pointermove', (e) => { if (bar.hasPointerCapture?.(e.pointerId)) at(e.clientX); });
  return h('div', { class: 'timeline interactive' }, bar,
    h('div', { class: 'timeline-labels' }, h('span', {}, tx('oggi', 'today', 'aujourd\'hui')), h('span', {}, 'Big Bang')), scale, out);
}
const formatLy = (v: number) => v >= 1e9 ? tx(`${num(v / 1e9, 1)} miliardi di al`, `${num(v / 1e9, 1)} billion ly`, `${num(v / 1e9, 1)} milliards d'al`)
  : v >= 1e6 ? tx(`${num(v / 1e6, 1)} milioni di al`, `${num(v / 1e6, 1)} million ly`, `${num(v / 1e6, 1)} millions d'al`) : `${num(v, v < 10 ? 1 : 0)} ${tx('al', 'ly', 'al')}`;

export function showInfo(ref: ObjRef) {
  const d = info(ref, api.frame());
  const body = h('div', { class: 'info' });
  // intestazione: foto reale o render generico, tipo e etichette di catalogo
  const tags = h('div', { class: 'tags' });
  for (const [k, v] of d.facts) {
    if (/Magnitud|Magnitude/.test(k)) tags.append(h('span', { class: 'tag' }, `MAG ${v}`));
    if (/Catalogo|Catalogue|Sigla|Abbreviation|Abréviation|Tipo spettrale|Spectral type|Type spectral/.test(k)) tags.append(h('span', { class: 'tag' }, v));
  }
  body.append(h('div', { class: 'info-head' }, objectThumb(ref), h('div', { class: 'info-head-text' }, d.subtitle ? h('div', { class: 'info-sub' }, d.subtitle) : null, tags)));

  const actions = h('div', { class: 'actions' });
  if (state.mode === 'sky') {
    actions.append(h('button', { class: 'btn', onclick: () => { api.centerSky(ref); closeSheet(); } }, icon('target'), tx('Centra', 'Centre', 'Centrer')));
    if (d.canFly) actions.append(h('button', { class: 'btn primary', onclick: () => { closeSheet(); api.flyTo(ref); } }, icon('ship'), tx('Vola fin lì', 'Fly there', 'Y aller')));
  } else if (d.canFly) {
    // stima del viaggio: durata reale del pilota automatico e distanza; il teletrasporto è istantaneo
    const trip = api.trip(ref);
    const eta = trip ? (trip.seconds < 60 ? `~${Math.max(1, Math.round(trip.seconds))} s` : `~${Math.round(trip.seconds / 60)} min`) : '';
    const sub = (t: string) => h('span', { class: 'btn-sub' }, t);
    actions.append(h('button', { class: 'btn primary', onclick: () => { closeSheet(); api.flyTo(ref); } }, icon('fly'), tx('Pilota automatico', 'Autopilot', 'Pilote automatique'), trip ? sub(tx(`${eta} di volo`, `${eta} flight`, `${eta} de vol`)) : null));
    actions.append(h('button', { class: 'btn', onclick: () => { closeSheet(); api.teleport(ref); } }, icon('place'), tx('Teletrasporto', 'Teleport', 'Téléportation'), sub(tx('istantaneo', 'instant', 'instantané'))));
  }
  // diario: interruttore (aggiungi / togli)
  const logBtn = h('button', { class: 'btn ghost' });
  const paintLog = () => {
    const on = isLogged(ref);
    logBtn.classList.toggle('on', on);
    logBtn.replaceChildren(icon(on ? 'check' : 'journal'), on ? tx('Nel diario', 'In your log', 'Dans le journal') : tx('Diario', 'Log', 'Journal'));
  };
  logBtn.addEventListener('click', () => {
    if (isLogged(ref)) { unlogObservation(ref); toast(tx(`${d.title} tolto dal diario`, `${d.title} removed from your log`, `${d.title} retiré du journal`)); }
    else { logObservation(ref); toast(tx(`${d.title} aggiunto al diario`, `${d.title} added to your log`, `${d.title} ajouté au journal`)); }
    paintLog();
  });
  paintLog();
  actions.append(logBtn);
  // le azioni subito sotto il titolo: visibili anche con la scheda a metà altezza
  body.append(actions);
  if (d.desc) body.append(h('p', { class: 'info-desc' }, d.desc));
  const st = story(storyKey(ref));
  if (st) body.append(h('div', { class: 'story' }, h('div', { class: 'story-k' }, tx('La storia', 'The story', 'L\'histoire')), h('p', {}, st)));

  // Idea 2: viaggio della luce
  const LJ = tx('Viaggio della luce', 'Light\'s journey', 'Voyage de la lumière');
  if (d.lightYears && d.lightYears > 0.5) {
    const lj = lightJourney(d.lightYears, new Date(state.time));
    const pct = Math.max(2, lj.timeline * 100);
    const close = Math.abs(lj.eventYear - lj.departureYear) <= 3;
    const yr = close ? '' : ` (${formatYear(lj.eventYear)})`;
    body.append(h('div', { class: 'journey' },
      h('div', { class: 'journey-k' }, LJ),
      h('div', { class: 'journey-big' }, tx('La luce che vedi è partita ', 'The light you see set off ', 'La lumière que vous voyez est partie '), countUp(lj.departureText)),
      h('p', {}, close
        ? tx(`In quel momento sulla Terra ${lj.event}.`, `At that moment on Earth, ${lj.event}.`, `À ce moment-là sur Terre, ${lj.event}.`)
        : tx(`In quell'epoca sulla Terra ${lj.event}${yr}.`, `Around that time on Earth, ${lj.event}${yr}.`, `À cette époque sur Terre, ${lj.event}${yr}.`)),
      journeyTimeline(lj.lightYears, pct),
      h('p', { class: 'muted' }, lj.mirror),
    ));
  } else if (d.lightSeconds) {
    const lt = formatLightTime(d.lightSeconds);
    const ago = d.lightSeconds < 60 ? tx('un attimo', 'a moment', 'un instant') : lt;
    body.append(h('div', { class: 'journey' },
      h('div', { class: 'journey-k' }, LJ),
      h('div', { class: 'journey-big' }, tx(`La sua luce impiega ${lt} per arrivare a te`, `Its light takes ${lt} to reach you`, `Sa lumière met ${lt} à vous parvenir`)),
      h('p', { class: 'muted' }, tx(`Quello che vedi è com'era ${ago} fa.`, `What you see is how it looked ${ago} ago.`, `Ce que vous voyez est son aspect d'il y a ${ago}.`)),
    ));
  }

  const facts = h('dl', { class: 'facts' });
  for (const [k, v] of d.facts) facts.append(h('dt', {}, k), h('dd', {}, v));
  body.append(facts);
  // chiudere la scheda non toglie la selezione: l'oggetto resta "agganciato" (lo si deseleziona ritoccandolo)
  openSheet('info', d.title, body, { compact: true, peek: true });
}

// ---------------------------------------------------------------------------
// Ricerca
// ---------------------------------------------------------------------------
const QUICK: Record<string, string[]> = {
  it: ['Luna', 'Giove', 'Saturno', 'Marte', 'Sirio', 'Betelgeuse', 'Orione', 'Andromeda', 'Pleiadi', 'Stella Polare', 'Proxima Centauri', 'ISS'],
  en: ['Moon', 'Jupiter', 'Saturn', 'Mars', 'Sirius', 'Betelgeuse', 'Orion', 'Andromeda', 'Pleiades', 'Polaris', 'Proxima Centauri', 'ISS'],
  fr: ['Lune', 'Jupiter', 'Saturne', 'Mars', 'Sirius', 'Bételgeuse', 'Orion', 'Andromède', 'Pléiades', 'Étoile polaire', 'Proxima du Centaure', 'ISS'],
};

export function openSearch(onPick?: (r: ObjRef) => void) {
  const input = h('input', { class: 'search-input', type: 'search', placeholder: tx('Pianeti, stelle, costellazioni, galassie…', 'Planets, stars, constellations, galaxies…', 'Planètes, étoiles, constellations, galaxies…'), autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const list = h('div', { class: 'list' });
  const quick = QUICK[lang];
  const pick = (r: ObjRef) => {
    closeSheet();
    if (onPick) return onPick(r);
    if (state.mode === 'sky') { api.selectSky(r); api.centerSky(r); setTimeout(() => showInfo(r), 1150); }
    else showInfo(r);
  };
  let cat: Category | null = null;
  let shown = 60;
  let sortKey: SortKey = 'name';
  const sortCache = new Map<string, SearchItem[]>();
  const sorted = (c: Category) => {
    const k = c.id + ':' + sortKey;
    if (!sortCache.has(k)) sortCache.set(k, sortItems(c.items, sortKey));
    return sortCache.get(k)!;
  };
  const SORTS: [SortKey, string][] = [
    ['name', tx('A–Z', 'A–Z', 'A–Z')], ['dist', tx('Distanza', 'Distance', 'Distance')],
    ['mag', tx('Luminosità', 'Brightness', 'Luminosité')], ['size', tx('Dimensione', 'Size', 'Taille')],
  ];
  const row = (it: SearchItem, extra = '') => h('button', { class: 'row', onclick: () => pick(it.ref) }, h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, it.name), h('div', { class: 'row-s' }, it.sub)), extra ? h('span', { class: 'row-x' }, extra) : null);
  const fmtLy = (ly: number) => ly < 0.01 ? `${num(ly * 63241, ly * 63241 < 10 ? 2 : 0)} ${tx('UA', 'AU', 'UA')}` : ly < 1000 ? `${num(ly, ly < 10 ? 1 : 0)} ${tx('al', 'ly', 'al')}` : ly < 1e6 ? `${num(ly / 1000, 1)} ${tx('mila al', 'kly', 'k al')}` : `${num(ly / 1e6, 1)} ${tx('mln al', 'Mly', 'M al')}`;
  const render = () => {
    const q = input.value;
    list.replaceChildren();
    if (cat) {
      // dentro una categoria: elenco completo, filtrabile, caricato a blocchi
      const c = cat;
      const items = filterItems(sorted(c), q);
      const extra = (it: SearchItem) => sortKey === 'dist' && it.dist != null ? fmtLy(it.dist) : sortKey === 'mag' && it.mag != null ? `mag ${num(it.mag, 1, 1)}` : sortKey === 'size' && it.size != null ? `⌀ ${fmtLy(it.size * 2)}` : '';
      list.append(h('div', { class: 'cat-head' },
        h('button', { class: 'chip', onclick: () => { cat = null; input.value = ''; input.placeholder = basePh; render(); } }, '‹ ' + tx('Categorie', 'Categories', 'Catégories')),
        h('span', { class: 'cat-title' }, `${c.name} · ${num(items.length)}`)));
      list.append(h('div', { class: 'chips sort' }, h('span', { class: 'sort-l' }, tx('Ordina per', 'Sort by', 'Trier par')),
        ...SORTS.map(([k, l]) => h('button', { class: 'chip' + (sortKey === k ? ' on' : ''), onclick: () => { sortKey = k; shown = 60; render(); } }, l))));
      if (!items.length) list.append(h('p', { class: 'muted pad' }, tx('Nessun risultato.', 'No results.', 'Aucun résultat.')));
      for (const it of items.slice(0, shown)) list.append(row(it, extra(it)));
      if (items.length > shown) list.append(h('button', { class: 'btn more', onclick: () => { shown += 120; render(); } }, tx(`Mostra altri (${num(items.length - shown)})`, `Show more (${num(items.length - shown)})`, `Afficher plus (${num(items.length - shown)})`)));
      return;
    }
    if (!q.trim()) {
      list.append(h('h3', { class: 'sec' }, tx('Suggeriti', 'Suggested', 'Suggestions')));
      list.append(h('div', { class: 'chips row-scroll' }, ...quick.slice(0, 8).map((t) => h('button', { class: 'chip', onclick: () => { input.value = t; render(); } }, t))));
      list.append(h('h3', { class: 'sec' }, tx('Categorie', 'Categories', 'Catégories')));
      list.append(h('div', { class: 'cats' }, ...categories().map((c) => h('button', { class: 'world cat', onclick: () => {
        cat = c; shown = 60; input.value = '';
        input.placeholder = tx(`Filtra in ${c.name}…`, `Filter ${c.name}…`, `Filtrer : ${c.name}…`);
        render(); list.parentElement?.parentElement?.scrollTo?.(0, 0);
      } }, h('span', { class: 'cat-ico' }, c.icon), h('span', { class: 'cat-n' }, c.name), h('span', { class: 'cat-c' }, num(c.items.length))))));
      return;
    }
    const res = search(q);
    if (!res.length) list.append(h('p', { class: 'muted pad' }, tx('Nessun risultato.', 'No results.', 'Aucun résultat.')));
    for (const it of res) list.append(row(it));
  };
  const basePh = input.placeholder;
  input.addEventListener('input', () => { shown = 60; render(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const r = cat ? filterItems(cat.items, input.value)[0] : search(input.value)[0]; if (r) pick(r.ref); } });
  render();
  // la tastiera compare solo se si tocca la barra: prima si possono esplorare le categorie
  openSheet('search', state.mode === 'ship' ? tx('Dove vuoi andare?', 'Where do you want to go?', 'Où voulez-vous aller ?') : tx('Cerca nel cielo', 'Search the sky', 'Chercher dans le ciel'), h('div', {}, input, list));
  if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => input.focus(), 250);
}

// ---------------------------------------------------------------------------
// Idea 1: Stasera vale la pena?
// ---------------------------------------------------------------------------
export async function openTonight() {
  const body = h('div', { class: 'tonight' }, h('div', { class: 'loading' }, tx('Controllo meteo, Luna e cielo…', 'Checking weather, Moon and sky…', 'Vérification de la météo, de la Lune et du ciel…')));
  openSheet('tonight', tx('Stasera vale la pena?', 'Is tonight worth it?', 'Ce soir, ça vaut le coup ?'), body, { wide: true });
  try {
    const t = await computeTonight(new Date());
    if (!sheetOpen('tonight')) return;
    const ring = h('div', { class: 'score', style: { '--p': String(t.score) } as any },
      h('div', { class: 'score-n' }, String(t.score)), h('div', { class: 'score-of' }, '/100'));
    const head = h('div', { class: 'tonight-head' }, ring, h('div', {}, h('div', { class: 'tonight-label' }, t.label), h('p', { class: 'muted' }, t.summary),
      h('div', { class: 'muted small' }, `${tx('Notte', 'Night', 'Nuit')}: ${fmtTime(t.start)} – ${fmtTime(t.end)} · ${state.location.name}`)));
    // andamento della notte (punteggio ogni mezz'ora)
    const maxS = Math.max(1, ...t.hours.map((x) => x.score));
    const bars = h('div', { class: 'bars', role: 'img', 'aria-label': tx('Punteggio della notte ora per ora', 'Hour-by-hour score for the night', 'Score de la nuit heure par heure') });
    for (const hs of t.hours) {
      const isBest = hs.t === t.best.getTime();
      const label = `${fmtTime(new Date(hs.t))} · ${Math.round(hs.score)}/100${hs.cloud != null ? ` · ${tx('nuvole', 'clouds', 'nuages')} ${Math.round(hs.cloud)}%` : ''}${hs.moonUp ? ' · ' + tx('Luna alta', 'Moon up', 'Lune levée') : ''}`;
      bars.append(h('div', { class: 'bar' + (isBest ? ' best' : ''), title: label, 'data-tip': label, style: { height: `${Math.max(4, (hs.score / Math.max(maxS, 60)) * 100)}%` } }));
    }
    const tip = h('div', { class: 'bars-tip muted small' }, tx(`Migliore: ${fmtTime(t.best)} · tocca una barra per i dettagli`, `Best: ${fmtTime(t.best)} · tap a bar for details`, `Meilleur : ${fmtTime(t.best)} · touchez une barre pour les détails`));
    bars.addEventListener('pointermove', (e) => { const el = (e.target as HTMLElement).closest('.bar') as HTMLElement | null; if (el) tip.textContent = el.dataset.tip ?? ''; });
    bars.addEventListener('click', (e) => { const el = (e.target as HTMLElement).closest('.bar') as HTMLElement | null; if (el) tip.textContent = el.dataset.tip ?? ''; });
    const axis = h('div', { class: 'bars-axis muted small' }, h('span', {}, fmtTime(t.start)), h('span', {}, fmtTime(t.end)));

    const factors = h('div', { class: 'factors' }, ...t.factors.map((f) => h('div', { class: 'factor ' + (f.ok ? 'ok' : 'bad') }, h('span', { class: 'dot' }), h('span', { class: 'f-n' }, f.name), h('span', { class: 'f-v' }, f.value))));

    const sugg = h('div', { class: 'list' });
    if (!t.suggestions.length) sugg.append(h('p', { class: 'muted' }, tx('Niente di particolare in alto stasera.', 'Nothing special up high tonight.', 'Rien de particulier haut dans le ciel ce soir.')));
    for (const s of t.suggestions) {
      // tocco sulla riga: punta il cielo all'ora giusta; l'icona a destra parte con la navicella
      const row = h('button', { class: 'row', onclick: () => { closeSheet(); setTime(s.when.getTime()); bus.emit('time-ui'); api.selectSky(s.ref); api.centerSky(s.ref); } },
        h('div', { class: 'row-ico' }, icon(s.icon === 'moon' ? 'tonight' : s.icon === 'planet' ? 'worlds' : s.icon === 'cons' ? 'light' : 'eye')),
        h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, s.name), h('div', { class: 'row-s' }, `${fmtTime(s.when)} · ${Math.round(s.alt)}° ${tx('verso', 'towards', 'vers')} ${azName(s.az)} · ${s.note}`)));
      sugg.append(s.ref.kind === 'constellation' ? row : h('div', { class: 'row-wrap' }, row,
        iconButton('fly', tx(`Vola verso ${s.name}`, `Fly to ${s.name}`, `Aller vers ${s.name}`), () => { closeSheet(); api.flyTo(s.ref); }, 'ibtn small row-fly')));
    }
    for (const p of t.iss) {
      sugg.append(h('button', { class: 'row', onclick: () => { closeSheet(); setTime(p.peak.getTime()); bus.emit('time-ui'); api.selectSky({ kind: 'iss' }); api.centerSky({ kind: 'iss' }); } },
        h('div', { class: 'row-ico' }, icon('target')),
        h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, tx('Passaggio della ISS', 'ISS pass', 'Passage de l\'ISS')),
          h('div', { class: 'row-s' }, `${fmtTime(p.start)}–${fmtTime(p.end)} · ${tx(`da ${azName(p.startAz)} a ${azName(p.endAz)}`, `from ${azName(p.startAz)} to ${azName(p.endAz)}`, `de ${azName(p.startAz)} à ${azName(p.endAz)}`)} · max ${Math.round(p.maxAlt)}°`))));
    }
    const moon = h('p', { class: 'muted small' }, `${tx('Luna', 'Moon', 'Lune')}: ${t.moon.phase} (${Math.round(t.moon.illum * 100)}%)${t.moon.rise ? ` · ${tx('sorge', 'rises', 'lever')} ${fmtTime(t.moon.rise)}` : ''}${t.moon.set ? ` · ${tx('tramonta', 'sets', 'coucher')} ${fmtTime(t.moon.set)}` : ''}`);
    const go = h('button', { class: 'btn primary block', onclick: () => { closeSheet(); setTime(t.best.getTime()); bus.emit('time-ui'); } }, icon('clock'), tx(`Mostrami il cielo delle ${fmtTime(t.best)}`, `Show me the sky at ${fmtTime(t.best)}`, `Montrez-moi le ciel à ${fmtTime(t.best)}`));
    body.replaceChildren(head, h('div', { class: 'chart' }, bars, axis, tip), factors, h('h3', {}, tx('Cosa guardare', 'What to look at', 'Quoi observer')), sugg, moon, go);
    // da non perdere questo mese: i migliori eventi dei prossimi 30 giorni
    refreshAlerts().then((ev) => {
      const top = ev.filter((e) => e.quality >= 2 && e.type !== 'iss').slice(0, 4);
      if (!top.length || !sheetOpen('tonight')) return;
      const month = h('div', { class: 'list' });
      for (const e of top) month.append(h('button', { class: 'row', onclick: () => { closeSheet(); api.setMode('sky'); setTime(e.date.getTime()); bus.emit('time-ui'); if (e.ref) { api.selectSky(e.ref); api.centerSky(e.ref); } } },
        h('div', { class: 'row-ico' }, icon('calendar')),
        h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, e.title), h('div', { class: 'row-s' }, `${fmtDay(e.date)} · ${e.desc}`))));
      body.append(h('h3', {}, tx('Da non perdere nei prossimi 30 giorni', 'Not to miss in the next 30 days', 'À ne pas manquer dans les 30 prochains jours')), month,
        h('button', { class: 'btn block', onclick: () => openAlerts() }, icon('bell'), tx('Tutti gli eventi e i promemoria', 'All events and reminders', 'Tous les événements et rappels')));
    }).catch(() => {});
  } catch (e) {
    body.replaceChildren(h('p', { class: 'muted' }, tx('Non riesco a calcolare la serata in questo momento.', 'I can\'t work out tonight\'s conditions right now.', 'Impossible d\'évaluer la soirée pour le moment.')));
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
    h('div', { class: 'rank-n' }, r.name),
    h('div', { class: 'muted small' }, `${progress.xp} XP${r.next ? ' · ' + tx(`${r.toNext} XP per diventare ${r.next}`, `${r.toNext} XP to become ${r.next}`, `${r.toNext} XP pour devenir ${r.next}`) : ''}`),
    h('div', { class: 'progress' }, h('div', { style: { width: `${Math.round(r.progress * 100)}%` } }))));
  body.append(h('button', { class: 'btn block tours-btn', onclick: () => openTours() }, icon('ship'), tx('Tour guidati con la navicella', 'Guided spaceship tours', 'Visites guidées en vaisseau')));
  body.append(h('h3', {}, tx('Missioni di oggi', 'Today\'s missions', 'Missions du jour')));
  const list = h('div', { class: 'list' });
  if (!ms.length) list.append(h('p', { class: 'muted' }, tx('Nessuna missione disponibile oggi dalla tua posizione.', 'No missions available today from your location.', 'Aucune mission disponible aujourd\'hui depuis votre position.')));
  for (const m of ms) {
    list.append(h('button', { class: 'row mission' + (m.done ? ' done' : ''), onclick: () => { if (m.done) return; closeSheet(); api.setMode('sky'); api.selectSky(m.ref); bus.emit('mission-focus'); } },
      h('div', { class: 'row-ico' }, m.done ? '✓' : icon('missions')),
      h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, m.title), h('div', { class: 'row-s' }, m.done ? tx(`Completata alle ${fmtTime(new Date(m.done))}`, `Completed at ${fmtTime(new Date(m.done))}`, `Accomplie à ${fmtTime(new Date(m.done))}`) : m.hint)),
      h('div', { class: 'xp' }, `+${m.xp}`)));
  }
  body.append(list, h('p', { class: 'muted small' }, tx(
    'Tieni l\'oggetto nel mirino al centro per qualche istante. Con il giroscopio (cielo vero) ottieni il doppio dei punti.',
    'Keep the object in the central reticle for a moment. With the gyroscope (real sky) you earn double points.',
    'Gardez l\'objet dans le viseur central quelques instants. Avec le gyroscope (vrai ciel), vous gagnez le double de points.')));
  // achievement: completamento totale 0–100% e avanzamento di ciascuno; i segreti restano nascosti finché non li sblocchi
  const ach = achievements();
  const secretsLeft = ach.list.filter((a) => a.b.secret && !a.got).length;
  body.append(h('div', { class: 'ach-head' },
    h('h3', {}, 'Achievement'),
    h('div', { class: 'ach-total' }, h('b', {}, `${ach.total}%`), h('span', { class: 'muted small' }, tx(`${ach.list.filter((a) => a.got).length} di ${ach.list.length} sbloccati`, `${ach.list.filter((a) => a.got).length} of ${ach.list.length} unlocked`, `${ach.list.filter((a) => a.got).length} sur ${ach.list.length} débloqués`)))),
    h('div', { class: 'progress ach-bar' }, h('div', { style: { width: `${ach.total}%` } })));
  body.append(h('div', { class: 'badges ach' }, ...ach.list.map((a) => {
    const hidden = a.b.secret && !a.got;
    return h('div', { class: 'badge' + (a.got ? ' got' : '') + (hidden ? ' secret' : ''), title: hidden ? '' : a.b.desc },
      h('div', { class: 'badge-i' }, hidden ? '?' : a.b.icon),
      h('div', { class: 'badge-n' }, hidden ? tx('Segreto', 'Secret', 'Secret') : a.b.name),
      h('div', { class: 'badge-d' }, hidden ? tx('Continua a esplorare per scoprirlo', 'Keep exploring to discover it', 'Continuez à explorer pour le découvrir') : a.b.desc),
      a.got || hidden ? null : h('div', { class: 'ach-p' }, h('div', { class: 'progress' }, h('div', { style: { width: `${Math.round(a.k * 100)}%` } })), h('span', {}, a.goal > 1 ? `${a.cur}/${a.goal}` : `${Math.round(a.k * 100)}%`)));
  })));
  if (secretsLeft) body.append(h('p', { class: 'muted small' }, tx(`${secretsLeft} achievement segreti da scoprire.`, `${secretsLeft} secret achievements to discover.`, `${secretsLeft} succès secrets à découvrir.`)));
  body.append(h('h3', {}, tx('Diario delle osservazioni', 'Observation log', 'Journal d\'observation')),
    h('button', { class: 'btn', onclick: () => openJournal() }, icon('journal'), tx(`Apri il diario (${progress.journal.length})`, `Open the log (${progress.journal.length})`, `Ouvrir le journal (${progress.journal.length})`)));
  openSheet('missions', tx('Caccia al tesoro celeste', 'Celestial treasure hunt', 'Chasse au trésor céleste'), body, { wide: true });
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
  const body = h('div', { class: 'alerts' }, h('div', { class: 'loading' }, tx('Calcolo gli eventi dei prossimi 30 giorni…', 'Working out the events of the next 30 days…', 'Calcul des événements des 30 prochains jours…')));
  openSheet('alerts', tx('Avvisi del cielo', 'Sky alerts', 'Alertes du ciel'), body, { wide: true });
  const ev = await refreshAlerts();
  if (!sheetOpen('alerts')) return;
  const notifBtn = h('button', { class: 'btn' + (notificationsEnabled() ? ' on' : ''), onclick: async () => {
    const ok = await requestNotifications();
    toast(ok ? tx('Notifiche attive mentre Vastity è aperta', 'Notifications on while Vastity is open', 'Notifications actives tant que Vastity est ouverte') : tx('Notifiche non consentite dal browser', 'Notifications blocked by the browser', 'Notifications bloquées par le navigateur'));
    notifBtn.classList.toggle('on', ok);
    if (ok) scheduleNotifications(lastEvents);
  } }, icon('bell'), notificationsEnabled() ? tx('Notifiche attive', 'Notifications on', 'Notifications actives') : tx('Attiva notifiche', 'Turn on notifications', 'Activer les notifications'));
  const ics = h('button', { class: 'btn', onclick: () => downloadICS(ev.filter((e) => e.quality > 0)) }, icon('calendar'), tx('Aggiungi tutti al calendario', 'Add all to calendar', 'Tout ajouter au calendrier'));
  const list = h('div', { class: 'list' });
  if (!ev.length) list.append(h('p', { class: 'muted' }, tx('Nessun evento nei prossimi giorni per i tipi selezionati.', 'No events in the coming days for the selected types.', 'Aucun événement dans les prochains jours pour les types choisis.')));
  const q = [tx('scarso', 'poor', 'faible'), tx('buono', 'good', 'bon'), tx('ottimo', 'great', 'excellent')];
  for (const e of ev) {
    const row = h('div', { class: `event q${e.quality}` },
      h('div', { class: 'event-when' }, h('div', {}, fmtDay(e.date)), h('div', { class: 'muted small' }, fmtTime(e.date))),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-t' }, e.title, h('span', { class: `qtag q${e.quality}` }, q[e.quality])),
        h('div', { class: 'row-s' }, e.desc),
        e.weather ? h('div', { class: 'row-s weather' }, e.weather) : null,
        h('div', { class: 'event-actions' },
          h('button', { class: 'link', onclick: () => { closeSheet(); api.setMode('sky'); setTime(e.date.getTime()); bus.emit('time-ui'); if (e.ref) { api.selectSky(e.ref); api.centerSky(e.ref); } } }, tx('Mostra nel cielo', 'Show in the sky', 'Voir dans le ciel')),
          h('button', { class: 'link', onclick: () => downloadICS([e], `${e.id}.ics`) }, tx('Promemoria', 'Reminder', 'Rappel')))));
    list.append(row);
  }
  const types = h('div', { class: 'toggles' }, ...ALERT_TYPES.map((t) => toggle(t.name, state.settings.alerts[t.id] !== false, (v) => { state.settings.alerts[t.id] = v; saveSettings(); openAlerts(); })));
  body.replaceChildren(
    h('p', { class: 'muted' }, tx(
      'Eventi calcolati per la tua posizione e incrociati con il meteo: ti avvisiamo solo quando vale la pena guardare.',
      'Events worked out for your location and checked against the weather: we only alert you when it is worth looking up.',
      'Événements calculés pour votre position et croisés avec la météo : on ne vous prévient que quand ça vaut le coup.')),
    h('div', { class: 'actions' }, notifBtn, ics), list, h('h3', {}, tx('Tipi di avviso', 'Alert types', 'Types d\'alertes')), types,
    h('p', { class: 'muted small' }, tx(
      'Le notifiche funzionano mentre l\'app è aperta; il calendario ti avvisa sempre. Nella versione app (iOS/Android) diventeranno notifiche di sistema.',
      'Notifications work while the app is open; the calendar always reminds you. In the iOS/Android app they will become system notifications.',
      'Les notifications fonctionnent quand l\'app est ouverte ; le calendrier vous prévient toujours. Dans l\'app iOS/Android, elles deviendront des notifications système.')));
}

// ---------------------------------------------------------------------------
// Idea 4: il cielo da un altro mondo
// ---------------------------------------------------------------------------
export function openWorlds() {
  const grid = h('div', { class: 'worlds' });
  for (const p of PLACES) {
    const active = state.placeId === p.id;
    const dotColor = `rgb(${p.ground.map((c) => Math.round(Math.min(1, c * 2.6 + 0.12) * 255)).join(',')})`;
    grid.append(h('button', { class: 'world' + (active ? ' active' : ''), onclick: () => {
      closeSheet();
      if (active) return;
      api.setMode('sky');
      worldTransition(p.name, dotColor, () => { api.setPlace(p.id); visitPlace(p.id); }, () => { api.landSky(); if (p.note) setTimeout(() => toast(p.note), 900); });
    } },
    h('div', { class: 'world-dot', style: { background: `rgb(${p.ground.map((c) => Math.round(Math.min(1, c * 2.6 + 0.12) * 255)).join(',')})` } }),
    h('div', { class: 'world-n' }, p.name), h('div', { class: 'world-s' }, p.sub)));
  }
  openSheet('worlds', tx('Guarda il cielo da…', 'See the sky from…', 'Voir le ciel depuis…'), h('div', {}, h('p', { class: 'muted' }, tx(
    'Le stelle sono nelle loro vere posizioni in 3D: dagli esopianeti le costellazioni si deformano e il Sole diventa una stella tra le altre.',
    'Stars are in their true 3D positions: from exoplanets the constellations warp and the Sun becomes just another star.',
    'Les étoiles sont à leur vraie position en 3D : depuis les exoplanètes, les constellations se déforment et le Soleil devient une étoile parmi d\'autres.')), grid), { wide: true });
}

// ---------------------------------------------------------------------------
// Impostazioni
// ---------------------------------------------------------------------------
function toggle(label: string, value: boolean, on: (v: boolean) => void) {
  const inp = h('input', { type: 'checkbox' }) as HTMLInputElement;
  inp.checked = value;
  inp.addEventListener('change', () => { feel.toggle(inp.checked); on(inp.checked); });
  return h('label', { class: 'toggle' }, h('span', {}, label), inp, h('span', { class: 'switch' }));
}

/** Scelta dell'icona dell'app (iPhone): quattro stili, cambiano subito nella schermata Home. */
function iconPicker() {
  const styles: [string, string, string][] = [
    ['', 'night', tx('Notte', 'Night', 'Nuit')], ['AppIcon-Aurora', 'aurora', 'Aurora'], ['AppIcon-Gold', 'gold', tx('Oro', 'Gold', 'Or')], ['AppIcon-Minimal', 'minimal', 'Minimal'],
  ];
  const row = h('div', { class: 'icon-pick' });
  const paint = (cur: string) => row.replaceChildren(...styles.map(([name, file, label]) => h('button', {
    class: 'icon-opt' + (cur === name ? ' on' : ''), 'aria-pressed': String(cur === name),
    onclick: () => AppIcon.set({ name }).then(() => paint(name)).catch(() => toast(tx('Non è stato possibile cambiare l\'icona', 'Couldn\'t change the icon', 'Impossible de changer l\'icône'))),
  }, h('img', { src: `icons/alt/${file}.png`, alt: '' }), h('span', {}, label))));
  paint('');
  AppIcon.get().then((r) => paint(r.name)).catch(() => {});
  return h('div', {}, h('h3', {}, tx('Icona dell\'app', 'App icon', 'Icône de l\'app')), row);
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
  const langs = h('div', { class: 'chips' }, ...LANGS.map((l) => h('button', { class: 'chip' + (l.id === lang ? ' on' : ''), lang: l.id, onclick: () => { if (l.id !== lang) setLang(l.id); } }, l.name)));
  const body = h('div', { class: 'settings' },
    h('h3', {}, tx('Lingua', 'Language', 'Langue')),
    langs,
    h('h3', {}, tx('Posizione', 'Location', 'Position')),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => locate(true) }, icon('place'), tx('Usa il GPS', 'Use GPS', 'Utiliser le GPS'))),
    h('div', { class: 'grid2' }, h('label', {}, tx('Latitudine', 'Latitude', 'Latitude'), lat), h('label', {}, tx('Longitudine', 'Longitude', 'Longitude'), lon)),
    h('label', { class: 'full' }, tx('Nome del luogo', 'Place name', 'Nom du lieu'), name),
    h('button', { class: 'btn ghost', onclick: () => { setLocation({ lat: +lat.value, lon: +lon.value, height: 0, name: name.value || tx('Personalizzata', 'Custom', 'Personnalisée'), source: 'manual' }); toast(tx('Posizione aggiornata', 'Location updated', 'Position mise à jour')); } }, tx('Salva posizione', 'Save location', 'Enregistrer la position')),
    h('h3', {}, tx('Cielo', 'Sky', 'Ciel')),
    toggle(tx('Costellazioni e orbite', 'Constellations and orbits', 'Constellations et orbites'), st.constellations, set('constellations')),
    toggle(tx('Nomi', 'Labels', 'Noms'), st.labels, set('labels')),
    h('div', { class: 'full density' }, h('span', { class: 'muted small' }, tx('Quante etichette', 'How many labels', 'Combien d\'étiquettes')),
      h('div', { class: 'chips' }, ...([['essential', tx('Essenziale', 'Essential', 'Essentiel')], ['explorer', tx('Esploratore', 'Explorer', 'Explorateur')], ['astronomer', tx('Astronomo', 'Astronomer', 'Astronome')]] as const).map(([id, name]) =>
        h('button', { class: 'chip' + ((st.labelDensity ?? 'explorer') === id ? ' on' : ''), onclick: (e: Event) => {
          st.labelDensity = id; saveSettings();
          (e.currentTarget as HTMLElement).parentElement!.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget));
        } }, name)))),
    toggle(tx('Via Lattea', 'Milky Way', 'Voie lactée'), st.milkyWay, set('milkyWay')),
    toggle(tx('Terreno', 'Ground', 'Sol'), st.ground, set('ground')),
    toggle(tx('Atmosfera e luce del giorno', 'Atmosphere and daylight', 'Atmosphère et lumière du jour'), st.atmosphere, set('atmosphere')),
    toggle(tx('Cielo realistico per la mia zona', 'Realistic sky for my area', 'Ciel réaliste pour ma zone'), st.realisticSky, set('realisticSky')),
    h('label', { class: 'full' }, h('span', {}, tx('Inquinamento luminoso (scala di Bortle) ', 'Light pollution (Bortle scale) ', 'Pollution lumineuse (échelle de Bortle) ')), bortleLbl, bortle),
    h('h3', {}, tx('Grafica', 'Graphics', 'Graphismes')), qualityControl(),
    h('h3', {}, tx('Immersione', 'Immersion', 'Immersion')),
    toggle(tx('Modalità notte (rossa, protegge la vista al buio)', 'Night mode (red, protects your dark vision)', 'Mode nuit (rouge, préserve la vision nocturne)'), st.nightMode, set('nightMode')),
    toggle(tx('Relatività realistica (le stelle si comprimono davanti a te vicino alla velocità della luce)', 'Realistic relativity (stars bunch up ahead of you near light speed)', 'Relativité réaliste (les étoiles se resserrent devant vous près de la vitesse de la lumière)'), st.realRelativity, set('realRelativity')),
    toggle(tx('Eclittica (il percorso del Sole e dei pianeti)', 'Ecliptic (the path of the Sun and planets)', 'Écliptique (le chemin du Soleil et des planètes)'), st.ecliptic !== false, (v) => { st.ecliptic = v; saveSettings(); }),
    toggle(tx('Realtà aumentata con la fotocamera', 'Augmented reality with the camera', 'Réalité augmentée avec la caméra'), api.ar(), async (v) => { const ok = await api.setAR(v); if (!ok && v) toast(tx('Fotocamera non disponibile', 'Camera unavailable', 'Caméra indisponible')); }),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); } }, icon('fullscreen'), tx('Schermo intero', 'Full screen', 'Plein écran')),
      h('button', { class: 'btn', onclick: () => api.share() }, icon('share'), tx('Condividi questa vista', 'Share this view', 'Partager cette vue')),
      h('button', { class: 'btn', onclick: () => api.tutorial() }, icon('eye'), tx('Rivedi il tutorial', 'Replay the tutorial', 'Revoir le tutoriel')),
      h('button', { class: 'btn', onclick: () => api.opening() }, icon('play'), tx('Rivedi l\'apertura', 'Replay the opening', 'Revoir l\'ouverture')),
      h('button', { class: 'btn', onclick: () => openFeedback() }, icon('bell'), tx('Segnala un problema o suggerisci un\'idea', 'Report a problem or suggest an idea', 'Signaler un problème ou suggérer une idée'))),
    h('p', { class: 'muted small' }, `Vastity ${APP_VERSION}`),
    native.isNative && native.platform === 'ios' ? iconPicker() : null,
    h('h3', {}, tx('Suoni e vibrazioni', 'Sound and haptics', 'Sons et vibrations')),
    toggle(tx('Suoni ed effetti', 'Sound and effects', 'Sons et effets'), st.sound !== false, (v) => { st.sound = v; saveSettings(); feel.refresh(); }),
    toggle(tx('Musica ambientale', 'Ambient music', 'Musique d\'ambiance'), st.music !== false, (v) => { st.music = v; saveSettings(); feel.refresh(); }),
    toggle(tx('Vibrazioni leggere', 'Light haptics', 'Vibrations légères'), st.haptics !== false, (v) => { st.haptics = v; saveSettings(); }),
    h('h3', {}, tx('Accessibilità', 'Accessibility', 'Accessibilité')),
    toggle(tx('Riduci movimento (meno scosse, scie e flash)', 'Reduce motion (fewer shakes, streaks and flashes)', 'Réduire les animations (moins de secousses, traînées et flashs)'), reducedMotion(), (v) => { st.reduceMotion = v; saveSettings(); applyAccessibility(); }),
    textSizeControl(),
    h('h3', {}, tx('Informazioni', 'About', 'À propos')),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: () => openCredits() }, icon('journal'), tx('Crediti e licenze', 'Credits and licences', 'Crédits et licences')),
      diagButton()),
  );
  openSheet('settings', tx('Impostazioni', 'Settings', 'Réglages'), body, { wide: true });
}

/** Testo con un numero (anno) che "scorre" dall'anno attuale a quello finale. */
function countUp(text: string): HTMLElement {
  const el = h('span', { class: 'count' }, text);
  const m = text.match(/-?\d[\d.\s]*/);
  if (!m || reducedMotion()) return el;
  const target = parseInt(m[0].replace(/[.\s]/g, ''), 10);
  const now = new Date(state.time).getFullYear();
  if (!isFinite(target) || target > now || now - target < 2) return el;
  const t0 = performance.now(), dur = 1400;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    const y = Math.round(now + (target - now) * e);
    el.textContent = text.replace(m[0], String(y) + (m[0].endsWith(' ') ? ' ' : ''));
    if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = text;
  };
  setTimeout(() => requestAnimationFrame(step), 250);
  return el;
}

/** Diario delle osservazioni: tutto ciò che hai salvato o trovato, raggruppato per giorno. */
export function openJournal() {
  const body = h('div', { class: 'journal' });
  const render = () => {
    body.replaceChildren();
    const list = progress.journal;
    body.append(h('div', { class: 'journal-stats' },
      h('div', {}, h('b', {}, num(new Set(list.map((e) => JSON.stringify(e.ref))).size)), h('span', {}, tx('oggetti', 'objects', 'objets'))),
      h('div', {}, h('b', {}, num(progress.days.length)), h('span', {}, tx('notti', 'nights', 'nuits'))),
      h('div', {}, h('b', {}, num(progress.xp)), h('span', {}, 'XP'))));
    if (!list.length) {
      body.append(h('p', { class: 'muted pad' }, tx('Il diario è vuoto. Apri la scheda di un oggetto e tocca «Diario» per salvarlo, oppure completa una missione.', 'Your log is empty. Open an object\'s card and tap “Log” to save it, or complete a mission.', 'Le journal est vide. Ouvrez la fiche d\'un objet et touchez « Journal » pour l\'enregistrer, ou accomplissez une mission.')));
      return;
    }
    let day = '';
    for (const e of list) {
      const d = new Date(e.t);
      const k = d.toDateString();
      if (k !== day) { day = k; body.append(h('h3', { class: 'sec' }, d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))); }
      const note = e.note === 'mission' || e.note === 'Missione completata' ? tx('Missione completata', 'Mission complete', 'Mission accomplie')
        : e.note === 'visit' ? tx('Visitato con la navicella', 'Visited by spaceship', 'Visité en vaisseau') : e.note;
      const from = e.place === 'ship' ? (e.dist ? `${e.dist} ${tx('dalla Terra', 'from Earth', 'de la Terre')}` : '')
        : e.place !== 'earth' ? tx('da', 'from', 'depuis') + ' ' + (PLACES.find((p) => p.id === e.place)?.name ?? '') : '';
      // nota personale: tocca la matita per scriverla, si salva uscendo dal campo
      const noteEl = h('div', { class: 'row-note' }, e.text ?? '');
      const editNote = () => {
        const inp = h('input', { class: 'row-note-in', type: 'text', maxlength: '280', value: e.text ?? '', placeholder: tx('Scrivi una nota…', 'Write a note…', 'Écrire une note…') }) as HTMLInputElement;
        const save = () => { setJournalText(e.t, inp.value); noteEl.textContent = inp.value.trim(); inp.replaceWith(noteEl); };
        inp.addEventListener('blur', save);
        inp.addEventListener('keydown', (k) => { if (k.key === 'Enter') inp.blur(); });
        noteEl.replaceWith(inp); inp.focus();
      };
      const row = h('div', { class: 'row journal-row' },
        objectThumb(e.ref),
        h('button', { class: 'row-main', onclick: () => { closeSheet(); setTimeout(() => showInfo(e.ref), 380); } },
          h('div', { class: 'row-t' }, refName(e.ref)),
          h('div', { class: 'row-s' }, [fmtTime(d), e.gyro ? tx('cielo vero', 'real sky', 'vrai ciel') : '', from, note].filter(Boolean).join(' · ')),
          noteEl),
        iconButton('journal', tx('Nota', 'Note', 'Note'), () => editNote(), 'ibtn small row-edit'),
        iconButton('close', tx('Rimuovi dal diario', 'Remove from log', 'Retirer du journal'), () => { removeJournalEntry(e.t); render(); }, 'ibtn small row-del'));
      body.append(row);
    }
  };
  render();
  openSheet('journal', tx('Diario delle osservazioni', 'Observation log', 'Journal d\'observation'), body, { wide: true });
}

/** Dimensione del testo dell'interfaccia (90–130%). */
function textSizeControl() {
  const v = state.settings.textScale ?? 1;
  const lbl = h('b', {}, `${Math.round(v * 100)}%`);
  const r = h('input', { type: 'range', min: '0.9', max: '1.3', step: '0.05', value: String(v), class: 'range', 'aria-label': tx('Dimensione del testo', 'Text size', 'Taille du texte') }) as HTMLInputElement;
  r.addEventListener('input', () => { state.settings.textScale = +r.value; lbl.textContent = `${Math.round(+r.value * 100)}%`; applyAccessibility(); });
  r.addEventListener('change', () => saveSettings());
  return h('label', { class: 'full' }, h('span', {}, tx('Dimensione del testo: ', 'Text size: ', 'Taille du texte : '), lbl), r);
}

/** Applica le preferenze di accessibilità all'interfaccia. */
export function applyAccessibility() {
  document.documentElement.style.setProperty('--ts', String(state.settings.textScale ?? 1));
  document.body.classList.toggle('reduce-motion', reducedMotion());
}

function diagButton() {
  const n = issueCount();
  return h('button', { class: 'btn', onclick: async () => {
    const rep = diagnosticsReport(api.gl());
    try { await navigator.clipboard.writeText(rep); toast(tx('Rapporto copiato: incollalo nella mail all\'assistenza', 'Report copied: paste it into your email to support', 'Rapport copié : collez-le dans votre e-mail au support')); }
    catch { toast(tx('Impossibile copiare il rapporto', 'Could not copy the report', 'Impossible de copier le rapport')); }
  } }, icon('settings'), tx(`Diagnostica (${n})`, `Diagnostics (${n})`, `Diagnostic (${n})`));
}

/** Crediti e licenze: fonti dei dati, texture e ogni foto di galassia con autore e licenza. */
export function openCredits() {
  const src: [string, string, string][] = [
    ['HYG Database v4.1', 'astronexus', 'CC BY-SA 4.0'],
    ['d3-celestial (costellazioni, Messier)', 'Olaf Frohn', 'BSD-3-Clause'],
    ['Astronomy Engine', 'Don Cross', 'MIT'],
    ['satellite.js (SGP4)', 'Shashwat Kandadai e altri', 'MIT'],
    ['Three.js', 'three.js authors', 'MIT'],
    ['Capacitor', 'Ionic', 'MIT'],
    ['Open-Meteo', 'open-meteo.com', 'CC BY 4.0'],
    ['CelesTrak (orbita ISS)', 'CelesTrak', 'uso pubblico'],
    [tx('Texture planetarie e Via Lattea', 'Planet textures and Milky Way', 'Textures planétaires et Voie lactée'), 'Solar System Scope (NASA/ESO)', 'CC BY 4.0'],
    [tx('Illustrazione della Via Lattea', 'Milky Way illustration', 'Illustration de la Voie lactée'), 'NASA/JPL-Caltech/R. Hurt', 'NASA/JPL'],
    [tx('Distanze Messier, catalogo Caldwell', 'Messier distances, Caldwell catalogue', 'Distances Messier, catalogue Caldwell'), 'Wikipedia', 'CC BY-SA 4.0'],
    [tx('Modelli 3D di ISS, Hubble, James Webb e Voyager', '3D models of the ISS, Hubble, James Webb and Voyager', 'Modèles 3D de l\'ISS, Hubble, James Webb et Voyager'), 'NASA 3D Resources', tx('pubblico dominio', 'public domain', 'domaine public')],
    [tx('Orbite di lune e sonde', 'Orbits of moons and probes', 'Orbites des lunes et des sondes'), 'NASA/JPL Horizons', tx('pubblico dominio', 'public domain', 'domaine public')],
    ['Inter, Space Grotesk, JetBrains Mono', 'Rasmus Andersson, Florian Karsten, JetBrains', 'SIL OFL 1.1'],
  ];
  const body = h('div', { class: 'credits-page' },
    h('p', { class: 'muted' }, tx('Vastity è costruita con dati, immagini e strumenti aperti. Grazie a chi li rende disponibili.', 'Vastity is built with open data, images and tools. Thanks to everyone who makes them available.', 'Vastity est construite avec des données, images et outils ouverts. Merci à celles et ceux qui les rendent disponibles.')),
    h('h3', {}, tx('Dati e software', 'Data and software', 'Données et logiciels')),
    h('div', { class: 'list' }, ...src.map(([a, b, c]) => h('div', { class: 'row static' }, h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, a), h('div', { class: 'row-s' }, `${b} · ${c}`))))),
    h('h3', {}, tx('Foto delle galassie', 'Galaxy photos', 'Photos des galaxies')),
    h('div', { class: 'list' }, ...Object.entries(galaxyPhotos).map(([id, p]) => h('a', { class: 'row', href: p.source, target: '_blank', rel: 'noopener' },
      h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, refName({ kind: 'deep', id })), h('div', { class: 'row-s' }, `${p.credit || 'Wikimedia Commons'} · ${p.license}`))))),
  );
  openSheet('credits', tx('Crediti e licenze', 'Credits and licences', 'Crédits et licences'), body, { wide: true });
}

/** Slider della qualità grafica: Auto (consigliata per il dispositivo) → Massima. */
function qualityControl() {
  const ids = ['auto', 'low', 'mid', 'high', 'ultra'] as const;
  const names: Record<string, string> = {
    low: tx('Bassa', 'Low', 'Basse'), mid: tx('Media', 'Medium', 'Moyenne'), high: tx('Alta', 'High', 'Haute'), ultra: tx('Massima', 'Maximum', 'Maximale'),
  };
  const cur = state.settings.quality ?? 'auto';
  const lbl = h('b', {});
  const hint = h('p', { class: 'muted small' });
  const paint = (id: string) => {
    lbl.textContent = id === 'auto' ? `${tx('Automatica', 'Automatic', 'Automatique')} · ${names[detectedTier]}` : names[id];
    hint.textContent = id === 'ultra'
      ? tx('Tutto al massimo, senza riduzioni automatiche: più bello, ma può scaldare il telefono e consumare batteria.', 'Everything maxed out with no automatic reductions: prettier, but it may heat up your phone and use more battery.', 'Tout au maximum, sans réduction automatique : plus beau, mais le téléphone peut chauffer et consommer plus.')
      : id === 'auto' ? tx(`Scelta in base al tuo dispositivo (${names[detectedTier]}). L'app si adatta da sola per restare fluida.`, `Chosen for your device (${names[detectedTier]}). The app adapts itself to stay smooth.`, `Choisie selon votre appareil (${names[detectedTier]}). L'app s'adapte pour rester fluide.`)
      : tx('Più alta è la qualità, più stelle, polveri e dettagli; meno fluidità sui dispositivi lenti.', 'Higher quality means more stars, dust and detail, and less smoothness on slow devices.', 'Plus la qualité est haute, plus il y a d\'étoiles, de poussières et de détails ; moins de fluidité sur les appareils lents.');
  };
  const range = h('input', { type: 'range', min: '0', max: '4', step: '1', value: String(ids.indexOf(cur)), class: 'range', 'aria-label': tx('Qualità grafica', 'Graphics quality', 'Qualité graphique') }) as HTMLInputElement;
  range.addEventListener('input', () => paint(ids[+range.value]));
  range.addEventListener('change', () => {
    const id = ids[+range.value];
    if (id === (state.settings.quality ?? 'auto')) return;
    state.settings.quality = id;
    saveSettings();
    toast(tx('Applico la nuova qualità…', 'Applying the new quality…', 'Application de la nouvelle qualité…'));
    setTimeout(() => location.reload(), 700);
  });
  paint(cur);
  return h('label', { class: 'full quality' }, h('span', {}, tx('Qualità grafica: ', 'Graphics quality: ', 'Qualité graphique : '), lbl), range,
    h('div', { class: 'range-ticks' }, h('span', {}, 'Auto'), h('span', {}, names.low), h('span', {}, names.mid), h('span', {}, names.high), h('span', {}, names.ultra)), hint);
}

function bortleName(b: number) {
  const it = ['cielo perfetto', 'cielo buio', 'campagna', 'campagna/periferia', 'periferia', 'periferia luminosa', 'periferia/città', 'città', 'centro città'];
  const en = ['perfect sky', 'dark sky', 'countryside', 'rural/suburban', 'suburban', 'bright suburban', 'suburban/urban', 'city', 'inner city'];
  const fr = ['ciel parfait', 'ciel noir', 'campagne', 'campagne/banlieue', 'banlieue', 'banlieue lumineuse', 'banlieue/ville', 'ville', 'centre-ville'];
  return `${b} · ${tx(it[b - 1], en[b - 1], fr[b - 1])}`;
}

export async function locate(verbose = false) {
  const p = await native.position();
  if (p) {
    setLocation({ lat: p.lat, lon: p.lon, height: p.alt, name: tx('La tua posizione', 'Your location', 'Votre position'), source: 'gps' });
    if (verbose) { toast(tx('Posizione aggiornata', 'Location updated', 'Position mise à jour')); if (sheetOpen('settings')) openSettings(); }
  } else if (verbose) toast(tx('Non riesco a ottenere la posizione: controlla il permesso nelle impostazioni del telefono', 'Couldn\'t get your location: check the permission in your phone settings', 'Impossible d\'obtenir votre position : vérifiez l\'autorisation dans les réglages du téléphone'));
  return !!p;
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
  const hr = tx('ora', 'hour', 'heure'), day = tx('giorno', 'day', 'jour');
  const rates: [string, number][] = [
    [tx('Pausa', 'Pause', 'Pause'), 0], [tx('Reale', 'Real time', 'Temps réel'), 1], ['1 min/s', 60],
    [`1 ${hr}/s`, 3600], [`1 ${day}/s`, 86400], [`−1 ${hr}/s`, -3600],
  ];
  const chips = h('div', { class: 'chips' }, ...rates.map(([l, r]) => h('button', { class: 'chip' + (!state.live && state.timeRate === r ? ' on' : ''), onclick: () => {
    state.live = false; state.timeRate = r;
    bus.emit('time-ui'); openTime();
  } }, l)));
  const body = h('div', { class: 'time' },
    h('div', { class: 'actions' },
      iconButton('back', `−1 ${day}`, step(-86400e3), 'btn'), iconButton('back', `−1 ${hr}`, step(-3600e3), 'btn'),
      h('button', { class: 'btn primary', onclick: () => { setTime(Date.now(), true); bus.emit('time-ui'); closeSheet(); } }, tx('Adesso', 'Now', 'Maintenant')),
      iconButton('fwd', `+1 ${hr}`, step(3600e3), 'btn'), iconButton('fwd', `+1 ${day}`, step(86400e3), 'btn')),
    h('label', { class: 'full' }, tx('Data e ora', 'Date and time', 'Date et heure'), dt),
    h('h3', {}, tx('Velocità del tempo', 'Time speed', 'Vitesse du temps')), chips,
    h('p', { class: 'muted small' }, tx(
      'Suggerimento: tocca l\'ora in basso a sinistra per tornare al presente; tienila premuta per riaprire questa macchina del tempo, o trascinala per scorrere il cielo come un film.',
      'Tip: tap the time at the bottom left to return to the present; press and hold it to reopen this time machine, or drag it to play the sky like a film.',
      'Astuce : touchez l\'heure en bas à gauche pour revenir au présent ; maintenez-la pour rouvrir cette machine à remonter le temps, ou faites-la glisser pour dérouler le ciel comme un film.')));
  openSheet('time', tx('Macchina del tempo', 'Time machine', 'Machine à remonter le temps'), body, { compact: true });
}

// ---------------------------------------------------------------------------
// Missioni attive in sovrimpressione
// ---------------------------------------------------------------------------
export function missionHintText(): string | null {
  const a = activeMissions();
  return a.length ? a[0].title : null;
}

export { refName };
