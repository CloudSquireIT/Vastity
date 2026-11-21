// Terreno procedurale per la superficie dei mondi solidi (Luna, Mercurio, Marte, Plutone, esopianeti
// rocciosi): un campo d'altezza su griglia polare attorno all'osservatore, fino all'orizzonte vero
// (curvatura del pianeta inclusa). Colline a più scale (fBm), crateri con bordo rialzato, dune o
// ghiaccio a seconda del mondo; luce dal Sole nella sua posizione reale. Approccio "heightfield"
// della skill shader-art-coding, con hash interi PCG (niente hash a seno) e normali per differenze finite.
import * as THREE from 'three';
import { FarTerrain } from './farTerrain';
import { planetTexture } from '../core/textures';

export type TerrainKind = 'craters' | 'dunes' | 'ice';
export interface TerrainLook { kind: TerrainKind; a1: number; a2: number; radiusKm: number; haze?: number; hazeColor?: number; relief?: number }

export const TERRAIN: Record<string, TerrainLook> = {
  moon: { kind: 'craters', a1: 0x8e8b86, a2: 0x5e5c59, radiusKm: 1737.4, relief: 1 },
  mercury: { kind: 'craters', a1: 0x8a7f74, a2: 0x5a524b, radiusKm: 2439.7, relief: 1.1 },
  mars: { kind: 'dunes', a1: 0xb0653a, a2: 0x6e3a22, radiusKm: 3389.5, haze: 0.55, hazeColor: 0xc49a78, relief: 1.3 },
  pluto: { kind: 'ice', a1: 0xd9cbb8, a2: 0x9a7f68, radiusKm: 1188.3, relief: 0.8 },
  proxima: { kind: 'dunes', a1: 0x6e3326, a2: 0x341712, radiusKm: 7000, haze: 0.35, hazeColor: 0x5a2218, relief: 1.4 },
  trappist: { kind: 'ice', a1: 0x6d6470, a2: 0x3a3340, radiusKm: 5800, haze: 0.3, hazeColor: 0x3a1f24, relief: 1 },
};

/** Metri reali → unità della scena: il terreno resta entro ~800 unità, davanti agli astri (a ~1000). */
const K = 0.24;
const EYE = 1.7;
const MAXR = 3300;

const common = /* glsl */ `
uniform float uSeed;
uniform float uKind;
uniform float uRelief;
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hash12(vec2 p) { uvec2 q = uvec2(ivec2(floor(p)) + ivec2(65536)); return float(pcg(q.x + pcg(q.y + uint(uSeed)))) / 4294967295.0; }
vec2 hash22(vec2 p) { return vec2(hash12(p), hash12(p + 17.31)); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 5; k++) { s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s; }
float ridged(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * (1.0 - abs(vnoise(p) * 2.0 - 1.0)); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s; }
// crateri: uno per cella (se presente), conca parabolica, bordo rialzato, ejecta che sfuma
float craters(vec2 p, float cell, float depth) {
  vec2 g = floor(p / cell); float h = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = g + vec2(float(i), float(j));
    if (hash12(c + 3.7) > 0.55) continue;
    vec2 o = (c + 0.2 + 0.6 * hash22(c)) * cell;
    float r = cell * (0.12 + 0.3 * hash12(c + 9.1));
    float d = length(p - o) / r;
    if (d < 1.0) h += depth * r * (d * d - 1.0) * 0.18;
    h += depth * r * 0.07 * exp(-pow((d - 1.0) * 5.0, 2.0));
    h += depth * r * 0.015 * exp(-max(d - 1.0, 0.0) * 2.5) * step(1.0, d);
  }
  return h;
}
float height(vec2 p) {
  float h = (fbm(p / 900.0) - 0.5) * 60.0 + (fbm(p / 90.0) - 0.5) * 6.0 + (vnoise(p / 6.0) - 0.5) * 0.5;
  if (uKind < 0.5) {
    h += craters(p, 380.0, 1.0) + craters(p + 1234.0, 70.0, 1.0) + craters(p - 777.0, 14.0, 0.8);
  } else if (uKind < 1.5) {
    // dune ondulate deformate dal vento, qualche masso
    vec2 w = p + 40.0 * vec2(fbm(p / 300.0), fbm(p / 300.0 + 5.0));
    h += sin(w.x / 38.0 + w.y / 70.0) * 2.2 * fbm(p / 400.0) + ridged(p / 260.0) * 14.0;
    h += craters(p, 260.0, 0.6) + pow(max(vnoise(p / 3.0) - 0.8, 0.0), 2.0) * 9.0;
  } else {
    // ghiaccio: pianure lisce, creste e celle poligonali
    h = (fbm(p / 1200.0) - 0.5) * 40.0 + ridged(p / 180.0) * 10.0 * smoothstep(0.45, 0.7, fbm(p / 700.0));
    h += (vnoise(p / 25.0) - 0.5) * 1.2;
  }
  return h * uRelief;
}
`;

