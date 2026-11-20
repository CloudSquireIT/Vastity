// Materiali dei corpi celesti con texture reali (Solar System Scope, CC BY 4.0):
// rilievo dalle texture, Terra con notte/nuvole/oceani, atmosfere, Sole animato, anelli con ombra.
import * as THREE from 'three';
import { blankTexture, planetTexture, ringTexture } from '../core/textures';

export const PT = { rocky: 0, gas: 1, earth: 2, venus: 3, star: 4, mars: 5 } as const;

const vert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vPosV;
varying vec3 vObj;
void main() {
  vUv = uv;
  vObj = position;
  vNormalV = normalize(normalMatrix * normal);
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
uniform vec3 uAtm;
uniform float uAtmK;
uniform float uCloudOffset;
uniform float uBright;
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vPosV;
varying vec3 vObj;

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 perturb(vec3 surfPos, vec3 n, vec2 dHdxy) {
  vec3 sx = dFdx(surfPos), sy = dFdy(surfPos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * n - grad);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }

void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vNormalV);
  vec3 V = normalize(-vPosV);
  vec3 L = normalize(uLight);
  vec2 uv = vUv;

  // --- stelle (Sole e stelle vicine): superficie ribollente e bordo più scuro ---
  if (uType > 3.5 && uType < 4.5) {
    float mu = max(dot(n, V), 0.0);
    vec2 w = vec2(noise(uv * 40.0 + uTime * 0.15), noise(uv * 40.0 - uTime * 0.12)) - 0.5;
    vec3 s1 = texture2D(uMap, uv + w * 0.004 + vec2(uTime * 0.0006, 0.0)).rgb;
    vec3 s2 = texture2D(uMap, uv * 1.003 - w * 0.003 - vec2(uTime * 0.0004, 0.0)).rgb;
    float g = mix(lum(s1), lum(s2), 0.5 + 0.5 * sin(uTime * 0.7));
    float limb = 0.35 + 0.65 * pow(mu, 0.45);
    vec3 col = uColor * (0.55 + 1.1 * g) * limb * uBright;
    col += uColor * pow(1.0 - mu, 3.0) * 0.6;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    return;
  }

  vec3 base = uHasMap > 0.5 ? texture2D(uMap, uv).rgb : uColor;
  // rilievo dalla luminosità della texture (crateri, canyon, catene montuose)
  if (uBump > 0.0 && uHasMap > 0.5) {
    vec2 dx = dFdx(uv), dy = dFdy(uv);
    float h0 = lum(texture2D(uMap, uv).rgb);
    vec2 dH = vec2(lum(texture2D(uMap, uv + dx).rgb) - h0, lum(texture2D(uMap, uv + dy).rgb) - h0) * uBump;
    n = perturb(vPosV, n, dH);
  }
  float NdL = dot(n, L);
  float NdV = max(dot(n, V), 0.0);
  float light = smoothstep(-0.06, 0.22, NdL) * (0.35 + 0.65 * max(NdL, 0.0));
  vec3 col;

  if (uType > 1.5 && uType < 2.5) {
    // Terra: oceani speculari, nuvole in movimento con ombra, luci delle città di notte
    vec4 scl = texture2D(uSCL, uv);
    float ocean = scl.r;
    float clouds = texture2D(uSCL, uv + vec2(uCloudOffset, 0.0)).g;
    float shadow = texture2D(uSCL, uv + vec2(uCloudOffset, 0.0) + vec2(0.0015, 0.0)).g;
    vec3 day = base * (1.0 - shadow * 0.35);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), 70.0) * ocean * (1.0 - clouds) * 0.9;
    col = mix(day, vec3(0.95), clouds * 0.92) * light;
    col += vec3(1.0, 0.92, 0.8) * spec * smoothstep(0.0, 0.2, NdL);
    float nightSide = 1.0 - smoothstep(-0.12, 0.08, NdL);
    col += vec3(1.0, 0.72, 0.38) * pow(scl.b, 1.6) * nightSide * (1.0 - clouds * 0.8) * 1.6;
    // arrossamento al terminatore
    col *= mix(vec3(1.0), vec3(1.15, 0.8, 0.6), smoothstep(0.25, 0.0, NdL) * smoothstep(-0.1, 0.05, NdL) * 0.6);
  } else if (uType > 0.5 && uType < 1.5 || (uType > 2.5 && uType < 3.5)) {
    // giganti gassosi e Venere: bordo più scuro e lento scorrimento delle bande
    float lat = uv.y - 0.5;
    vec2 flow = vec2(uTime * 0.0004 * sin(lat * 40.0), 0.0);
    base = uHasMap > 0.5 ? texture2D(uMap, uv + flow).rgb : base;
    float limb = mix(1.0, pow(NdV, 0.35), 0.55);
    col = base * light * limb;
  } else {
    col = base * light;
  }

  // atmosfera vista di taglio (Rayleigh semplificato)
  if (uAtmK > 0.0) {
    float fres = pow(1.0 - NdV, 2.6);
    float litRim = smoothstep(-0.35, 0.45, NdL);
    col += uAtm * fres * litRim * uAtmK;
  }
  col += base * 0.006; // luce cinerea minima
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export interface PlanetLook { type: number; map?: string; color?: number; atm?: number; atmK?: number; bump?: number; bright?: number }

export function planetMaterial(look: PlanetLook) {
  const map = look.map ? planetTexture(look.map) : blankTexture;
  const scl = look.type === PT.earth ? planetTexture('earth_scl', false) : blankTexture;
  return new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag,
    uniforms: {
      uMap: { value: map }, uSCL: { value: scl }, uHasMap: { value: look.map ? 1 : 0 },
      uColor: { value: new THREE.Color(look.color ?? 0xffffff) }, uLight: { value: new THREE.Vector3(1, 0, 0) },
      uType: { value: look.type }, uTime: { value: 0 }, uBump: { value: look.bump ?? 0 },
      uAtm: { value: new THREE.Color(look.atm ?? 0x000000) }, uAtmK: { value: look.atmK ?? 0 },
      uCloudOffset: { value: 0 }, uBright: { value: look.bright ?? 1.25 },
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
varying vec2 vP;
varying vec3 vPosV;
void main() {
  #include <logdepthbuf_fragment>
  float r = (length(vP) - uInner) / (uOuter - uInner);
  if (r < 0.0 || r > 1.0) discard;
  vec4 t = texture2D(uMap, vec2(r, 0.5));
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
      uPlanetV: { value: new THREE.Vector3() }, uPlanetR: { value: 58232 }, uLight: { value: new THREE.Vector3(1, 0, 0) },
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
