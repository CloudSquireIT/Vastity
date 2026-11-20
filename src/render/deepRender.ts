// Render 3D degli oggetti del profondo cielo:
// - galassie come dischi procedurali inclinati nel loro vero piano (riconoscibili da lontano),
//   che sfumano nelle particelle quando ci si entra;
// - buchi neri (ombra, anello di fotoni, disco di accrescimento), quasar con getti, pulsar con fasci.
import * as THREE from 'three';
import { DeepObject, deepObjects } from '../data/deep';
import { radecToVec } from '../data/catalog';
import { blankTexture, planetTexture } from '../core/textures';

const LY_PC = 1 / 3.26156;

const NOISE = /* glsl */ `
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
`;

// ----------------------------------------------------------------------------- galassie
const galVert = /* glsl */ `
uniform vec3 uObs;
uniform vec3 uCenter;
uniform vec3 uA;
uniform vec3 uB;
uniform float uR;
varying vec2 vP;
void main() {
  vP = (uv - 0.5) * 2.0 * 1.25;
  vec3 p = uCenter + (uA * vP.x + uB * vP.y) * uR;
  vec3 rel = p - uObs;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(normalize(rel) * 1000.0, 1.0);
}
`;

const galFrag = /* glsl */ `
uniform float uShape;   // 0 spirale, 1 barrata, 2 ellittica, 3 lenticolare, 4 irregolare, 5 anello
uniform float uArms;
uniform float uSeed;
uniform float uK;
uniform float uSpin;
uniform vec3 uTint;
uniform sampler2D uMap;
uniform float uUseMap;  // 1 = render fotografico (texture reale di una galassia vista di fronte)
uniform float uMirror;
uniform float uRot;
uniform float uBright;
varying vec2 vP;
${NOISE}
void main() {
  float r = length(vP);
  if (r > 1.25) discard;
  if (uUseMap > 0.5) {
    // galassia vista da fuori come nelle foto: texture reale ruotata nel piano del disco
    float a = uRot + uSpin;
    vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * vec2(vP.x * uMirror, vP.y);
    vec2 uv = 0.5 + q * (0.5 / 1.12);
    float lent = (uShape > 2.5 && uShape < 3.5) ? 1.0 : 0.0;
    vec3 c = texture2D(uMap, uv, lent * 3.0).rgb;
    // lenticolari: disco liscio e caldo, senza bracci evidenti
    float l = dot(c, vec3(0.33, 0.5, 0.17));
    c = mix(c, vec3(l) * vec3(1.05, 0.95, 0.82), lent * 0.75);
    c *= mix(vec3(1.0), uTint, 0.5);
    // esposizione morbida: colori della foto senza bruciare il nucleo
    c = 1.0 - exp(-c * 1.35);
    float edge = 1.0 - smoothstep(1.0, 1.2, r);
    gl_FragColor = vec4(c * edge * uK * uBright, 1.0);
    return;
  }
  float th = atan(vP.y, vP.x) + uSpin;
  vec2 q = vec2(cos(th), sin(th)) * r;
  vec3 warm = vec3(1.0, 0.82, 0.58);
  vec3 blue = vec3(0.55, 0.7, 1.0) * uTint;
  vec3 pink = vec3(1.0, 0.38, 0.6);
  vec3 col = vec3(0.0);
  float edge = 1.0 - smoothstep(0.85, 1.22, r);
  if (uShape > 1.5 && uShape < 2.5) {
    // ellittica: alone liscio, più caldo al centro
    float I = exp(-pow(r / 0.42, 0.9) * 2.4);
    col = mix(warm * 0.9, warm, I) * I * 1.6 + warm * exp(-r * r / 0.004) * 1.5;
  } else if (uShape > 3.5 && uShape < 4.5) {
    // irregolare: nubi di stelle e regioni di formazione
    float n = fbm(q * 3.0 + uSeed);
    float I = exp(-r * 2.4) * smoothstep(0.35, 0.75, n + 0.25 * (1.0 - r));
    col = mix(blue, vec3(1.0, 0.92, 0.85), 0.4) * I * 1.4;
    col += pink * smoothstep(0.72, 0.85, fbm(q * 9.0 - uSeed)) * exp(-r * 2.0) * 0.8;
  } else if (uShape > 4.5) {
    // anello: nucleo e un anello di stelle giovani blu
    float ring = exp(-pow((r - 0.72) / 0.08, 2.0)) * (0.65 + 0.5 * fbm(q * 6.0 + uSeed));
    col = blue * ring * 1.5 + pink * ring * smoothstep(0.6, 0.8, fbm(q * 12.0)) * 0.6;
    col += warm * exp(-r * r / 0.01) * 1.6;
  } else {
    // spirali (anche barrate e lenticolari)
    float lr = log(r + 0.04);
    float pitch = 0.32;
    float arms = max(uArms, 1.0);
    float phase = arms * (th - lr / pitch);
    float warp = fbm(q * 4.0 + uSeed) * 1.4;
    float arm = pow(0.5 + 0.5 * cos(phase + warp), 5.0);
    float dust = pow(0.5 + 0.5 * cos(phase + warp - 0.85), 9.0);
    float disk = exp(-r / 0.42);
    float lent = uShape > 2.5 ? 1.0 : 0.0;
    float armK = mix(1.0, 0.15, lent);
    float bulge = exp(-r * r / 0.02) * 1.4 + exp(-r / 0.09) * 0.6;
    float bar = 0.0;
    if (uShape > 0.5 && uShape < 1.5) bar = exp(-(q.x * q.x / 0.055 + q.y * q.y / 0.005)) * 0.9;
    float detail = 0.75 + 0.5 * fbm(q * 14.0 + uSeed);
    vec3 starlight = mix(warm, blue, smoothstep(0.05, 0.45, r));
    col = starlight * disk * (0.35 + armK * arm * 1.7) * detail;
    col *= 1.0 - dust * 0.75 * smoothstep(0.08, 0.3, r) * armK;
    col *= 1.0 - lent * 0.8 * exp(-pow(q.y / 0.035, 2.0)) * step(0.06, abs(q.x));
    col += warm * (bulge + bar) * 1.1;
    float hii = smoothstep(0.8, 0.92, fbm(q * 18.0 + uSeed * 3.0)) * arm * armK * smoothstep(0.1, 0.3, r);
    col += pink * hii * 1.8;
  }
  gl_FragColor = vec4(col * edge * uK * 1.8, 1.0);
}
`;

