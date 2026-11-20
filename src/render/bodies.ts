// Dischi dei corpi celesti visti dal cielo (Sole, Luna con le fasi, pianeti), come billboard.
import * as THREE from 'three';

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
uniform float uSeed;
varying vec2 vUv;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
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
    if (uStar > 0.5) {
      float limb = 0.55 + 0.45 * pow(z, 0.6);
      col = uColor * limb * 1.6;
    } else {
      vec3 bn = uViewToBody * n;
      float tex = noise(bn * 4.0 + uSeed) * 0.6 + noise(bn * 11.0 + uSeed) * 0.4;
      float lit = max(dot(n, normalize(uLight)), 0.0);
      lit = smoothstep(0.0, 0.25, lit) * (0.6 + 0.4 * lit);
      col = uColor * (0.72 + 0.5 * tex) * lit + uColor * 0.012;
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
  constructor(seed: number) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      uniforms: {
        uQuad: { value: 1 }, uQuadPx: { value: 10 }, uDiscPx: { value: 0 }, uGlowPx: { value: 4 }, uGlow: { value: 1 },
        uColor: { value: new THREE.Color() }, uLight: { value: new THREE.Vector3(0, 0, 1) }, uStar: { value: 0 },
        uDim: { value: 1 }, uViewToBody: { value: new THREE.Matrix3() }, uSeed: { value: seed },
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
