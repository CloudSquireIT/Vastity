// Materiali procedurali per pianeti, stelle e anelli (nessuna texture esterna).
import * as THREE from 'three';

const NOISE = /* glsl */ `
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

const vert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vPosV;
void main() {
  vObj = position;
  vNormalV = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPosV = mv.xyz;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;

const frag = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec3 uLight;   // direzione verso la stella, spazio vista
uniform float uType;   // 0 roccioso, 1 gassoso, 2 Terra, 3 Venere, 4 stella, 5 Marte
uniform float uTime;
uniform float uSeed;
uniform vec3 uAtm;
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vPosV;
${NOISE}
void main() {
  #include <logdepthbuf_fragment>
  vec3 p = normalize(vObj);
  vec3 n = normalize(vNormalV);
  vec3 V = normalize(-vPosV);
  vec3 L = normalize(uLight);
  vec3 col;
  if (uType > 3.5 && uType < 4.5) {
    float mu = max(dot(n, V), 0.0);
    float gran = fbm(p * 40.0 + uTime * 0.05) * 0.25 + fbm(p * 6.0 - uTime * 0.01) * 0.2;
    col = uColor * (0.45 + 0.55 * pow(mu, 0.5)) * (0.85 + gran) * 1.6;
    gl_FragColor = vec4(col, 1.0);
    return;
  }
  vec3 q = p * 2.0 + uSeed;
  float diff = max(dot(n, L), 0.0);
  float term = smoothstep(-0.05, 0.25, dot(n, L));
  float spec = 0.0;
  if (uType < 0.5 || (uType > 4.5)) {
    float h = fbm(q * 1.6);
    float cr = fbm(q * 7.0);
    col = mix(uColor * 0.55, uColor * 1.15, h) * (0.8 + 0.4 * cr);
    if (uType > 4.5) {
      col = mix(col, uColor2, smoothstep(0.55, 0.7, fbm(q * 2.5)) * 0.6);
      col = mix(col, vec3(0.95), smoothstep(0.9, 0.94, abs(p.z)));
    }
  } else if (uType < 1.5) {
    float w = fbm(p * vec3(3.0, 3.0, 1.0) + uSeed) * 1.6;
    float b = sin(p.z * 22.0 + w * 2.5) * 0.5 + 0.5;
    float b2 = sin(p.z * 9.0 + w) * 0.5 + 0.5;
    col = mix(uColor, uColor2, b * 0.7 + b2 * 0.3);
    col *= 0.85 + 0.3 * fbm(p * 12.0 + uSeed);
  } else if (uType < 2.5) {
    float h = fbm(p * 2.3 + 3.1);
    float land = smoothstep(0.5, 0.53, h);
    vec3 ocean = vec3(0.02, 0.09, 0.25) + vec3(0.0, 0.05, 0.08) * fbm(p * 8.0);
    float lat = abs(p.z);
    vec3 ground = mix(vec3(0.12, 0.28, 0.08), vec3(0.45, 0.38, 0.22), smoothstep(0.55, 0.7, h) + smoothstep(0.1, 0.35, 0.35 - abs(lat - 0.35)) * 0.4);
    col = mix(ocean, ground, land);
    col = mix(col, vec3(0.92), smoothstep(0.82, 0.88, lat + fbm(p * 6.0) * 0.08));
    float cl = smoothstep(0.52, 0.72, fbm(p * 4.5 + vec3(uTime * 0.004, 0.0, 0.0)));
    col = mix(col, vec3(1.0), cl * 0.85);
    vec3 R = reflect(-L, n);
    spec = pow(max(dot(R, V), 0.0), 40.0) * (1.0 - land) * (1.0 - cl) * 0.6;
    // luci delle città sul lato notturno
    float city = land * (1.0 - cl) * smoothstep(0.62, 0.8, fbm(p * 30.0)) * (1.0 - smoothstep(0.75, 0.85, lat));
    col += vec3(1.0, 0.75, 0.4) * city * (1.0 - term) * 0.5 / max(diff, 0.02) * 0.02;
  } else {
    float s = fbm(p * vec3(2.0, 2.0, 5.0) + uSeed);
    col = mix(uColor * 0.85, uColor2, s);
  }
  vec3 lit = col * (term * (0.25 + 0.85 * diff)) + col * 0.008 + spec;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  lit += uAtm * rim * (smoothstep(-0.3, 0.4, dot(n, L)));
  gl_FragColor = vec4(lit, 1.0);
}
`;

export function planetMaterial(type: number, c1: THREE.ColorRepresentation, c2: THREE.ColorRepresentation, atm: THREE.ColorRepresentation, seed: number) {
  return new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag,
    uniforms: {
      uColor: { value: new THREE.Color(c1) }, uColor2: { value: new THREE.Color(c2) }, uLight: { value: new THREE.Vector3(1, 0, 0) },
      uType: { value: type }, uTime: { value: 0 }, uSeed: { value: seed }, uAtm: { value: new THREE.Color(atm) },
    },
  });
}

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
#include <logdepthbuf_pars_fragment>
uniform float uInner;
uniform float uOuter;
uniform float uLit;
varying vec2 vP;
float h(float x) { return fract(sin(x * 127.1) * 43758.5453); }
void main() {
  #include <logdepthbuf_fragment>
  float r = (length(vP) - uInner) / (uOuter - uInner);
  if (r < 0.0 || r > 1.0) discard;
  float bands = 0.55 + 0.45 * sin(r * 90.0) * sin(r * 23.0 + 1.0);
  float gap = smoothstep(0.56, 0.58, r) * (1.0 - smoothstep(0.6, 0.62, r));
  float a = (0.35 + 0.5 * bands) * (1.0 - gap * 0.9) * smoothstep(0.0, 0.05, r) * (1.0 - smoothstep(0.95, 1.0, r));
  vec3 c = mix(vec3(0.75, 0.68, 0.55), vec3(0.95, 0.9, 0.8), h(floor(r * 60.0)));
  gl_FragColor = vec4(c * a * uLit, a * 0.9);
}
`;

export function ringMaterial(inner: number, outer: number) {
  return new THREE.ShaderMaterial({
    vertexShader: ringVert, fragmentShader: ringFrag, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uInner: { value: inner }, uOuter: { value: outer }, uLit: { value: 1 } },
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
