// Immagine dell'oggetto nella scheda: foto reale (NASA/ESA/ESO via Wikimedia Commons)
// oppure un render generico disegnato al volo in base al tipo di oggetto.
import { ObjRef } from '../features/objects';
import { exoTexture, exoplanets } from '../data/exoplanets';
import { constellationById, messier, radecToVec, starPhysical } from '../data/catalog';
import { rng } from '../render/background';
import { deepById } from '../data/deep';
import { tempColor } from '../render/planet';

const PHOTOS = new Set([
  'sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'iss',
  'M1', 'M8', 'M13', 'M16', 'M17', 'M20', 'M27', 'M31', 'M33', 'M42', 'M45', 'M51', 'M57', 'M64', 'M81', 'M82', 'M87', 'M101', 'M104',
]);

function photoId(r: ObjRef): string | null {
  if (r.kind === 'deep') return deepById(r.id)?.messier ?? null;
  if (r.kind === 'body') return r.id;
  if (r.kind === 'iss') return 'iss';
  if (r.kind === 'messier') return r.id;
  return null;
}

const SIZE = 240;

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  g.fillStyle = '#05070f';
  g.fillRect(0, 0, SIZE, SIZE);
  return { c, g };
}

const css = (r: number, g: number, b: number, a = 1) => `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: [number, number, number], a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, css(...col, a));
  gr.addColorStop(1, css(...col, 0));
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

function starfield(g: CanvasRenderingContext2D, r: () => number, n = 70) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(220,230,255,${0.2 + r() * 0.6})`;
    g.fillRect(r() * SIZE, r() * SIZE, r() < 0.9 ? 1 : 2, r() < 0.9 ? 1 : 2);
  }
}

/** Stella disegnata in base a temperatura e raggio: nane rosse, nane bianche, giganti, supergiganti. */
function drawStar(index: number) {
  const { c, g } = canvas();
  const r = rng(index + 1);
  starfield(g, r, 50);
  const ph = starPhysical(index);
  const col = tempColor(ph.T);
  const rgb: [number, number, number] = [col.r, col.g, col.b];
  const cx = SIZE / 2, cy = SIZE / 2;
  const isWhiteDwarf = ph.R < 0.05;
  const rad = isWhiteDwarf ? 14 : Math.max(26, Math.min(82, 34 + Math.log10(Math.max(ph.R, 0.08)) * 22));
  glow(g, cx, cy, rad * (isWhiteDwarf ? 5 : 2.4), rgb, 0.45);
  // disco con bordo più scuro
  const disc = g.createRadialGradient(cx - rad * 0.2, cy - rad * 0.2, rad * 0.1, cx, cy, rad);
  disc.addColorStop(0, css(Math.min(1, rgb[0] * 1.1 + 0.25), Math.min(1, rgb[1] * 1.1 + 0.25), Math.min(1, rgb[2] * 1.1 + 0.25)));
  disc.addColorStop(0.75, css(...rgb));
  disc.addColorStop(1, css(rgb[0] * 0.6, rgb[1] * 0.45, rgb[2] * 0.4));
  g.fillStyle = disc;
  g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
  // granulazione e macchie
  if (!isWhiteDwarf) {
    g.save();
    g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.clip();
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad;
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
      g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + r() * rad * 0.08, 0, Math.PI * 2); g.fill();
    }
    if (ph.T < 4000) for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2, d = r() * rad * 0.7;
      g.fillStyle = 'rgba(40,10,0,0.25)';
      g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rad * (0.08 + r() * 0.12), 0, Math.PI * 2); g.fill();
    }
    g.restore();
  } else {
    // punte di diffrazione per le nane bianche, piccole e luminosissime
    g.strokeStyle = css(...rgb, 0.5);
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(cx - 70, cy); g.lineTo(cx + 70, cy); g.moveTo(cx, cy - 70); g.lineTo(cx, cy + 70); g.stroke();
  }
  return c;
}

