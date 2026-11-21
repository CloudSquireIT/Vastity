// Screenshot grezzi per le pagine store (iPhone 6,9" orizzontale e iPad 13"), dall'app vera.
// Uso: npx vite --port 5173 &  →  node tests/store-shots.cjs  →  store/raw/<device>-<scena>.png
const fs = require('node:fs');
const { chromium } = require('playwright');
const URL = 'http://localhost:5173/?q=high';
const OUT = 'store/raw';
fs.mkdirSync(OUT, { recursive: true });
const DEVICES = [['iphone', 1434, 660], ['ipad', 1376, 1032]];
const LANG = process.env.SHOT_LANG || 'it';
const ONLY = (process.env.SCENES || '').split(',').filter(Boolean);
const DEVS = (process.env.DEVICES || 'iphone,ipad').split(',');
const SCENES_ALL = [
  ['1-sky', `v.setTime(Date.parse('2026-08-12T20:40:00Z')); v.sky.setView(200, 22, 75);`],
  ['2-saturn', `v.setMode('ship', true); await w(800); v.ship.placeNear({kind:'body',id:'saturn'}); await w(500); v.ship.zoom = 0.22;`],
  ['3-milkyway', `v.setMode('ship', true); await w(800); v.ship.placeNear({kind:'deep',id:'milkyway'});`],
  ['4-andromeda', `v.setMode('ship', true); await w(800); v.ship.placeNear({kind:'deep',id:'m31g'});`],
  ['5-blackhole', `v.setMode('ship', true); await w(800); v.ship.placeNear({kind:'deep',id:'m87bh'});`],
  ['6-story', `v.setTime(Date.parse('2026-08-12T20:40:00Z')); v.sky.setView(150, 20, 75); await w(1500); v.sky.select({kind:'body',id:'saturn'}); await w(1200); const sh = document.querySelector('.sheet'); sh.classList.remove('peek'); await w(900); const sb = sh.querySelector('.sheet-body'); const st = sb.querySelector('.story'); if (st) sb.scrollTop = st.offsetTop - 160;`],
  ['7-exo', `v.setMode('ship', true); await w(800); const ex = await import('/src/data/exoplanets.ts'); const i = ex.exoplanets.findIndex(p => p.name === 'TRAPPIST-1 e'); v.ship.placeNear({kind:'exo',index:i});`],
];
const SCENES = ONLY.length ? SCENES_ALL.filter(([n]) => ONLY.includes(n)) : SCENES_ALL;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [dev, W, H] of DEVICES.filter(([d]) => DEVS.includes(d))) {
    for (const [name, script] of SCENES) {
      const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: LANG, hasTouch: true, isMobile: false });
      await ctx.addInitScript(() => localStorage.setItem('vastity.settings.v1', JSON.stringify({ tutorialDone: true, prologueDone: true, firstTrip: 3, sound: false })));
      const p = await ctx.newPage();
      await p.goto(URL);
      await p.waitForFunction(() => window.vastity?.sky, null, { timeout: 180000 });
      await p.waitForTimeout(3000);
      await p.evaluate(`(async () => { const v = window.vastity; const w = (ms) => new Promise(r => setTimeout(r, ms)); ${script} })()`);
      await p.waitForTimeout(9000);
      await p.addStyleTag({ content: '.toasts, .rotate-hint { display: none !important; } body.idle .top, body.idle .bottom { opacity: 1 !important; }' + (LANG === 'xx' ? ' .ui, .overlay .label, .ship-target { display: none !important; }' : '') });
      await p.waitForTimeout(600);
      await p.screenshot({ path: `${OUT}/${LANG}-${dev}-${name}.png` });
      console.log('ok', dev, name);
      await ctx.close();
    }
  }
  await b.close();
})();
