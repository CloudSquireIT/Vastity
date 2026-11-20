# Brand Vastity

## Icona dell'app
1. `gargantua-icon.glsl`: shader (formato Shadertoy) del buco nero su cielo al tramonto.
2. `node scripts/brand/render-icon.js scripts/brand/gargantua-icon.glsl master-2048.png 2048` → render master.
3. `python3 scripts/brand/export-icons.py master-2048.png` → genera:
   - `resources/ios/AppIcon.appiconset/` (tutte le dimensioni iPhone/iPad + `Contents.json`, da copiare in `ios/App/App/Assets.xcassets/`)
   - `assets/icon-only.png` (sorgente per `npx @capacitor/assets generate`)
   - `public/icons/` (PWA 192/512/maskable, apple-touch-icon 180, favicon 16/32) e `public/favicon.ico`
4. `compose-macos-icon.js`: versione arrotondata stile macOS.

## Logo
- `brand-logo.py`: simbolo e scritta in SVG.