// strato "di taglio": spessore del disco, banda di polvere e rigonfiamento quando la galassia è vista di profilo
const edgeVert = /* glsl */ `
uniform vec3 uObs;
uniform vec3 uCenter;
uniform vec3 uN;
uniform float uR;
varying vec2 vP;
varying float vCos;
void main() {
  vP = (uv - 0.5) * 2.0;
  vec3 f = normalize(uCenter - uObs);
  vec3 m = cross(uN, f);
  float lm = length(m);
  m = lm > 1e-4 ? m / lm : normalize(cross(f, vec3(0.0, 0.0, 1.0)));
  vec3 u = normalize(cross(f, m));
  vCos = dot(uN, f);
  vec3 p = uCenter + (m * vP.x * 1.2 + u * vP.y * 0.42) * uR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(normalize(p - uObs) * 1000.0, 1.0);
}
`;
const edgeFrag = /* glsl */ `
uniform float uK;
uniform float uShape;
uniform float uSeed;
uniform vec3 uTint;
varying vec2 vP;
varying float vCos;
${NOISE}
void main() {
  float X = vP.x * 1.2, Y = vP.y * 0.42;
  float ax = abs(X);
  if (ax > 1.2) discard;
  float lent = uShape > 2.5 ? 1.0 : 0.0;
  // spessore apparente: il disco sottile più la sua proiezione per l'inclinazione residua
  float h = mix(0.06, 0.1, lent) + abs(vCos) * 0.25 * (1.0 - smoothstep(0.0, 1.0, ax));
  float mott = 0.7 + 0.6 * fbm(vec2(X * 9.0, Y * 30.0) + uSeed);
  float disk = exp(-ax / mix(0.45, 0.38, lent)) * exp(-pow(Y / h, 2.0)) * mott;
  float bulgeR = mix(0.16, 0.24, lent);
  float bulge = exp(-(X * X + Y * Y * 2.2) / (bulgeR * bulgeR)) * 1.1 + exp(-(X * X + Y * Y) / 0.0025) * 0.9;
  vec3 warm = vec3(1.0, 0.84, 0.62);
  vec3 blue = vec3(0.62, 0.74, 1.0) * uTint;
  vec3 col = mix(warm, blue, smoothstep(0.08, 0.6, ax)) * disk * 2.4 + warm * bulge;
  // banda di polvere: scura, sottile, un po' spostata verso il lato più vicino e frastagliata
  float laneY = sign(vCos + 1e-4) * h * 0.25;
  float laneW = h * mix(0.38, 0.28, lent) * (0.8 + 0.4 * fbm(vec2(X * 14.0, 3.0) + uSeed));
  float lane = exp(-pow((Y - laneY) / laneW, 2.0)) * smoothstep(0.03, 0.14, ax) * (1.0 - smoothstep(0.85, 1.15, ax));
  col *= 1.0 - 0.88 * lane;
  float edge = 1.0 - smoothstep(0.95, 1.2, ax);
  gl_FragColor = vec4(col * edge * uK, 1.0);
}
`;