function drawMessier(type: string, seed: number) {
  const { c, g } = canvas();
  const r = rng(seed);
  starfield(g, r, 60);
  const cx = SIZE / 2, cy = SIZE / 2;
  if (type === 'gc') {
    glow(g, cx, cy, 70, [1, 0.9, 0.7], 0.5);
    for (let i = 0; i < 900; i++) {
      const a = r() * Math.PI * 2, d = Math.abs((r() + r() + r() - 1.5)) * 55;
      g.fillStyle = `rgba(255,${220 + r() * 35},${170 + r() * 60},${0.4 + r() * 0.6})`;
      g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.4, 1.4);
    }
  } else if (type === 'oc' || type === 'ast' || type === 'pos' || type === 'ds') {
    for (let i = 0; i < 40; i++) {
      const x = cx + (r() - 0.5) * 150, y = cy + (r() - 0.5) * 150;
      const s = 1 + r() * 3.5;
      glow(g, x, y, s * 4, [0.75, 0.85, 1], 0.6);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, s * 0.6, 0, Math.PI * 2); g.fill();
    }
  } else if (['s', 'sg', 'sd', 's0', 'i', 'e'].includes(type)) {
    g.save();
    g.translate(cx, cy); g.rotate(r() * Math.PI); g.scale(1, type === 'e' ? 0.7 : 0.45);
    glow(g, 0, 0, 100, [0.75, 0.8, 1], 0.35);
    if (type !== 'e') for (let i = 0; i < 1400; i++) {
      const arm = i % 2, t = r() * 4.2;
      const a = t + arm * Math.PI + (r() - 0.5) * 0.5, d = 8 + t * 22;
      g.fillStyle = r() < 0.07 ? 'rgba(255,140,170,0.7)' : 'rgba(190,210,255,0.5)';
      g.fillRect(Math.cos(a) * d, Math.sin(a) * d, 1.6, 1.6);
    }
    glow(g, 0, 0, 34, [1, 0.88, 0.65], 0.95);
    g.restore();
  } else {
    // nebulose: nubi colorate stratificate
    const palettes: [number, number, number][][] = [
      [[1, 0.3, 0.45], [0.3, 0.75, 0.85], [1, 0.75, 0.5]],
      [[0.35, 0.9, 0.85], [1, 0.4, 0.35], [0.6, 0.5, 1]],
    ];
    const pal = palettes[type === 'pn' ? 1 : 0];
    for (let i = 0; i < 46; i++) {
      const col = pal[Math.floor(r() * pal.length)];
      glow(g, cx + (r() - 0.5) * 130, cy + (r() - 0.5) * 130, 20 + r() * 55, col, 0.18 + r() * 0.2);
    }
    if (type === 'pn') { g.strokeStyle = 'rgba(160,240,230,0.6)'; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, 40, 0, Math.PI * 2); g.stroke(); }
  }
  return c;
}

/** Figura della costellazione con le sue linee. */
function drawConstellation(id: string) {
  const { c, g } = canvas();
  const con = constellationById(id);
  if (!con) return c;
  const center = radecToVec(con.c[0], con.c[1]);
  const up: [number, number, number] = [0, 0, 1];
  const e = norm(cross(up, center));
  const n = cross(center, e);
  const pts: [number, number][][] = con.lines.map((ln) => ln.map(([ra, dec]) => {
    const v = radecToVec(ra, dec);
    const d = dot(v, center);
    return [-dot(v, e) / d, -dot(v, n) / d];
  }));
  const all = pts.flat();
  const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
  const s = (SIZE - 50) / Math.max(maxX - minX, maxY - minY, 1e-3);
  const ox = SIZE / 2 - ((minX + maxX) / 2) * s, oy = SIZE / 2 - ((minY + maxY) / 2) * s;
  starfield(g, rng(id.length * 31), 40);
  g.strokeStyle = 'rgba(148,163,184,0.75)';
  g.lineWidth = 1.6;
  for (const ln of pts) {
    g.beginPath();
    ln.forEach(([x, y], i) => (i ? g.lineTo(x * s + ox, y * s + oy) : g.moveTo(x * s + ox, y * s + oy)));
    g.stroke();
  }
  for (const [x, y] of all) { glow(g, x * s + ox, y * s + oy, 7, [0.85, 0.9, 1], 0.9); g.fillStyle = '#fff'; g.beginPath(); g.arc(x * s + ox, y * s + oy, 1.8, 0, Math.PI * 2); g.fill(); }
  return c;
}

