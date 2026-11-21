// Materiali dei corpi celesti con texture reali (Solar System Scope, CC BY 4.0):
// rilievo dalle texture, Terra con notte/nuvole/oceani, atmosfere, Sole animato, anelli con ombra.
import * as THREE from 'three';
import { blankTexture, planetTexture, ringTexture } from '../core/textures';

export const PT = { rocky: 0, gas: 1, earth: 2, venus: 3, star: 4, mars: 5 } as const;

const vert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec3 uLight;
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vPosV;
varying vec3 vObj;
varying vec3 vLightObj;
void main() {
  vUv = uv;
  vObj = position;
  vNormalV = normalize(normalMatrix * normal);
  // direzione del Sole nel riferimento del corpo (per l'ombra degli anelli sul pianeta)
  vLightObj = normalize(transpose(mat3(modelViewMatrix)) * uLight);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPosV = mv.xyz;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;

const frag = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap;
uniform sampler2D uSCL;
uniform float uHasMap;
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uType;
uniform float uTime;
uniform float uBump;
uniform sampler2D uHeight;
uniform float uBumpH;
uniform vec3 uAtm;
uniform float uAtmK;
uniform float uCloudOffset;
uniform float uBright;
uniform vec3 uEmit;
uniform sampler2D uRingMap;
uniform vec2 uRing;
uniform float uDetail;
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vPosV;
varying vec3 vObj;
varying vec3 vLightObj;

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 perturb(vec3 surfPos, vec3 n, vec2 dHdxy) {
  vec3 sx = dFdx(surfPos), sy = dFdy(surfPos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * n - grad);
}
// hash senza seno (stabile su tutte le GPU) e rumore di valore 3D: sul globo niente cuciture né poli
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vn3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1, 0, 0)), f.x), mix(h13(i + vec3(0, 1, 0)), h13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h13(i + vec3(0, 0, 1)), h13(i + vec3(1, 0, 1)), f.x), mix(h13(i + vec3(0, 1, 1)), h13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm3(vec3 p, int oct) {
  float a = 0.5, s = 0.0;
  for (int k = 0; k < 6; k++) { if (k >= oct) break; s += a * vn3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
float noise(vec2 p) { return vn3(vec3(p, 0.5)); }
// crateri: uno per cella (se presente), interamente dentro la cella → basta la cella corrente
float crater(vec3 p, out float rim) {
  vec3 c = floor(p), f = fract(p);
  vec3 r3 = h33(c);
  rim = 0.0;
  if (r3.x > 0.55) return 0.0;
  vec3 o = 0.3 + 0.4 * h33(c + 7.1);
  float rad = 0.12 + 0.12 * r3.y;
  float d = length(f - o) / rad;
  rim = exp(-pow((d - 1.0) * 4.0, 2.0));
  float h = d < 1.0 ? (d * d - 1.0) * 0.55 : 0.0;
  return (h + 0.22 * rim + 0.05 * exp(-max(d - 1.0, 0.0) * 2.5) * step(1.0, d)) * rad;
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vNormalV);
  vec3 V = normalize(-vPosV);
  vec3 L = normalize(uLight);
  vec2 uv = vUv;
  float t = uTime;

  // --- stelle: palla di fuoco nel colore della loro temperatura ---------------------------------
  if (uType > 3.5 && uType < 4.5) {
    float mu = max(dot(n, V), 0.0);
    vec3 sp0 = normalize(vObj);
    vec3 p = sp0 * 2.4;
    float tt = t * 0.05;
    // plasma con domain warping animato e filamenti "di fuoco" (turbolenza a creste)
    vec3 q = vec3(fbm3(p + vec3(0.0, 0.0, tt), 3), fbm3(p + vec3(5.2, 1.3, -tt), 3), fbm3(p + vec3(2.1, 7.7, tt * 0.7), 3));
    float pl = fbm3(p * 1.8 + q * 2.6 + vec3(tt * 1.4, 0.0, 0.0), 5);
    float ridge = 1.0 - abs(pl * 2.0 - 1.0);
    float fire = pow(ridge, 3.0);
    float gran = vn3(sp0 * 80.0 + vec3(t * 0.3, -t * 0.22, t * 0.17)) * 0.6 + vn3(sp0 * 170.0 - vec3(t * 0.4)) * 0.4;
    float spots = smoothstep(0.68, 0.82, fbm3(sp0 * 3.5 + vec3(0.0, 0.0, t * 0.01), 3));
    float heat = clamp(0.25 + fire * 0.75 + (gran - 0.5) * 0.35 + (pl - 0.5) * 0.4 - spots * 0.55, 0.0, 1.0);
    if (uHasMap > 0.5) heat = clamp(mix(heat, lum(texture2D(uMap, uv + vec2(t * 0.0004, 0.0)).rgb) * 1.15, 0.25), 0.0, 1.0);
    // rampa satura nel colore della stella: brace scura → colore pieno → quasi bianco al calor bianco
    float l0 = dot(uColor, vec3(0.299, 0.587, 0.114));
    vec3 satc = clamp(mix(vec3(l0), uColor, 2.6), 0.0, 1.0);
    float blue = clamp((uColor.b - uColor.r) * 2.5 + 0.2, 0.0, 1.0);
    vec3 ember = mix(vec3(0.42, 0.06, 0.01), vec3(0.04, 0.09, 0.35), blue);
    vec3 mid = mix(satc * vec3(1.0, 0.62, 0.35), satc * vec3(0.55, 0.75, 1.0), blue);
    vec3 hot = mix(satc, vec3(1.0), 0.45);
    vec3 c = mix(ember, mid, smoothstep(0.08, 0.45, heat));
    c = mix(c, hot, smoothstep(0.5, 0.92, heat));
    // bordo più scuro (oscuramento al lembo) e lingue luminose sul contorno
    c *= 0.5 + 0.5 * pow(mu, 0.55);
    c += satc * pow(1.0 - mu, 4.0) * (0.4 + 0.6 * vn3(sp0 * 12.0 + t * 0.35));
    gl_FragColor = vec4(min(c * 1.1 * uBright, vec3(1.0)), 1.0);
    #include <colorspace_fragment>
    return;
  }

  bool gasLike = (uType > 0.5 && uType < 1.5) || (uType > 2.5 && uType < 3.5);
  bool rockLike = uType < 0.5 || (uType > 4.5 && uType < 5.5);
  vec3 sp = normalize(vObj);

  // --- giganti gassosi e Venere: bande che scorrono, vortici che si avvolgono, turbolenza fine ---
  vec2 flow = vec2(0.0);
  if (gasLike) {
    float lat = uv.y - 0.5;
    float spin = t * 0.0035;
    float jets = t * 0.0022 * sin(lat * 46.0);
    float shear = abs(cos(lat * 46.0));
    // vortici allungati lungo le bande (spazio 3D stirato in latitudine)
    vec3 pp = sp * vec3(7.0, 7.0, 26.0);
    vec2 warp = vec2(fbm3(pp + vec3(t * 0.02, 0.0, 0.0), 4), fbm3(pp + vec3(9.1, 3.3, t * 0.015), 4)) - 0.5;
    flow = vec2(spin + jets, 0.0) + warp * vec2(0.022, 0.007) * (0.35 + shear);
  }

  vec3 base;
  if (uHasMap > 0.5) base = texture2D(uMap, uv + flow).rgb;
  else if (gasLike) {
    // gigante senza mappa: bande procedurali nel suo colore
    float b = sin(sp.z * 18.0 + fbm3(sp * 4.0, 3) * 3.0) * 0.5 + 0.5;
    base = uColor * (0.72 + 0.45 * b);
  } else {
    // roccioso senza mappa: regioni chiare e scure, come una superficie ghiacciata o polverosa
    float m = fbm3(sp * 3.2, 5);
    base = uColor * (0.6 + 0.75 * smoothstep(0.3, 0.75, m));
  }

  if (gasLike) {
    // turbolenza fine che si muove (visibile da vicino) e contrasto delle bande
    float fine = fbm3(sp * vec3(28.0, 28.0, 90.0) + vec3(t * 0.06, -t * 0.04, 0.0), 4);
    // tempeste e filamenti scuri/chiari che si avvolgono lungo le bande
    float storms = smoothstep(0.62, 0.8, fbm3(sp * vec3(10.0, 10.0, 34.0) + vec3(-t * 0.03, t * 0.02, 0.0), 4));
    base *= 0.8 + 0.4 * fine + storms * 0.12;
    float l = lum(base);
    base = clamp(mix(vec3(l), base, 1.25) + (base - vec3(0.55)) * 0.18, 0.0, 1.0);
  }

  // rilievo dalla luminosità della texture e dalle quote vere
  if ((uBump > 0.0 || uBumpH > 0.0) && uHasMap > 0.5) {
    vec2 dx = dFdx(uv), dy = dFdy(uv);
    float h0 = lum(texture2D(uMap, uv).rgb);
    vec2 dH = vec2(lum(texture2D(uMap, uv + dx).rgb) - h0, lum(texture2D(uMap, uv + dy).rgb) - h0) * uBump;
    if (uBumpH > 0.0) {
      vec2 ex = dx * max(1.0, 0.0007 / max(length(dx), 1e-7)), ey = dy * max(1.0, 0.0007 / max(length(dy), 1e-7));
      float g0 = texture2D(uHeight, uv).r;
      dH += vec2((texture2D(uHeight, uv + ex).r - g0) * length(dx) / length(ex), (texture2D(uHeight, uv + ey).r - g0) * length(dy) / length(ey)) * uBumpH;
    }
    n = perturb(vPosV, n, dH);
  }

  // --- dettaglio da vicino per i mondi rocciosi: crateri e rugosità oltre la risoluzione della mappa ---
  if (rockLike && uDetail > 0.0) {
    float pix = length(fwidth(sp));                 // raggi per pixel
    float world = length(fwidth(vPosV)) / max(pix, 1e-9); // unità del mondo per raggio
    float on = smoothstep(0.004, 0.0012, pix) * uDetail;
    if (on > 0.0) {
      float h = 0.0, rimSum = 0.0, rim;
      float f = 180.0;
      for (int k = 0; k < 5; k++) {
        float cell = 1.0 / f;
        float w = smoothstep(3.0 * pix, 10.0 * pix, cell);
        vec3 rp = sp * f + vec3(float(k) * 17.3, float(k) * 5.1, float(k) * 11.7);
        h += crater(rp, rim) * cell * w;
        rimSum += rim * w;
        h += (vn3(rp * 2.7) - 0.5) * cell * 0.08 * w;
        f *= 2.6;
      }
      h *= on;
      n = perturb(vPosV, n, vec2(dFdx(h), dFdy(h)) * world * 0.9);
      // ejecta più chiari sul bordo dei crateri, regolite più varia
      base *= 1.0 + (rimSum * 0.06 + (vn3(sp * 900.0) - 0.5) * 0.12) * on;
    }
  }

  float NdL = dot(n, L);
  float NdV = max(dot(n, V), 0.0);
  float light = smoothstep(-0.06, 0.22, NdL) * (0.35 + 0.65 * max(NdL, 0.0));
  vec3 col;

  if (uType > 1.5 && uType < 2.5) {
    // Terra: oceani speculari, nuvole in movimento con la loro ombra, luci delle città di notte
    vec4 scl = texture2D(uSCL, uv);
    float ocean = scl.r;
    float clouds = texture2D(uSCL, uv + vec2(uCloudOffset, 0.0)).g;
    // l'ombra delle nuvole cade dalla parte opposta al Sole
    vec2 sh = normalize(vLightObj.xy + 1e-5) * 0.0018;
    float shadow = texture2D(uSCL, uv + vec2(uCloudOffset, 0.0) - vec2(sh.x, sh.y * 0.5)).g;
    vec3 day = base * (1.0 - shadow * 0.4);
    // oceani più profondi e blu, terre un po' più calde
    day = mix(day, day * vec3(0.78, 0.9, 1.12), ocean * 0.6);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), 160.0) * ocean * (1.0 - clouds) * 0.55;
    float fres = pow(1.0 - NdV, 5.0);
    col = mix(day, vec3(0.97), clouds * 0.95) * light;
    col += vec3(1.0, 0.9, 0.75) * (spec + fres * 0.05 * ocean) * smoothstep(0.0, 0.2, NdL);
    // notte: luci delle città calde, più intense nel buio pieno, attenuate dalle nuvole
    float nightSide = 1.0 - smoothstep(-0.18, 0.06, NdL);
    // solo le luci vere: la mappa notturna ha anche un leggero chiarore delle terre, che si toglie
    float cities = pow(max(scl.b - 0.1, 0.0) / 0.9, 1.7) * 1.3;
    col += vec3(1.0, 0.68, 0.32) * cities * nightSide * (1.0 - clouds * 0.75) * 1.9;
    col += vec3(0.25, 0.32, 0.55) * clouds * nightSide * cities * 0.25;
    // crepuscolo: fascia arancio-rosata sul terminatore
    float dusk = smoothstep(0.28, 0.0, NdL) * smoothstep(-0.16, 0.04, NdL);
    col *= mix(vec3(1.0), vec3(1.2, 0.78, 0.55), dusk * 0.65);
    col += vec3(0.9, 0.45, 0.2) * dusk * clouds * 0.12;
  } else if (gasLike) {
    float limb = mix(1.0, pow(NdV, 0.35), 0.55);
    col = base * light * limb;
    // ombra degli anelli sul pianeta (Saturno)
    if (uRing.y > 0.0 && abs(vLightObj.z) > 1e-3) {
      float tr = -sp.z / vLightObj.z;
      if (tr > 0.0) {
        float rr = length((sp + vLightObj * tr).xy);
        float k = (rr - uRing.x) / (uRing.y - uRing.x);
        if (k > 0.0 && k < 1.0) col *= 1.0 - 0.8 * texture2D(uRingMap, vec2(k, 0.5)).a;
      }
    }
  } else {
    col = base * light;
    vec3 Hh = normalize(L + V);
    float sheen = pow(max(dot(n, Hh), 0.0), 18.0) * 0.18 + pow(max(dot(V, L), 0.0), 6.0) * 0.12 * light;
    col += base * sheen;
    col += base * vec3(0.55, 0.65, 0.9) * 0.035 * (1.0 - smoothstep(-0.1, 0.15, NdL));
  }

  // atmosfera vista di taglio (Rayleigh semplificato), più azzurra sul lato di giorno
  if (uAtmK > 0.0) {
    float fres = pow(1.0 - NdV, 2.6);
    float litRim = smoothstep(-0.35, 0.45, NdL);
    col += uAtm * fres * litRim * uAtmK;
    col = mix(col, uAtm * light * 0.55, pow(1.0 - NdV, 4.0) * 0.35 * uAtmK);
  }
  col += base * 0.006;
  col += uEmit * base * (0.6 + 0.4 * sin(t * 0.7 + vObj.x * 0.0001));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export interface PlanetLook {
  type: number; map?: string; color?: number; atm?: number; atmK?: number; bump?: number; bright?: number;
  /** Mappa delle quote vere (8 bit normalizzati) e dislivello totale in km. */
  height?: { map: string; km: number };
  /** Anelli: raggio interno ed esterno in raggi del pianeta (per l'ombra sul globo). */
  ring?: [number, number];
  /** Intensità del dettaglio procedurale da vicino (0 = niente). */
  detail?: number;
}
/** Esagerazione del rilievo vero sui globi: abbastanza per vedere i vulcani al terminatore. */
const RELIEF_EXAG = 3;

export const LOOKS: Record<string, PlanetLook & { shell?: [number, number, number] }> = {
  sun: { type: PT.star, map: 'sun', color: 0xffd08a, bright: 1.0 },
  mercury: { type: PT.rocky, map: 'mercury', bump: 2.4 },
  venus: { type: PT.venus, map: 'venus', atm: 0xffe0a8, atmK: 0.45, shell: [0xffcf8a, 1.04, 0.9] },
  earth: { type: PT.earth, map: 'earth', atm: 0x6fa8ff, atmK: 0.7, bump: 0.5, shell: [0x6aa2ff, 1.022, 0.7] },
  moon: { type: PT.rocky, map: 'moon', bump: 1.2, height: { map: 'moon_h', km: 19.38 } },
  mars: { type: PT.rocky, map: 'mars', bump: 0.6, height: { map: 'mars_h', km: 29.2 }, atm: 0xe0a080, atmK: 0.22, shell: [0xe8a07a, 1.015, 0.45] },
  jupiter: { type: PT.gas, map: 'jupiter', atm: 0xe8d6b8, atmK: 0.18 },
  saturn: { type: PT.gas, map: 'saturn', atm: 0xf0e0b8, atmK: 0.15, ring: [74500 / 58232, 140220 / 58232] },
  uranus: { type: PT.gas, map: 'uranus', atm: 0xa8ecff, atmK: 0.35, shell: [0x9fe6ff, 1.03, 0.5] },
  neptune: { type: PT.gas, map: 'neptune', atm: 0x6f8cff, atmK: 0.4, shell: [0x5d7cff, 1.03, 0.55] },
  pluto: { type: PT.rocky, color: 0xc9b29a, detail: 1 },
};

export function planetMaterial(look: PlanetLook) {
  const map = look.map ? planetTexture(look.map) : blankTexture;
  const scl = look.type === PT.earth ? planetTexture('earth_scl', false) : blankTexture;
  return new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag,
    uniforms: {
      uMap: { value: map }, uSCL: { value: scl }, uHasMap: { value: look.map ? 1 : 0 },
      uColor: { value: new THREE.Color(look.color ?? 0xffffff) }, uLight: { value: new THREE.Vector3(1, 0, 0) },
      uType: { value: look.type }, uTime: { value: 0 }, uBump: { value: look.bump ?? 0 },
      uHeight: { value: look.height ? planetTexture(look.height.map, false) : blankTexture }, uBumpH: { value: look.height ? look.height.km * RELIEF_EXAG : 0 },
      uAtm: { value: new THREE.Color(look.atm ?? 0x000000) }, uAtmK: { value: look.atmK ?? 0 },
      uCloudOffset: { value: 0 }, uBright: { value: look.bright ?? 1.25 }, uEmit: { value: new THREE.Color(0, 0, 0) },
      // anelli (raggio interno/esterno in raggi del pianeta) per l'ombra sul globo
      uRingMap: { value: look.ring ? ringTexture() : blankTexture }, uRing: { value: new THREE.Vector2(look.ring?.[0] ?? 0, look.ring?.[1] ?? 0) },
      // dettaglio procedurale da vicino (crateri, rugosità) per i mondi rocciosi
      uDetail: { value: look.detail ?? (look.type === PT.rocky || look.type === PT.mars ? 1 : 0) },
    },
  });
}