// alone del nucleo sempre rivolto verso l'osservatore (dà volume anche di taglio)
const coreVert = /* glsl */ `
uniform vec3 uObs;
uniform vec3 uCenter;
uniform float uR;
varying vec2 vP;
void main() {
  vP = (uv - 0.5) * 2.0;
  vec3 rel = uCenter - uObs;
  vec3 f = normalize(rel);
  vec3 up = abs(f.z) < 0.95 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 right = normalize(cross(f, up));
  vec3 u2 = cross(right, f);
  vec3 p = uCenter + (right * vP.x + u2 * vP.y) * uR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(normalize(p - uObs) * 1000.0, 1.0);
}
`;
const coreFrag = /* glsl */ `
uniform float uK;
uniform vec3 uColor;
varying vec2 vP;
void main() {
  float r2 = dot(vP, vP);
  if (r2 > 1.0) discard;
  float f = exp(-r2 * 7.0) * 0.9 + exp(-r2 * 40.0) * 0.8;
  gl_FragColor = vec4(uColor * f * uK, 1.0);
}
`;

// ----------------------------------------------------------------------------- oggetti esotici
const exoticFrag = /* glsl */ `
uniform float uKind;   // 0 buco nero, 1 quasar, 2 pulsar
uniform float uTime;
uniform float uK;
uniform float uTilt;
uniform float uSeed;
varying vec2 vP;
${NOISE}
void main() {
  vec2 p = vP;
  float r = length(p);
  if (r > 1.0) discard;
  vec3 col = vec3(0.0);
  float occ = 0.0;
  if (uKind < 1.5) {
    float rs = 0.16;
    // disco di accrescimento inclinato, più luminoso dal lato che si avvicina (Doppler)
    vec2 d = vec2(p.x, p.y / max(0.12, uTilt));
    float dr = length(d);
    float ang = atan(d.y, d.x);
    float swirl = fbm(vec2(ang * 3.0 - uTime * 0.8, dr * 18.0) + uSeed);
    float disk = smoothstep(rs * 1.5, rs * 1.9, dr) * (1.0 - smoothstep(0.45, 0.95, dr)) * (0.55 + 0.6 * swirl);
    float dopp = 0.55 + 0.75 * (0.5 + 0.5 * cos(ang));
    vec3 hot = mix(vec3(1.0, 0.45, 0.15), vec3(1.0, 0.93, 0.8), smoothstep(0.6, 0.2, dr));
    // la parte posteriore del disco piegata sopra l'ombra (lente gravitazionale)
    vec2 lp = vec2(p.x, (p.y - rs * 1.25) / 0.55);
    float lens = smoothstep(rs * 1.6, rs * 1.9, length(lp)) * (1.0 - smoothstep(rs * 2.6, rs * 3.4, length(lp))) * step(0.0, p.y) * 0.6;
    col = hot * (disk * dopp + lens) * 1.6;
    // anello di fotoni e ombra
    col += vec3(1.0, 0.85, 0.65) * exp(-pow((r - rs * 1.05) / 0.012, 2.0)) * 1.5;
    float shadow = 1.0 - smoothstep(rs * 0.95, rs * 1.02, r);
    col *= 1.0 - shadow;
    occ = shadow;
    col += vec3(1.0, 0.6, 0.3) * exp(-r * 4.0) * 0.12 * (1.0 - shadow);
    if (uKind > 0.5) {
      // quasar: nucleo accecante e getti relativistici
      float jet = exp(-pow(p.x / (0.02 + abs(p.y) * 0.05), 2.0)) * smoothstep(1.0, 0.1, abs(p.y));
      col += vec3(0.6, 0.75, 1.0) * jet * 1.4 * (0.7 + 0.3 * fbm(vec2(p.y * 10.0 - uTime * 2.0, 0.0)));
      col += vec3(1.0, 0.95, 0.9) * exp(-r * r / 0.002) * 2.0;
    }
  } else {
    // pulsar: stella di neutroni e due fasci rotanti
    float a = uTime * 3.0;
    vec2 dir = vec2(cos(a), sin(a) * 0.35);
    float along = dot(p, normalize(dir));
    float perp = length(p - normalize(dir) * along);
    float beam = exp(-pow(perp / (0.015 + abs(along) * 0.12), 2.0)) * smoothstep(1.0, 0.05, abs(along));
    col = vec3(0.6, 0.8, 1.0) * beam * 1.2;
    col += vec3(0.8, 0.9, 1.0) * exp(-r * r / 0.0015) * 2.5 + vec3(0.4, 0.55, 1.0) * exp(-r * 6.0) * 0.4;
    col += vec3(0.3, 0.6, 0.9) * fbm(p * 5.0 + uTime * 0.05) * exp(-r * 2.5) * 0.25;
  }
  // l'ombra del buco nero copre davvero le stelle dietro (alfa premoltiplicato)
  gl_FragColor = vec4(col * uK, occ * uK);
}
`;

