// Immagine dell'oggetto nella scheda: foto reale (NASA/ESA/ESO via Wikimedia Commons)
// oppure un render generico disegnato al volo in base al tipo di oggetto.
import { ObjRef } from '../features/objects';
import { constellationById, messier, radecToVec, starPhysical } from '../data/catalog';
import { rng } from '../render/background';
import { tempColor } from '../render/planet';

const PHOTOS = new Set([
  'sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'iss',
  'M1', 'M8', 'M13', 'M16', 'M17', 'M20', 'M27', 'M31', 'M33', 'M42', 'M45', 'M51', 'M57', 'M64', 'M81', 'M82', 'M87', 'M101', 'M104',
]);

function photoId(r: ObjRef): string | null {
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

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: number[]): [number, number, number] => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

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
  else cv = drawMessier('oc', 1);
  wrap.appendChild(cv);
  wrap.classList.add('render');
  return wrap;
}

export const hasPhoto = (ref: ObjRef) => { const p = photoId(ref); return !!p && PHOTOS.has(p); };

