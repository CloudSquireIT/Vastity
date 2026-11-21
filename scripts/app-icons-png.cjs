// Converte brand/icons/*.svg in PNG 1024×1024 (per Xcode, Android, web) con il Chromium di Playwright.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const dir = path.join(__dirname, '..', 'brand', 'icons');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.svg'))) {
    const transparent = f.endsWith('-fg.svg');
    await p.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#000'}">${fs.readFileSync(path.join(dir, f), 'utf8')}</body></html>`);
    await p.screenshot({ path: path.join(dir, f.replace('.svg', '.png')), clip: { x: 0, y: 0, width: 1024, height: 1024 }, omitBackground: transparent });
  }
  await b.close();
  console.log('ok');
})();
