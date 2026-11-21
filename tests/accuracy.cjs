// Verifica di precisione: confronta altezza/azimut calcolati dalla pipeline di Vastity (astro.ts:
// skyFrame + eqjToHor, cioè ciò che si vede sullo schermo) con le effemeridi NASA/JPL Horizons,
// per Sole, Luna e pianeti, da tre città e in otto istanti tra 2026 e 2027. Controlla anche alba e
// tramonto del Sole e gli istanti delle eclissi contro i valori pubblicati dalla NASA.
// Uso: npx vite --port 5173 &  →  NODE_USE_ENV_PROXY=1 node tests/accuracy.cjs [url]
const fs = require('node:fs');
const { chromium } = require('playwright');
const URL = process.argv[2] ?? 'http://localhost:5173/?q=low';

const SITES = [['Roma', 41.9028, 12.4964, 30], ['Sydney', -33.8688, 151.2093, 20], ['New York', 40.7128, -74.006, 10]];
const TIMES = ['2026-01-15T21:00Z', '2026-03-20T04:30Z', '2026-05-05T18:00Z', '2026-07-21T23:00Z', '2026-09-09T02:15Z', '2026-11-21T20:00Z', '2027-02-14T12:00Z', '2027-06-30T09:45Z'];
const BODIES = [['sun', '10'], ['moon', '301'], ['mercury', '199'], ['venus', '299'], ['mars', '499'], ['jupiter', '599'], ['saturn', '699'], ['uranus', '799'], ['neptune', '899'], ['pluto', '999']];

