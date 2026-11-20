// Converte i cataloghi sorgente in file JSON compatti per l'app.
// Sorgenti (scaricate in .data-src/ se mancanti):
//  - HYG Database v4.1 (CC BY-SA 4.0) — https://codeberg.org/astronexus/hyg
//  - d3-celestial data (BSD-3-Clause) — https://github.com/ofrohn/d3-celestial
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, '.data-src');
const out = path.join(root, 'public', 'data');
fs.mkdirSync(src, { recursive: true });
fs.mkdirSync(out, { recursive: true });

const HYG_URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv';
const CEL_URL = 'https://registry.npmjs.org/d3-celestial/-/d3-celestial-0.7.35.tgz';

async function download(url, file) {
  if (fs.existsSync(file)) return;
  console.log('Scarico', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const hygFile = path.join(src, 'hygdata_v41.csv');
const celTgz = path.join(src, 'd3-celestial.tgz');
await download(HYG_URL, hygFile);
await download(CEL_URL, celTgz);
const celDir = path.join(src, 'celestial');
if (!fs.existsSync(celDir)) {
  fs.mkdirSync(celDir);
  execSync(`tar xzf "${celTgz}" -C "${celDir}"`);
}
const celData = (f) => JSON.parse(fs.readFileSync(path.join(celDir, 'package', 'data', f), 'utf8'));

// --- CSV parser minimale (campi con virgolette) ---
function parseCSVLine(line) {
  const r = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { r.push(cur); cur = ''; }
    else cur += c;
  }
  r.push(cur);
  return r;
}

const GREEK = { Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ', Eta: 'η', The: 'θ', Iot: 'ι', Kap: 'κ', Lam: 'λ', Mu: 'μ', Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π', Rho: 'ρ', Sig: 'σ', Tau: 'τ', Ups: 'υ', Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω' };

const lines = fs.readFileSync(hygFile, 'utf8').split(/\r?\n/);
const header = parseCSVLine(lines[0]);
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const rows = [];
const names = [];
for (let li = 2; li < lines.length; li++) { // salta il Sole (riga 1)
  if (!lines[li]) continue;
  const f = parseCSVLine(lines[li]);
  const mag = parseFloat(f[idx.mag]);
  let dist = parseFloat(f[idx.dist]);
  if (!(mag <= 9.0 || dist < 25)) continue;
  const unknown = !(dist > 0) || dist >= 100000;
  const ra = parseFloat(f[idx.rarad]);
  const dec = parseFloat(f[idx.decrad]);
  if (unknown) dist = 1000;
  const x = dist * Math.cos(dec) * Math.cos(ra);
  const y = dist * Math.cos(dec) * Math.sin(ra);
  const z = dist * Math.sin(dec);
  const absmag = mag - 5 * Math.log10(dist) + 5;
  let ci = parseFloat(f[idx.ci]);
  if (!isFinite(ci)) ci = 0.6;
  const proper = f[idx.proper];
  const bayer = f[idx.bayer];
  const flam = f[idx.flam];
  const con = f[idx.con];
  let desig = '';
  if (bayer) {
    const m = bayer.match(/^([A-Za-z]+)(-?\d*)$/);
    desig = (GREEK[m?.[1]] ?? bayer) + (m?.[2] ? m[2].replace('-', '') : '') + ' ' + con;
  } else if (flam) desig = flam + ' ' + con;
  // ogni stella ha almeno una designazione di catalogo cercabile (HD, HIP o Gliese)
  if (!desig) desig = f[idx.hd] ? 'HD ' + f[idx.hd] : f[idx.hip] ? 'HIP ' + f[idx.hip] : f[idx.gl] ? f[idx.gl].replace(/^Gl\s*/, 'Gliese ') : '';
  let nameIdx = -1;
  if (proper || desig) {
    nameIdx = names.length;
    names.push([proper ?? '', desig, f[idx.hip] || '', f[idx.spect] || '']);
  }
  rows.push([
    +x.toFixed(4), +y.toFixed(4), +z.toFixed(4),
    +absmag.toFixed(2), +ci.toFixed(2), nameIdx, con || '', unknown ? 1 : 0,
  ]);
}
// Ordina per magnitudine apparente (le più luminose prima: utile per le etichette)
const appMag = (r) => r[3] + 5 * Math.log10(Math.max(Math.hypot(r[0], r[1], r[2]), 1e-6)) - 5;
rows.sort((a, b) => appMag(a) - appMag(b));
// le 50.000 stelle più luminose, più tutte le stelle vicine (entro 25 pc)
const MAX_STARS = 50000;
const near = rows.slice(MAX_STARS).filter((r) => Math.hypot(r[0], r[1], r[2]) < 25);
rows.splice(MAX_STARS);
rows.push(...near);
// rinumera i nomi usati dalle stelle tenute
const used = [];
const remap = new Map();
for (const r of rows) {
  if (r[5] < 0) continue;
  if (!remap.has(r[5])) { remap.set(r[5], used.length); used.push(names[r[5]]); }
  r[5] = remap.get(r[5]);
}
names.length = 0;
names.push(...used);
for (const r of rows) { r[0] = +r[0].toFixed(3); r[1] = +r[1].toFixed(3); r[2] = +r[2].toFixed(3); }
// formato binario compatto (caricamento e lettura molto più rapidi del JSON):
// Float32 x,y,z,absmag,ci per stella · Int32 indice del nome · Uint8 costellazione · Uint8 distanza ignota
const N = rows.length;
const conList = [...new Set(rows.map((r) => r[6]).filter(Boolean))].sort();
const conIdx = new Map(conList.map((c, i) => [c, i + 1]));
const buf = Buffer.alloc(N * 20 + N * 4 + N * 2);
const f32 = new Float32Array(buf.buffer, buf.byteOffset, N * 5);
const i32 = new Int32Array(buf.buffer, buf.byteOffset + N * 20, N);
const u8 = new Uint8Array(buf.buffer, buf.byteOffset + N * 24, N * 2);
rows.forEach((r, i) => {
  f32.set([r[0], r[1], r[2], r[3], r[4]], i * 5);
  i32[i] = r[5];
  u8[i] = conIdx.get(r[6]) ?? 0;
  u8[N + i] = r[7];
});
fs.writeFileSync(path.join(out, 'stars.bin'), buf);
fs.writeFileSync(path.join(out, 'stars-meta.json'), JSON.stringify({ count: N, cons: conList, names }));
if (fs.existsSync(path.join(out, 'stars.json'))) fs.unlinkSync(path.join(out, 'stars.json'));
console.log('Stelle:', rows.length, 'con nome:', names.length);

// --- Costellazioni ---
const cLines = celData('constellations.lines.json');
const cInfo = celData('constellations.json');
const cons = {};
for (const ft of cInfo.features) {
  cons[ft.id] = { it: ft.properties.it || ft.properties.name, en: ft.properties.name, fr: ft.properties.fr || ft.properties.name, la: ft.properties.name, gen: ft.properties.gen, rank: +ft.properties.rank, c: ft.geometry.coordinates.map((v) => +(+v).toFixed(2)), lines: [] };
}
for (const ft of cLines.features) {
  if (!cons[ft.id]) continue;
  cons[ft.id].lines = ft.geometry.coordinates.map((ln) => ln.map(([ra, dec]) => [+((ra + 360) % 360).toFixed(3), +dec.toFixed(3)]));
}
fs.writeFileSync(path.join(out, 'constellations.json'), JSON.stringify(cons));
console.log('Costellazioni:', Object.keys(cons).length);

// --- Oggetti di Messier ---
const mess = celData('messier.json').features.map((ft) => ({
  id: ft.id, alt: ft.properties.alt, type: ft.properties.type, mag: ft.properties.mag,
  ra: +(((ft.geometry.coordinates[0] + 360) % 360).toFixed(3)), dec: +ft.geometry.coordinates[1].toFixed(3),
}));
fs.writeFileSync(path.join(out, 'messier.json'), JSON.stringify(mess));
console.log('Messier:', mess.length);
