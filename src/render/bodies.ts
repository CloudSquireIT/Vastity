// Dischi dei corpi celesti visti dal cielo (Sole, Luna con le fasi, pianeti), come billboard.
// Con le texture reali quando il disco è abbastanza grande da mostrarle.
import * as THREE from 'three';
import { blankTexture } from '../core/textures';

const vert = /* glsl */ `
uniform float uQuad;
varying vec2 vUv;
void main() {
  vUv = position.xy;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  c.xy += position.xy * uQuad;
  gl_Position = projectionMatrix * c;
}
`;

const frag = /* glsl */ `
uniform float uQuadPx;
uniform float uDiscPx;
uniform float uGlowPx;
uniform float uGlow;
uniform vec3 uColor;
uniform vec3 uLight;     // direzione della luce in spazio vista
uniform float uStar;
uniform float uDim;
uniform mat3 uViewToBody;
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uSeed;
varying vec2 vUv;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 sampleBody(vec3 bn) {
  float lon = atan(bn.y, bn.x);
  float lat = asin(clamp(bn.z, -1.0, 1.0));
  float u = 0.5 + lon / 6.2831853;
  float v = 0.5 + lat / 3.1415927;
  // evita la cucitura a ±180°: sceglie la parametrizzazione con derivate più piccole
  float u2 = fract(u + 0.5) - 0.5;
  float uu = fwidth(u) < fwidth(u2) + 1e-5 ? u : u2;
  return pow(texture2D(uMap, vec2(uu, v)).rgb, vec3(0.4545));
}
void main() {
  float pd = length(vUv) * uQuadPx;
  vec3 col = vec3(0.0);
  float a = 0.0;
  if (uDiscPx > 0.8 && pd < uDiscPx) {
    vec2 q = vUv * uQuadPx / uDiscPx;
    float z = sqrt(max(0.0, 1.0 - dot(q, q)));
    vec3 n = vec3(q, z);
    float edge = smoothstep(uDiscPx, uDiscPx - 1.2, pd);
    vec3 bn = uViewToBody * n;
    if (uStar > 0.5) {
      // disco solare: bianco-caldo, bordo più scuro e arancio, granulazione appena accennata
      float limb = 0.42 + 0.58 * pow(z, 0.55);
      float gran = uHasMap > 0.5 && uDiscPx > 6.0 ? dot(sampleBody(bn), vec3(0.33)) : 0.6;
      vec3 hot = mix(vec3(1.0, 0.62, 0.32), vec3(1.0, 0.97, 0.92), pow(z, 0.35));
      col = hot * limb * (0.88 + 0.25 * gran) * 1.35;
    } else {
      vec3 base;
      if (uHasMap > 0.5 && uDiscPx > 5.0) base = sampleBody(bn);
      else base = uColor * (0.75 + 0.45 * (noise(bn * 4.0 + uSeed) * 0.6 + noise(bn * 11.0 + uSeed) * 0.4));
      float NdL = dot(n, normalize(uLight));
      float lit = smoothstep(-0.04, 0.2, NdL) * (0.45 + 0.55 * max(NdL, 0.0));
      col = base * lit * 1.15 + base * 0.012;
    }
    a = edge;
  }
  float g = exp(-pow(pd / max(uGlowPx, 0.5), 2.0) * 2.5) * uGlow;
  col += uColor * g * (uStar > 0.5 ? 1.0 : 0.9);
  gl_FragColor = vec4(col * uDim, max(a, 0.0));
}
`;

export class BodySprite {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  constructor(seed: number, map?: THREE.Texture) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      uniforms: {
        uQuad: { value: 1 }, uQuadPx: { value: 10 }, uDiscPx: { value: 0 }, uGlowPx: { value: 4 }, uGlow: { value: 1 },
        uColor: { value: new THREE.Color() }, uLight: { value: new THREE.Vector3(0, 0, 1) }, uStar: { value: 0 },
        uDim: { value: 1 }, uViewToBody: { value: new THREE.Matrix3() }, uSeed: { value: seed },
        uMap: { value: map ?? blankTexture }, uHasMap: { value: map ? 1 : 0 },
      },
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }
}
