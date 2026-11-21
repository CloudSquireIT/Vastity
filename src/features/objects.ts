// Riferimenti agli oggetti del cielo, ricerca e dati per la scheda informativa.
import {
  AU_IN_KM, C_KMS, LY_IN_KM, PC_IN_KM, MESSIER_EXTRA, MESSIER_TYPES, PC_IN_LY, constellationById, constellations, messier,
  messierName, radecToVec, starAppMag, starDistPc, starName, starPhysical, starRaDec, starSpectrum, starSubtitle, stars,
} from '../data/catalog';
import { BODIES, SkyFrame, V3, bodyById, v3 } from '../astro/astro';
import { num, tx } from '../i18n';
import { DEEP_TYPE_NAME, deepById, deepForMessier, deepObjects } from '../data/deep';
import { GALACTIC_CENTER_PC } from '../render/background';
import { EXO_CLASS_DESC, EXO_CLASS_NAME, exoHosts, exoPosPc, exoplanets } from '../data/exoplanets';
import { state } from '../state';
import * as A from 'astronomy-engine';
import { CRAFT, allMoons, craftById, craftHelioKm, moonById, moonOffsetKm } from '../data/ephem';

export type ObjRef =
  | { kind: 'body'; id: string }
  | { kind: 'star'; index: number }
  | { kind: 'messier'; id: string }
  | { kind: 'constellation'; id: string }
  | { kind: 'iss' }
  | { kind: 'deep'; id: string }
  | { kind: 'exo'; index: number }
  | { kind: 'moon'; id: string }
  | { kind: 'craft'; id: string };

export const sameRef = (a: ObjRef | null, b: ObjRef | null) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

export function refName(r: ObjRef): string {
  switch (r.kind) {
    case 'body': return bodyById(r.id)?.name ?? r.id;
    case 'star': return starName(r.index);
    case 'messier': { const m = messier.find((x) => x.id === r.id); return m ? messierName(m) : r.id; }
    case 'constellation': return constellationById(r.id)?.name ?? r.id;
    case 'iss': return tx('Stazione Spaziale', 'Space Station', 'Station spatiale');
    case 'deep': return deepById(r.id)?.name ?? r.id;
    case 'exo': return exoplanets[r.index]?.name ?? '';
    case 'moon': return moonById(r.id)?.name ?? r.id;
    case 'craft': return craftById(r.id)?.name ?? r.id;
  }
}

/** Posizione in parsec (eliocentrica EQJ) per oggetti fuori dal Sistema Solare. */
export function refPosPc(r: ObjRef): V3 | null {
  if (r.kind === 'star') return [stars.pos[r.index * 3], stars.pos[r.index * 3 + 1], stars.pos[r.index * 3 + 2]];
  if (r.kind === 'messier') {
    const m = messier.find((x) => x.id === r.id)!;
    const ly = MESSIER_EXTRA[m.id]?.ly ?? 5000;
    return v3.scale(radecToVec(m.ra, m.dec), ly / PC_IN_LY);
  }
  if (r.kind === 'exo') return exoplanets[r.index] ? exoPosPc(r.index, state.time) : null;
  if (r.kind === 'moon' || r.kind === 'craft') { const k = refHelioKm(r, state.time); return k ? v3.scale(k, 1 / PC_IN_KM) : null; }
  if (r.kind === 'deep') {
    const o = deepById(r.id);
    if (!o) return null;
    if (o.id === 'milkyway') return [...GALACTIC_CENTER_PC] as V3;
    return v3.scale(radecToVec(o.ra, o.dec), o.ly / PC_IN_LY);
  }
  return null;
}

/** Posizione eliocentrica EQJ in km di lune e veicoli spaziali. */
export function refHelioKm(r: ObjRef, t: number): V3 | null {
  if (r.kind === 'craft') return craftHelioKm(r.id, t);
  if (r.kind === 'iss') return craftHelioKm('iss', t);
  if (r.kind === 'moon') {
    const m = moonById(r.id), b = m && bodyById(m.planet);
    if (!m || !b?.body) return null;
    const h = A.HelioVector(b.body, new Date(t));
    const o = moonOffsetKm(m, t);
    return [h.x * AU_IN_KM + o[0], h.y * AU_IN_KM + o[1], h.z * AU_IN_KM + o[2]];
  }
  return null;
}