const vert = /* glsl */ `
${common}
uniform float uRadius;
uniform float uK;
uniform vec2 uTilt;
varying vec3 vN;
varying vec2 vP;
varying float vDist;
// rilievo procedurale che si attenua verso il bordo (dove comincia il terreno ricostruito dalle quote vere),
// più la pendenza reale del luogo
float hn(vec2 q) { return height(q) * (1.0 - 0.8 * smoothstep(${(MAXR * 0.45).toFixed(1)}, ${MAXR.toFixed(1)}, length(q))) + dot(uTilt, q); }
void main() {
  vec2 p = position.xz;
  float h = hn(p);
  float d = length(p);
  // curvatura del pianeta: la superficie scende con la distanza (orizzonte vero)
  // l'osservatore sta sempre 1,7 m sopra il suolo del punto in cui si trova
  float y = h - hn(vec2(0.0)) - ${EYE.toFixed(1)} - d * d / (2.0 * uRadius);
  float e = max(0.6, d * 0.01);
  float hx = hn(p + vec2(e, 0.0)) - hn(p - vec2(e, 0.0));
  float hz = hn(p + vec2(0.0, e)) - hn(p - vec2(0.0, e));
  vN = normalize(vec3(-hx, 2.0 * e, -hz));
  vP = p;
  vDist = d;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x * uK, y * uK, p.y * uK, 1.0);
}
`;

const frag = /* glsl */ `
${common}
uniform vec3 uSun;
uniform vec3 uA1;
uniform vec3 uA2;
uniform vec3 uHazeColor;
uniform float uHaze;
uniform float uDay;
uniform sampler2D uMap;
uniform vec2 uSiteUv;
uniform float uHasSite;
varying vec3 vN;
varying vec2 vP;
varying float vDist;
void main() {
  vec3 n = normalize(vN);
  // albedo: chiazze grandi, grana fine, roccia più scura sui pendii
  float big = fbm(vP / 160.0), fine = vnoise(vP / 2.5) * 0.6 + vnoise(vP / 0.7) * 0.4;
  vec3 alb = mix(uA2, uA1, smoothstep(0.25, 0.75, big)) * (0.82 + 0.3 * fine);
  float slope = 1.0 - n.y;
  alb = mix(alb, uA2 * 0.7, smoothstep(0.25, 0.6, slope));
  if (uKind > 1.5) alb = mix(alb, uA1 * 1.08, smoothstep(0.55, 0.7, fbm(vP / 50.0)));
  // colore del suolo del luogo vero (dalla mappa del pianeta), così il terreno vicino si raccorda a quello lontano
  if (uHasSite > 0.5) alb *= clamp(texture2D(uMap, uSiteUv).rgb * 1.25 / max((uA1 + uA2) * 0.5, vec3(0.01)), 0.2, 3.0);
  float sunUp = smoothstep(-0.02, 0.04, uSun.y);
  float lam = max(dot(n, normalize(uSun)), 0.0) * sunUp;
  // senza atmosfera il cielo non illumina: ombre nere e luce dura; con atmosfera, un po' di luce diffusa
  vec3 amb = mix(vec3(0.026, 0.028, 0.036), uHazeColor * 0.35 * uDay, uHaze);
  vec3 c = alb * (lam * 1.25 + amb);
  // foschia verso l'orizzonte (Marte) o lieve dissolvenza (mondi senza aria)
  float f = 1.0 - exp(-vDist / mix(9000.0, 1400.0, uHaze));
  c = mix(c, uHazeColor * (0.25 + 0.75 * uDay) * uHaze + c * (1.0 - uHaze) * 0.6, f * max(uHaze, 0.25));
  c = pow(c, vec3(1.0 / 2.2));
  gl_FragColor = vec4(c, 1.0);
}
`;

