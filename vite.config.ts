import { defineConfig, Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Elenco dei file del "guscio" da salvare offline all'installazione (texture e foto si salvano all'uso). */
function precache(): Plugin {
  return {
    name: 'vastity-precache',
    apply: 'build',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist/', import.meta.url));
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const f of fs.readdirSync(dir)) {
          const p = path.join(dir, f);
          const rel = path.relative(dist, p).split(path.sep).join('/');
          if (fs.statSync(p).isDirectory()) { if (!/^(textures|photos)$/.test(rel)) walk(p); continue; }
          if (rel === 'sw.js' || rel === 'precache.json') continue;
          files.push(rel);
        }
      };
      walk(dist);
      const h = createHash('sha1');
      for (const f of files.sort()) h.update(f + fs.statSync(path.join(dist, f)).size);
      files.unshift('./');
      fs.writeFileSync(path.join(dist, 'precache.json'), JSON.stringify({ version: h.digest('hex').slice(0, 10), files }));
      // versioni dei file di dati aggiornabili (l'app confronta questo file con quello del sito)
      const ver: Record<string, string> = {};
      for (const f of ['data/exoplanets.json', 'data/deepsky.json', 'data/galaxy-photos.json']) {
        const p = path.join(dist, f);
        if (fs.existsSync(p)) ver[f] = createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 12);
      }
      fs.writeFileSync(path.join(dist, 'data/version.json'), JSON.stringify({ built: new Date().toISOString(), files: ver }));
      // le texture 4K sono incluse anche nell'app nativa: si caricano solo da vicino (wantHiRes)
    },
  };
}

// satellite.js include anche una build WebAssembly multi-thread che qui non serve:
// importiamo solo il propagatore SGP4 in JavaScript puro.
const satDir = fileURLToPath(new URL('./node_modules/satellite.js/dist/', import.meta.url));

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: [
      { find: /^satellite\.js$/, replacement: fileURLToPath(new URL('./src/vendor/satellite.ts', import.meta.url)) },
      { find: /^@satellite\//, replacement: satDir },
    ],
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  plugins: [precache()],
  server: { host: true },
});