async function horizons(cmd, lat, lon, hkm, times) {
  const q = new URLSearchParams({
    format: 'json', COMMAND: `'${cmd}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@399'", COORD_TYPE: "'GEODETIC'", SITE_COORD: `'${lon},${lat},${hkm}'`, TIME_TYPE: "'UT'",
    TLIST: times.map((t) => `'${t.replace('T', ' ').replace('Z', '')}'`).join(' '), QUANTITIES: "'4'", ANG_FORMAT: "'DEG'", EXTRA_PREC: "'YES'",
  });
  for (let k = 0; k < 4; k++) {
    try {
      const r = await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + q);
      const j = await r.json();
      const txt = j.result;
      const block = txt.slice(txt.indexOf('$$SOE') + 5, txt.indexOf('$$EOE')).trim().split('\n');
      return block.map((l) => { const n = l.trim().split(/\s+/).filter((x) => /^-?\d+(\.\d+)?$/.test(x)).map(Number); return { az: n[n.length - 2], alt: n[n.length - 1] }; });
    } catch (e) { await new Promise((r) => setTimeout(r, 1500 * (k + 1))); }
  }
  throw new Error('Horizons non raggiungibile');
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.addInitScript(() => localStorage.setItem('vastity.settings.v1', JSON.stringify({ tutorialDone: true, prologueDone: true, firstTrip: 3 })));
  await p.goto(URL);
  await p.waitForFunction(() => window.vastity?.state, null, { timeout: 120000 });
  const rows = [];
  for (const [site, lat, lon, h] of SITES) {
    const app = await p.evaluate(async ({ lat, lon, h, TIMES, BODIES }) => {
      const astro = await import('/src/astro/astro.ts');
      const st = window.vastity.state;
      st.location = { ...st.location, lat, lon, height: h };
      const out = {};
      for (const t of TIMES) {
        const d = new Date(t);
        const f = astro.skyFrame({ id: 'earth' }, d);
        for (const [id] of BODIES) { const bb = f.bodies.find((x) => x.id === id); out[id + '|' + t] = astro.eqjToHor(bb.dir, d); }
      }
      return out;
    }, { lat, lon, h, TIMES, BODIES });
    for (const [id, cmd] of BODIES) {
      const ref = await horizons(cmd, lat, lon, h / 1000, TIMES);
      TIMES.forEach((t, i) => {
        const a = app[id + '|' + t], r = ref[i];
        const dAlt = a.alt - r.alt;
        let dAz = ((a.az - r.az + 540) % 360) - 180;
        const sep = Math.hypot(dAlt, dAz * Math.cos(r.alt * Math.PI / 180)) * 3600;
        rows.push({ site, id, t, alt: r.alt, az: r.az, sepArcsec: sep });
      });
    }
  }
  // alba e tramonto del Sole a Roma, come li calcola l'app: in quell'istante JPL deve dare il bordo
  // superiore del Sole sull'orizzonte (centro a circa −0,27° di altezza con la rifrazione)
  const rts = await (async () => {
    const A = require('astronomy-engine');
    const obs = new A.Observer(41.9028, 12.4964, 0);
    const out = [];
    for (const d of ['2026-03-20', '2026-06-21', '2026-09-23', '2026-12-21']) {
      const t0 = new Date(d + 'T00:00:00Z');
      out.push({ ev: 'alba ' + d, t: A.SearchRiseSet(A.Body.Sun, obs, +1, t0, 1).date.toISOString() });
      out.push({ ev: 'tramonto ' + d, t: A.SearchRiseSet(A.Body.Sun, obs, -1, t0, 1).date.toISOString() });
    }
    // eclissi come le trova l'app (alerts.ts)
    const le1 = A.SearchLunarEclipse(new Date('2026-01-01'));
    const le2 = A.NextLunarEclipse(le1.peak);
    const se = A.SearchGlobalSolarEclipse(new Date('2026-06-01'));
    return { out, ecl: [['Eclissi totale di Luna 3/3/2026', le1.peak.date.toISOString()], ['Eclissi parziale di Luna 28/8/2026', le2.peak.date.toISOString()], ['Eclissi totale di Sole 12/8/2026', se.peak.date.toISOString()]] };
  })();
  const tl = rts.out.map((x) => x.t.slice(0, 19).replace('T', ' '));
  const q = new URLSearchParams({ format: 'json', COMMAND: "'10'", OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'", CENTER: "'coord@399'", COORD_TYPE: "'GEODETIC'", SITE_COORD: "'12.4964,41.9028,0'", TIME_TYPE: "'UT'", TLIST: tl.map((t) => `'${t}'`).join(' '), QUANTITIES: "'4'", ANG_FORMAT: "'DEG'", APPARENT: "'REFRACTED'", EXTRA_PREC: "'YES'" });
  const txt = (await (await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + q)).json()).result;
  const elev = txt.slice(txt.indexOf('$$SOE') + 5, txt.indexOf('$$EOE')).trim().split('\n').map((l) => { const n = l.trim().split(/\s+/).filter((x) => /^-?\d+(\.\d+)?$/.test(x)).map(Number); return n[n.length - 1]; });
  // pendenza dell'altezza del Sole all'alba a Roma ≈ 0,13–0,16 °/min → scarto in secondi
  const rise = rts.out.map((x, i) => ({ evento: x.ev, ora_app_UT: x.t.slice(11, 19), alt_JPL: elev[i].toFixed(3), scarto_s: Math.round(((elev[i] + 0.27) / 0.14) * 60) }));
  console.log('Alba e tramonto del Sole a Roma (app) — altezza del centro secondo JPL (atteso ≈ −0,27°):');
  console.table(rise);
  // istanti di massimo pubblicati dalla NASA (Five Millennium Canon, Espenak), in UT
  const NASA = ['2026-03-03T11:33', '2026-08-28T04:13', '2026-08-12T17:46'];
  const ecl = rts.ecl.map(([n, t], i) => ({ evento: n, app_UT: t.slice(0, 16).replace('T', ' '), NASA_UT: NASA[i].replace('T', ' '), scarto_min: Math.round((Date.parse(t) - Date.parse(NASA[i] + ':00Z')) / 60000) }));
  console.log('Eclissi: istante del massimo, app vs NASA:');
  console.table(ecl);
  const badRise = rise.filter((r) => Math.abs(r.scarto_s) > 60);
  const badEcl = ecl.filter((r) => Math.abs(r.scarto_min) > 2);
  const bad = rows.filter((r) => r.alt > -2 && r.sepArcsec > 60);
  const by = {};
  for (const r of rows) { (by[r.id] ??= []).push(r.sepArcsec); }
  const summary = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { max: Math.max(...v).toFixed(1), median: v.sort((a, b) => a - b)[v.length >> 1].toFixed(1) }]));
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/accuracy.json', JSON.stringify({ summary, rise, ecl, rows }, null, 1));
  console.log('Scarto (secondi d\'arco) app vs JPL Horizons, per corpo:');
  console.table(summary);
  console.log(bad.length ? `ATTENZIONE: ${bad.length} posizioni sopra l'orizzonte con scarto > 60"` : 'OK: tutte le posizioni entro 60" (1 minuto d\'arco)');
  await b.close();
  process.exit(bad.length || badRise.length || badEcl.length ? 1 : 0);
})();