export class SurfaceTerrain {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  /** Paesaggio lontano dalle quote vere (Luna, Marte). */
  far = new FarTerrain();
  private cur = '';

  constructor() {
    // griglia polare: anelli sempre più radi verso l'orizzonte
    const rings = 72, seg = 144;
    const pos: number[] = [];
    const idx: number[] = [];
    pos.push(0, 0, 0);
    for (let r = 1; r <= rings; r++) {
      const d = 1.2 * Math.pow(MAXR / 1.2, r / rings);
      for (let s = 0; s < seg; s++) { const a = (s / seg) * Math.PI * 2; pos.push(Math.cos(a) * d, 0, Math.sin(a) * d); }
    }
    for (let s = 0; s < seg; s++) idx.push(0, 1 + s, 1 + ((s + 1) % seg));
    for (let r = 1; r < rings; r++) for (let s = 0; s < seg; s++) {
      const a = 1 + (r - 1) * seg + s, b = 1 + (r - 1) * seg + ((s + 1) % seg), c = a + seg, d = b + seg;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
      // nella coda dei trasparenti (come stelle e linee) per essere disegnato dopo di loro; resta opaco
      transparent: true, depthWrite: true, depthTest: true,
      uniforms: {
        uSeed: { value: 7 }, uKind: { value: 0 }, uRelief: { value: 1 }, uRadius: { value: 1.7e6 }, uK: { value: K },
        uSun: { value: new THREE.Vector3(0, 1, 0) }, uA1: { value: new THREE.Color() }, uA2: { value: new THREE.Color() },
        uHazeColor: { value: new THREE.Color() }, uHaze: { value: 0 }, uDay: { value: 1 },
        uTilt: { value: new THREE.Vector2() }, uMap: { value: null }, uSiteUv: { value: new THREE.Vector2() }, uHasSite: { value: 0 },
      },
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    // disegnato per ultimo e su un depth buffer pulito: copre stelle, linee e astri sotto l'orizzonte,
    // mentre le sue colline si coprono correttamente tra loro
    this.mesh.renderOrder = 900;
    this.mesh.onBeforeRender = (r) => r.clearDepth();
    this.mesh.visible = false;
  }

  hasWorld() { return this.cur !== ''; }

  /** Imposta il mondo; `seed` cambia il paesaggio a seconda del punto di atterraggio. */
  setWorld(id: string | null, seed = 7, site?: { lat: number; lon: number }) {
    const look = id ? TERRAIN[id] : undefined;
    this.mesh.visible = !!look;
    if (!look) { this.cur = ''; this.far.ready = false; return; }
    const key = `${id}:${seed}:${site?.lat}:${site?.lon}`;
    if (key === this.cur) return;
    this.cur = key;
    const u0 = this.mat.uniforms;
    u0.uTilt.value.set(0, 0);
    u0.uHasSite.value = 0;
    this.far.ready = false;
    if (site && id) {
      this.far.build(id, site.lat, site.lon, EYE).then((r) => {
        if (!r || this.cur !== key) return;
        // x est, z sud: la quota cresce di gE verso est e di gN verso nord
        u0.uTilt.value.set(r.gE, -r.gN);
        u0.uMap.value = planetTexture(id);
        u0.uSiteUv.value.set(r.uv[0], r.uv[1]);
        u0.uHasSite.value = 1;
      });
    }
    const u = this.mat.uniforms;
    u.uSeed.value = Math.abs(Math.floor(seed)) % 100000;
    u.uKind.value = look.kind === 'craters' ? 0 : look.kind === 'dunes' ? 1 : 2;
    u.uRelief.value = look.relief ?? 1;
    u.uRadius.value = look.radiusKm * 1000;
    u.uA1.value.set(look.a1).convertSRGBToLinear();
    u.uA2.value.set(look.a2).convertSRGBToLinear();
    u.uHaze.value = look.haze ?? 0;
    u.uHazeColor.value.set(look.hazeColor ?? 0x000000).convertSRGBToLinear();
  }

  /** Direzione del Sole nel riferimento locale (x est, y alto, z sud) e luce del giorno 0–1. */
  setSun(local: THREE.Vector3, day: number) {
    this.mat.uniforms.uSun.value.copy(local);
    this.mat.uniforms.uDay.value = day;
    this.far.setSun(local, day);
  }
}
