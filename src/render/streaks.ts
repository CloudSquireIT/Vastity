// Scie stellari per il volo ad alta velocità: le stelle si allungano in linee che
// partono dal punto di fuga (la direzione di viaggio), così si capisce sempre dove si va.
import * as THREE from 'three';
import { stars } from '../data/catalog';
import { quality } from '../core/quality';

const vert = /* glsl */ `
attribute float tail;
attribute float absmag;
attribute float temp;
uniform vec3 uObs;
uniform vec3 uFwd;
uniform float uLen;
uniform float uIntensity;
varying float vA;
varying vec3 vC;
vec3 bb(float T) {
  float t = T / 100.0;
  float r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
  float g = t <= 66.0 ? clamp(0.390081578 * log(t) - 0.631841444, 0.0, 1.0) : clamp(1.129890861 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
  float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.543206789 * log(t - 10.0) - 1.196254089, 0.0, 1.0));
  return vec3(r, g, b);
}
void main() {
  vec3 rel = position - uObs;
  float d = length(rel);
  vec3 n = rel / d;
  float front = dot(n, uFwd);
  // la coda punta verso il punto di fuga: lunghezza crescente con la velocità e con la distanza dal centro
  float k = uLen * (0.25 + 0.75 * (1.0 - abs(front)));
  vec3 dir = tail > 0.5 ? normalize(n + uFwd * k) : n;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * 980.0, 1.0);
  float m = absmag + 5.0 * log(max(d, 1e-4)) / log(10.0) - 5.0;
  float bright = clamp((7.5 - m) / 6.0, 0.0, 1.0);
  vA = uIntensity * (0.25 + 0.75 * bright) * (tail > 0.5 ? 0.0 : 1.0) * smoothstep(-0.3, 0.2, front);
  vC = mix(bb(temp), vec3(0.75, 0.85, 1.0), 0.45);
}
`;
const frag = /* glsl */ `
varying float vA;
varying vec3 vC;
void main() { gl_FragColor = vec4(vC * vA, 1.0); }
`;

export class Streaks {
  lines: THREE.LineSegments;
  private mat: THREE.ShaderMaterial;
  constructor() {
    const n = Math.min(quality.streaks, stars.count);
    const pos = new Float32Array(n * 6);
    const tail = new Float32Array(n * 2);
    const mag = new Float32Array(n * 2);
    const temp = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 2; k++) {
        pos[(i * 2 + k) * 3] = stars.pos[i * 3];
        pos[(i * 2 + k) * 3 + 1] = stars.pos[i * 3 + 1];
        pos[(i * 2 + k) * 3 + 2] = stars.pos[i * 3 + 2];
        tail[i * 2 + k] = k;
        mag[i * 2 + k] = stars.absmag[i];
        temp[i * 2 + k] = stars.temp[i];
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tail', new THREE.BufferAttribute(tail, 1));
    g.setAttribute('absmag', new THREE.BufferAttribute(mag, 1));
    g.setAttribute('temp', new THREE.BufferAttribute(temp, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uObs: { value: new THREE.Vector3() }, uFwd: { value: new THREE.Vector3(0, 0, -1) }, uLen: { value: 0 }, uIntensity: { value: 0 } },
    });
    this.lines = new THREE.LineSegments(g, this.mat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 2;
  }

  update(obsPc: THREE.Vector3, fwd: THREE.Vector3, amount: number) {
    const u = this.mat.uniforms;
    u.uObs.value.copy(obsPc);
    u.uFwd.value.copy(fwd);
    u.uLen.value = 0.02 + amount * 0.55;
    u.uIntensity.value = Math.min(1, amount * 1.6);
    this.lines.visible = amount > 0.01;
  }
}
