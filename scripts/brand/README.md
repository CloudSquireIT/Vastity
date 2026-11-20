# Brand Vastity

- `brand-logo.py`: genera simbolo e scritta in SVG (`python3 brand-logo.py ../../public/brand <space-grotesk.woff2>`).
- `gargantua-icon.glsl`: shader (formato Shadertoy) del buco nero con lente gravitazionale usato per l'icona dell'app.
  Costanti principali: `ZOOM` (grandezza), `INCLINATION` (inclinazione del disco), `BEAMING` (asimmetria di luce), `EXPOSURE`.
- `render-icon.js`: `node render-icon.js gargantua-icon.glsl vastity-app-icon.png 1024` → icona quadrata piena (iOS/Android/PWA).
- `compose-macos-icon.js`: da `icon-full.png` crea la versione arrotondata stile macOS e un'anteprima del Dock.