interface GalaxyMesh { obj: DeepObject; center: THREE.Vector3; R: number; disk: THREE.Mesh; core: THREE.Mesh; hasParticles: boolean; edge: THREE.Mesh | null; normal: THREE.Vector3 }
interface ExoticMesh { obj: DeepObject; center: THREE.Vector3; R: number; mesh: THREE.Mesh }

const SHAPES: Record<string, number> = { spiral: 0, barred: 1, elliptical: 2, lenticular: 3, irregular: 4, ring: 5 };
/** Foto reali di galassie viste di fronte (senza stelle in primo piano), usate come render da lontano. */
function galaxyMap(id: string, shape: string, seed: number): THREE.Texture | null {
  const own: Record<string, string> = { milkyway: 'gal_mw', m31g: 'gal_mw', m101g: 'gal_m101', m83g: 'gal_m83', ngc1300: 'gal_ngc1300', m33g: 'gal_m101', m51g: 'gal_m83', m81g: 'gal_mw' };
  if (own[id]) return planetTexture(own[id], false);
  if (shape === 'barred') return planetTexture(seed % 2 ? 'gal_ngc1300' : 'gal_mw', false);
  if (shape === 'spiral') return planetTexture(['gal_m101', 'gal_m83', 'gal_mw', 'gal_ngc1300'][seed % 4], false);
  if (shape === 'lenticular') return planetTexture('gal_m83', false);
  return null;
}

/** Galassie che hanno anche una versione a particelle (si dissolvono quando ci si entra). */
export const PARTICLE_GALAXIES = ['milkyway', 'm31g', 'm33g', 'lmc', 'smc'];

function diskBasis(o: DeepObject, galPlane?: { a: THREE.Vector3; b: THREE.Vector3 }) {
  if (galPlane) return galPlane;
  const g = o.galaxy!;
  const L = new THREE.Vector3(...radecToVec(o.ra, o.dec));
  const n0 = new THREE.Vector3(0, 0, 1).sub(L.clone().multiplyScalar(L.z)).normalize();
  const e0 = new THREE.Vector3().crossVectors(n0, L).normalize().negate();
  const pa = (g.pa * Math.PI) / 180, incl = (g.incl * Math.PI) / 180;
  const a = n0.clone().multiplyScalar(Math.cos(pa)).add(e0.clone().multiplyScalar(Math.sin(pa)));
  const m = new THREE.Vector3().crossVectors(L, a);
  const normal = L.clone().multiplyScalar(Math.cos(incl)).add(m.multiplyScalar(Math.sin(incl))).normalize();
  const b = new THREE.Vector3().crossVectors(normal, a).normalize();
  return { a, b };
}

