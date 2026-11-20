const { chromium } = require('playwright'); const fs = require('fs');
const img = 'data:image/png;base64,' + fs.readFileSync(process.argv[2]||'icon-full.png').toString('base64');
const icon = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity=".35"/></filter>
<clipPath id="sq"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath></defs>
<rect x="100" y="100" width="824" height="824" rx="185" fill="#0b1640" filter="url(#sh)"/>
<image href="${img}" x="100" y="100" width="824" height="824" clip-path="url(#sq)"/>
<rect x="100.5" y="100.5" width="823" height="823" rx="184.5" fill="none" stroke="#fff" stroke-opacity=".12"/></svg>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await p.setContent('<body style="margin:0;background:transparent">' + icon + '</body>');
await (await p.$('svg')).screenshot({ path: process.argv[3]||'icon-macos.png', omitBackground: true });
const mac = 'data:image/png;base64,' + fs.readFileSync(process.argv[3]||'icon-macos.png').toString('base64');
await p.setViewportSize({ width: 900, height: 200 });
await p.setContent('<body style="margin:0;background:linear-gradient(#2a3550,#1a2236);display:flex;gap:18px;align-items:center;justify-content:center;height:200px">' + [160,128,64,32].map(s => `<img src="${mac}" width=${s} height=${s}>`).join('') + '</body>');
await p.screenshot({ path: process.argv[4]||'dock.png' }); await b.close(); })();