/** Sfera con le UV allineate agli assi del corpo (polo = +Z, meridiano zero = +X). */
export function bodySphere(segments: number) {
  const g = new THREE.SphereGeometry(1, segments, Math.round(segments / 2));
  g.rotateX(Math.PI / 2);
  return g;
}

// --- alone atmosferico (guscio esterno) -------------------------------------
const atmVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN;
varying vec3 vP;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vP = mv.xyz;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;
const atmFrag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uK;
varying vec3 vN;
varying vec3 vP;
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vN);
  vec3 V = normalize(-vP);
  float edge = pow(clamp(1.0 + dot(n, V) * 1.15, 0.0, 1.0), 3.0);
  float lit = smoothstep(-0.45, 0.6, dot(n, normalize(uLight)));
  vec3 c = mix(uColor * vec3(1.4, 0.75, 0.55), uColor, smoothstep(0.0, 0.5, lit));
  gl_FragColor = vec4(c * edge * lit * uK, 1.0);
}
`;

export function atmosphereMaterial(color: number, k: number) {
  return new THREE.ShaderMaterial({
    vertexShader: atmVert, fragmentShader: atmFrag, side: THREE.BackSide, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uLight: { value: new THREE.Vector3(1, 0, 0) }, uK: { value: k } },
  });
}

// --- anelli di Saturno con l'ombra del pianeta --------------------------------
const ringVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vP;
varying vec3 vPosV;
void main() {
  vP = position.xy;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPosV = mv.xyz;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;
const ringFrag = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap;
uniform float uInner;
uniform float uOuter;
uniform float uLit;
uniform vec3 uPlanetV;
uniform float uPlanetR;
uniform vec3 uLight;
uniform float uTime;
varying vec2 vP;
varying vec3 vPosV;
float rh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rh(i), rh(i + vec2(1, 0)), f.x), mix(rh(i + vec2(0, 1)), rh(i + vec2(1, 1)), f.x), f.y); }
void main() {
  #include <logdepthbuf_fragment>
  float rad = length(vP);
  float r = (rad - uInner) / (uOuter - uInner);
  if (r < 0.0 || r > 1.0) discard;
  vec4 t = texture2D(uMap, vec2(r, 0.5));
  // rotazione kepleriana (accelerata per vederla): l'interno gira più veloce dell'esterno
  float omega = 0.035 * pow(uInner / rad, 1.5);
  float th = atan(vP.y, vP.x) - uTime * omega;
  vec2 ang = vec2(cos(th), sin(th));
  float clump = rn(ang * 60.0 + vec2(r * 140.0, 0.0)) * 0.6 + rn(ang * 220.0 + vec2(r * 500.0, 3.0)) * 0.4;
  t.a *= 0.86 + 0.28 * clump;
  // "spoke": raggi scuri e tenui nell'anello B che ruotano con le particelle
  float spoke = smoothstep(0.62, 0.9, rn(vec2(th * 9.0, r * 3.0))) * smoothstep(0.25, 0.4, r) * (1.0 - smoothstep(0.55, 0.62, r));
  t.rgb *= 1.0 - 0.18 * spoke;
  vec3 rel = vPosV - uPlanetV;
  vec3 L = normalize(uLight);
  float along = dot(rel, L);
  float perp = length(rel - along * L);
  float sh = along < 0.0 ? smoothstep(uPlanetR * 0.97, uPlanetR * 1.03, perp) : 1.0;
  float a = t.a;
  vec3 c = t.rgb * (0.2 + 0.8 * uLit) * (0.08 + 0.92 * sh);
  gl_FragColor = vec4(c * a, a);
  #include <colorspace_fragment>
}
`;

