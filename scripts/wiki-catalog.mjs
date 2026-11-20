// Importa da Wikipedia (CC BY-SA 4.0) le distanze del catalogo di Messier e il
// catalogo Caldwell completo con coordinate, tipo, distanza e magnitudine.
// Uso: node scripts/wiki-catalog.mjs  →  public/data/deepsky.json
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (compatible; astronomy-app-catalog-builder)';
const API = 'https://en.wikipedia.org/w/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function raw(title) {
  const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${title}: ${r.status}`);
  return r.text();
}

async function pages(titles) {
  // una pagina alla volta (action=raw), con pausa, seguendo i redirect
  const out = {};
  for (const t of titles) {
    let title = t;
    for (let hop = 0; hop < 3; hop++) {
      let w = '';
      for (let k = 0; k < 4; k++) {
        try { w = await raw(title); break; } catch { await sleep(4000 * (k + 1)); }
      }
      const red = w.match(/^#REDIRECT\s*\[\[([^\]#|]+)/i);
      await sleep(900);
      if (red) { title = red[1]; continue; }
      out[t] = w;
      break;
    }
  }
  return out;
}

const strip = (s) => s
  .replace(/^\s*style="[^"]*"\s*\|/, '').replace(/&nbsp;/g, ' ')
  .replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '')
  .replace(/\{\{(?:sdash|wbr|shy)[^}]*\}\}/g, '')
  .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/''+/g, '').replace(/\{\{[^}]*\}\}/g, '').trim();

function parseRA(s) {
  const m = s.match(/\{\{RA\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*(?:\|\s*([\d.]+))?/i);
  return m ? (+m[1] + +m[2] / 60 + (+(m[3] ?? 0)) / 3600) * 15 : NaN;
}
function parseDec(s) {
  const m = s.match(/\{\{DEC\|\s*([+\-−–]?\s*[\d.]+)\s*\|\s*([\d.]+)\s*(?:\|\s*([\d.]+))?/i);
  if (!m) return NaN;
  const sign = /[-−–]/.test(m[1]) ? -1 : 1;
  return sign * (Math.abs(parseFloat(m[1].replace(/[−–]/, '-'))) + +m[2] / 60 + (+(m[3] ?? 0)) / 3600);
}

function typeCode(t) {
  t = t.toLowerCase();
  if (t.includes('globular')) return 'gc';
  if (t.includes('open') || t.includes('cluster')) return 'oc';
  if (t.includes('planetary')) return 'pn';
  if (t.includes('supernova')) return 'snr';
  if (t.includes('dark')) return 'dn';
  if (t.includes('reflection')) return 'rn';
  if (t.includes('nebula') || t.includes('h ii') || t.includes('emission')) return 'en';
  if (t.includes('lenticular')) return 's0';
  if (t.includes('elliptical')) return 'e';
  if (t.includes('irregular')) return 'i';
  if (t.includes('galaxy') || t.includes('spiral')) return 's';
  return 'bn';
}

function rowsOf(table) {
  return table.split(/\n\|-[^\n]*/).slice(1).map((r) => r.split(/\n[|!]/).map((c) => c.trim()).filter((c, i) => i > 0 || c));
}

// --- Messier: distanze in kly ---
const mtxt = await raw('Messier object');
const mtab = mtxt.slice(mtxt.indexOf('{|class="wikitable plainrowheaders'));
const messier = {};
for (const cells of rowsOf(mtab.slice(0, mtab.indexOf('\n|}')))) {
  const id = strip(cells.find((c) => /M\d+/.test(strip(c))) ?? '').match(/M\d+/)?.[0];
  if (!id) continue;
  // colonna 6 (indice 5): distanza in kly, come {{dsv|6.5}}, {{nts|37,000}} o un numero
  const dc = cells[5] ?? '';
  const m = dc.match(/\{\{(?:dsv|nts|val)\|([\d.,]+)/) ?? strip(dc).match(/([\d.,]+)/);
  const kly = m ? parseFloat(m[1].replace(/,/g, '')) : NaN;
  const name = strip(cells[2] ?? '');
  if (isFinite(kly)) messier[id] = { ly: Math.round(kly * 1000), name: name || undefined };
}

// --- Caldwell ---
const ctxt = await raw('Caldwell catalogue');
const ctab = ctxt.slice(ctxt.indexOf('!Caldwell number'));
const cal = [];
for (const cells of rowsOf(ctab.slice(0, ctab.indexOf('\n|}')))) {
  const num = cells[0]?.match(/C(\d+)/)?.[1];
  if (!num) continue;
  const linkM = cells[1].match(/\[\[([^|\]]+)/);
  cal.push({
    id: 'C' + num,
    ngc: strip(cells[1]),
    page: linkM ? linkM[1] : strip(cells[1]),
    namePage: cells[2].match(/\[\[([^|\]]+)/)?.[1],
    name: strip(cells[2]).replace(/^-$/, ''),
    type: typeCode(strip(cells[4])),
    ly: Math.round(parseFloat(strip(cells[5]).replace(/[^\d.]/g, '')) * 1000),
    mag: parseFloat(strip(cells[7]).replace('−', '-')),
  });
}
const txt = await pages([...new Set(cal.flatMap((c) => [c.page, c.namePage].filter(Boolean)))]);
const out = [];
for (const c of cal) {
  let ra = NaN, dec = NaN;
  for (const t of [c.page, c.namePage]) {
    const w = t && txt[t];
    if (!w) continue;
    const raL = w.match(/\|\s*ra\s*=([^\n]*)/i)?.[1] ?? '';
    const decL = w.match(/\|\s*dec\s*=([^\n]*)/i)?.[1] ?? '';
    ra = parseRA(raL); dec = parseDec(decL);
    if (isFinite(ra) && isFinite(dec)) break;
  }
  if (!isFinite(ra) || !isFinite(dec)) { console.warn('senza coordinate', c.id, c.page); continue; }
  out.push({ id: c.id, alt: c.name.trim() || c.ngc, ngc: c.ngc, type: c.type, mag: isFinite(c.mag) ? c.mag : 10,
    ra: +ra.toFixed(3), dec: +dec.toFixed(3), ly: isFinite(c.ly) && c.ly > 0 ? c.ly : 5000 });
}

const file = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'data', 'deepsky.json');
fs.writeFileSync(file, JSON.stringify({ source: 'Wikipedia (CC BY-SA 4.0)', messier, caldwell: out }));
console.log('Messier con distanza:', Object.keys(messier).length, '· Caldwell:', out.length);
