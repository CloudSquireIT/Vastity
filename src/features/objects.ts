// Riferimenti agli oggetti del cielo, ricerca e dati per la scheda informativa.
import {
  AU_IN_KM, C_KMS, LY_IN_KM, MESSIER_EXTRA, MESSIER_TYPES, PC_IN_LY, constellationById, constellations, messier,
  messierName, radecToVec, starAppMag, starDistPc, starName, starPhysical, starRaDec, starSpectrum, starSubtitle, stars,
} from '../data/catalog';
import { BODIES, SkyFrame, V3, bodyById, v3 } from '../astro/astro';
import { num, tx } from '../i18n';
import { DEEP_TYPE_NAME, deepById, deepForMessier, deepObjects } from '../data/deep';
import { GALACTIC_CENTER_PC } from '../render/background';

export type ObjRef =
  | { kind: 'body'; id: string }
  | { kind: 'star'; index: number }
  | { kind: 'messier'; id: string }
  | { kind: 'constellation'; id: string }
  | { kind: 'iss' }
  | { kind: 'deep'; id: string };

export const sameRef = (a: ObjRef | null, b: ObjRef | null) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

export function refName(r: ObjRef): string {
  switch (r.kind) {
    case 'body': return bodyById(r.id)?.name ?? r.id;
    case 'star': return starName(r.index);
    case 'messier': { const m = messier.find((x) => x.id === r.id); return m ? messierName(m) : r.id; }
    case 'constellation': return constellationById(r.id)?.name ?? r.id;
    case 'iss': return tx('Stazione Spaziale', 'Space Station', 'Station spatiale');
    case 'deep': return deepById(r.id)?.name ?? r.id;
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
  if (r.kind === 'deep') {
    const o = deepById(r.id);
    if (!o) return null;
    if (o.id === 'milkyway') return [...GALACTIC_CENTER_PC] as V3;
    return v3.scale(radecToVec(o.ra, o.dec), o.ly / PC_IN_LY);
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
    items.push({ ref: { kind: 'body', id: b.id }, name: b.name, sub: kindName(b.kind, false), key: norm(b.name + ' ' + b.id), rank: 0 });
  }
  for (const o of deepObjects()) items.push({ ref: { kind: 'deep', id: o.id }, name: o.name, sub: DEEP_TYPE_NAME(o.type, o.galaxy), key: norm(o.name + ' ' + o.id + ' ' + (o.messier ?? '') + ' ' + (messier.find((m) => m.id === o.messier)?.ngc ?? '') + ' ' + (messier.find((m) => m.id === o.messier)?.ngc ?? '').replace(' ', '') + ' ' + DEEP_TYPE_NAME(o.type, o.galaxy) + (o.id === 'milkyway' ? ' milky way voie lactee via lattea' : '')), rank: o.id === 'milkyway' ? 0.2 : 1.2 });
  items.push({ ref: { kind: 'iss' }, name: tx('Stazione Spaziale (ISS)', 'Space Station (ISS)', 'Station spatiale (ISS)'), sub: tx('Satellite', 'Satellite', 'Satellite'), key: 'iss stazione spaziale internazionale space station station spatiale', rank: 0 });
  for (const c of constellations) items.push({ ref: { kind: 'constellation', id: c.id }, name: c.name, sub: `${tx('Costellazione', 'Constellation', 'Constellation')} · ${c.la}`, key: norm(c.name + ' ' + c.la + ' ' + c.id), rank: 1 + c.rank * 0.1 });
  for (const m of messier) if (!deepForMessier(m.id)) items.push({ ref: { kind: 'messier', id: m.id }, name: messierName(m), sub: `${m.id} · ${MESSIER_TYPES[m.type] ?? tx('Oggetto', 'Object', 'Objet')}`, key: norm(messierName(m) + ' ' + m.id + ' ' + m.alt + ' ' + (m.ngc ?? '') + ' ' + (m.ngc ?? '').replace(' ', '')), rank: (m.id[0] === 'C' ? 2.3 : 2) + Math.min(m.mag, 15) * 0.01 });
  for (let i = 0; i < stars.count; i++) {
    const ni = stars.name[i];
    if (ni < 0) continue;
    const [proper, desig, hip] = stars.names[ni];
    items.push({ ref: { kind: 'star', index: i }, name: proper || desig, sub: `${tx('Stella', 'Star', 'Étoile')}${proper && desig ? ' · ' + desig : ''} · mag ${num(starAppMag(i), 1, 1)}`, key: norm(`${proper} ${desig} hip${hip}`), rank: (proper ? 1.5 : 4) + starAppMag(i) * 0.05 });
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
    C('stars', tx('Stelle', 'Stars', 'Étoiles'), '✦'),
    C('constellations', tx('Costellazioni', 'Constellations', 'Constellations'), '✧'),
    C('galaxies', tx('Galassie', 'Galaxies', 'Galaxies'), '◎'),
    C('nebulae', tx('Nebulose', 'Nebulae', 'Nébuleuses'), '☁'),
    C('clusters', tx('Ammassi stellari', 'Star clusters', 'Amas d\'étoiles'), '⁂'),
    C('exotic', tx('Buchi neri, quasar e pulsar', 'Black holes, quasars & pulsars', 'Trous noirs, quasars et pulsars'), '●'),
    C('messier', tx('Catalogo di Messier', 'Messier catalogue', 'Catalogue de Messier'), 'M'),
    C('caldwell', tx('Catalogo Caldwell', 'Caldwell catalogue', 'Catalogue de Caldwell'), 'C'),
  ];
  const by = Object.fromEntries(list.map((c) => [c.id, c]));
  for (const it of searchIndex()) {
    const r = it.ref;
    let g = '';
    if (r.kind === 'body' || r.kind === 'iss') g = 'solar';
    else if (r.kind === 'star') g = 'stars';
    else if (r.kind === 'constellation') g = 'constellations';
    else if (r.kind === 'deep') g = deepById(r.id)?.id === 'milkyway' ? 'galaxies' : DEEP_GROUP[deepById(r.id)?.type ?? ''] ?? 'nebulae';
    else if (r.kind === 'messier') g = MESSIER_GROUP[messier.find((m) => m.id === r.id)?.type ?? ''] ?? 'nebulae';
    by[g]?.items.push(it);
  }
  // cataloghi: tutti gli oggetti, anche quelli che hanno un render dedicato
  for (const m of messier) {
    const d = deepForMessier(m.id);
    const ref: ObjRef = d ? { kind: 'deep', id: d.id } : { kind: 'messier', id: m.id };
    const name = d ? d.name : messierName(m);
    const item: SearchItem = { ref, name: name === m.id ? m.id : `${m.id} · ${name}`, sub: `${MESSIER_TYPES[m.type] ?? ''}${m.ngc ? ' · ' + m.ngc : ''}`, key: norm(`${m.id} ${name} ${m.ngc ?? ''}`), rank: +m.id.slice(1) };
    (m.id[0] === 'C' ? by.caldwell : by.messier).items.push(item);
  }
  by.stars.items.sort((a, b) => a.rank - b.rank);
  by.solar.items.sort((a, b) => a.rank - b.rank);
  for (const c of [by.constellations, by.galaxies, by.nebulae, by.clusters, by.exotic]) c.items.sort((a, b) => a.name.localeCompare(b.name));
  for (const c of [by.messier, by.caldwell]) c.items.sort((a, b) => a.rank - b.rank);
  cats = list;
  return list;
}

export function filterItems(items: SearchItem[], q: string) {
  const nq = norm(q.trim());
  return nq ? items.filter((it) => it.key.includes(nq) || norm(it.name).includes(nq)) : items;
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