export function ringMaterial(inner: number, outer: number) {
  return new THREE.ShaderMaterial({
    vertexShader: ringVert, fragmentShader: ringFrag, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      uMap: { value: ringTexture() }, uInner: { value: inner }, uOuter: { value: outer }, uLit: { value: 1 },
      uPlanetV: { value: new THREE.Vector3() }, uPlanetR: { value: 58232 }, uLight: { value: new THREE.Vector3(1, 0, 0) }, uTime: { value: 0 },
    },
  });
}

/** Colore approssimato di un corpo nero (per le stelle). */
export function tempColor(T: number): THREE.Color {
  const t = T / 100;
  const r = t <= 66 ? 1 : Math.min(1, Math.max(0, 1.292936 * Math.pow(t - 60, -0.1332047592)));
  const g = t <= 66 ? Math.min(1, Math.max(0, 0.390081578 * Math.log(t) - 0.631841444)) : Math.min(1, Math.max(0, 1.129890861 * Math.pow(t - 60, -0.0755148492)));
  const b = t >= 66 ? 1 : t <= 19 ? 0 : Math.min(1, Math.max(0, 0.543206789 * Math.log(t - 10) - 1.196254089));
  return new THREE.Color(r, g, b);
}

// --- corona di fiamme attorno alle stelle ---------------------------------------
// un quadrato sempre rivolto alla camera, centrato sulla stella e dietro al disco: lingue di fuoco
// che si muovono verso l'esterno, nel colore della stella, che sfumano a pochi raggi di distanza
const coronaVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uSize;
varying vec2 vQ;
void main() {
  vQ = position.xy * 2.0 * uSize;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(modelViewMatrix[0].xyz);
  vec4 mv = c + vec4(position.xy * 2.0 * uSize * s, 0.0, 0.0);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;
const coronaFrag = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uTime;
uniform float uK;
uniform float uSize;
varying vec2 vQ;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 5; k++) { s += a * vn(p); p = p * 2.07 + 3.1; a *= 0.5; } return s; }
void main() {
  #include <logdepthbuf_fragment>
  float r = length(vQ);
  if (r < 0.95 || r > uSize) discard;
  float a = atan(vQ.y, vQ.x);
  float x = r - 1.0;
  // lingue di fuoco: rumore lungo il bordo che sale verso l'esterno nel tempo
  vec2 fp = vec2(a * 9.0 + 31.4, x * 9.0 - uTime * 0.5);
  float fl = fbm(fp + vec2(fbm(fp * 0.8 + uTime * 0.07), 0.0) * 1.8);
  float tongues = smoothstep(0.42, 0.85, fl);
  float fall = exp(-max(x, 0.0) * mix(16.0, 5.5, tongues));
  float glow = exp(-max(x, 0.0) * 9.0) * 0.6;
  float inner = smoothstep(0.95, 1.01, r);
  float l0 = dot(uColor, vec3(0.299, 0.587, 0.114));
  vec3 sat = clamp(mix(vec3(l0), uColor, 2.4), 0.0, 1.0);
  float I = (glow + tongues * fall * 1.3) * inner * uK;
  vec3 c = mix(sat * vec3(1.0, 0.7, 0.5), mix(sat, vec3(1.0), 0.35), fall);
  gl_FragColor = vec4(c * I, 1.0);
  #include <colorspace_fragment>
}
`;

/** Corona animata per una stella: `size` = raggio del quadrato in raggi stellari. */
export function coronaMesh(color: THREE.Color, size = 1.7, k = 0.9) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: coronaVert, fragmentShader: coronaFrag, transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: color.clone() }, uTime: { value: 0 }, uK: { value: k }, uSize: { value: size } },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2.9;
  return { mesh, mat };
}
