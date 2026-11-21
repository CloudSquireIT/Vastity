// Terreno lontano ricostruito dalle quote vere: LOLA (Lunar Reconnaissance Orbiter) per la Luna e
// MOLA (Mars Global Surveyor) per Marte, a 4 campioni per grado (dati NASA di pubblico dominio).
// Attorno al punto di atterraggio si costruisce una griglia polare fino a ~600 km, con la curvatura
// esatta del pianeta: dall'orizzonte spuntano davvero Olympus Mons, le pareti di Valles Marineris,
// il bordo del cratere Jezero o i Montes Apenninus. I colori vengono dalla mappa del pianeta.
import * as THREE from 'three';
import { planetTexture } from '../core/textures';

export const DEM_WORLDS: Record<string, { url: string; radiusKm: number; map: string; hazeKm: number }> = {
  moon: { url: 'dem/moon.png', radiusKm: 1737.4, map: 'moon', hazeKm: 0 },
  mars: { url: 'dem/mars.png', radiusKm: 3389.5, map: 'mars', hazeKm: 70 },
};
const DW = 1440, DH = 720;
const cache = new Map<string, Promise<Float32Array | null>>();

/** Quote in metri (riga 0 = 90° N, colonna 0 = longitudine 0°, verso est), o null se non disponibili. */
export function loadDem(id: string): Promise<Float32Array | null> {
  const w = DEM_WORLDS[id];
  if (!w) return Promise.resolve(null);
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      try {
        const blob = await (await fetch(w.url)).blob();
        // decodifica senza gestione del colore: i byte sono numeri, non colori
        const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
        const cv = document.createElement('canvas');
        cv.width = DW; cv.height = DH;
        const ctx = cv.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(bmp, 0, 0);
        const px = ctx.getImageData(0, 0, DW, DH).data;
        const out = new Float32Array(DW * DH);
        for (let i = 0; i < out.length; i++) out[i] = px[i * 4] * 256 + px[i * 4 + 1] - 32768;
        return out;
      } catch { return null; }
    })();
    cache.set(id, p);
  }
  return p;
}