/** Direzione EQJ dell'oggetto vista dall'osservatore attuale. */
export function refDirection(r: ObjRef, frame: SkyFrame, issDir?: V3 | null): V3 | null {
  if (r.kind === 'body') return frame.bodies.find((b) => b.id === r.id)?.dir ?? null;
  if (r.kind === 'iss') return issDir ?? null;
  if (r.kind === 'constellation') {
    const c = constellationById(r.id);
    if (!c) return null;
    return v3.norm(v3.sub(v3.scale(radecToVec(c.c[0], c.c[1]), 300), frame.observerPc));
  }
  if (r.kind === 'moon' || r.kind === 'craft') {
    const k = refHelioKm(r, state.time);
    return k ? v3.norm(v3.sub(k, v3.scale(frame.observerPc, PC_IN_KM))) : null;
  }
  const p = refPosPc(r);
  return p ? v3.norm(v3.sub(p, frame.observerPc)) : null;
}

export interface SearchItem {
  ref: ObjRef; name: string; sub: string; key: string; rank: number;
  /** Per ordinare: distanza dal Sole (anni luce), magnitudine apparente, raggio (anni luce). */
  dist?: number; mag?: number; size?: number;
}
const KM_LY = 1 / 9.4607e12;
const BODY_MAG: Record<string, number> = { sun: -26.7, moon: -12.7, venus: -4.4, jupiter: -2.7, mars: -1.5, mercury: -0.4, saturn: 0.5, uranus: 5.7, neptune: 7.8, pluto: 14.4 };