/** Posizione (pc) di un oggetto del catalogo profondo; la Via Lattea usa il centro galattico. */
export function deepCenterPc(o: DeepObject, gc?: [number, number, number]): THREE.Vector3 {
  if (o.id === 'milkyway' && gc) return new THREE.Vector3(...gc);
  return new THREE.Vector3(...radecToVec(o.ra, o.dec)).multiplyScalar(o.ly * LY_PC);
}

export class DeepRenderer {
  group = new THREE.Group();
  galaxies: GalaxyMesh[] = [];
  exotics: ExoticMesh[] = [];
  clusters: ExoticMesh[] = [];
  /** Visibilità delle particelle (1 = piene) per le galassie che le hanno. */
  particleFactor: Record<string, number> = {};
  private obs = { value: new THREE.Vector3() };
  private time = { value: 0 };
  private tmp = new THREE.Vector3();

  constructor(gc: [number, number, number], mwPlane: { a: THREE.Vector3; b: THREE.Vector3 }) {
    const plane = new THREE.PlaneGeometry(1, 1, 24, 24);
    const quad = new THREE.PlaneGeometry(1, 1, 1, 1);
    let seed = 1;
    for (const o of deepObjects()) {
      if (o.type === 'galaxy' && o.galaxy) {
        const center = deepCenterPc(o, gc);
        const R = o.radiusLy * LY_PC;
        const { a, b } = diskBasis(o, o.id === 'milkyway' ? mwPlane : undefined);
        const g = o.galaxy;
        const tint = new THREE.Color(...(g.tint ?? [1, 1, 1]));
        const map = galaxyMap(o.id, g.shape, seed);
        const disk = new THREE.Mesh(plane, new THREE.ShaderMaterial({
          vertexShader: galVert, fragmentShader: galFrag,
          uniforms: {
            uObs: this.obs, uCenter: { value: center }, uA: { value: a }, uB: { value: b }, uR: { value: R },
            uShape: { value: SHAPES[g.shape] }, uArms: { value: g.arms ?? 2 }, uSeed: { value: seed++ * 3.7 },
            uK: { value: 0 }, uSpin: { value: 0 }, uTint: { value: tint },
            uMap: { value: map ?? blankTexture }, uUseMap: { value: map ? 1 : 0 }, uMirror: { value: seed % 2 ? -1 : 1 },
            uRot: { value: (seed * 2.399) % 6.283 }, uBright: { value: 1 },
          },
          blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide,
        }));
        disk.frustumCulled = false;
        disk.renderOrder = 0.2;
        const elliptical = g.shape === 'elliptical';
        const core = new THREE.Mesh(quad, new THREE.ShaderMaterial({
          vertexShader: coreVert, fragmentShader: coreFrag,
          uniforms: { uObs: this.obs, uCenter: { value: center }, uR: { value: R * (elliptical ? 0.9 : g.shape === 'lenticular' ? 0.75 : 0.25) }, uK: { value: 0 }, uColor: { value: new THREE.Color(1, 0.85, 0.62) } },
          blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
        }));
        core.frustumCulled = false;
        core.renderOrder = 0.25;
        this.group.add(disk, core);
        const normal = new THREE.Vector3().crossVectors(a, b).normalize();
        let edge: THREE.Mesh | null = null;
        if (['spiral', 'barred', 'lenticular'].includes(g.shape)) {
          edge = new THREE.Mesh(quad, new THREE.ShaderMaterial({
            vertexShader: edgeVert, fragmentShader: edgeFrag,
            uniforms: { uObs: this.obs, uCenter: { value: center }, uN: { value: normal }, uR: { value: R }, uK: { value: 0 }, uShape: { value: SHAPES[g.shape] }, uSeed: { value: seed * 1.7 }, uTint: { value: tint } },
            blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide,
          }));
          edge.frustumCulled = false;
          edge.renderOrder = 0.22;
          this.group.add(edge);
        }
        this.galaxies.push({ obj: o, center, R, disk, core, hasParticles: PARTICLE_GALAXIES.includes(o.id), edge, normal });
      } else if (o.type === 'gc' || o.type === 'oc') {
        // bagliore d'insieme dell'ammasso: si dissolve quando le singole stelle si risolvono
        const center = deepCenterPc(o);
        const R = o.radiusLy * LY_PC;
        const core = new THREE.Mesh(quad, new THREE.ShaderMaterial({
          vertexShader: coreVert, fragmentShader: coreFrag,
          uniforms: { uObs: this.obs, uCenter: { value: center }, uR: { value: R * (o.type === 'gc' ? 0.5 : 0.8) }, uK: { value: 0 }, uColor: { value: o.type === 'gc' ? new THREE.Color(1, 0.86, 0.65) : new THREE.Color(0.7, 0.8, 1) } },
          blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
        }));
        core.frustumCulled = false;
        core.renderOrder = 0.3;
        this.group.add(core);
        this.clusters.push({ obj: o, center, R, mesh: core });
      } else if (o.type === 'blackhole' || o.type === 'quasar' || o.type === 'pulsar') {
        const center = deepCenterPc(o);
        const R = o.radiusLy * LY_PC * (o.type === 'pulsar' ? 4 : 1);
        const mesh = new THREE.Mesh(quad, new THREE.ShaderMaterial({
          vertexShader: coreVert, fragmentShader: exoticFrag,
          uniforms: {
            uObs: this.obs, uCenter: { value: center }, uR: { value: R }, uTime: this.time, uK: { value: 0 },
            uKind: { value: o.type === 'blackhole' ? 0 : o.type === 'quasar' ? 1 : 2 }, uTilt: { value: 0.22 + (seed % 5) * 0.06 }, uSeed: { value: seed++ },
          },
          blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
          depthTest: false, depthWrite: false, transparent: true,
        }));
        mesh.frustumCulled = false;
        mesh.renderOrder = 2.5;
        this.group.add(mesh);
        this.exotics.push({ obj: o, center, R, mesh });
      }
    }
  }

