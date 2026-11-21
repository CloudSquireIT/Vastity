// Effemeridi da NASA/JPL Horizons per lune e veicoli spaziali → public/data/ephem.json
// - lune: elementi orbitali osculanti (rispetto al centro del pianeta, piano ICRF/EQJ) a un'epoca;
//   l'app li propaga come orbite kepleriane (precisione di qualche grado su pochi anni)
// - veicoli nello spazio profondo: posizione e velocità eliocentriche EQJ ogni N giorni 2025–2031;
//   l'app interpola con spline di Hermite
// Uso: NODE_USE_ENV_PROXY=1 node scripts/build-ephem.mjs
import fs from 'node:fs';
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const EPOCH = '2026-11-21';
async function hz(params) {
  const q = new URLSearchParams({ format: 'json', OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", ...params });
  for (let k = 0; k < 5; k++) {
    try { const j = await (await fetch(API + '?' + q)).json(); if (j.result?.includes('$$SOE')) return j.result; throw new Error(j.result?.slice(0, 300) || 'vuoto'); }
    catch (e) { if (k === 4) throw e; await new Promise((r) => setTimeout(r, 2000 * (k + 1))); }
  }
}
const block = (t) => t.slice(t.indexOf('$$SOE') + 5, t.indexOf('$$EOE')).trim();
// [id, nome, pianeta, codice pianeta, raggio km]
const MOONS = [
  ['phobos', 'Phobos', 'mars', 499, 11.3], ['deimos', 'Deimos', 'mars', 499, 6.2],
  ['io', 'Io', 'jupiter', 599, 1821.6], ['europa', 'Europa', 'jupiter', 599, 1560.8], ['ganymede', 'Ganymede', 'jupiter', 599, 2634.1], ['callisto', 'Callisto', 'jupiter', 599, 2410.3],
  ['mimas', 'Mimas', 'saturn', 699, 198.2], ['enceladus', 'Enceladus', 'saturn', 699, 252.1], ['tethys', 'Tethys', 'saturn', 699, 531.1], ['dione', 'Dione', 'saturn', 699, 561.4],
  ['rhea', 'Rhea', 'saturn', 699, 763.8], ['titan', 'Titan', 'saturn', 699, 2574.7], ['iapetus', 'Iapetus', 'saturn', 699, 734.5],
  ['miranda', 'Miranda', 'uranus', 799, 235.8], ['ariel', 'Ariel', 'uranus', 799, 578.9], ['umbriel', 'Umbriel', 'uranus', 799, 584.7], ['titania', 'Titania', 'uranus', 799, 788.4], ['oberon', 'Oberon', 'uranus', 799, 761.4],
  ['triton', 'Triton', 'neptune', 899, 1353.4], ['charon', 'Charon', 'pluto', 999, 606],
];
const CODES = { phobos: 401, deimos: 402, io: 501, europa: 502, ganymede: 503, callisto: 504, mimas: 601, enceladus: 602, tethys: 603, dione: 604, rhea: 605, titan: 606, iapetus: 608, miranda: 705, ariel: 701, umbriel: 702, titania: 703, oberon: 704, triton: 801, charon: 901 };
// [id, nome, codice Horizons, passo in giorni]
const CRAFT = [['tesla', 'Tesla Roadster', '-143205', 4], ['jwst', 'James Webb', '-170', 2], ['voyager1', 'Voyager 1', '-31', 30], ['voyager2', 'Voyager 2', '-32', 30], ['newhorizons', 'New Horizons', '-98', 20], ['parker', 'Parker Solar Probe', '-96', 1]];

const out = { epoch: EPOCH + 'T00:00:00Z', moons: [], craft: [] };
for (const [id, name, planet, pc, r] of MOONS) {
  const t = await hz({ COMMAND: `'${CODES[id]}'`, EPHEM_TYPE: "'ELEMENTS'", CENTER: `'500@${pc}'`, REF_PLANE: "'FRAME'", TLIST: `'${EPOCH}'`, OUT_UNITS: "'KM-S'", CSV_FORMAT: "'YES'" });
  // JDTDB, data, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR
  const f = block(t).split(',').map((s) => s.trim());
  const [EC, QR, IN, OM, W, Tp, N, MA, TA, A] = f.slice(2, 12).map(Number);
  out.moons.push({ id, name, planet, r, e: EC, a: A, i: IN, node: OM, peri: W, M: MA, n: N });
  console.log('luna', name, A.toFixed(0), 'km');
}
for (const [id, name, code, step] of CRAFT) {
  const t = await hz({ COMMAND: `'${code}'`, EPHEM_TYPE: "'VECTORS'", CENTER: "'500@10'", REF_PLANE: "'FRAME'", START_TIME: "'2025-01-01'", STOP_TIME: "'2031-01-01'", STEP_SIZE: `'${step} d'`, OUT_UNITS: "'KM-S'", VEC_TABLE: "'2'", CSV_FORMAT: "'YES'" }).catch((e) => { console.log('salto', name, String(e).slice(0, 120)); return null; });
  if (!t) continue;
  const rows = block(t).split('\n').map((l) => l.split(',').map((s) => s.trim()));
  const jd0 = +rows[0][0];
  const data = [];
  for (const r of rows) data.push(...r.slice(2, 8).map((v) => Math.round(+v * 1000) / 1000));
  out.craft.push({ id, name, jd0, step, n: rows.length, data });
  console.log('veicolo', name, rows.length, 'punti');
}
fs.writeFileSync('public/data/ephem.json', JSON.stringify(out));
console.log('ok', (fs.statSync('public/data/ephem.json').size / 1024).toFixed(0), 'KB');
