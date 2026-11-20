// Sfondo celeste 3D condiviso: stelle reali (posizione in parsec), linee delle costellazioni,
// Via Lattea volumetrica (bagliore, polveri che fanno ombra, regioni di formazione stellare,
// nucleo), nebulose 3D, Andromeda e Nubi di Magellano.
// Tutto è calcolato rispetto a un osservatore uObs (parsec): funziona dalla Terra, da un
// esopianeta o dalla navicella, con effetti relativistici opzionali.
import * as THREE from 'three';
import { MESSIER_EXTRA, constellations, messier, radecToVec, stars } from '../data/catalog';
import { deepObjects } from '../data/deep';
import { DeepRenderer } from './deepRender';
import { quality } from '../core/quality';
import { planetTexture } from '../core/textures';

const BLACKBODY = /* glsl */ `
vec3 blackbody(float T) {
  float t = T / 100.0;
  float r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
  float g = t <= 66.0 ? clamp(0.390081578 * log(t) - 0.631841444, 0.0, 1.0) : clamp(1.129890861 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
  float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.543206789 * log(t - 10.0) - 1.196254089, 0.0, 1.0));
  return vec3(r, g, b);
}
`;

const RELATIVITY = /* glsl */ `
uniform vec3 uBeta;
vec3 aberrate(vec3 n, out float D) {
  float b = length(uBeta);
  if (b < 1e-6) { D = 1.0; return n; }
  vec3 bh = uBeta / b;
  float g = 1.0 / sqrt(1.0 - b * b);
  float nb = dot(n, bh);
  vec3 np = (n + ((g - 1.0) * nb + g * b) * bh) / (g * (1.0 + b * nb));
  D = g * (1.0 + b * nb);
  return normalize(np);
}
`;

// Nel cielo dalla Terra, di giorno, sotto l'orizzonte si vede la notte dell'altro emisfero.
const HORIZON = /* glsl */ `
uniform float uHz;
float belowF(vec3 dir) {
  if (uHz < 0.5) return 0.0;
  float wy = (modelMatrix * vec4(dir, 0.0)).y;
  return smoothstep(0.0, -0.05, wy);
}
`;

// ---------------------------------------------------------------------------- stelle
const starVert = /* glsl */ `
attribute float absmag;
attribute float temp;
uniform vec3 uObs;
uniform float uMagLimit;
uniform float uScale;
uniform float uNearCut;
uniform float uTime;
uniform float uTwinkle;
uniform float uSpikes;
uniform float uMagBelow;
varying vec3 vColor;
varying float vAlpha;
varying float vSpike;
varying float vCore;
${BLACKBODY}
${RELATIVITY}
${HORIZON}
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec3 rel = position - uObs;
  float d = length(rel);
  float D;
  vec3 dir = aberrate(rel / d, D);
  float m = absmag + 5.0 * log(d) / log(10.0) - 5.0 - 2.5 * 1.2 * log(D) / log(10.0);
  float Tobs = temp * D;
  float s = mix(uMagLimit, uMagBelow, belowF(dir)) - m;
  if (d < uNearCut || s < 0.0 || Tobs < 600.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * 1000.0, 1.0);
  float id = float(gl_VertexID);
  float tw = 1.0 + uTwinkle * 0.22 * sin(uTime * (3.0 + hash(id) * 5.0) + hash(id * 1.3) * 6.28);
  // stelle molto brillanti: punte di diffrazione e un alone più ampio
  vSpike = uSpikes * smoothstep(5.2, 8.5, s);
  float size = clamp(2.0 + s * 1.3, 2.0, 18.0) * (1.0 + vSpike * 1.6);
  gl_PointSize = size * uScale;
  vCore = clamp((2.0 + s * 1.3) / size, 0.1, 1.0);
  vAlpha = clamp(0.24 + s * 0.5, 0.0, 1.0) * (1.0 + max(0.0, s - 5.0) * 0.25) * tw;
  vec3 c = blackbody(Tobs);
  vColor = mix(c, vec3(1.0), 0.18) * (Tobs > 40000.0 ? 1.15 : 1.0);
}
`;

const starFrag = /* glsl */ `
uniform float uDim;
varying vec3 vColor;
varying float vAlpha;
varying float vSpike;
varying float vCore;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  float r = length(p);
  if (r > 1.0) discard;
  float rc = r / vCore;
  float core = exp(-rc * rc * 5.5);
  float halo = exp(-rc * 2.6) * 0.3;
  float spikes = 0.0;
  if (vSpike > 0.01) {
    float sx = exp(-abs(p.y) * 70.0) * pow(1.0 - abs(p.x), 2.0);
    float sy = exp(-abs(p.x) * 70.0) * pow(1.0 - abs(p.y), 2.0);
    spikes = (sx + sy) * 0.55 * vSpike + exp(-r * 4.0) * 0.12 * vSpike;
  }
  vec3 col = vColor * (core + halo) + mix(vColor, vec3(1.0), 0.4) * spikes;
  gl_FragColor = vec4(col * vAlpha * uDim, 1.0);
}
`;

const lineVert = /* glsl */ `
uniform vec3 uObs;
uniform float uOpacity;
uniform float uLineBelow;
varying float vOp;
${RELATIVITY}
${HORIZON}
void main() {
  vec3 rel = position - uObs;
  float D;
  vec3 dir = aberrate(normalize(rel), D);
  vOp = mix(uOpacity, uLineBelow, belowF(dir));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * 990.0, 1.0);
}
`;
const lineFrag = /* glsl */ `
uniform vec3 uColor;
varying float vOp;
void main() { gl_FragColor = vec4(uColor * vOp, 1.0); }
`;

