// Riferimenti agli oggetti del cielo, ricerca e dati per la scheda informativa.
import {
  AU_IN_KM, C_KMS, LY_IN_KM, MESSIER_EXTRA, MESSIER_TYPES, PC_IN_LY, constellationById, constellations, messier,
  messierName, radecToVec, starAppMag, starDistPc, starName, starPhysical, starRaDec, starSpectrum, starSubtitle, stars,
} from '../data/catalog';
import { BODIES, SkyFrame, V3, bodyById, v3 } from '../astro/astro';

export type ObjRef =
  | { kind: 'body'; id: string }
  | { kind: 'star'; index: number }
  | { kind: 'messier'; id: string }
  | { kind: 'constellation'; id: string }
  | { kind: 'iss' };

export const sameRef = (a: ObjRef | null, b: ObjRef | null) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

export function refName(r: ObjRef): string {
  switch (r.kind) {
    case 'body': return bodyById(r.id)?.it ?? r.id;
    case 'star': return starName(r.index);
    case 'messier': { const m = messier.find((x) => x.id === r.id); return m ? messierName(m) : r.id; }
    case 'constellation': return constellationById(r.id)?.it ?? r.id;
    case 'iss': return 'Stazione Spaziale';
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
  const p = refPosPc(r);
  return p ? v3.norm(v3.sub(p, frame.observerPc)) : null;
}

export interface SearchItem { ref: ObjRef; name: string; sub: string; key: string; rank: number }

let index: SearchItem[] | null = null;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function searchIndex(): SearchItem[] {
  if (index) return index;
  const items: SearchItem[] = [];
  for (const b of BODIES) {
    if (b.id === 'earth') continue;
    items.push({ ref: { kind: 'body', id: b.id }, name: b.it, sub: b.kind === 'star' ? 'Stella' : b.kind === 'moon' ? 'Satellite' : b.kind === 'dwarf' ? 'Pianeta nano' : 'Pianeta', key: norm(b.it + ' ' + b.id), rank: 0 });
  }
  items.push({ ref: { kind: 'iss' }, name: 'Stazione Spaziale (ISS)', sub: 'Satellite', key: 'iss stazione spaziale internazionale', rank: 0 });
  for (const c of constellations) items.push({ ref: { kind: 'constellation', id: c.id }, name: c.it, sub: `Costellazione · ${c.la}`, key: norm(c.it + ' ' + c.la + ' ' + c.id), rank: 1 + c.rank * 0.1 });
  for (const m of messier) items.push({ ref: { kind: 'messier', id: m.id }, name: messierName(m), sub: `${m.id} · ${MESSIER_TYPES[m.type] ?? 'Oggetto'}`, key: norm(messierName(m) + ' ' + m.id + ' ' + m.alt), rank: 2 + m.mag * 0.01 });
  for (let i = 0; i < stars.count; i++) {
    const ni = stars.name[i];
    if (ni < 0) continue;
    const [proper, desig, hip] = stars.names[ni];
    items.push({ ref: { kind: 'star', index: i }, name: proper || desig, sub: `Stella${proper && desig ? ' · ' + desig : ''} · mag ${starAppMag(i).toFixed(1)}`, key: norm(`${proper} ${desig} hip${hip}`), rank: (proper ? 1.5 : 4) + starAppMag(i) * 0.05 });
  }
  index = items;
  return items;
}

export function search(q: string, limit = 30): SearchItem[] {
  const nq = norm(q.trim());
  if (!nq) return [];
  const res: { it: SearchItem; s: number }[] = [];
  for (const it of searchIndex()) {
    const p = it.key.indexOf(nq);
    if (p < 0) continue;
    res.push({ it, s: it.rank + (p === 0 ? 0 : 1) + (norm(it.name) === nq ? -2 : 0) });
  }
  return res.sort((a, b) => a.s - b.s).slice(0, limit).map((r) => r.it);
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

const fmt = (n: number, d = 0) => n.toLocaleString('it-IT', { maximumFractionDigits: d, minimumFractionDigits: 0 });

export function formatDistanceKm(km: number): string {
  if (km < 1e6) return `${fmt(km)} km`;
  if (km < 0.05 * LY_IN_KM) {
    const au = km / AU_IN_KM;
    return au < 0.1 ? `${fmt(km / 1e6, 2)} milioni di km` : `${fmt(au, 2)} UA`;
  }
  const ly = km / LY_IN_KM;
  if (ly < 1e6) return `${fmt(ly, ly < 10 ? 2 : 0)} anni luce`;
  return `${fmt(ly / 1e6, 2)} milioni di anni luce`;
}

export function info(r: ObjRef, frame: SkyFrame): InfoData {
  if (r.kind === 'body') {
    const b = bodyById(r.id)!;
    const sb = frame.bodies.find((x) => x.id === r.id);
    const facts: [string, string][] = [];
    if (sb) {
      facts.push(['Distanza', formatDistanceKm(sb.distKm)]);
      if (sb.mag < 30) facts.push(['Magnitudine', sb.mag.toFixed(1).replace('.', ',')]);
      facts.push(['Diametro apparente', `${((sb.angRadius * 2 * 180 * 3600) / Math.PI).toFixed(0)}″`]);
    }
    facts.push(['Raggio', `${fmt(b.radiusKm)} km`]);
    return { title: b.it, subtitle: b.kind === 'star' ? 'Stella' : b.kind === 'moon' ? 'Satellite naturale' : b.kind === 'dwarf' ? 'Pianeta nano' : 'Pianeta', facts, desc: b.desc, lightSeconds: sb ? sb.distKm / C_KMS : undefined, canFly: true };
  }
  if (r.kind === 'star') {
    const i = r.index;
    const dpc = starDistPc(i);
    const ly = dpc * PC_IN_LY;
    const ph = starPhysical(i);
    const { ra, dec } = starRaDec(i);
    const con = constellationById(stars.con[i]);
    const facts: [string, string][] = [
      ['Distanza', stars.distUnknown[i] ? 'sconosciuta' : `${fmt(ly, ly < 20 ? 2 : 0)} anni luce`],
      ['Magnitudine', starAppMag(i).toFixed(2).replace('.', ',')],
      ['Temperatura', `${fmt(Math.round(ph.T / 100) * 100)} K`],
      ['Luminosità', `${fmt(ph.L, ph.L < 10 ? 2 : 0)} × Sole`],
      ['Raggio stimato', `${fmt(ph.R, ph.R < 10 ? 2 : 0)} × Sole`],
      ['Coordinate', `AR ${(ra / 15).toFixed(2)}h · Dec ${dec.toFixed(1)}°`],
    ];
    const sp = starSpectrum(i);
    if (sp) facts.splice(2, 0, ['Tipo spettrale', sp]);
    return {
      title: starName(i), subtitle: ['Stella', starSubtitle(i), con ? `in ${con.it}` : ''].filter(Boolean).join(' · '),
      facts, desc: starDescription(ph.T, ph.R), lightYears: stars.distUnknown[i] ? undefined : ly, canFly: !stars.distUnknown[i],
    };
  }
  if (r.kind === 'messier') {
    const m = messier.find((x) => x.id === r.id)!;
    const ex = MESSIER_EXTRA[m.id];
    const facts: [string, string][] = [['Catalogo', m.id], ['Magnitudine', String(m.mag).replace('.', ',')]];
    if (ex) facts.unshift(['Distanza', `${ex.ly >= 1e6 ? fmt(ex.ly / 1e6, 2) + ' milioni di' : fmt(ex.ly)} anni luce`]);
    return { title: messierName(m), subtitle: MESSIER_TYPES[m.type] ?? 'Oggetto del profondo cielo', facts, lightYears: ex?.ly, canFly: !!ex };
  }
  if (r.kind === 'constellation') {
    const c = constellationById(r.id)!;
    return { title: c.it, subtitle: `Costellazione · ${c.la}`, facts: [['Genitivo', c.gen], ['Sigla', c.id]], desc: 'Le stelle di una costellazione sembrano vicine, ma spesso sono a distanze molto diverse: prova a guardarle dalla navicella.', canFly: false };
  }
  return { title: 'Stazione Spaziale Internazionale', subtitle: 'Satellite con equipaggio', facts: [['Quota', '≈ 420 km'], ['Velocità', '27.600 km/h'], ['Giro della Terra', '≈ 92 minuti']], desc: 'Il più grande oggetto costruito dall\'uomo nello spazio. Si vede a occhio nudo come una stella che si muove veloce, senza lampeggiare.', canFly: false };
}

function starDescription(T: number, R: number) {
  const type = T > 25000 ? 'blu e caldissima' : T > 10000 ? 'bianco-azzurra' : T > 7500 ? 'bianca' : T > 6000 ? 'bianco-gialla' : T > 5000 ? 'gialla, come il Sole' : T > 3700 ? 'arancione' : 'rossa e relativamente fredda';
  const size = R > 100 ? 'una supergigante' : R > 10 ? 'una gigante' : R < 0.6 ? 'una nana' : 'una stella di dimensioni simili al Sole';
  return `È ${size} ${type}.`;
}
