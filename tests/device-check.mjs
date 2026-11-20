// Controllo multi-dispositivo: apre l'app con profili di telefoni, tablet e desktop e livelli di
// qualità diversi, visita le scene principali, salva gli screenshot e segnala:
//  - errori JavaScript o WebGL nella console;
//  - zone trasparenti del canvas (alfa < 255), che su alcuni browser appaiono come macchie nere.
// Uso: npm run build && npx vite preview --port 4173 &  →  node tests/device-check.mjs [url] [cartella]
// Browser: chromium sempre; webkit e firefox se installati (npx playwright install webkit firefox).
import fs from 'node:fs';
import { createRequire } from 'node:module';

// Playwright: dal progetto se installato, altrimenti dall'installazione globale
const require = createRequire(import.meta.url);
const { chromium, webkit, firefox, devices } = require('playwright');

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? 'test-results/devices';
fs.mkdirSync(OUT, { recursive: true });

const PROFILES = [
  ['iphone-13', devices['iPhone 13 landscape']],
  ['pixel-7', devices['Pixel 7 landscape']],
  ['ipad-pro-11', devices['iPad Pro 11 landscape']],
  ['desktop-1440', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
  ['desktop-1280', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }],
];
const QUALITIES = ['auto', 'high', 'ultra'];
const SCENES = [
  ['sky-night', `v.setTime(Date.parse('2026-07-20T22:30:00Z'))`],
  ['sky-day', `v.setTime(Date.parse('2026-07-20T10:30:00Z'))`],
  ['milky-way', `v.setMode('ship'); await w(1200); v.ship.placeNear({kind:'deep',id:'milkyway'})`],
  ['andromeda', `v.setMode('ship'); await w(1200); v.ship.placeNear({kind:'deep',id:'m31g'})`],
  ['saturn', `v.setMode('ship'); await w(1200); v.ship.placeNear({kind:'body',id:'saturn'})`],
];
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const browsers = [['chromium', chromium]];
for (const [n, b] of [['webkit', webkit], ['firefox', firefox]]) {
  try { const x = await b.launch(); await x.close(); browsers.push([n, b]); } catch { /* non installato */ }
}

let failures = 0;
const rows = [];
for (const [bn, bt] of browsers) {
  const browser = await bt.launch(bn === 'chromium' ? { args: ARGS } : {});
  for (const [pn, prof] of PROFILES) {
    for (const q of QUALITIES) {
      for (const [sn, script] of SCENES) {
        const { defaultBrowserType, ...opts } = prof;
        const ctx = await browser.newContext(opts);
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', (e) => errs.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
        await page.addInitScript(() => { localStorage.setItem('vastity.settings.v1', JSON.stringify({ tutorialDone: true })); });
        const t0 = Date.now();
        await page.goto(URL + (q === 'auto' ? '' : `?q=${q}`));
        await page.waitForFunction(() => window.vastity, null, { timeout: 120000 });
        const loadMs = Date.now() - t0;
        await page.evaluate(`(async()=>{const v=window.vastity; const w=(ms)=>new Promise(r=>setTimeout(r,ms)); ${script};})()`);
        await page.waitForTimeout(3000);
        const alpha = await page.evaluate(() => window.vastity.debugAlpha());
        const file = `${OUT}/${bn}-${pn}-${q}-${sn}.png`;
        await page.screenshot({ path: file });
        const ok = alpha === 255 && errs.length === 0;
        if (!ok) failures++;
        rows.push(`${ok ? 'OK  ' : 'FAIL'} ${bn.padEnd(8)} ${pn.padEnd(13)} ${q.padEnd(5)} ${sn.padEnd(10)} load ${String(loadMs).padStart(5)} ms · alpha ${alpha}${errs.length ? ' · ' + errs.join(' | ') : ''}`);
        console.log(rows[rows.length - 1]);
        await ctx.close();
      }
    }
  }
  await browser.close();
}
fs.writeFileSync(`${OUT}/report.txt`, rows.join('\n') + '\n');
console.log(`\n${rows.length - failures}/${rows.length} OK · screenshot e report in ${OUT}`);
process.exit(failures ? 1 : 0);