let index: SearchItem[] | null = null;
/** Da chiamare quando arrivano nuovi dati (lune, veicoli): l'indice di ricerca e le categorie si ricostruiscono. */
export function resetSearchIndex() { index = null; cats = null; }
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function searchIndex(): SearchItem[] {
  if (index) return index;
  const items: SearchItem[] = [];
  for (const b of BODIES) {
    const au = b.id === 'sun' ? 0 : b.id === 'moon' ? 1 : Math.pow((b.period ?? 365.25) / 365.25, 2 / 3);
    items.push({ ref: { kind: 'body', id: b.id }, name: b.name, sub: kindName(b.kind, false), key: norm(b.name + ' ' + b.id), rank: 0,
      dist: au * AU_IN_KM * KM_LY, mag: BODY_MAG[b.id], size: b.radiusKm * KM_LY });
  }
  for (const o of deepObjects()) items.push({ ref: { kind: 'deep', id: o.id }, name: o.name, sub: DEEP_TYPE_NAME(o.type, o.galaxy), key: norm(o.name + ' ' + o.id + ' ' + (o.messier ?? '') + ' ' + (messier.find((m) => m.id === o.messier)?.ngc ?? '') + ' ' + (messier.find((m) => m.id === o.messier)?.ngc ?? '').replace(' ', '') + ' ' + DEEP_TYPE_NAME(o.type, o.galaxy) + (o.id === 'milkyway' ? ' milky way voie lactee via lattea' : '')), rank: o.id === 'milkyway' ? 0.2 : 1.2,
    dist: o.id === 'milkyway' ? 26000 : o.ly, size: o.radiusLy, mag: messier.find((m) => m.id === o.messier)?.mag });
  items.push({ ref: { kind: 'iss' }, name: tx('Stazione Spaziale (ISS)', 'Space Station (ISS)', 'Station spatiale (ISS)'), sub: tx('Satellite', 'Satellite', 'Satellite'), key: 'iss stazione spaziale internazionale space station station spatiale', rank: 0 });
  for (const m of allMoons()) items.push({ ref: { kind: 'moon', id: m.id }, name: m.name, sub: `${tx('Luna di', 'Moon of', 'Lune de')} ${bodyById(m.planet)?.name ?? m.planet}`, key: norm(`${m.name} ${m.id} ${bodyById(m.planet)?.name ?? ''} luna moon lune`), rank: 0.8, size: m.r * KM_LY });
  for (const c of CRAFT) if (c.id !== 'iss') items.push({ ref: { kind: 'craft', id: c.id }, name: c.name, sub: tx('Veicolo spaziale', 'Spacecraft', 'Engin spatial'), key: norm(`${c.name} ${c.id} satellite sonda probe sonde`), rank: 0.6 });
  for (const c of constellations) items.push({ ref: { kind: 'constellation', id: c.id }, name: c.name, sub: `${tx('Costellazione', 'Constellation', 'Constellation')} · ${c.la}`, key: norm(c.name + ' ' + c.la + ' ' + c.id), rank: 1 + c.rank * 0.1 });
  for (const m of messier) if (!deepForMessier(m.id)) items.push({ ref: { kind: 'messier', id: m.id }, name: messierName(m), sub: `${m.id} · ${MESSIER_TYPES[m.type] ?? tx('Oggetto', 'Object', 'Objet')}`, key: norm(messierName(m) + ' ' + m.id + ' ' + m.alt + ' ' + (m.ngc ?? '') + ' ' + (m.ngc ?? '').replace(' ', '')), rank: (m.id[0] === 'C' ? 2.3 : 2) + Math.min(m.mag, 15) * 0.01,
    dist: MESSIER_EXTRA[m.id]?.ly, mag: m.mag < 50 ? m.mag : undefined });
  for (let i = 0; i < stars.count; i++) {
    const ni = stars.name[i];
    if (ni < 0) continue;
    const [proper, desig, hip] = stars.names[ni];
    items.push({ ref: { kind: 'star', index: i }, name: proper || desig, sub: `${tx('Stella', 'Star', 'Étoile')}${proper && desig ? ' · ' + desig : ''} · mag ${num(starAppMag(i), 1, 1)}`, key: norm(`${proper} ${desig} hip${hip}`), rank: (proper ? 1.5 : 4) + starAppMag(i) * 0.05,
      dist: stars.distUnknown[i] ? undefined : starDistPc(i) * 3.26156, mag: starAppMag(i), size: starPhysical(i).R * 696340 * KM_LY });
  }
  for (let i = 0; i < exoplanets.length; i++) {
    const p = exoplanets[i], hst = exoHosts[p.host];
    items.push({ ref: { kind: 'exo', index: i }, name: p.name, sub: `${tx('Esopianeta', 'Exoplanet', 'Exoplanète')} · ${EXO_CLASS_NAME(p.cls)} · ${hst.name}`,
      key: norm(`${p.name} ${p.name.replace(/\s+/g, '')} ${hst.name} ${EXO_CLASS_NAME(p.cls)} exoplanet esopianeta exoplanete`), rank: 3 + (p.name.length > 14 ? 0.2 : 0),
      dist: hst.distPc * 3.26156, size: p.radiusEarth * 6371 / 9.4607e12 });
  }
  index = items;
  return items;
}

// ---------------------------------------------------------------------------
// Categorie: ogni oggetto del catalogo appartiene ad almeno una categoria
// ---------------------------------------------------------------------------
export interface Category { id: string; name: string; icon: string; items: SearchItem[] }

const MESSIER_GROUP: Record<string, string> = {
  s: 'galaxies', sg: 'galaxies', sd: 'galaxies', s0: 'galaxies', e: 'galaxies', i: 'galaxies',
  gc: 'clusters', oc: 'clusters', pos: 'clusters', ast: 'clusters', ds: 'clusters',
  en: 'nebulae', rn: 'nebulae', bn: 'nebulae', sfr: 'nebulae', pn: 'nebulae', snr: 'nebulae', dn: 'nebulae',
};
const DEEP_GROUP: Record<string, string> = {
  galaxy: 'galaxies', nebula: 'nebulae', pn: 'nebulae', snr: 'nebulae', gc: 'clusters', oc: 'clusters',
  blackhole: 'exotic', quasar: 'exotic', pulsar: 'exotic',
};