// ---------------------------------------------------------------------------- galassia
// aGal: posizione galattocentrica (pc) per la Via Lattea (aKind 0, ruota),
// o posizione EQJ eliocentrica già pronta per gli altri oggetti (aKind 1).
const galVert = /* glsl */ `
attribute vec3 color;
attribute float size;
attribute float aKind;
attribute float aSeed;
uniform vec3 uObs;
uniform float uPixPerRad;
uniform mat3 uGalToEq;
uniform vec3 uSunGal;
uniform float uSpin;
uniform float uTime;
uniform float uMaxPx;
uniform float uBoost;
uniform float uOther;
uniform float uPF[5];
attribute float aGal;
uniform float uDim;
uniform float uDimBelow;
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
varying float vDimK;
${RELATIVITY}
${HORIZON}
void main() {
  vec3 p = position;
  if (aKind < 0.5) {
    float r = length(p.xy);
    float a = uSpin * (0.75 + 0.25 * clamp(8000.0 / max(r, 1500.0), 0.0, 2.0));
    float c = cos(a), s = sin(a);
    p.xy = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    p = uGalToEq * (p - uSunGal);
  }
  vec3 rel = p - uObs;
  float d = length(rel);
  float D;
  vec3 dir = aberrate(rel / d, D);
  vDimK = mix(uDim, uDimBelow, belowF(dir));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * 1000.0, 1.0);
  // a velocità relativistiche il cielo si comprime in avanti: le nubi si rimpiccioliscono invece di accumularsi
  float px = size / d * uPixPerRad / max(1.0, D);
  float alpha = smoothstep(size * 0.6, size * 3.0, d);
  if (px < 1.5) { alpha *= (px * px) / 2.25; px = 1.5; }
  if (px > uMaxPx) { alpha *= uMaxPx / px; px = uMaxPx; }
  gl_PointSize = px;
  float shimmer = 0.92 + 0.08 * sin(uTime * (0.3 + aSeed * 0.6) + aSeed * 40.0);
  // la Via Lattea vista da fuori viene schiarita; le altre galassie restano naturali
  vAlpha = alpha * shimmer / max(1.0, D) * (aKind < 0.5 ? uBoost : uOther) * uPF[int(aGal + 0.5)];
  vColor = color * clamp(sqrt(D), 0.4, 1.4);
  vSoft = aKind > 1.5 ? 1.0 : 0.0;
}
`;
const galFrag = /* glsl */ `
uniform float uGain;
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
varying float vDimK;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r2 = dot(p, p) * 4.0;
  if (r2 > 1.0) discard;
  float f = vSoft > 0.5 ? exp(-r2 * 6.0) * 1.4 : exp(-r2 * 3.0) - 0.05;
  gl_FragColor = vec4(vColor * f * vAlpha * vDimK * uGain, 1.0);
}
`;

// le polveri sottraggono luce: bande scure e "Grande Fenditura"
const dustFrag = /* glsl */ `
uniform float uGain;
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
varying float vDimK;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r2 = dot(p, p) * 4.0;
  if (r2 > 1.0) discard;
  float f = exp(-r2 * 2.5) - 0.08;
  gl_FragColor = vec4(vColor * max(f, 0.0) * vAlpha * vDimK * uGain, 1.0);
}
`;

// nebulose: nubi colorate con struttura filamentosa
const nebVert = /* glsl */ `
attribute vec3 color;
attribute float size;
attribute float aSeed;
uniform vec3 uObs;
uniform float uPixPerRad;
uniform float uMaxPx;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
uniform float uDim;
uniform float uDimBelow;
varying float vDimK;
${RELATIVITY}
${HORIZON}
void main() {
  vec3 rel = position - uObs;
  float d = length(rel);
  float D;
  vec3 dir = aberrate(rel / d, D);
  vDimK = mix(uDim, uDimBelow, belowF(dir));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * 1000.0, 1.0);
  float px = size / d * uPixPerRad;
  float alpha = smoothstep(size * 0.3, size * 1.6, d);
  if (px < 2.0) { alpha *= (px * px) / 4.0; px = 2.0; }
  if (px > uMaxPx) { alpha *= sqrt(uMaxPx / px); px = uMaxPx; }
  gl_PointSize = px;
  vAlpha = alpha;
  vColor = color;
  vSeed = aSeed;
}
`;
const nebFrag = /* glsl */ `
uniform float uTime;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
varying float vDimK;
float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p *= 2.07; a *= 0.5; } return s; }
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  if (r > 1.0) discard;
  vec2 q = p * 3.0 + vSeed * 17.0;
  float w = fbm(q + fbm(q * 1.7 + uTime * 0.01));
  float shape = smoothstep(1.0, 0.15, r) * smoothstep(0.25, 0.85, w);
  gl_FragColor = vec4(vColor * shape * vAlpha * vDimK, 1.0);
}
`;

// galassie lontane: piccole ellissi di luce con orientamento casuale
const deepVert = /* glsl */ `
attribute vec3 color;
attribute float size;
attribute float aAngle;
uniform float uScale;
varying vec3 vColor;
varying float vAngle;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale;
  vColor = color;
  vAngle = aAngle;
}
`;
const deepFrag = /* glsl */ `
uniform float uK;
varying vec3 vColor;
varying float vAngle;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  float c = cos(vAngle), s = sin(vAngle);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  p.y *= 2.6;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float f = exp(-r2 * 4.0) + exp(-r2 * 30.0) * 0.6;
  gl_FragColor = vec4(vColor * f * uK * 0.55, 1.0);
}
`;