  update(obsPc: THREE.Vector3, time: number, dim: number, spin: number, pixPerRad: number) {
    this.obs.value.copy(obsPc);
    this.time.value = time;
    for (const g of this.galaxies) {
      const d = this.tmp.copy(g.center).sub(obsPc).length();
      // da lontano il render "fotografico", da vicino le particelle
      const far = g.hasParticles ? smooth(0.45 * g.R, 1.25 * g.R, d) : smooth(0.3 * g.R, 0.9 * g.R, d);
      const px = (g.R / d) * pixPerRad;
      const visible = smooth(1.5, 6, px);
      const k = far * visible * dim * (g.obj.bright ?? 1);
      // quanto è "di taglio": il disco piatto lascia il posto allo strato con spessore e polveri
      const cosv = Math.abs(this.tmp.normalize().dot(g.normal));
      const edgeK = g.edge ? smooth(0.5, 0.12, cosv) : 0;
      if (g.edge) {
        (g.edge.material as THREE.ShaderMaterial).uniforms.uK.value = k * edgeK * 0.9;
        g.edge.visible = k * edgeK > 0.005;
      }
      (g.disk.material as THREE.ShaderMaterial).uniforms.uK.value = k * 0.95 * (1 - 0.75 * edgeK);
      (g.disk.material as THREE.ShaderMaterial).uniforms.uSpin.value = g.obj.id === 'milkyway' ? -spin : 0;
      (g.core.material as THREE.ShaderMaterial).uniforms.uK.value = k * 0.8 * (1 - 0.45 * edgeK) * ((g.disk.material as THREE.ShaderMaterial).uniforms.uUseMap.value ? 0.35 : 1);
      g.disk.visible = g.core.visible = k > 0.005;
      if (g.hasParticles) this.particleFactor[g.obj.id] = 1 - 0.97 * far;
    }
    for (const c of this.clusters) {
      const d = this.tmp.copy(c.center).sub(obsPc).length();
      const px = (c.R / d) * pixPerRad;
      const k = smooth(1, 6, px) * (1 - 0.7 * smooth(0.8 * c.R, 0.2 * c.R, d)) * dim * (c.obj.type === 'gc' ? 0.55 : 0.3);
      (c.mesh.material as THREE.ShaderMaterial).uniforms.uK.value = k;
      c.mesh.visible = k > 0.003;
    }
    for (const e of this.exotics) {
      const d = this.tmp.copy(e.center).sub(obsPc).length();
      const px = (e.R / d) * pixPerRad;
      const k = smooth(2, 10, px) * dim;
      (e.mesh.material as THREE.ShaderMaterial).uniforms.uK.value = k;
      e.mesh.visible = k > 0.005;
    }
  }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