let cats: Category[] | null = null;
export function categories(): Category[] {
  if (cats) return cats;
  const C = (id: string, name: string, icon: string): Category => ({ id, name, icon, items: [] });
  const list = [
    C('solar', tx('Sistema solare', 'Solar System', 'Système solaire'), '☉'),
    C('moons', tx('Lune', 'Moons', 'Lunes'), '☾'),
    C('craft', tx('Satelliti e sonde', 'Satellites & probes', 'Satellites et sondes'), '⌁'),
    C('stars', tx('Stelle', 'Stars', 'Étoiles'), '✦'),
    C('constellations', tx('Costellazioni', 'Constellations', 'Constellations'), '✧'),
    C('galaxies', tx('Galassie', 'Galaxies', 'Galaxies'), '◎'),
    C('nebulae', tx('Nebulose', 'Nebulae', 'Nébuleuses'), '☁'),
    C('clusters', tx('Ammassi stellari', 'Star clusters', 'Amas d\'étoiles'), '⁂'),
    C('exotic', tx('Buchi neri, quasar e pulsar', 'Black holes, quasars & pulsars', 'Trous noirs, quasars et pulsars'), '●'),
    C('exoplanets', tx('Esopianeti', 'Exoplanets', 'Exoplanètes'), '◐'),
    C('messier', tx('Catalogo di Messier', 'Messier catalogue', 'Catalogue de Messier'), 'M'),
    C('caldwell', tx('Catalogo Caldwell', 'Caldwell catalogue', 'Catalogue de Caldwell'), 'C'),
  ];
  const by = Object.fromEntries(list.map((c) => [c.id, c]));
  for (const it of searchIndex()) {
    const r = it.ref;
    let g = '';
    if (r.kind === 'body') g = 'solar';
    else if (r.kind === 'moon') g = 'moons';
    else if (r.kind === 'iss' || r.kind === 'craft') g = 'craft';
    else if (r.kind === 'star') g = 'stars';
    else if (r.kind === 'constellation') g = 'constellations';
    else if (r.kind === 'deep') g = deepById(r.id)?.id === 'milkyway' ? 'galaxies' : DEEP_GROUP[deepById(r.id)?.type ?? ''] ?? 'nebulae';
    else if (r.kind === 'exo') g = 'exoplanets';
    else if (r.kind === 'messier') g = MESSIER_GROUP[messier.find((m) => m.id === r.id)?.type ?? ''] ?? 'nebulae';
    by[g]?.items.push(it);
  }
  // cataloghi: tutti gli oggetti, anche quelli che hanno un render dedicato
  for (const m of messier) {
    const d = deepForMessier(m.id);
    const ref: ObjRef = d ? { kind: 'deep', id: d.id } : { kind: 'messier', id: m.id };
    const name = d ? d.name : messierName(m);
    const item: SearchItem = { ref, name: name === m.id ? m.id : `${m.id} · ${name}`, sub: `${MESSIER_TYPES[m.type] ?? ''}${m.ngc ? ' · ' + m.ngc : ''}`, key: norm(`${m.id} ${name} ${m.ngc ?? ''}`), rank: +m.id.slice(1),
      dist: d ? d.ly : MESSIER_EXTRA[m.id]?.ly, mag: m.mag < 50 ? m.mag : undefined, size: d?.radiusLy };
    (m.id[0] === 'C' ? by.caldwell : by.messier).items.push(item);
  }
  for (const c of list) c.items = sortItems(c.items, 'name');
  cats = list;
  return list;
}

export type SortKey = 'name' | 'dist' | 'mag' | 'size';
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
/** Ordina: nome (A→Z, numeri in ordine naturale), distanza crescente, luminosità (magnitudine crescente), dimensione decrescente. */
export function sortItems(items: SearchItem[], key: SortKey): SearchItem[] {
  const v = (it: SearchItem) => (key === 'dist' ? it.dist : key === 'mag' ? it.mag : key === 'size' ? it.size : undefined);
  return [...items].sort((a, b) => {
    if (key === 'name') return collator.compare(a.name, b.name);
    const va = v(a), vb = v(b);
    if (va == null && vb == null) return collator.compare(a.name, b.name);
    if (va == null) return 1;
    if (vb == null) return -1;
    return key === 'size' ? vb - va : va - vb;
  });
}

