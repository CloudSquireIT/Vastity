import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// satellite.js include anche una build WebAssembly multi-thread che qui non serve:
// importiamo solo il propagatore SGP4 in JavaScript puro.
const satDir = fileURLToPath(new URL('./node_modules/satellite.js/dist/', import.meta.url));

export default defineConfig({
  base: './',
  resolve: {
    alias: [
      { find: /^satellite\.js$/, replacement: fileURLToPath(new URL('./src/vendor/satellite.ts', import.meta.url)) },
      { find: /^@satellite\//, replacement: satDir },
    ],
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: { host: true },
});