// Via Lattea fotografica (panorama in coordinate galattiche, Solar System Scope CC BY 4.0)
const panoVert = /* glsl */ `
uniform mat3 uEqToGal;
varying vec3 vGal;
varying float vD;
uniform float uDim;
uniform float uDimBelow;
varying float vDimK;
${RELATIVITY}
${HORIZON}
void main() {
  float D;
  vec3 n = normalize(position);
  vec3 dir = aberrate(n, D);
  vDimK = mix(uDim, uDimBelow, belowF(dir));
  vGal = uEqToGal * n;
  vD = D;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * 900.0, 1.0);
}
`;
const panoFrag = /* glsl */ `
uniform sampler2D uMap;
uniform float uK;
varying vec3 vGal;
varying float vD;
varying float vDimK;
const float PI = 3.14159265;
void main() {
  vec3 g = normalize(vGal);
  float l = atan(g.y, g.x);
  float b = asin(clamp(g.z, -1.0, 1.0));
  vec2 uv = vec2(0.5 - l / (2.0 * PI), 0.5 - b / PI);
  // derivate continue anche sulla cucitura (l = ±180°)
  vec2 uv2 = vec2(fract(uv.x + 0.5), uv.y);
  vec2 dx = dFdx(uv), dx2 = dFdx(uv2), dy = dFdy(uv), dy2 = dFdy(uv2);
  if (abs(dx2.x) < abs(dx.x)) dx.x = dx2.x;
  if (abs(dy2.x) < abs(dy.x)) dy.x = dy2.x;
  vec3 c = textureGrad(uMap, uv, dx, dy).rgb;
  // un velo di colore più caldo verso il centro galattico, come nelle foto a lunga posa
  float warm = smoothstep(0.9, 0.0, length(vec2(l, b * 2.2)));
  float lum = dot(c, vec3(0.3, 0.5, 0.2));
  c = mix(vec3(lum), c, 0.35) * mix(vec3(0.95, 0.97, 1.04), vec3(1.3, 1.05, 0.8), warm);
  gl_FragColor = vec4(c * uK * vDimK * clamp(vD, 0.25, 1.6), 1.0);
}
`;