export function filterItems(items: SearchItem[], q: string) {
  const nq = norm(q.trim());
  return nq ? items.filter((it) => it.key.includes(nq) || norm(it.name).includes(nq)) : items;
}

export function search(q: string, limit = 80): SearchItem[] {
  const nq = norm(q.trim());
  if (!nq) return [];
  const exact: SearchItem[] = [], rest: SearchItem[] = [];
  for (const it of searchIndex()) {
    if (!it.key.includes(nq)) continue;
    (norm(it.name) === nq ? exact : rest).push(it);
  }
  // corrispondenze esatte in cima, poi tutto in ordine alfabetico (con tantissimi risultati, prima chi inizia per la ricerca)
  let pool = rest;
  if (pool.length > 3000) { const pre = pool.filter((it) => norm(it.name).startsWith(nq)); pool = pre.length >= limit ? pre : pool.slice(0, 3000); }
  return [...exact, ...sortItems(pool, 'name')].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Dati per la scheda informativa
// ---------------------------------------------------------------------------

export interface InfoData {
  title: string;
  subtitle: string;
  facts: [string, string][];
  desc?: string;
  lightYears?: number;
  lightSeconds?: number;
  canFly: boolean;
}

const fmt = (n: number, d = 0) => num(n, d);
const LY = () => tx('anni luce', 'light years', 'années-lumière');
const MLY = () => tx('milioni di anni luce', 'million light years', 'millions d\'années-lumière');

function kindName(k: string, long: boolean) {
  if (k === 'star') return tx('Stella', 'Star', 'Étoile');
  if (k === 'moon') return long ? tx('Satellite naturale', 'Natural satellite', 'Satellite naturel') : tx('Satellite', 'Satellite', 'Satellite');
  if (k === 'dwarf') return tx('Pianeta nano', 'Dwarf planet', 'Planète naine');
  return tx('Pianeta', 'Planet', 'Planète');
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${fmt(km * 1000)} m`;
  if (km < 10) return `${fmt(km, 1)} km`;
  if (km < 1e6) return `${fmt(km)} km`;
  if (km < 0.05 * LY_IN_KM) {
    const au = km / AU_IN_KM;
    return au < 0.1 ? `${fmt(km / 1e6, 2)} ${tx('milioni di km', 'million km', 'millions de km')}` : `${fmt(au, 2)} ${tx('UA', 'AU', 'UA')}`;
  }
  const ly = km / LY_IN_KM;
  if (ly < 1e6) return `${fmt(ly, ly < 10 ? 2 : 0)} ${LY()}`;
  return `${fmt(ly / 1e6, 2)} ${MLY()}`;
}

export function info(r: ObjRef, frame: SkyFrame): InfoData {
  if (r.kind === 'moon' || r.kind === 'craft') {
    const here = v3.scale(frame.observerPc, PC_IN_KM);
    const pos = refHelioKm(r, state.time);
    const distKm = pos ? v3.len(v3.sub(pos, here)) : 0;
    const dist = distKm > 1e7 ? `${num(distKm / AU_IN_KM, 2)} ${tx('UA', 'AU', 'UA')}` : `${fmt(distKm)} km`;
    if (r.kind === 'moon') {
      const m = moonById(r.id)!;
      const pl = bodyById(m.planet)?.name ?? m.planet;
      const per = 360 / m.n / 86400;
      return { title: m.name, subtitle: `${tx('Luna di', 'Moon of', 'Lune de')} ${pl}`, canFly: true, lightSeconds: distKm / C_KMS,
        facts: [[tx('Distanza', 'Distance', 'Distance'), dist], [tx('Raggio', 'Radius', 'Rayon'), `${fmt(m.r)} km`],
          [tx('Distanza dal pianeta', 'Distance from planet', 'Distance à la planète'), `${fmt(m.a)} km`],
          [tx('Orbita', 'Orbit', 'Orbite'), per < 2 ? `${num(per * 24, 1)} ${tx('ore', 'hours', 'heures')}` : `${num(per, 1)} ${tx('giorni', 'days', 'jours')}`]] };
    }
    const c = craftById(r.id)!;
    const facts: [string, string][] = [[tx('Distanza', 'Distance', 'Distance'), dist], [tx('Dimensioni', 'Size', 'Taille'), `${fmt(c.sizeKm * 1000)} m`]];
    if (c.kind === 'leo' && pos) {
      const e = A.HelioVector(A.Body.Earth, new Date(state.time));
      const alt = v3.len(v3.sub(pos, [e.x * AU_IN_KM, e.y * AU_IN_KM, e.z * AU_IN_KM])) - 6371;
      facts.push([tx('Quota', 'Altitude', 'Altitude'), `${fmt(alt)} km`]);
    }
    return { title: c.name, subtitle: c.kind === 'leo' ? tx('Satellite · in tempo reale', 'Satellite · live', 'Satellite · en temps réel') : tx('Sonda · in tempo reale', 'Probe · live', 'Sonde · en temps réel'),
      facts, desc: c.desc, canFly: !!pos, lightSeconds: distKm / C_KMS };
  }
  if (r.kind === 'exo') {
    const p = exoplanets[r.index], hst = exoHosts[p.host];
    const ly = hst.distPc * PC_IN_LY;
    const facts: [string, string][] = [
      [tx('Stella', 'Star', 'Étoile'), hst.name],
      [tx('Distanza', 'Distance', 'Distance'), `${fmt(ly, ly < 20 ? 1 : 0)} ${LY()}`],
      [tx('Raggio', 'Radius', 'Rayon'), `${num(p.radiusEarth, p.radiusEarth < 3 ? 2 : 1)} × ${tx('Terra', 'Earth', 'Terre')}`],
    ];
    if (p.massEarth > 0) facts.push([tx('Massa', 'Mass', 'Masse'), p.massEarth > 300 ? `${num(p.massEarth / 317.8, 2)} × ${tx('Giove', 'Jupiter', 'Jupiter')}` : `${num(p.massEarth, 1)} × ${tx('Terra', 'Earth', 'Terre')}`]);
    facts.push([tx('Anno (orbita)', 'Year (orbit)', 'Année (orbite)'), p.periodD < 2 ? `${num(p.periodD * 24, 1)} ${tx('ore', 'hours', 'heures')}` : p.periodD < 730 ? `${num(p.periodD, 1)} ${tx('giorni', 'days', 'jours')}` : `${num(p.periodD / 365.25, 1)} ${tx('anni', 'years', 'ans')}`]);
    facts.push([tx('Distanza dalla stella', 'Distance from star', 'Distance à l\'étoile'), `${num(p.aAU, p.aAU < 1 ? 3 : 2)} ${tx('UA', 'AU', 'UA')}`]);
    facts.push([tx('Temperatura', 'Temperature', 'Température'), `≈ ${fmt(p.eqTempK - 273)} °C`]);
    if (p.year) facts.push([tx('Scoperto', 'Discovered', 'Découverte'), `${p.year} · ${p.method}`]);
    return { title: p.name, subtitle: `${tx('Esopianeta', 'Exoplanet', 'Exoplanète')} · ${EXO_CLASS_NAME(p.cls)}`, facts,
      desc: EXO_CLASS_DESC(p.cls) + ' ' + tx('Render generato dai dati reali (raggio e temperatura).', 'Render generated from real data (radius and temperature).', 'Rendu généré à partir des données réelles (rayon et température).'), lightYears: ly, canFly: true };
  }
  if (r.kind === 'deep') {
    const o = deepById(r.id)!;
    const facts: [string, string][] = [[tx('Distanza', 'Distance', 'Distance'), o.ly >= 1e6 ? `${fmt(o.ly / 1e6, 2)} ${MLY()}` : `${fmt(o.ly)} ${LY()}`]];
    if (o.id === 'milkyway') facts[0] = [tx('Distanza dal centro', 'Distance to centre', 'Distance au centre'), `${fmt(o.ly)} ${LY()}`];
    facts.push([o.type === 'blackhole' || o.type === 'quasar' || o.type === 'pulsar' ? tx('Dimensione mostrata', 'Size shown', 'Taille affichée') : tx('Diametro', 'Diameter', 'Diamètre'), `${fmt(o.radiusLy * 2, o.radiusLy < 1 ? 3 : 0)} ${LY()}`]);
    if (o.mass) facts.push([tx('Massa', 'Mass', 'Masse'), o.mass]);
    return { title: o.name, subtitle: DEEP_TYPE_NAME(o.type, o.galaxy), facts, desc: o.desc, lightYears: o.id === 'milkyway' ? undefined : o.ly, canFly: true };
  }
  if (r.kind === 'body') {
    const b = bodyById(r.id)!;
    const sb = frame.bodies.find((x) => x.id === r.id);
    const facts: [string, string][] = [];
    if (sb) {
      facts.push([tx('Distanza', 'Distance', 'Distance'), formatDistanceKm(sb.distKm)]);
      if (sb.mag < 30) facts.push([tx('Magnitudine', 'Magnitude', 'Magnitude'), num(sb.mag, 1, 1)]);
      facts.push([tx('Diametro apparente', 'Apparent diameter', 'Diamètre apparent'), `${((sb.angRadius * 2 * 180 * 3600) / Math.PI).toFixed(0)}″`]);
    }
    facts.push([tx('Raggio', 'Radius', 'Rayon'), `${fmt(b.radiusKm)} km`]);
    return { title: b.name, subtitle: kindName(b.kind, true), facts, desc: b.desc, lightSeconds: sb ? sb.distKm / C_KMS : undefined, canFly: true };
  }
  if (r.kind === 'star') {
    const i = r.index;
    const dpc = starDistPc(i);
    const ly = dpc * PC_IN_LY;
    const ph = starPhysical(i);
    const { ra, dec } = starRaDec(i);
    const con = constellationById(stars.con[i]);
    const facts: [string, string][] = [
      [tx('Distanza', 'Distance', 'Distance'), stars.distUnknown[i] ? tx('sconosciuta', 'unknown', 'inconnue') : `${fmt(ly, ly < 20 ? 2 : 0)} ${LY()}`],
      [tx('Magnitudine', 'Magnitude', 'Magnitude'), num(starAppMag(i), 2, 2)],
      [tx('Temperatura', 'Temperature', 'Température'), `${fmt(Math.round(ph.T / 100) * 100)} K`],
      [tx('Luminosità', 'Luminosity', 'Luminosité'), `${fmt(ph.L, ph.L < 10 ? 2 : 0)} × ${tx('Sole', 'Sun', 'Soleil')}`],
      [tx('Raggio stimato', 'Estimated radius', 'Rayon estimé'), `${fmt(ph.R, ph.R < 10 ? 2 : 0)} × ${tx('Sole', 'Sun', 'Soleil')}`],
      [tx('Coordinate', 'Coordinates', 'Coordonnées'), `${tx('AR', 'RA', 'AD')} ${(ra / 15).toFixed(2)}h · Dec ${dec.toFixed(1)}°`],
    ];
    const sp = starSpectrum(i);
    if (sp) facts.splice(2, 0, [tx('Tipo spettrale', 'Spectral type', 'Type spectral'), sp]);
    return {
      title: starName(i), subtitle: [tx('Stella', 'Star', 'Étoile'), starSubtitle(i), con ? `${tx('in', 'in', 'dans')} ${con.name}` : ''].filter(Boolean).join(' · '),
      facts, desc: starDescription(ph.T, ph.R), lightYears: stars.distUnknown[i] ? undefined : ly, canFly: !stars.distUnknown[i],
    };
  }
  if (r.kind === 'messier') {
    const m = messier.find((x) => x.id === r.id)!;
    const ex = MESSIER_EXTRA[m.id];
    const facts: [string, string][] = [[tx('Catalogo', 'Catalogue', 'Catalogue'), m.id], [tx('Magnitudine', 'Magnitude', 'Magnitude'), num(m.mag, 1, 1)]];
    if (ex) facts.unshift([tx('Distanza', 'Distance', 'Distance'), ex.ly >= 1e6 ? `${fmt(ex.ly / 1e6, 2)} ${MLY()}` : `${fmt(ex.ly)} ${LY()}`]);
    return { title: messierName(m), subtitle: MESSIER_TYPES[m.type] ?? tx('Oggetto del profondo cielo', 'Deep-sky object', 'Objet du ciel profond'), facts, lightYears: ex?.ly, canFly: !!ex };
  }
  if (r.kind === 'constellation') {
    const c = constellationById(r.id)!;
    return { title: c.name, subtitle: `${tx('Costellazione', 'Constellation', 'Constellation')} · ${c.la}`, facts: [[tx('Genitivo', 'Genitive', 'Génitif'), c.gen], [tx('Sigla', 'Abbreviation', 'Abréviation'), c.id]], desc: tx('Le stelle di una costellazione sembrano vicine, ma spesso sono a distanze molto diverse: prova a guardarle dalla navicella.', 'The stars of a constellation look close together, but they are often at very different distances: try viewing them from the spaceship.', 'Les étoiles d\'une constellation semblent proches, mais elles sont souvent à des distances très différentes : essayez de les voir depuis le vaisseau.'), canFly: false };
  }
  return {
    title: tx('Stazione Spaziale Internazionale', 'International Space Station', 'Station spatiale internationale'),
    subtitle: tx('Satellite con equipaggio', 'Crewed satellite', 'Satellite habité'),
    facts: [[tx('Quota', 'Altitude', 'Altitude'), '≈ 420 km'], [tx('Velocità', 'Speed', 'Vitesse'), `${num(27600)} km/h`], [tx('Giro della Terra', 'Orbit of Earth', 'Tour de la Terre'), '≈ 92 min']],
    desc: tx('Il più grande oggetto costruito dall\'uomo nello spazio. Si vede a occhio nudo come una stella che si muove veloce, senza lampeggiare.', 'The largest human-made object in space. It is visible to the naked eye as a fast-moving star that does not blink.', 'Le plus grand objet construit par l\'homme dans l\'espace. On la voit à l\'œil nu comme une étoile qui se déplace vite, sans clignoter.'),
    canFly: false,
  };
}

function starDescription(T: number, R: number) {
  const type = T > 25000 ? tx('blu e caldissima', 'blue and extremely hot', 'bleue et extrêmement chaude')
    : T > 10000 ? tx('bianco-azzurra', 'blue-white', 'blanc-bleu')
    : T > 7500 ? tx('bianca', 'white', 'blanche')
    : T > 6000 ? tx('bianco-gialla', 'yellow-white', 'blanc-jaune')
    : T > 5000 ? tx('gialla, come il Sole', 'yellow, like the Sun', 'jaune, comme le Soleil')
    : T > 3700 ? tx('arancione', 'orange', 'orange')
    : tx('rossa e relativamente fredda', 'red and relatively cool', 'rouge et relativement froide');
  const a = /^[aeiou]/i.test(type) ? 'an' : 'a';
  if (R > 100) return tx(`È una supergigante ${type}.`, `It is ${a} ${type} supergiant.`, `C'est une supergéante ${type}.`);
  if (R > 10) return tx(`È una gigante ${type}.`, `It is ${a} ${type} giant.`, `C'est une géante ${type}.`);
  if (R < 0.6) return tx(`È una nana ${type}.`, `It is ${a} ${type} dwarf.`, `C'est une naine ${type}.`);
  return tx(`È una stella ${type}, di dimensioni simili al Sole.`, `It is ${a} ${type} star, similar in size to the Sun.`, `C'est une étoile ${type}, de taille comparable au Soleil.`);
}