/** Buchi neri (ombra, anello di fotoni, disco), quasar con getti, pulsar con fasci. */
function drawExotic(type: string, seed: number) {
  const { c, g } = canvas();
  const r = rng(seed);
  starfield(g, r, 60);
  const cx = SIZE / 2, cy = SIZE / 2;
  if (type === 'pulsar') {
    glow(g, cx, cy, 90, [0.35, 0.5, 1], 0.35);
    g.save(); g.translate(cx, cy); g.rotate(-0.5);
    for (const s of [-1, 1]) {
      const gr = g.createLinearGradient(0, 0, 0, s * 115);
      gr.addColorStop(0, 'rgba(200,225,255,0.9)'); gr.addColorStop(1, 'rgba(120,170,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-3, 0); g.lineTo(-22, s * 115); g.lineTo(22, s * 115); g.lineTo(3, 0); g.fill();
    }
    g.restore();
    glow(g, cx, cy, 16, [1, 1, 1], 1);
    return c;
  }
  g.save(); g.translate(cx, cy); g.scale(1, 0.32);
  for (let i = 0; i < 3; i++) glow(g, 0, 0, 105 - i * 25, i ? [1, 0.75, 0.4] : [1, 0.5, 0.2], 0.55);
  g.restore();
  // anello di luce piegato sopra l'ombra
  g.strokeStyle = 'rgba(255,200,140,0.75)'; g.lineWidth = 6;
  g.beginPath(); g.ellipse(cx, cy - 6, 44, 38, 0, Math.PI, 0); g.stroke();
  g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,235,200,0.95)'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, 36, 0, Math.PI * 2); g.stroke();
  if (type === 'quasar') {
    for (const s of [-1, 1]) {
      const gr = g.createLinearGradient(cx, cy, cx, cy + s * 120);
      gr.addColorStop(0, 'rgba(170,200,255,0.9)'); gr.addColorStop(1, 'rgba(120,160,255,0)');
      g.fillStyle = gr; g.fillRect(cx - 4, s > 0 ? cy : cy - 120, 8, 120);
    }
  }
  return c;
}

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: number[]): [number, number, number] => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

