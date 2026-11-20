// Esopianeti confermati dal NASA Exoplanet Archive (tabella pscomppars, dati pubblici).
// Scarica .data-src/exo.csv se manca e produce public/data/exoplanets.json (compatto).
// Uso: node scripts/build-exoplanets.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, '.data-src', 'exo.csv');
const Q = 'select+pl_name,hostname,ra,dec,sy_dist,pl_orbsmax,pl_orbper,pl_rade,pl_bmasse,pl_eqt,pl_orbeccen,st_teff,st_rad,disc_year,discoverymethod,sy_pnum+from+pscomppars';
if (!fs.existsSync(src)) {
  const r = await fetch(`https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${Q}&format=csv`);
  fs.mkdirSync(path.dirname(src), { recursive: true });
  fs.writeFileSync(src, await r.text());
}
const parse = (line) => { const r = []; let cur = '', q = false; for (const c of line) { if (q) { if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { r.push(cur); cur = ''; } else cur += c; } r.push(cur); return r; };
const lines = fs.readFileSync(src, 'utf8').trim().split(/\r?\n/);
const head = parse(lines[0]);
const ix = Object.fromEntries(head.map((h, i) => [h, i]));
const num = (v) => (v === '' || v == null ? NaN : +v);
const METHODS = ['Transit', 'Radial Velocity', 'Microlensing', 'Imaging', 'Transit Timing Variations', 'Eclipse Timing Variations', 'Orbital Brightness Modulation', 'Pulsar Timing', 'Astrometry', 'Pulsation Timing Variations', 'Disk Kinematics'];
const hosts = new Map();
const planets = [];
let skipped = 0;
for (const l of lines.slice(1)) {
  const f = parse(l);
  const ra = num(f[ix.ra]), dec = num(f[ix.dec]), dist = num(f[ix.sy_dist]);
  if (!isFinite(ra) || !isFinite(dec) || !isFinite(dist)) { skipped++; continue; }
  const teff = num(f[ix.st_teff]), srad = num(f[ix.st_rad]);
  let per = num(f[ix.pl_orbper]), a = num(f[ix.pl_orbsmax]), rade = num(f[ix.pl_rade]), mass = num(f[ix.pl_bmasse]), eqt = num(f[ix.pl_eqt]);
  if (!isFinite(a) && isFinite(per)) a = Math.cbrt((per / 365.25) ** 2); // Keplero con massa solare
  if (!isFinite(a)) { skipped++; continue; }
  if (!isFinite(per)) per = 365.25 * Math.sqrt(a ** 3);
  // raggio dalla massa (relazione massa-raggio semplificata) se manca
  if (!isFinite(rade) && isFinite(mass)) rade = mass < 2 ? Math.pow(mass, 0.28) : mass < 130 ? 0.8 * Math.pow(mass, 0.59) : 11.5;
  if (!isFinite(rade)) rade = 1.5;
  // temperatura di equilibrio dalla stella se manca
  if (!isFinite(eqt) && isFinite(teff) && isFinite(srad)) eqt = teff * Math.sqrt((srad * 0.00465) / (2 * a)) * 0.9;
  if (!isFinite(eqt)) eqt = 300;
  const host = f[ix.hostname];
  if (!hosts.has(host)) hosts.set(host, [host, +ra.toFixed(4), +dec.toFixed(4), +dist.toFixed(3), isFinite(teff) ? Math.round(teff) : 5500, isFinite(srad) ? +srad.toFixed(3) : 1]);
  const hi = [...hosts.keys()].indexOf(host);
  planets.push([f[ix.pl_name], hi, +a.toPrecision(4), +per.toPrecision(5), +rade.toPrecision(3), isFinite(mass) ? +mass.toPrecision(3) : -1, Math.round(eqt), +(num(f[ix.pl_orbeccen]) || 0).toFixed(3), +f[ix.disc_year] || 0, Math.max(0, METHODS.indexOf(f[ix.discoverymethod]))]);
}
const out = { source: 'NASA Exoplanet Archive (pscomppars)', methods: METHODS,
  hostFields: ['name', 'ra', 'dec', 'distPc', 'teff', 'radiusSun'], planetFields: ['name', 'host', 'aAU', 'periodD', 'radiusEarth', 'massEarth', 'eqTempK', 'ecc', 'year', 'method'],
  hosts: [...hosts.values()], planets };
fs.writeFileSync(path.join(root, 'public', 'data', 'exoplanets.json'), JSON.stringify(out));
console.log('Esopianeti:', planets.length, '· stelle ospiti:', hosts.size, '· scartati (dati mancanti):', skipped);
