// Sfondo celeste 3D condiviso: stelle reali (con posizione in parsec), linee delle
// costellazioni, Via Lattea a particelle, Andromeda e Nubi di Magellano.
// Tutto è calcolato rispetto a un osservatore uObs (parsec), quindi funziona
// dalla Terra, da un esopianeta o dalla navicella. Include gli effetti relativistici
// (aberrazione e Doppler) quando la navicella si avvicina alla velocità della luce.
import * as THREE from 'three';
import { constellations, radecToVec, stars } from '../data/catalog';

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
// n: direzione verso la sorgente nel riferimento "fermo". Restituisce la direzione osservata
// e scrive in D il fattore Doppler.
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

const starVert = /* glsl */ `
attribute float absmag;
attribute float temp;
uniform vec3 uObs;
uniform float uMagLimit;
uniform float uScale;
uniform float uNearCut;
uniform float uTime;
uniform float uTwinkle;
varying vec3 vColor;
varying float vAlpha;
${BLACKBODY}
${RELATIVITY}
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec3 rel = position - uObs;
  float d = length(rel);
  float D;
  vec3 dir = aberrate(rel / d, D);
  float m = absmag + 5.0 * log(d) / log(10.0) - 5.0 - 2.5 * 1.2 * log(D) / log(10.0);
  float Tobs = temp * D;
  float s = uMagLimit - m;
  if (d < uNearCut || s < 0.0 || Tobs < 600.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }
  vec4 mv = modelViewMatrix * vec4(dir * 1000.0, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 1.0 + uTwinkle * 0.22 * sin(uTime * (3.0 + hash(float(gl_VertexID)) * 5.0) + hash(float(gl_VertexID) * 1.3) * 6.28);
  gl_PointSize = clamp(2.0 + s * 1.25, 2.0, 18.0) * uScale;
  vAlpha = clamp(0.22 + s * 0.5, 0.0, 1.0) * (1.0 + max(0.0, s - 5.0) * 0.25) * tw;
  vec3 c = blackbody(Tobs);
  vColor = mix(c, vec3(1.0), 0.3) * (Tobs > 40000.0 ? 1.15 : 1.0);
}
`;

const starFrag = /* glsl */ `
uniform float uDim;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * 6.0);
  float halo = exp(-r * 3.0) * 0.28;
  gl_FragColor = vec4(vColor * (core + halo) * vAlpha * uDim, 1.0);
}
`;