const MOON_TINT: Record<string, [number, number, number]> = { io: [0.88, 0.77, 0.36], europa: [0.86, 0.8, 0.7], titan: [0.85, 0.63, 0.29], enceladus: [0.95, 0.97, 1], triton: [0.9, 0.85, 0.82], callisto: [0.54, 0.48, 0.41] };
function drawMoonBody(id: string) {
  const { c, g } = canvas();
  const col = MOON_TINT[id] ?? [0.72, 0.7, 0.68];
  const R = SIZE * 0.34, cx = SIZE / 2, cy = SIZE / 2;
  const gr = g.createRadialGradient(cx - R * 0.45, cy - R * 0.4, R * 0.1, cx, cy, R);
  gr.addColorStop(0, css(col[0], col[1], col[2]));
  gr.addColorStop(0.75, css(col[0] * 0.55, col[1] * 0.55, col[2] * 0.55));
  gr.addColorStop(1, css(col[0] * 0.15, col[1] * 0.15, col[2] * 0.15));
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  const r = rng(id.length * 31 + id.charCodeAt(0));
  for (let k = 0; k < 14; k++) { const a = r() * 6.28, d = r() * R * 0.8, s = 3 + r() * 10; g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, 0, 6.28); g.fill(); }
  return c;
}
function drawCraft(id: string) {
  const { c, g } = canvas();
  const S = SIZE, cx = S / 2, cy = S / 2;
  // stelle di fondo
  const r = rng(id.length * 7 + 3);
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.5})`; g.fillRect(r() * S, r() * S, 1.2, 1.2); }
  const panel = (x: number, y: number, w: number, h: number) => {
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#2a3f78'); gr.addColorStop(1, '#16224a');
    g.fillStyle = gr; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(214,170,90,.8)'; g.lineWidth = 1.5; g.strokeRect(x, y, w, h);
    g.strokeStyle = 'rgba(140,170,255,.25)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x, y + (h * k) / 4); g.lineTo(x + w, y + (h * k) / 4); g.stroke(); }
  };
  const metal = (x: number, y: number, w: number, h: number, col = '#d9dde6') => { const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, col); gr.addColorStop(1, '#7d838f'); g.fillStyle = gr; g.fillRect(x, y, w, h); };
  if (id === 'iss') {
    metal(cx - 100, cy - 4, 200, 8, '#a9afba');
    for (const sx of [-1, 1]) for (const k of [0, 1]) for (const sy of [-1, 1]) panel(cx + sx * (62 + k * 24) - 10, sy < 0 ? cy - 58 : cy + 8, 20, 50);
    metal(cx - 8, cy - 36, 16, 72); metal(cx - 24, cy + 18, 48, 12); for (const x of [-30, 0, 30]) { g.fillStyle = 'rgba(240,244,250,.9)'; g.fillRect(cx + x - 9, cy - 22, 18, 12); }
  } else if (id === 'tiangong') {
    metal(cx - 10, cy - 40, 20, 80); metal(cx - 46, cy - 50, 92, 16);
    for (const sx of [-1, 1]) { panel(cx + sx * 50 - (sx < 0 ? 60 : 0), cy - 54, 60, 24); panel(cx + sx * 14 - (sx < 0 ? 22 : 0), cy + 10, 22, 40); }
  } else if (id === 'hubble') {
    g.save(); g.translate(cx, cy); g.rotate(-0.35); metal(-26, -70, 52, 130, '#c9ced8'); g.fillStyle = '#20242c'; g.fillRect(-27, -76, 54, 8);
    panel(-80, -40, 44, 70); panel(36, -40, 44, 70); g.restore();
  } else if (id === 'jwst') {
    g.fillStyle = '#9a86c8'; g.beginPath(); g.moveTo(cx - 100, cy + 40); g.lineTo(cx, cy + 10); g.lineTo(cx + 100, cy + 40); g.lineTo(cx, cy + 75); g.closePath(); g.fill();
    for (let k = 0; k < 18; k++) {
      const ring = k < 6 ? 1 : 2; const a = (k % 6) * Math.PI / 3 + (ring === 2 ? Math.PI / 6 : 0); const d = ring * 19;
      const hx = cx + Math.cos(a) * d * (ring === 2 && k >= 12 ? 1.7 : 1), hy = cy - 30 + Math.sin(a) * d * (ring === 2 && k >= 12 ? 1.7 : 1);
      g.fillStyle = `hsl(42, 80%, ${55 + (k % 3) * 8}%)`; g.beginPath(); for (let j = 0; j < 6; j++) { const b = j * Math.PI / 3 + Math.PI / 6; g.lineTo(hx + Math.cos(b) * 10, hy + Math.sin(b) * 10); } g.closePath(); g.fill();
    }
    g.fillStyle = '#f3d27a'; g.beginPath(); for (let j = 0; j < 6; j++) { const b = j * Math.PI / 3 + Math.PI / 6; g.lineTo(cx + Math.cos(b) * 10, cy - 30 + Math.sin(b) * 10); } g.closePath(); g.fill();
  } else if (id === 'tesla') {
    // Roadster rossa di profilo con Starman al volante
    const red = g.createLinearGradient(0, cy - 20, 0, cy + 20); red.addColorStop(0, '#ff5a5f'); red.addColorStop(1, '#8e0f16');
    g.fillStyle = red; g.beginPath(); g.moveTo(cx - 92, cy + 14); g.quadraticCurveTo(cx - 90, cy - 6, cx - 60, cy - 10); g.lineTo(cx - 10, cy - 14); g.quadraticCurveTo(cx + 40, cy - 16, cx + 88, cy - 2); g.quadraticCurveTo(cx + 96, cy + 10, cx + 90, cy + 18); g.lineTo(cx - 92, cy + 18); g.closePath(); g.fill();
    g.fillStyle = '#1b1e25'; for (const x of [-56, 52]) { g.beginPath(); g.arc(cx + x, cy + 18, 15, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5b6170'; g.beginPath(); g.arc(cx + x, cy + 18, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1b1e25'; }
    g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(cx - 14, cy - 30, 12, 0, Math.PI * 2); g.fill(); g.fillRect(cx - 22, cy - 22, 16, 16);
    g.fillStyle = '#26324a'; g.beginPath(); g.arc(cx - 11, cy - 31, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(120,180,255,.18)'; g.beginPath(); g.arc(cx, cy + 60, 140, Math.PI * 1.15, Math.PI * 1.85); g.fill();
  } else {
    // sonde: antenna parabolica e bracci
    g.strokeStyle = '#cfd5df'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 90, cy + 40); g.moveTo(cx, cy); g.lineTo(cx - 70, cy + 50); g.stroke();
    const dg = g.createRadialGradient(cx - 10, cy - 30, 4, cx, cy - 20, 50); dg.addColorStop(0, '#ffffff'); dg.addColorStop(1, '#9aa2b0');
    g.fillStyle = dg; g.beginPath(); g.ellipse(cx, cy - 20, 50, 22, -0.25, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d6aa5a'; g.fillRect(cx - 14, cy - 4, 28, 20);
  }
  return c;
}

export function objectThumb(ref: ObjRef): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'thumb';
  const pid = photoId(ref);
  if (pid && PHOTOS.has(pid)) {
    const img = document.createElement('img');
    img.src = `photos/${pid}.webp`;
    img.alt = '';
    img.decoding = 'async';
    wrap.appendChild(img);
    wrap.classList.add('photo');
    return wrap;
  }
  let cv: HTMLCanvasElement;
  if (ref.kind === 'star') cv = drawStar(ref.index);
  else if (ref.kind === 'messier') { const m = messier.find((x) => x.id === ref.id); cv = drawMessier(m?.type ?? 'oc', ref.id.length * 13 + +ref.id.slice(1)); }
  else if (ref.kind === 'constellation') cv = drawConstellation(ref.id);
  else if (ref.kind === 'deep') {
    const o = deepById(ref.id)!;
    const seed = ref.id.length * 17 + ref.id.charCodeAt(0);
    if (o.type === 'blackhole' || o.type === 'quasar' || o.type === 'pulsar') cv = drawExotic(o.type, seed);
    else if (o.type === 'galaxy') cv = drawMessier(o.galaxy?.shape === 'elliptical' ? 'e' : o.galaxy?.shape === 'irregular' ? 'i' : 's', seed);
    else cv = drawMessier(o.type === 'nebula' ? 'en' : o.type, seed);
  }
  else if (ref.kind === 'exo') cv = drawExoplanet(ref.index);
  else if (ref.kind === 'moon') cv = drawMoonBody(ref.id);
  else if (ref.kind === 'craft') cv = drawCraft(ref.id);
  else cv = drawMessier('oc', 1);
  wrap.appendChild(cv);
  wrap.classList.add('render');
  return wrap;
}

/** Esopianeta: sfera ombreggiata con la sua texture generata (proiezione ortografica). */
function drawExoplanet(index: number) {
  const { c, g } = canvas();
  const r = rng(index + 7);
  starfield(g, r, 60);
  const src = exoTexture(index).image as HTMLCanvasElement;
  const sd = src.getContext('2d')!.getImageData(0, 0, src.width, src.height).data;
  const R = SIZE * 0.36, cx = SIZE / 2, cy = SIZE / 2;
  const img = g.getImageData(0, 0, SIZE, SIZE);
  const L = norm([-0.55, -0.35, 0.75]);
  const emit = ['lava', 'hotjupiter'].includes(exoplanets[index].cls);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const nx = (x - cx) / R, ny = (y - cy) / R, d2 = nx * nx + ny * ny;
    if (d2 > 1) continue;
    const nz = Math.sqrt(1 - d2);
    const lon = Math.atan2(nx, nz) + 0.6, lat = Math.asin(-ny);
    const u = Math.floor(((lon / (2 * Math.PI)) % 1 + 1) % 1 * src.width), v = Math.floor((0.5 - lat / Math.PI) * (src.height - 1));
    const o = (v * src.width + u) * 4;
    const lit = Math.max(0, dot([nx, -ny, nz], L)) * 0.95 + 0.05;
    const edge = Math.min(1, (1 - Math.sqrt(d2)) * R * 0.8);
    const k = (emit ? Math.max(lit, 0.45) : lit) * edge;
    const t = (y * SIZE + x) * 4;
    img.data[t] = sd[o] * k; img.data[t + 1] = sd[o + 1] * k; img.data[t + 2] = sd[o + 2] * k; img.data[t + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export const hasPhoto = (ref: ObjRef) => { const p = photoId(ref); return !!p && PHOTOS.has(p); };