/** Quota (m) interpolata in un punto (gradi, longitudine est). */
export function demAt(d: Float32Array, lat: number, lon: number) {
  const x = ((((lon % 360) + 360) % 360) * DW) / 360 - 0.5;
  const y = Math.max(0, Math.min(DH - 1.001, ((90 - lat) * DH) / 180 - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const c0 = ((x0 % DW) + DW) % DW, c1 = (c0 + 1) % DW;
  const r0 = y0 * DW, r1 = (y0 + 1) * DW;
  return (d[r0 + c0] * (1 - fx) + d[r0 + c1] * fx) * (1 - fy) + (d[r1 + c0] * (1 - fx) + d[r1 + c1] * fx) * fy;
}

/** Punto a distanza `distM` e azimut `az` (rad, da nord verso est) da (lat0, lon0) sulla sfera. */
function dest(lat0: number, lon0: number, az: number, delta: number): [number, number] {
  const p0 = (lat0 * Math.PI) / 180;
  const sl = Math.sin(p0) * Math.cos(delta) + Math.cos(p0) * Math.sin(delta) * Math.cos(az);
  const lat = Math.asin(Math.max(-1, Math.min(1, sl)));
  const lon = (lon0 * Math.PI) / 180 + Math.atan2(Math.sin(az) * Math.sin(delta) * Math.cos(p0), Math.cos(delta) - Math.sin(p0) * sl);
  return [(lat * 180) / Math.PI, (lon * 180) / Math.PI];
}

/** Metri → unità della scena: 600 km stanno entro il piano lontano della camera (la prospettiva non cambia). */
export const KF = 0.0055;
const R0 = 2400, RMAX = 620000, NR = 120, NS = 360;

const vert = /* glsl */ `
varying vec3 vN;
varying vec2 vUv;
varying float vDist;
void main() {
  vN = normal;
  vUv = uv;
  vDist = length(position.xz) / ${KF.toFixed(5)};
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const frag = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uSun;
uniform float uDay;
uniform float uHazeKm;
uniform vec3 uHazeColor;
varying vec3 vN;
varying vec2 vUv;
varying float vDist;
void main() {
  vec3 n = normalize(vN);
  vec3 alb = texture2D(uMap, vUv).rgb * 1.25;
  float sunUp = smoothstep(-0.02, 0.04, uSun.y);
  float lam = max(dot(n, normalize(uSun)), 0.0) * sunUp;
  vec3 amb = uHazeKm > 0.0 ? uHazeColor * 0.3 * uDay : vec3(0.026, 0.028, 0.036);
  vec3 c = alb * (lam * 1.25 + amb);
  // foschia (Marte) o una leggera perdita di contrasto con la distanza (Luna)
  float f = uHazeKm > 0.0 ? 1.0 - exp(-vDist / (uHazeKm * 1000.0)) : 1.0 - exp(-vDist / 900000.0);
  c = mix(c, uHazeKm > 0.0 ? uHazeColor * (0.2 + 0.8 * uDay) : c * 0.6, f);
  gl_FragColor = vec4(pow(max(c, 0.0), vec3(1.0 / 2.2)), 1.0);
}`;

export class FarTerrain {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  ready = false;
  private geo: THREE.BufferGeometry;
  private token = 0;

  constructor() {
    this.geo = new THREE.BufferGeometry();
    const n = 1 + NR * NS;
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const idx: number[] = [];
    for (let s = 0; s < NS; s++) idx.push(0, 1 + ((s + 1) % NS), 1 + s);
    for (let r = 0; r < NR - 1; r++) for (let s = 0; s < NS; s++) {
      const a = 1 + r * NS + s, b = 1 + r * NS + ((s + 1) % NS), c = a + NS, d = b + NS;
      idx.push(a, b, c, b, d, c);
    }
    this.geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
      transparent: true, depthWrite: true, depthTest: true,
      uniforms: {
        uMap: { value: null }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uDay: { value: 1 },
        uHazeKm: { value: 0 }, uHazeColor: { value: new THREE.Color(0xc49a78).convertSRGBToLinear() },
      },
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    // prima del terreno vicino, su un depth buffer pulito: copre stelle e astri sotto il profilo dei monti
    this.mesh.renderOrder = 899;
    this.mesh.onBeforeRender = (r) => r.clearDepth();
    this.mesh.visible = false;
  }

  /**
   * Ricostruisce il paesaggio attorno a (lat, lon). Restituisce la pendenza locale (est, nord, m/m)
   * per raccordare il terreno vicino, oppure null se il mondo non ha quote.
   */
  async build(id: string, lat: number, lon: number, eye: number): Promise<{ gE: number; gN: number; uv: [number, number] } | null> {
    const t = ++this.token;
    this.ready = false;
    const w = DEM_WORLDS[id];
    const dem = w ? await loadDem(id) : null;
    if (!w || !dem || t !== this.token) return null;
    const R = w.radiusKm * 1000;
    const h0 = demAt(dem, lat, lon);
    const ro = R + h0 + eye;
    const pos = this.geo.attributes.position.array as Float32Array;
    const uv = this.geo.attributes.uv.array as Float32Array;
    const lonE = (l: number) => ((((l + 180) % 360) + 360) % 360) / 360;
    pos[0] = 0; pos[1] = -eye * KF; pos[2] = 0;
    uv[0] = lonE(lon); uv[1] = (lat + 90) / 180;
    for (let r = 0; r < NR; r++) {
      const dist = R0 * Math.pow(RMAX / R0, r / (NR - 1));
      const delta = dist / R;
      for (let s = 0; s < NS; s++) {
        const az = (s / NS) * Math.PI * 2;
        const [la, lo] = dest(lat, lon, az, delta);
        const rp = R + demAt(dem, la, lo);
        const horiz = rp * Math.sin(delta), y = rp * Math.cos(delta) - ro;
        const i = 1 + r * NS + s;
        // x est, z sud (come il resto della scena)
        pos[i * 3] = Math.sin(az) * horiz * KF;
        pos[i * 3 + 1] = y * KF;
        pos[i * 3 + 2] = -Math.cos(az) * horiz * KF;
        uv[i * 2] = lonE(lo);
        uv[i * 2 + 1] = (la + 90) / 180;
      }
    }
    // le UV attraversano l'antimeridiano: si evita la "cucitura" sostituendo i salti con il valore vicino
    for (let r = 0; r < NR; r++) for (let s = 0; s < NS; s++) {
      const i = 1 + r * NS + s, ref = 1 + r * NS;
      const du = uv[i * 2] - uv[ref * 2];
      if (du > 0.5) uv[i * 2] -= 1; else if (du < -0.5) uv[i * 2] += 1;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
    this.geo.computeVertexNormals();
    // normali verso l'alto
    const nrm = this.geo.attributes.normal.array as Float32Array;
    let sy = 0;
    for (let i = 1; i < nrm.length; i += 3) sy += nrm[i];
    if (sy < 0) for (let i = 0; i < nrm.length; i++) nrm[i] = -nrm[i];
    const tex = planetTexture(w.map);
    tex.wrapS = THREE.RepeatWrapping;
    this.mat.uniforms.uMap.value = tex;
    this.mat.uniforms.uHazeKm.value = w.hazeKm;
    this.ready = true;
    // pendenza locale su ±4 km per raccordare il terreno vicino
    const e = 4000 / R;
    const [laN, loN] = dest(lat, lon, 0, e), [laS, loS] = dest(lat, lon, Math.PI, e);
    const [laE, loE] = dest(lat, lon, Math.PI / 2, e), [laW, loW] = dest(lat, lon, -Math.PI / 2, e);
    return {
      gN: (demAt(dem, laN, loN) - demAt(dem, laS, loS)) / 8000,
      gE: (demAt(dem, laE, loE) - demAt(dem, laW, loW)) / 8000,
      uv: [lonE(lon), (lat + 90) / 180],
    };
  }

  setSun(local: THREE.Vector3, day: number) {
    this.mat.uniforms.uSun.value.copy(local);
    this.mat.uniforms.uDay.value = day;
  }
}