// Cielo intergalattico: blu notte con velature e stelle lontanissime, visibile fuori dalla Via Lattea
const igVert = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 950.0, 1.0); }
`;
const igFrag = /* glsl */ `
uniform float uK;
uniform float uScale;
varying vec3 vDir;
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
float starLayer(vec3 d, float cells, float thr, float sz) {
  vec3 p = d * cells; vec3 c = floor(p); float r = h3(c);
  if (r < thr) return 0.0;
  vec3 o = vec3(h3(c + 1.7), h3(c + 3.1), h3(c + 5.3));
  float dist = length(fract(p) - o);
  return smoothstep(sz, 0.0, dist) * (0.4 + 0.6 * h3(c + 9.1));
}
void main() {
  vec3 d = normalize(vDir);
  // velature morbide: rumore a bassa frequenza, deformato per togliere ogni forma "a blocchi"
  vec3 q = d * 1.6 + vec3(fbm(d * 1.3 + 1.0), fbm(d * 1.3 + 5.0), fbm(d * 1.3 + 9.0)) * 1.4;
  float cloud = smoothstep(0.25, 0.8, fbm(q));
  vec3 col = mix(vec3(0.016, 0.03, 0.072), vec3(0.03, 0.055, 0.12), cloud);
  // stelle di sfondo (molto meno fitte che nella Via Lattea), di colori diversi
  float s = starLayer(d, 70.0, 0.9, 0.22 * uScale) + starLayer(d, 160.0, 0.95, 0.24 * uScale) * 0.55;
  vec3 tint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), h3(floor(d * 70.0)));
  col += tint * s * 1.3;
  gl_FragColor = vec4(col * uK, 1.0);
}
`;

// Matrice equatoriale J2000 → galattica (righe); la sua trasposta va da galattico a EQJ
const R_EQ_GAL = [
  [-0.0548755604, -0.873437090, -0.4838350155],
  [0.4941094279, -0.4448296300, 0.7469822445],
  [-0.8676661490, -0.1980763734, 0.4559837762],
];
function galToEq(x: number, y: number, z: number): [number, number, number] {
  return [
    R_EQ_GAL[0][0] * x + R_EQ_GAL[1][0] * y + R_EQ_GAL[2][0] * z,
    R_EQ_GAL[0][1] * x + R_EQ_GAL[1][1] * y + R_EQ_GAL[2][1] * z,
    R_EQ_GAL[0][2] * x + R_EQ_GAL[1][2] * y + R_EQ_GAL[2][2] * z,
  ];
}

/** Generatore pseudo-casuale deterministico. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}

const SUN_GAL: [number, number, number] = [-8200, 0, 20];
export const GALACTIC_CENTER_PC = galToEq(8200, 0, -20);

interface Particles { pos: number[]; col: number[]; size: number[]; kind: number[]; seed: number[]; gal: number[] }
const P = (): Particles => ({ pos: [], col: [], size: [], kind: [], seed: [], gal: [] });

const PITCH = (12.5 * Math.PI) / 180;
const armAngle = (rad: number, arm: number) => Math.log(rad / 2400) / Math.tan(PITCH) + (arm * Math.PI) / 2;

function buildMilkyWay(p: Particles, dust: Particles, n: number, nd: number) {
  const r = rng(42);
  const push = (q: Particles, x: number, y: number, z: number, c: number[], s: number, kind: number) => {
    q.pos.push(x, y, z); q.col.push(c[0], c[1], c[2]); q.size.push(s); q.kind.push(kind); q.seed.push(r()); q.gal.push(0);
  };
  for (let i = 0; i < n; i++) {
    const u = r();
    if (u < 0.08) {
      // bulge + barra: stelle vecchie, color crema (non un blocco giallo)
      const bx = gauss(r) * 1500, by = gauss(r) * 560, bz = gauss(r) * 420;
      const a = (27 * Math.PI) / 180;
      const k = 0.35 + r() * 0.35;
      push(p, bx * Math.cos(a) - by * Math.sin(a), bx * Math.sin(a) + by * Math.cos(a), bz, [1.0 * k, 0.9 * k, 0.76 * k], 110 + r() * 150, 0);
    } else if (u < 0.17) {
      // regioni di formazione stellare (HII): nodi rosati lungo i bracci
      const rad = 3000 + r() * 12000;
      const th = armAngle(rad, Math.floor(r() * 4)) + gauss(r) * 0.08;
      push(p, rad * Math.cos(th), rad * Math.sin(th), gauss(r) * 60, [1.2, 0.42, 0.55], 50 + r() * 70, 0);
    } else if (u < 0.42) {
      // polvere di stelle fine: granulosità e profondità
      let rad = -Math.log(1 - r() * 0.985) * 3400 + 1500;
      if (rad > 17000) rad = 1500 + r() * 15000;
      const th = r() < 0.65 ? armAngle(rad, Math.floor(r() * 4)) + gauss(r) * 0.18 : r() * Math.PI * 2;
      const k = 0.5 + r() * 0.6;
      push(p, rad * Math.cos(th), rad * Math.sin(th), gauss(r) * (90 + rad * 0.01), [0.85 * k, 0.88 * k, 1.0 * k], 25 + r() * 35, 0);
    } else {
      // bagliore diffuso del disco e dei bracci
      let rad = -Math.log(1 - r() * 0.985) * 3600 + 1200;
      if (rad > 17000) rad = 1200 + r() * 15000;
      const inArm = r() < 0.72;
      const th = inArm ? armAngle(rad, Math.floor(r() * 4)) + gauss(r) * 0.22 : r() * Math.PI * 2;
      const c = inArm ? [0.72, 0.8, 1.0] : [0.95, 0.86, 0.74];
      const k = 0.45 + r() * 0.5;
      push(p, rad * Math.cos(th), rad * Math.sin(th), gauss(r) * (110 + rad * 0.012), [c[0] * k, c[1] * k, c[2] * k], 100 + r() * 170, 0);
    }
  }
  // nucleo: un bagliore caldo e ampio
  for (let i = 0; i < 18; i++) push(p, gauss(r) * 450, gauss(r) * 280, gauss(r) * 220, [0.42, 0.38, 0.32], 520 + r() * 380, 0);
  // polveri: sul bordo interno dei bracci, molto sottili in altezza
  for (let i = 0; i < nd; i++) {
    let rad = -Math.log(1 - r() * 0.98) * 3800 + 1800;
    if (rad > 15000) rad = 2500 + r() * 12000;
    const th = r() < 0.8 ? armAngle(rad, Math.floor(r() * 4)) - 0.12 + gauss(r) * 0.12 : r() * Math.PI * 2;
    const k = 0.55 + r() * 0.45;
    push(dust, rad * Math.cos(th), rad * Math.sin(th), gauss(r) * 45, [0.55 * k, 0.6 * k, 0.75 * k], 70 + r() * 140, 0);
  }
}

function buildDiskGalaxy(p: Particles, dust: Particles, n: number, raDeg: number, decDeg: number, distPc: number, radiusPc: number, incl: number, pa: number, bright: number, seed: number, gal: number) {
  const r = rng(seed);
  const L = new THREE.Vector3(...radecToVec(raDeg, decDeg));
  const n0 = new THREE.Vector3(0, 0, 1).sub(L.clone().multiplyScalar(L.z)).normalize();
  const e0 = new THREE.Vector3().crossVectors(n0, L).normalize().negate();
  const a = n0.clone().multiplyScalar(Math.cos(pa)).add(e0.clone().multiplyScalar(Math.sin(pa)));
  const m = new THREE.Vector3().crossVectors(L, a);
  const normal = L.clone().multiplyScalar(Math.cos(incl)).add(m.multiplyScalar(Math.sin(incl))).normalize();
  const b = new THREE.Vector3().crossVectors(normal, a).normalize();
  const center = L.clone().multiplyScalar(distPc);
  const put = (q: Particles, rad: number, th: number, zz: number, c: number[], s: number) => {
    const v = center.clone().add(a.clone().multiplyScalar(rad * Math.cos(th))).add(b.clone().multiplyScalar(rad * Math.sin(th))).add(normal.clone().multiplyScalar(zz));
    q.pos.push(v.x, v.y, v.z); q.col.push(c[0], c[1], c[2]); q.size.push(s); q.kind.push(1); q.seed.push(r()); q.gal.push(gal);
  };
  for (let i = 0; i < n; i++) {
    const core = r() < 0.25;
    const rad = core ? Math.abs(gauss(r)) * radiusPc * 0.12 : -Math.log(1 - r() * 0.98) * radiusPc * 0.25;
    const th = core ? r() * 6.283 : Math.log(rad / (radiusPc * 0.1) + 1) * 3.2 + Math.floor(r() * 2) * Math.PI + gauss(r) * 0.35;
    const c = core ? [1, 0.85, 0.65] : r() < 0.05 ? [1.2, 0.5, 0.6] : [0.75, 0.82, 1];
    const k = (0.5 + r() * 0.5) * bright;
    put(p, rad, th, gauss(r) * radiusPc * (core ? 0.06 : 0.015), [c[0] * k, c[1] * k, c[2] * k], radiusPc * (core ? 0.022 : 0.012));
  }
  for (let i = 0; i < n * 0.25; i++) {
    const rad = radiusPc * (0.15 + r() * 0.7);
    const th = Math.log(rad / (radiusPc * 0.1) + 1) * 3.2 + Math.floor(r() * 2) * Math.PI - 0.15 + gauss(r) * 0.15;
    put(dust, rad, th, gauss(r) * radiusPc * 0.006, [0.35, 0.38, 0.5], radiusPc * 0.01);
  }
}

function buildBlob(p: Particles, n: number, raDeg: number, decDeg: number, distPc: number, radiusPc: number, bright: number, seed: number, gal: number) {
  const r = rng(seed);
  const c = radecToVec(raDeg, decDeg).map((v) => v * distPc);
  for (let i = 0; i < n; i++) {
    p.pos.push(c[0] + gauss(r) * radiusPc, c[1] + gauss(r) * radiusPc * 0.7, c[2] + gauss(r) * radiusPc * 0.6);
    const k = (0.5 + r() * 0.5) * bright;
    const pink = r() < 0.06;
    p.col.push((pink ? 1.1 : 0.8) * k, (pink ? 0.45 : 0.85) * k, (pink ? 0.6 : 1) * k);
    p.size.push(radiusPc * 0.07);
    p.kind.push(1);
    p.gal.push(gal);
    p.seed.push(r());
  }
}

/** Nebulose extra non presenti nei cataloghi (Rosetta, Nord America). */
const EXTRA_NEB: { ra: number; dec: number; ly: number; r: number; type: string }[] = [
  { ra: 97.98, dec: 4.94, ly: 5200, r: 60, type: 'nebula' },
  { ra: 314.7, dec: 44.3, ly: 2590, r: 50, type: 'nebula' },
];

/** Nubi, gusci e anelli generati in base al tipo di nebulosa. */
function buildNebulae(p: Particles) {
  const r = rng(77);
  const LY = 1 / 3.26156;
  const list: { ra: number; dec: number; ly: number; r: number; type: string }[] = [...EXTRA_NEB];
  for (const o of deepObjects()) if (['nebula', 'pn', 'snr'].includes(o.type)) list.push({ ra: o.ra, dec: o.dec, ly: o.ly, r: o.radiusLy, type: o.type });
  for (const m of messier) {
    const ex = MESSIER_EXTRA[m.id];
    if (!ex) continue;
    const t = m.type === 'pn' ? 'pn' : m.type === 'snr' ? 'snr' : ['en', 'rn', 'bn', 'sfr'].includes(m.type) ? 'nebula' : '';
    if (!t) continue;
    const rad = t === 'pn' ? 1.2 : t === 'snr' ? 5.5 : Math.max(10, ex.ly * 0.006);
    list.push({ ra: m.ra, dec: m.dec, ly: ex.ly, r: rad, type: t });
  }
  const palettes: number[][][] = [
    [[1.0, 0.32, 0.45], [0.35, 0.8, 0.85], [1.0, 0.7, 0.5]],
    [[1.0, 0.4, 0.35], [0.9, 0.7, 0.4], [0.5, 0.6, 1.0]],
    [[0.35, 0.9, 0.85], [1.0, 0.4, 0.35], [0.6, 0.5, 1.0]],
  ];
  for (const n of list) {
    const c = radecToVec(n.ra, n.dec).map((v) => v * n.ly * LY);
    const R = n.r * LY;
    const pal = palettes[n.type === 'pn' ? 2 : n.type === 'snr' ? 2 : Math.floor(r() * 2)];
    const count = n.type === 'nebula' ? 40 : 60;
    for (let i = 0; i < count; i++) {
      let x: number, y: number, z: number, size: number;
      if (n.type === 'nebula') {
        x = gauss(r) * R * 0.45; y = gauss(r) * R * 0.45; z = gauss(r) * R * 0.45; size = R * (0.6 + r() * 0.9);
      } else {
        // anelli (planetarie) e gusci filamentosi (resti di supernova)
        const u = r() * 2 - 1, ph = r() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
        const shell = R * (0.8 + r() * 0.25);
        x = rr * Math.cos(ph) * shell; y = rr * Math.sin(ph) * shell; z = u * shell * (n.type === 'pn' ? 0.55 : 1);
        size = R * (n.type === 'pn' ? 0.45 : 0.35) * (0.6 + r() * 0.7);
      }
      const col = pal[Math.floor(r() * pal.length)];
      const k = 0.4 + r() * 0.5;
      p.pos.push(c[0] + x, c[1] + y, c[2] + z);
      p.col.push(col[0] * k, col[1] * k, col[2] * k);
      p.size.push(size);
      p.kind.push(0);
      p.seed.push(r());
      p.gal.push(0);
    }
  }
}

/** Stelle degli ammassi (globulari e aperti), aggiunte al campo stellare vero. */
function clusterStars() {
  const r = rng(303);
  const LY = 1 / 3.26156;
  const out: { pos: number[]; mag: number[]; temp: number[] } = { pos: [], mag: [], temp: [] };
  const list: { ra: number; dec: number; ly: number; r: number; gc: boolean }[] = [];
  const linked = new Set<string>();
  for (const o of deepObjects()) if (o.type === 'gc' || o.type === 'oc') { list.push({ ra: o.ra, dec: o.dec, ly: o.ly, r: o.radiusLy, gc: o.type === 'gc' }); if (o.messier) linked.add(o.messier); }
  for (const m of messier) {
    const ex = MESSIER_EXTRA[m.id];
    if (!ex || linked.has(m.id) || (m.type !== 'gc' && m.type !== 'oc')) continue;
    list.push({ ra: m.ra, dec: m.dec, ly: ex.ly, r: m.type === 'gc' ? 50 : m.id === 'M45' ? 8 : 12, gc: m.type === 'gc' });
  }
  const nGc = quality.tier === 'low' ? 500 : 1400, nOc = quality.tier === 'low' ? 60 : 140;
  for (const c of list) {
    const ctr = radecToVec(c.ra, c.dec).map((v) => v * c.ly * LY);
    const R = c.r * LY;
    const n = c.gc ? nGc : nOc;
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, ph = r() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
      const d = c.gc ? R * 0.12 * Math.pow(-Math.log(1 - r() * 0.985), 1.3) : R * Math.sqrt(r());
      out.pos.push(ctr[0] + rr * Math.cos(ph) * d, ctr[1] + rr * Math.sin(ph) * d, ctr[2] + u * d);
      const t = r();
      if (c.gc) {
        // giganti rosse brillanti, qualche "blue straggler", tante stelle deboli
        if (t < 0.05) { out.mag.push(-2.5 + r() * 2); out.temp.push(3900 + r() * 400); }
        else if (t < 0.08) { out.mag.push(0 + r()); out.temp.push(9000 + r() * 3000); }
        else { out.mag.push(1 + r() * 3); out.temp.push(5200 + r() * 1200); }
      } else {
        // ammassi giovani: stelle calde e azzurre
        if (t < 0.12) { out.mag.push(-2.5 + r() * 2); out.temp.push(12000 + r() * 12000); }
        else { out.mag.push(0.5 + r() * 4); out.temp.push(6500 + r() * 6000); }
      }
    }
  }
  return out;
}

function toGeometry(p: Particles) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(p.col, 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(p.size, 1));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(p.kind, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(p.seed, 1));
  g.setAttribute('aGal', new THREE.Float32BufferAttribute(p.gal.length ? p.gal : new Array(p.seed.length).fill(0), 1));
  return g;
}

export interface BackgroundUpdate {
  obsPc: THREE.Vector3;
  beta: THREE.Vector3;
  magLimit: number;
  pixelScale: number;
  pixPerRad: number;
  dim: number;
  galaxyDim: number;
  linesOpacity: number;
  twinkle: number;
  time: number;
  nearCutPc: number;
  galSpin?: number;
  spikes?: number;
  /** Mostra il fondale di galassie lontane (solo in navicella). */
  deepField?: boolean;
  /** Cielo notturno sotto l'orizzonte (solo vista dalla Terra). */
  below?: { mag: number; galaxyDim: number; lines: number };
  /** Intensità della Via Lattea fotografica. */
  panoGain?: number;
}

export class Background {
  group = new THREE.Group();
  starPoints: THREE.Points;
  lines: THREE.LineSegments;
  galaxy: THREE.Points;
  dust: THREE.Points;
  nebulae: THREE.Points;
  panorama: THREE.Mesh;
  private panoMat: THREE.ShaderMaterial;
  intergalactic: THREE.Mesh;
  private igMat: THREE.ShaderMaterial;
  private starMat: THREE.ShaderMaterial;
  private lineMat: THREE.ShaderMaterial;
  private galMat: THREE.ShaderMaterial;
  private dustMat: THREE.ShaderMaterial;
  private nebMat: THREE.ShaderMaterial;
  deep: THREE.Points;
  private deepMat: THREE.ShaderMaterial;
  private pf = { value: [1, 1, 1, 1, 1] };
  private hz = { uHz: { value: 0 }, uDimBelow: { value: 0 }, uMagBelow: { value: 6 }, uLineBelow: { value: 0 } };
  deepObjects: DeepRenderer;
  /** Modalità leggera (dispositivo in difficoltà): niente polveri né fondale profondo. */
  lite = false;
  /** Per ogni costellazione: indici dei vertici-stella delle sue linee. */
  lineStars: Map<string, number[]> = new Map();

  constructor() {
    const beta = { value: new THREE.Vector3() };
    const obs = { value: new THREE.Vector3() };
    const time = { value: 0 };
    const pixPerRad = { value: 800 };
    const dim = { value: 1 };
    const hz = this.hz;

    // --- stelle (+ il Sole in coda) ---
    const cl = clusterStars();
    const nCl = cl.mag.length;
    const n = stars.count + 1 + nCl;
    const pos = new Float32Array(n * 3);
    pos.set(stars.pos);
    pos.set(cl.pos, (stars.count + 1) * 3);
    const absmag = new Float32Array(n);
    absmag.set(stars.absmag);
    absmag[stars.count] = 4.83;
    absmag.set(cl.mag, stars.count + 1);
    const temp = new Float32Array(n);
    temp.set(stars.temp);
    temp[stars.count] = 5772;
    temp.set(cl.temp, stars.count + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('absmag', new THREE.BufferAttribute(absmag, 1));
    g.setAttribute('temp', new THREE.BufferAttribute(temp, 1));
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: starVert, fragmentShader: starFrag,
      uniforms: {
        uObs: obs, uBeta: beta, uMagLimit: { value: 6.5 }, uScale: { value: 1 }, uNearCut: { value: 1e-4 },
        uDim: { value: 1 }, uTime: time, uTwinkle: { value: 0 }, uSpikes: { value: 1 }, uHz: hz.uHz, uMagBelow: hz.uMagBelow,
      },
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
    this.starPoints = new THREE.Points(g, this.starMat);
    this.starPoints.frustumCulled = false;
    this.starPoints.renderOrder = 2;

    // --- linee delle costellazioni, agganciate alle stelle vere ---
    const bright: number[] = [];
    for (let i = 0; i < stars.count; i++) {
      const d = Math.hypot(stars.pos[i * 3], stars.pos[i * 3 + 1], stars.pos[i * 3 + 2]);
      if (stars.absmag[i] + 5 * Math.log10(d) - 5 < 6.8) bright.push(i);
    }
    const dirs = bright.map((i) => {
      const x = stars.pos[i * 3], y = stars.pos[i * 3 + 1], z = stars.pos[i * 3 + 2];
      const d = Math.hypot(x, y, z);
      return [x / d, y / d, z / d];
    });
    const nearestStar = (ra: number, dec: number) => {
      const v = radecToVec(ra, dec);
      let best = -1, bd = -2;
      for (let k = 0; k < dirs.length; k++) {
        const dd = dirs[k][0] * v[0] + dirs[k][1] * v[1] + dirs[k][2] * v[2];
        if (dd > bd) { bd = dd; best = k; }
      }
      return bd > Math.cos((0.3 * Math.PI) / 180) ? bright[best] : -1;
    };
    const lp: number[] = [];
    for (const c of constellations) {
      const ids: number[] = [];
      for (const ln of c.lines) {
        for (let k = 0; k < ln.length - 1; k++) {
          const a = ln[k], b = ln[k + 1];
          const ia = nearestStar(a[0], a[1]), ib = nearestStar(b[0], b[1]);
          const pa = ia >= 0 ? [stars.pos[ia * 3], stars.pos[ia * 3 + 1], stars.pos[ia * 3 + 2]] : radecToVec(a[0], a[1]).map((x) => x * 1000);
          const pb = ib >= 0 ? [stars.pos[ib * 3], stars.pos[ib * 3 + 1], stars.pos[ib * 3 + 2]] : radecToVec(b[0], b[1]).map((x) => x * 1000);
          lp.push(...pa, ...pb);
          if (ia >= 0) ids.push(ia);
          if (ib >= 0) ids.push(ib);
        }
      }
      this.lineStars.set(c.id, [...new Set(ids)]);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    this.lineMat = new THREE.ShaderMaterial({
      vertexShader: lineVert, fragmentShader: lineFrag,
      uniforms: { uObs: obs, uBeta: beta, uColor: { value: new THREE.Color(0.45, 0.62, 0.95) }, uOpacity: { value: 0.5 }, uHz: hz.uHz, uLineBelow: hz.uLineBelow },
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
    this.lines = new THREE.LineSegments(lg, this.lineMat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 1;

    // --- Via Lattea, polveri e galassie vicine ---
    const glow = P();
    const dust = P();
    buildMilkyWay(glow, dust, quality.galaxyParticles, quality.dustParticles);
    buildDiskGalaxy(glow, dust, quality.tier === 'low' ? 9000 : 18000, 10.6847, 41.2687, 2537000 / 3.26156, 30000, (77 * Math.PI) / 180, (38 * Math.PI) / 180, 1.6, 7, 1);
    buildDiskGalaxy(glow, dust, quality.tier === 'low' ? 2500 : 5000, 23.4621, 30.6599, 2730000 / 3.26156, 9000, (55 * Math.PI) / 180, (23 * Math.PI) / 180, 1.2, 9, 2);
    buildBlob(glow, 3500, 80.894, -69.756, 163000 / 3.26156, 1600, 1.2, 11, 3);
    buildBlob(glow, 1800, 13.187, -72.829, 200000 / 3.26156, 1000, 1.1, 13, 4);
    const galToEqM = new THREE.Matrix3().set(
      R_EQ_GAL[0][0], R_EQ_GAL[1][0], R_EQ_GAL[2][0],
      R_EQ_GAL[0][1], R_EQ_GAL[1][1], R_EQ_GAL[2][1],
      R_EQ_GAL[0][2], R_EQ_GAL[1][2], R_EQ_GAL[2][2],
    );
    const shared = {
      uObs: obs, uBeta: beta, uPixPerRad: pixPerRad, uTime: time, uDim: dim, uHz: hz.uHz, uDimBelow: hz.uDimBelow,
      uGalToEq: { value: galToEqM }, uSunGal: { value: new THREE.Vector3(...SUN_GAL) }, uSpin: { value: 0 },
      uPF: this.pf,
    };
    const mobile = quality.tier === 'low' || quality.tier === 'mid';
    this.galMat = new THREE.ShaderMaterial({
      vertexShader: galVert, fragmentShader: galFrag,
      uniforms: { ...shared, uGain: { value: mobile ? 0.05 : 0.04 }, uMaxPx: { value: 90 }, uBoost: { value: 1 }, uOther: { value: 1 } },
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
    this.galaxy = new THREE.Points(toGeometry(glow), this.galMat);
    this.galaxy.frustumCulled = false;
    this.galaxy.renderOrder = 0;

    this.dustMat = new THREE.ShaderMaterial({
      vertexShader: galVert, fragmentShader: dustFrag,
      uniforms: { ...shared, uGain: { value: 0.022 }, uMaxPx: { value: 110 }, uBoost: { value: 1 }, uOther: { value: 1 } },
      // le polveri tolgono luce ma NON trasparenza: il canvas ha l'alfa (realtà aumentata) e sottrarre
      // anche l'alfa lo renderebbe trasparente (dischi neri su alcuni browser desktop)
      blending: THREE.CustomBlending, blendEquation: THREE.ReverseSubtractEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      depthTest: false, depthWrite: false, transparent: true,
    });
    this.dust = new THREE.Points(toGeometry(dust), this.dustMat);
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 0.5;

    // --- panorama fotografico della Via Lattea, visibile vicino al Sole ---
    const eqToGal = new THREE.Matrix3().set(
      R_EQ_GAL[0][0], R_EQ_GAL[0][1], R_EQ_GAL[0][2],
      R_EQ_GAL[1][0], R_EQ_GAL[1][1], R_EQ_GAL[1][2],
      R_EQ_GAL[2][0], R_EQ_GAL[2][1], R_EQ_GAL[2][2],
    );
    const mwTex = planetTexture('milkyway', false);
    mwTex.wrapS = THREE.RepeatWrapping;
    this.panoMat = new THREE.ShaderMaterial({
      vertexShader: panoVert, fragmentShader: panoFrag,
      uniforms: { uMap: { value: mwTex }, uEqToGal: { value: eqToGal }, uBeta: beta, uK: { value: 1 }, uDim: dim, uHz: hz.uHz, uDimBelow: hz.uDimBelow },
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.BackSide,
    });
    this.panorama = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), this.panoMat);
    this.panorama.frustumCulled = false;
    this.panorama.renderOrder = -0.5;

    this.igMat = new THREE.ShaderMaterial({
      vertexShader: igVert, fragmentShader: igFrag, uniforms: { uK: { value: 0 }, uScale: { value: 1 } },
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
    this.intergalactic = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), this.igMat);
    this.intergalactic.frustumCulled = false;
    this.intergalactic.renderOrder = -2;
    this.intergalactic.visible = false;

    const neb = P();
    buildNebulae(neb);
    this.nebMat = new THREE.ShaderMaterial({
      vertexShader: nebVert, fragmentShader: nebFrag,
      uniforms: { uObs: obs, uBeta: beta, uPixPerRad: pixPerRad, uTime: time, uDim: dim, uMaxPx: { value: 420 }, uHz: hz.uHz, uDimBelow: hz.uDimBelow },
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
    this.nebulae = new THREE.Points(toGeometry(neb), this.nebMat);
    this.nebulae.frustumCulled = false;
    this.nebulae.renderOrder = 0.7;

    // --- fondale di galassie lontanissime (direzioni fisse, distanza "infinita") ---
    const dr = rng(101);
    const nDeep = quality.tier === 'low' ? 1200 : 2400;
    const dp: number[] = [], dc: number[] = [], ds: number[] = [], da: number[] = [];
    for (let i = 0; i < nDeep; i++) {
      const z = dr() * 2 - 1, ph = dr() * Math.PI * 2, rr = Math.sqrt(1 - z * z);
      dp.push(rr * Math.cos(ph) * 1000, rr * Math.sin(ph) * 1000, z * 1000);
      const warm = dr() < 0.55;
      const k = 0.35 + dr() * 0.65;
      dc.push((warm ? 1.0 : 0.7) * k, (warm ? 0.85 : 0.8) * k, (warm ? 0.65 : 1.0) * k);
      ds.push(2 + Math.pow(dr(), 3) * 9);
      da.push(dr() * Math.PI);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    dg.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
    dg.setAttribute('size', new THREE.Float32BufferAttribute(ds, 1));
    dg.setAttribute('aAngle', new THREE.Float32BufferAttribute(da, 1));
    this.deepMat = new THREE.ShaderMaterial({
      vertexShader: deepVert, fragmentShader: deepFrag,
      uniforms: { uK: { value: 0 }, uScale: { value: 1 } },
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
    this.deep = new THREE.Points(dg, this.deepMat);
    this.deep.frustumCulled = false;
    this.deep.renderOrder = -1;
    this.deep.visible = false;

    const mwPlane = { a: new THREE.Vector3(...galToEq(1, 0, 0)), b: new THREE.Vector3(...galToEq(0, 1, 0)) };
    this.deepObjects = new DeepRenderer(GALACTIC_CENTER_PC, mwPlane);

    this.group.add(this.intergalactic, this.deep, this.panorama, this.deepObjects.group, this.galaxy, this.dust, this.nebulae, this.lines, this.starPoints);
  }

  update(u: BackgroundUpdate) {
    const su = this.starMat.uniforms;
    su.uObs.value.copy(u.obsPc);
    su.uBeta.value.copy(u.beta);
    su.uMagLimit.value = u.magLimit;
    su.uScale.value = u.pixelScale;
    su.uDim.value = u.dim;
    su.uTime.value = u.time;
    su.uTwinkle.value = u.twinkle;
    su.uNearCut.value = u.nearCutPc;
    su.uSpikes.value = u.spikes ?? 1;
    this.deepMat.uniforms.uScale.value = u.pixelScale;
    const bl = u.below;
    this.hz.uHz.value = bl ? 1 : 0;
    this.hz.uMagBelow.value = bl ? bl.mag : u.magLimit;
    this.hz.uDimBelow.value = bl ? bl.galaxyDim : u.galaxyDim;
    this.hz.uLineBelow.value = bl ? bl.lines : u.linesOpacity;
    const galVis = Math.max(u.galaxyDim, bl ? bl.galaxyDim : 0);
    this.lineMat.uniforms.uOpacity.value = u.linesOpacity;
    this.lines.visible = Math.max(u.linesOpacity, bl ? bl.lines : 0) > 0.001;
    const gu = this.galMat.uniforms;
    // vista da fuori: più luce e polveri più marcate per far risaltare bracci e bande scure
    const dgc = Math.hypot(u.obsPc.x - GALACTIC_CENTER_PC[0], u.obsPc.y - GALACTIC_CENTER_PC[1], u.obsPc.z - GALACTIC_CENTER_PC[2]);
    const out = Math.max(0, Math.min(1, (dgc - 12000) / 18000));
    // da molto lontano le particelle diventano più piccole di un pixel: si compensa per vedere la galassia intera
    const far = Math.max(0, Math.min(1, (dgc - 80000) / 500000));
    // fuori dalla Via Lattea: cielo intergalattico blu notte con stelle lontane
    const ig = u.deepField ? Math.max(0, Math.min(1, (dgc - 22000) / 40000)) : 0;
    this.igMat.uniforms.uK.value = ig;
    this.igMat.uniforms.uScale.value = Math.min(2, Math.max(0.6, u.pixPerRad / 900));
    this.intergalactic.visible = ig > 0.01;
    gu.uBoost.value = 1 + 1.8 * out + 6 * far;
    this.dustMat.uniforms.uBoost.value = 1 + 4 * out;
    // fondale di galassie lontane: compare quando ci si allontana dal Sole
    const fromSun = u.obsPc.length();
    this.deepMat.uniforms.uK.value = u.deepField ?? 0 ? Math.max(0, Math.min(1, (Math.log10(Math.max(fromSun, 1)) - 2.3) / 2.2)) : 0;
    this.deep.visible = this.deepMat.uniforms.uK.value > 0.01 && !this.lite;
    // le altre galassie risaltano di più quando si viaggia nello spazio intergalattico
    gu.uOther.value = 1 + 1.6 * this.deepMat.uniforms.uK.value;
    this.dustMat.uniforms.uOther.value = 1 + 1.6 * this.deepMat.uniforms.uK.value;
    gu.uPixPerRad.value = u.pixPerRad;
    gu.uDim.value = u.galaxyDim;
    gu.uSpin.value = u.galSpin ?? 0;
    this.dustMat.uniforms.uSpin.value = u.galSpin ?? 0;
    this.galaxy.visible = this.dust.visible = this.nebulae.visible = galVis > 0.001;
    if (this.lite) this.dust.visible = false;
    // render "fotografici" delle galassie e oggetti esotici; dissolvenza delle particelle
    this.deepObjects.update(u.obsPc, u.time, u.galaxyDim, u.galSpin ?? 0, u.pixPerRad);
    const pf = this.deepObjects.particleFactor;
    // vicino al Sole la Via Lattea è la foto vera; allontanandosi subentra il modello 3D
    const pano = 1 - Math.max(0, Math.min(1, (Math.log10(Math.max(fromSun, 1)) - 2.4) / 1.0));
    this.panoMat.uniforms.uK.value = pano * (u.panoGain ?? 1.6);
    this.panorama.visible = pano > 0.002 && galVis > 0.001;
    this.pf.value[0] = (pf.milkyway ?? 1) * (1 - 0.92 * pano); this.pf.value[1] = pf.m31g ?? 1; this.pf.value[2] = pf.m33g ?? 1;
    this.pf.value[3] = pf.lmc ?? 1; this.pf.value[4] = pf.smc ?? 1;
  }
}