const lineVert = /* glsl */ `
uniform vec3 uObs;
${RELATIVITY}
void main() {
  vec3 rel = position - uObs;
  float D;
  vec3 dir = aberrate(normalize(rel), D);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * 990.0, 1.0);
}
`;
const lineFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uColor * uOpacity, 1.0); }
`;

const galVert = /* glsl */ `
attribute vec3 color;
attribute float size;
uniform vec3 uObs;
uniform float uPixPerRad;
varying vec3 vColor;
varying float vAlpha;
${RELATIVITY}
void main() {
  vec3 rel = position - uObs;
  float d = length(rel);
  float D;
  vec3 dir = aberrate(rel / d, D);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * 1000.0, 1.0);
  float s = size / d * uPixPerRad;
  float a = smoothstep(size * 0.6, size * 3.0, d);
  if (s < 1.5) { a *= (s * s) / 2.25; s = 1.5; }
  if (s > 90.0) { a *= 90.0 / s; s = 90.0; }
  gl_PointSize = s;
  vAlpha = a / max(1.0, D * D);
  vColor = color * clamp(sqrt(D), 0.4, 1.4);
}
`;
const galFrag = /* glsl */ `
uniform float uDim;
uniform float uGain;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r2 = dot(p, p) * 4.0;
  if (r2 > 1.0) discard;
  float f = exp(-r2 * 3.0) - 0.05;
  gl_FragColor = vec4(vColor * f * vAlpha * uDim * uGain, 1.0);
}
`;

// Matrice galattico → equatoriale J2000 (trasposta di quella eq → gal)
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

export const GALACTIC_CENTER_PC = galToEq(8200, 0, -20);

interface Particles { pos: number[]; col: number[]; size: number[] }

function buildMilkyWay(p: Particles, n: number) {
  const r = rng(42);
  const sunGal = [-8200, 0, 20];
  const pitch = (12.5 * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number, c: [number, number, number], s: number;
    const u = r();
    if (u < 0.16) {
      // bulge + barra
      const bx = gauss(r) * 1400, by = gauss(r) * 520, bz = gauss(r) * 380;
      const a = (27 * Math.PI) / 180;
      x = bx * Math.cos(a) - by * Math.sin(a);
      y = bx * Math.sin(a) + by * Math.cos(a);
      z = bz;
      c = [1.0, 0.82, 0.58];
      s = 220 + r() * 220;
    } else {
      let rad = -Math.log(1 - r() * 0.985) * 3600 + 1200;
      if (rad > 17000) rad = 1200 + r() * 15000;
      let th: number;
      const arm = Math.floor(r() * 4);
      if (r() < 0.72) {
        th = Math.log(rad / 2400) / Math.tan(pitch) + (arm * Math.PI) / 2 + gauss(r) * 0.22;
        c = r() < 0.12 ? [1.0, 0.55, 0.65] : [0.72, 0.8, 1.0];
      } else {
        th = r() * Math.PI * 2;
        c = [0.95, 0.88, 0.78];
      }
      x = rad * Math.cos(th);
      y = rad * Math.sin(th);
      z = gauss(r) * (110 + rad * 0.012);
      s = 90 + r() * 170;
    }
    const e = galToEq(x - sunGal[0], y - sunGal[1], z - sunGal[2]);
    p.pos.push(e[0], e[1], e[2]);
    const k = 0.5 + r() * 0.5;
    p.col.push(c[0] * k, c[1] * k, c[2] * k);
    p.size.push(s);
  }
}

function buildDiskGalaxy(p: Particles, n: number, raDeg: number, decDeg: number, distPc: number, radiusPc: number, incl: number, pa: number, bright: number, seed: number) {
  const r = rng(seed);
  const l = radecToVec(raDeg, decDeg);
  const L = new THREE.Vector3(...l);
  const n0 = new THREE.Vector3(0, 0, 1).sub(L.clone().multiplyScalar(L.z)).normalize();
  const e0 = new THREE.Vector3().crossVectors(n0, L).normalize().negate();
  const a = n0.clone().multiplyScalar(Math.cos(pa)).add(e0.clone().multiplyScalar(Math.sin(pa)));
  const m = new THREE.Vector3().crossVectors(L, a);
  const normal = L.clone().multiplyScalar(Math.cos(incl)).add(m.multiplyScalar(Math.sin(incl))).normalize();
  const b = new THREE.Vector3().crossVectors(normal, a).normalize();
  const center = L.clone().multiplyScalar(distPc);
  for (let i = 0; i < n; i++) {
    const core = r() < 0.25;
    const rad = core ? Math.abs(gauss(r)) * radiusPc * 0.12 : -Math.log(1 - r() * 0.98) * radiusPc * 0.25;
    const arm = Math.floor(r() * 2);
    const th = core ? r() * 6.283 : Math.log(rad / (radiusPc * 0.1) + 1) * 3.2 + arm * Math.PI + gauss(r) * 0.35;
    const zz = gauss(r) * radiusPc * (core ? 0.06 : 0.015);
    const pnt = center.clone().add(a.clone().multiplyScalar(rad * Math.cos(th))).add(b.clone().multiplyScalar(rad * Math.sin(th))).add(normal.clone().multiplyScalar(zz));
    p.pos.push(pnt.x, pnt.y, pnt.z);
    const c = core ? [1, 0.85, 0.65] : [0.75, 0.82, 1];
    const k = (0.5 + r() * 0.5) * bright;
    p.col.push(c[0] * k, c[1] * k, c[2] * k);
    p.size.push(radiusPc * (core ? 0.05 : 0.035));
  }
}

function buildBlob(p: Particles, n: number, raDeg: number, decDeg: number, distPc: number, radiusPc: number, bright: number, seed: number) {
  const r = rng(seed);
  const c = radecToVec(raDeg, decDeg).map((v) => v * distPc);
  for (let i = 0; i < n; i++) {
    p.pos.push(c[0] + gauss(r) * radiusPc, c[1] + gauss(r) * radiusPc * 0.7, c[2] + gauss(r) * radiusPc * 0.6);
    const k = (0.5 + r() * 0.5) * bright;
    p.col.push(0.8 * k, 0.85 * k, 1 * k);
    p.size.push(radiusPc * 0.12);
  }
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
}

export class Background {
  group = new THREE.Group();
  starPoints: THREE.Points;
  lines: THREE.LineSegments;
  galaxy: THREE.Points;
  private starMat: THREE.ShaderMaterial;
  private lineMat: THREE.ShaderMaterial;
  private galMat: THREE.ShaderMaterial;
  /** Per ogni costellazione: indici dei vertici-stella delle sue linee. */
  lineStars: Map<string, number[]> = new Map();

  constructor() {
    const beta = { value: new THREE.Vector3() };
    const obs = { value: new THREE.Vector3() };
    // --- stelle (+ il Sole in coda) ---
    const n = stars.count + 1;
    const pos = new Float32Array(n * 3);
    pos.set(stars.pos);
    const absmag = new Float32Array(n);
    absmag.set(stars.absmag);
    absmag[n - 1] = 4.83;
    const temp = new Float32Array(n);
    temp.set(stars.temp);
    temp[n - 1] = 5772;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('absmag', new THREE.BufferAttribute(absmag, 1));
    g.setAttribute('temp', new THREE.BufferAttribute(temp, 1));
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: starVert, fragmentShader: starFrag,
      uniforms: {
        uObs: obs, uBeta: beta, uMagLimit: { value: 6.5 }, uScale: { value: 1 }, uNearCut: { value: 1e-4 },
        uDim: { value: 1 }, uTime: { value: 0 }, uTwinkle: { value: 0 },
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
      uniforms: { uObs: obs, uBeta: beta, uColor: { value: new THREE.Color(0.45, 0.62, 0.95) }, uOpacity: { value: 0.5 } },
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
    this.lines = new THREE.LineSegments(lg, this.lineMat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 1;

    // --- Via Lattea e galassie vicine ---
    const p: Particles = { pos: [], col: [], size: [] };
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
    buildMilkyWay(p, mobile ? 45000 : 80000);
    buildDiskGalaxy(p, 9000, 10.6847, 41.2687, 765000, 30000, (77 * Math.PI) / 180, (38 * Math.PI) / 180, 1.6, 7);
    buildDiskGalaxy(p, 2500, 23.4621, 30.6599, 840000, 9000, (55 * Math.PI) / 180, (23 * Math.PI) / 180, 1.2, 9);
    buildBlob(p, 3500, 80.894, -69.756, 50000, 1600, 1.2, 11);
    buildBlob(p, 1800, 13.187, -72.829, 62000, 1000, 1.1, 13);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
    gg.setAttribute('color', new THREE.Float32BufferAttribute(p.col, 3));
    gg.setAttribute('size', new THREE.Float32BufferAttribute(p.size, 1));
    this.galMat = new THREE.ShaderMaterial({
      vertexShader: galVert, fragmentShader: galFrag,
      uniforms: { uObs: obs, uBeta: beta, uPixPerRad: { value: 800 }, uDim: { value: 1 }, uGain: { value: mobile ? 0.05 : 0.035 } },
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    });
    this.galaxy = new THREE.Points(gg, this.galMat);
    this.galaxy.frustumCulled = false;
    this.galaxy.renderOrder = 0;

    this.group.add(this.galaxy, this.lines, this.starPoints);
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
    this.lineMat.uniforms.uOpacity.value = u.linesOpacity;
    this.lines.visible = u.linesOpacity > 0.001;
    this.galMat.uniforms.uPixPerRad.value = u.pixPerRad;
    this.galMat.uniforms.uDim.value = u.galaxyDim;
    this.galaxy.visible = u.galaxyDim > 0.001;
  }
}
