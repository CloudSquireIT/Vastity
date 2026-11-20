// Vista "Cielo": planetario in tempo reale dalla Terra o da altri mondi.
import * as THREE from 'three';
import { Background } from '../render/background';
import { BodySprite } from '../render/bodies';
import { Place, SkyFrame, V3, horToEqj, placeById, skyFrame, v3 } from '../astro/astro';
import { constellations, messier, messierName, radecToVec, starAppMag, starName, stars } from '../data/catalog';
import { ObjRef, refDirection, sameRef } from '../features/objects';
import { issLook } from '../features/iss';
import { bus, simDate, state } from '../state';
import { LabelLayer } from '../ui/labels';
import { PointerHandlers } from '../ui/pointer';

const D2R = Math.PI / 180;

const domeVert = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const domeFrag = /* glsl */ `
uniform vec3 uSun;
uniform float uSunAlt;
uniform vec3 uDay;
uniform float uHasAtm;
uniform float uPollution;
varying vec3 vDir;
void main() {
  vec3 v = normalize(vDir);
  float h = uSunAlt;
  float day = smoothstep(-8.0, 12.0, h);
  float tw = exp(-pow((h + 3.0) / 7.0, 2.0));
  float up = max(v.y, 0.0);
  float hor = pow(1.0 - up, 4.0);
  float cosS = dot(v, uSun);
  vec3 night = vec3(0.004, 0.006, 0.014);
  vec3 zen = mix(night, uDay * 0.55, day);
  vec3 horizon = mix(night * 2.0, mix(uDay, vec3(1.0), 0.45) * 0.95, day);
  vec3 c = mix(zen, horizon, hor);
  float sunSide = pow(max(cosS, 0.0), 3.0);
  c += vec3(1.0, 0.45, 0.18) * tw * (0.15 + 0.85 * sunSide) * hor * 0.9;
  c += vec3(0.25, 0.15, 0.35) * tw * 0.12 * (1.0 - hor);
  c += vec3(1.0, 0.9, 0.75) * pow(max(cosS, 0.0), 64.0) * (day * 0.6 + tw * 0.4);
  c += vec3(0.09, 0.07, 0.05) * uPollution * hor * (1.0 - day);
  gl_FragColor = vec4(c * uHasAtm, 1.0);
}
`;
const groundFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uLight;
varying vec3 vDir;
void main() {
  vec3 v = normalize(vDir);
  float d = -v.y;
  vec3 c = uColor * (0.12 + 0.88 * uLight) * (1.0 - 0.5 * smoothstep(0.0, 0.6, d));
  float rim = exp(-d * 120.0) * 0.6;
  c += vec3(0.25, 0.32, 0.45) * rim * (0.3 + uLight * 0.7);
  gl_FragColor = vec4(c, 1.0);
}
`;

export interface CenterHit { ref: ObjRef; sep: number }

export class SkyView {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
  celestial = new THREE.Group();
  frame!: SkyFrame;
  place: Place = placeById('earth');
  selected: ObjRef | null = null;
  ar = false;

  private sprites = new Map<string, BodySprite>();
  private issSprite = new BodySprite(3);
  private dome: THREE.Mesh;
  private ground: THREE.Mesh;
  private domeMat: THREE.ShaderMaterial;
  private groundMat: THREE.ShaderMaterial;
  private labels: LabelLayer;
  private ring: HTMLDivElement;
  private arrow: HTMLDivElement;
  private yaw = 0;      // azimut (rad) da Nord verso Est
  private pitch = 0.5;  // altezza (rad)
  private fov = 70;
  private vYaw = 0;
  private vPitch = 0;
  private slew: { y0: number; p0: number; y1: number; p1: number; t: number; f0: number; f1: number } | null = null;
  private gyroQ = new THREE.Quaternion();
  private gyroHas = false;
  private alphaOffset: number | null = null;
  private brightNamed: number[] = [];
  private consCenters: { id: string; name: string; dir: V3 }[] = [];
  private issDir: V3 | null = null;
  private w = 1;
  private h = 1;
  private tmp = new THREE.Vector3();
  private time = 0;

  constructor(private bg: Background, overlay: HTMLElement) {
    this.camera.rotation.order = 'YXZ';
    this.celestial.matrixAutoUpdate = false;
    this.scene.add(this.celestial);
    this.scene.add(this.camera);

    this.domeMat = new THREE.ShaderMaterial({
      vertexShader: domeVert, fragmentShader: domeFrag, side: THREE.BackSide, depthTest: false, depthWrite: false,
      uniforms: { uSun: { value: new THREE.Vector3() }, uSunAlt: { value: -30 }, uDay: { value: new THREE.Color() }, uHasAtm: { value: 1 }, uPollution: { value: 0 } },
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 32), this.domeMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.scene.add(this.dome);

    this.groundMat = new THREE.ShaderMaterial({
      vertexShader: domeVert, fragmentShader: groundFrag, side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true,
      uniforms: { uColor: { value: new THREE.Color() }, uLight: { value: 0 } },
    });
    this.ground = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), this.groundMat);
    this.ground.renderOrder = 10;
    this.ground.frustumCulled = false;
    this.scene.add(this.ground);

    this.issSprite.mesh.visible = false;
    this.celestial.add(this.issSprite.mesh);

    this.labels = new LabelLayer(overlay);
    this.ring = document.createElement('div');
    this.ring.className = 'sel-ring';
    this.arrow = document.createElement('div');
    this.arrow.className = 'sel-arrow';
    this.arrow.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3l7 12h-14z"/></svg><span></span>';
    overlay.append(this.ring, this.arrow);

    this.setPlace(state.placeId);
    bus.on('settings', () => this.refreshLists());
  }

  attach() { this.celestial.add(this.bg.group); this.labels.el.style.display = ''; }
  detach() { this.labels.clear(); this.labels.el.style.display = 'none'; this.ring.style.display = 'none'; this.arrow.style.display = 'none'; }

  setPlace(id: string) {
    this.place = placeById(id);
    state.placeId = this.place.id;
    this.frame = skyFrame(this.place, simDate());
    this.refreshLists();
    bus.emit('place');
  }

  private refreshLists() {
    const obs = this.frame.observerPc;
    const cand: { i: number; m: number }[] = [];
    for (let i = 0; i < stars.count; i++) {
      const ni = stars.name[i];
      if (ni < 0 || !stars.names[ni][0]) continue;
      const dx = stars.pos[i * 3] - obs[0], dy = stars.pos[i * 3 + 1] - obs[1], dz = stars.pos[i * 3 + 2] - obs[2];
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.01) continue;
      cand.push({ i, m: stars.absmag[i] + 5 * Math.log10(d) - 5 });
    }
    cand.sort((a, b) => a.m - b.m);
    this.brightNamed = cand.slice(0, 60).map((c) => c.i);
    this.consCenters = constellations.map((c) => {
      const ids = this.bg.lineStars.get(c.id) ?? [];
      let s: V3 = [0, 0, 0];
      for (const i of ids) s = v3.add(s, v3.norm([stars.pos[i * 3] - obs[0], stars.pos[i * 3 + 1] - obs[1], stars.pos[i * 3 + 2] - obs[2]]));
      const dir = ids.length ? v3.norm(s) : radecToVec(c.c[0], c.c[1]);
      return { id: c.id, name: c.it, dir };
    });
  }

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // --- orientamento ---------------------------------------------------------
  get viewAz() { return ((this.yaw / D2R) % 360 + 360) % 360; }
  get viewAlt() { return this.pitch / D2R; }

  /** Direzione EQJ al centro dello schermo. */
  viewDirEqj(): V3 {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const m = this.celestial.matrix.clone().invert();
    f.applyMatrix4(m).normalize();
    return [f.x, f.y, f.z];
  }

  lookAtEqj(dir: V3, animate = true, fov?: number) {
    const v = new THREE.Vector3(...dir).applyMatrix4(this.celestial.matrix).normalize();
    const alt = Math.asin(v.y);
    let az = Math.atan2(v.x, -v.z);
    let y0 = this.yaw;
    while (az - y0 > Math.PI) az -= 2 * Math.PI;
    while (az - y0 < -Math.PI) az += 2 * Math.PI;
    if (animate) this.slew = { y0, p0: this.pitch, y1: az, p1: alt, t: 0, f0: this.fov, f1: fov ?? this.fov };
    else { this.yaw = az; this.pitch = alt; if (fov) this.fov = fov; }
  }

  setView(azDeg: number, altDeg: number, fov: number) {
    this.yaw = azDeg * D2R; this.pitch = altDeg * D2R; this.fov = fov;
  }

  centerOn(ref: ObjRef) {
    const d = refDirection(ref, this.frame, this.issDir);
    if (!d) return;
    const fov = ref.kind === 'constellation' ? 60 : ref.kind === 'body' && (ref.id === 'moon' || ref.id === 'sun') ? 8 : Math.min(this.fov, 40);
    this.lookAtEqj(d, true, fov);
  }

  select(ref: ObjRef | null) {
    this.selected = ref;
    bus.emit('select', ref);
  }

  // --- giroscopio -----------------------------------------------------------
  private onOrient = (e: DeviceOrientationEvent) => {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    let alpha = e.alpha;
    const heading = (e as any).webkitCompassHeading as number | undefined;
    if (heading != null && !isNaN(heading)) {
      const target = 360 - heading;
      if (this.alphaOffset == null) this.alphaOffset = target - alpha;
      alpha += this.alphaOffset;
    }
    const orient = ((screen.orientation?.angle ?? (window as any).orientation ?? 0) * D2R);
    const euler = new THREE.Euler(e.beta * D2R, alpha * D2R, -e.gamma * D2R, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(euler);
    q.multiply(new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -orient));
    this.gyroQ.copy(q);
    this.gyroHas = true;
  };

  async setGyro(on: boolean): Promise<boolean> {
    if (on) {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE?.requestPermission === 'function') {
        try { if ((await DOE.requestPermission()) !== 'granted') return false; } catch { return false; }
      }
      if (typeof DeviceOrientationEvent === 'undefined') return false;
      this.alphaOffset = null;
      this.gyroHas = false;
      const w: any = window;
      if ('ondeviceorientationabsolute' in w) w.addEventListener('deviceorientationabsolute' as any, this.onOrient as any);
      else w.addEventListener('deviceorientation', this.onOrient);
      state.gyro = true;
    } else {
      window.removeEventListener('deviceorientationabsolute' as any, this.onOrient);
      window.removeEventListener('deviceorientation', this.onOrient);
      state.gyro = false;
    }
    bus.emit('gyro');
    return true;
  }

  // --- input ----------------------------------------------------------------
  handlers(): PointerHandlers {
    const radPerPx = () => (this.fov * D2R) / this.h;
    return {
      down: () => { this.vYaw = this.vPitch = 0; this.slew = null; },
      drag: (dx, dy) => {
        if (state.gyro) return;
        this.yaw -= dx * radPerPx();
        this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch + dy * radPerPx()));
      },
      dragEnd: (vx, vy) => { this.vYaw = -vx * radPerPx(); this.vPitch = vy * radPerPx(); },
      pinch: (s) => { this.fov = Math.max(0.5, Math.min(100, this.fov / s)); },
      wheel: (d) => { this.fov = Math.max(0.5, Math.min(100, this.fov * Math.exp(d * 0.001))); },
      tap: (x, y) => this.select(this.pick(x, y)),
      doubleTap: (x, y) => {
        const p = this.pick(x, y);
        if (p) { this.select(p); this.centerOn(p); }
        else this.fov = Math.max(0.5, this.fov / 2);
      },
    };
  }

  // --- proiezioni -----------------------------------------------------------
  /** Proietta una direzione EQJ sullo schermo (px CSS). */
  project(dir: V3): { x: number; y: number; front: boolean; alt: number } {
    const v = this.tmp.set(dir[0], dir[1], dir[2]).applyMatrix4(this.celestial.matrix);
    const alt = Math.asin(Math.max(-1, Math.min(1, v.y))) / D2R;
    v.multiplyScalar(1000).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h, front: v.z < 1, alt };
  }

  private starDir(i: number): V3 {
    const o = this.frame.observerPc;
    return v3.norm([stars.pos[i * 3] - o[0], stars.pos[i * 3 + 1] - o[1], stars.pos[i * 3 + 2] - o[2]]);
  }

  private visibleAlt(alt: number) { return !this.groundOn() || alt > -0.5; }
  private groundOn() { return state.settings.ground && !this.ar; }

  pick(x: number, y: number): ObjRef | null {
    let best: ObjRef | null = null;
    let bs = 30;
    const consider = (ref: ObjRef, dir: V3, bonus: number) => {
      const p = this.project(dir);
      if (!p.front || !this.visibleAlt(p.alt)) return;
      const d = Math.hypot(p.x - x, p.y - y) - bonus;
      if (d < bs) { bs = d; best = ref; }
    };
    for (const b of this.frame.bodies) {
      if (b.id.startsWith('exo') || b.id === 'host') continue;
      consider({ kind: 'body', id: b.id }, b.dir, 8);
    }
    if (this.issDir) consider({ kind: 'iss' }, this.issDir, 8);
    const lim = this.magLimit();
    const o = this.frame.observerPc;
    for (let i = 0; i < stars.count; i++) {
      const dx = stars.pos[i * 3] - o[0], dy = stars.pos[i * 3 + 1] - o[1], dz = stars.pos[i * 3 + 2] - o[2];
      const d = Math.hypot(dx, dy, dz);
      const m = stars.absmag[i] + 5 * Math.log10(d) - 5;
      if (m > lim || d < 0.001) continue;
      consider({ kind: 'star', index: i }, [dx / d, dy / d, dz / d], Math.max(0, 4 - m) * 1.5);
    }
    if (this.fov < 50) for (const m of messier) consider({ kind: 'messier', id: m.id }, radecToVec(m.ra, m.dec), 0);
    if (!best && state.settings.constellations) {
      bs = 140;
      for (const c of this.consCenters) consider({ kind: 'constellation', id: c.id }, c.dir, 0);
    }
    return best;
  }

  /** Oggetti vicini al centro dello schermo (per le missioni). */
  centerHits(maxDeg = 3): CenterHit[] {
    const c = this.viewDirEqj();
    const hits: CenterHit[] = [];
    const check = (ref: ObjRef, d: V3 | null, lim = maxDeg) => {
      if (!d) return;
      const sep = Math.acos(Math.max(-1, Math.min(1, v3.dot(c, d)))) / D2R;
      if (sep < lim) hits.push({ ref, sep });
    };
    for (const b of this.frame.bodies) check({ kind: 'body', id: b.id }, b.dir);
    check({ kind: 'iss' }, this.issDir, 5);
    for (const i of this.brightNamed) check({ kind: 'star', index: i }, this.starDir(i));
    for (const k of this.consCenters) check({ kind: 'constellation', id: k.id }, k.dir, 12);
    for (const m of messier) if (m.mag < 7) check({ kind: 'messier', id: m.id }, radecToVec(m.ra, m.dec));
    return hits.sort((a, b) => a.sep - b.sep);
  }

  // --- aggiornamento --------------------------------------------------------
  dayFactor() {
    if (!this.hasAtmosphere()) return 0;
    const h = this.frame.sunAlt;
    // le nane rosse illuminano poco: il cielo degli esopianeti resta scuro e stellato
    return Math.max(0, Math.min(1, (h + 14) / 18)) * (this.place.exo ? 0.25 : 1);
  }
  hasAtmosphere() {
    const s = this.place.sky;
    return state.settings.atmosphere && !this.ar && s[0] + s[1] + s[2] > 0;
  }

  magLimit() {
    const st = state.settings;
    const B = [7.6, 7.1, 6.6, 6.1, 5.6, 5.1, 4.6, 4.1, 3.6];
    let lim = this.place.id === 'earth' && st.realisticSky ? B[Math.max(0, Math.min(8, st.bortle - 1))] : 6.9;
    lim += Math.max(0, Math.min(3, 2.2 * Math.log10(60 / this.fov)));
    const day = this.dayFactor();
    return lim * (1 - day) + -4 * day;
  }

  update(dt: number) {
    this.time += dt;
    const date = simDate();
    this.frame = skyFrame(this.place, date);
    const r = this.frame.rows;
    this.celestial.matrix.set(
      r[0][0], r[0][1], r[0][2], 0,
      r[1][0], r[1][1], r[1][2], 0,
      r[2][0], r[2][1], r[2][2], 0,
      0, 0, 0, 1,
    );
    this.celestial.matrixWorldNeedsUpdate = true;

    // camera
    if (this.slew) {
      this.slew.t = Math.min(1, this.slew.t + dt / 1.1);
      const k = this.slew.t < 0.5 ? 4 * this.slew.t ** 3 : 1 - Math.pow(-2 * this.slew.t + 2, 3) / 2;
      this.yaw = this.slew.y0 + (this.slew.y1 - this.slew.y0) * k;
      this.pitch = this.slew.p0 + (this.slew.p1 - this.slew.p0) * k;
      this.fov = this.slew.f0 + (this.slew.f1 - this.slew.f0) * k;
      if (this.slew.t >= 1) this.slew = null;
    } else if (!state.gyro) {
      this.yaw += this.vYaw; this.pitch += this.vPitch;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
      const damp = Math.pow(0.04, dt);
      this.vYaw *= damp; this.vPitch *= damp;
    }
    if (state.gyro && this.gyroHas) {
      this.camera.quaternion.slerp(this.gyroQ, 1 - Math.pow(0.001, dt));
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.pitch = Math.asin(f.y);
      this.yaw = Math.atan2(f.x, -f.z);
    } else {
      this.camera.rotation.set(this.pitch, -this.yaw, 0, 'YXZ');
    }
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixPerRad = (this.h * dpr) / (2 * Math.tan((this.fov * D2R) / 2));
    const day = this.dayFactor();
    const st = state.settings;

    // atmosfera e terreno
    const sunH = new THREE.Vector3(...this.frame.sunDir).applyMatrix4(this.celestial.matrix).normalize();
    const du = this.domeMat.uniforms;
    du.uSun.value.copy(sunH);
    du.uSunAlt.value = this.frame.sunAlt;
    du.uDay.value.setRGB(...this.place.sky);
    du.uHasAtm.value = this.hasAtmosphere() ? 1 : 0;
    du.uPollution.value = this.place.id === 'earth' ? (st.bortle - 1) / 8 : 0;
    this.dome.visible = !this.ar;
    this.ground.visible = this.groundOn();
    this.groundMat.uniforms.uColor.value.setRGB(...this.place.ground);
    this.groundMat.uniforms.uLight.value = Math.max(0, Math.min(1, (this.frame.sunAlt + 8) / 20));

    // stelle e Via Lattea
    let galDim = st.milkyWay ? 1 - day : 0;
    if (this.place.id === 'earth' && st.realisticSky) galDim *= Math.max(0, Math.min(1, (8 - st.bortle) / 4));
    if (this.ar) galDim *= 0.6;
    this.bg.update({
      obsPc: new THREE.Vector3(...this.frame.observerPc), beta: new THREE.Vector3(), magLimit: this.magLimit(),
      pixelScale: dpr * Math.pow(Math.max(1, 60 / this.fov), 0.12), pixPerRad, dim: 1, galaxyDim: galDim,
      linesOpacity: st.constellations ? 0.28 * (1 - day) * (1 - day) : 0,
      twinkle: this.hasAtmosphere() ? 1 : 0, time: this.time, nearCutPc: 0.002,
    });

    // corpi del Sistema Solare
    this.updateBodies(pixPerRad, dpr, day);
    this.updateISS(date, pixPerRad, dpr, day);
  }

  private viewRot = new THREE.Matrix4();
  private updateBodies(pixPerRad: number, dpr: number, day: number) {
    const seen = new Set<string>();
    const sorted = [...this.frame.bodies].sort((a, b) => b.distKm - a.distKm);
    this.viewRot.multiplyMatrices(this.camera.matrixWorldInverse, this.celestial.matrix);
    const viewToBody = new THREE.Matrix3().setFromMatrix4(this.viewRot.clone().invert());
    sorted.forEach((b, k) => {
      seen.add(b.id);
      let sp = this.sprites.get(b.id);
      if (!sp) {
        sp = new BodySprite(b.id.length * 7.3 + k);
        this.sprites.set(b.id, sp);
        this.celestial.add(sp.mesh);
      }
      sp.mesh.visible = true;
      sp.mesh.renderOrder = 3 + k * 0.01;
      sp.mesh.position.set(b.dir[0] * 900, b.dir[1] * 900, b.dir[2] * 900);
      const u = sp.mat.uniforms;
      const disc = b.angRadius * pixPerRad;
      let glowPx: number, glow: number;
      if (b.isStar) {
        glowPx = Math.max(disc * 4, 22 * dpr);
        glow = 0.9;
        const T = b.temp ?? 5772;
        const c = T > 5000 ? [1, 0.96, 0.88] : T > 3500 ? [1, 0.72, 0.45] : [1, 0.5, 0.3];
        u.uColor.value.setRGB(c[0], c[1], c[2]);
      } else {
        const s = 6.9 - b.mag;
        glowPx = Math.max(2, Math.min(13, 1.6 + s * 0.95)) * dpr;
        glow = Math.max(0.25, Math.min(1.4, 0.3 + s * 0.12)) / (1 + disc / 5);
        u.uColor.value.setRGB(...b.color);
      }
      const quadPx = Math.max(disc * 1.2, glowPx * 2.4);
      u.uQuad.value = (quadPx / pixPerRad) * 900;
      u.uQuadPx.value = quadPx;
      u.uDiscPx.value = disc;
      u.uGlowPx.value = glowPx;
      u.uGlow.value = glow;
      u.uStar.value = b.isStar ? 1 : 0;
      u.uDim.value = b.isStar || b.id === 'moon' ? 1 : Math.max(0.15, 1 - day * 0.85);
      u.uLight.value.set(...b.lightDir).transformDirection(this.viewRot);
      u.uViewToBody.value.copy(viewToBody);
    });
    for (const [id, sp] of this.sprites) if (!seen.has(id)) sp.mesh.visible = false;
  }

  private updateISS(date: Date, pixPerRad: number, dpr: number, day: number) {
    this.issDir = null;
    const sp = this.issSprite;
    sp.mesh.visible = false;
    if (this.place.id !== 'earth') return;
    const l = issLook(date);
    if (!l) return;
    this.issDir = horToEqj(l.alt, l.az, date);
    if (l.alt < -1) return;
    sp.mesh.visible = true;
    sp.mesh.position.set(this.issDir[0] * 900, this.issDir[1] * 900, this.issDir[2] * 900);
    const u = sp.mat.uniforms;
    const glowPx = (l.sunlit ? 6 : 3) * dpr;
    u.uQuadPx.value = glowPx * 2.4;
    u.uQuad.value = (glowPx * 2.4 / pixPerRad) * 900;
    u.uDiscPx.value = 0;
    u.uGlowPx.value = glowPx;
    u.uGlow.value = l.sunlit ? 1.2 : 0.35;
    u.uColor.value.setRGB(0.9, 0.95, 1);
    u.uDim.value = 1 - day * 0.7;
    sp.mesh.renderOrder = 4;
  }

  /** Etichette, anello di selezione e freccia verso l'oggetto selezionato. */
  updateOverlay() {
    const L = this.labels;
    L.begin();
    const st = state.settings;
    const day = this.dayFactor();
    const put = (dir: V3, text: string, cls: string, force = false) => {
      const p = this.project(dir);
      if (!p.front || p.x < -50 || p.x > this.w + 50 || p.y < -20 || p.y > this.h + 20) return;
      if (!this.visibleAlt(p.alt)) return;
      L.add(p.x, p.y, text, cls, force);
    };
    // punti cardinali
    if (this.groundOn() || this.ar) {
      const card: [number, string][] = [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'O']];
      for (const [az, t] of card) {
        const h: V3 = [Math.sin(az * D2R), 0.0, -Math.cos(az * D2R)];
        const p = this.tmp.set(...h).multiplyScalar(1000).project(this.camera);
        if (p.z < 1) L.add((p.x * 0.5 + 0.5) * this.w, (-p.y * 0.5 + 0.5) * this.h, t, 'cardinal', true);
      }
    }
    if (st.labels) {
      for (const b of this.frame.bodies) put(b.dir, b.name, b.isStar ? 'body star' : 'body', true);
      if (this.issDir) put(this.issDir, 'ISS', 'body iss', true);
      if (this.place.exo) put(v3.norm(v3.scale(this.frame.observerPc, -1)), 'Sole ☉', 'body sun-far', true);
      if (day < 0.7) {
        const lim = this.magLimit();
        for (const i of this.brightNamed) {
          if (starAppMag(i) > lim) continue;
          put(this.starDir(i), starName(i), 'star');
        }
        if (st.constellations) for (const c of this.consCenters) put(c.dir, c.name.toUpperCase(), 'cons');
        if (this.fov < 35) for (const m of messier) if (m.mag < 7.5) put(radecToVec(m.ra, m.dec), messierName(m), 'dso');
      }
    }
    L.end();

    // selezione
    const sel = this.selected;
    const dir = sel ? refDirection(sel, this.frame, this.issDir) : null;
    if (!sel || !dir) { this.ring.style.display = 'none'; this.arrow.style.display = 'none'; return; }
    const p = this.project(dir);
    const onScreen = p.front && p.x > 0 && p.x < this.w && p.y > 0 && p.y < this.h;
    if (onScreen) {
      const big = sel.kind === 'constellation' ? 0 : 1;
      this.ring.style.display = big ? '' : 'none';
      this.ring.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      this.arrow.style.display = 'none';
    } else {
      this.ring.style.display = 'none';
      // freccia sul bordo verso l'oggetto
      const v = this.tmp.set(...dir).applyMatrix4(this.celestial.matrix).applyMatrix4(this.camera.matrixWorldInverse);
      let ax = v.x, ay = -v.y;
      const l = Math.hypot(ax, ay) || 1;
      ax /= l; ay /= l;
      const cx = this.w / 2, cy = this.h / 2;
      const m = 46;
      const t = Math.min((cx - m) / Math.abs(ax || 1e-6), (cy - m) / Math.abs(ay || 1e-6));
      const x = cx + ax * t, y = cy + ay * t;
      const ang = Math.atan2(ay, ax) * 180 / Math.PI + 90;
      this.arrow.style.display = '';
      this.arrow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      (this.arrow.firstElementChild as HTMLElement).style.transform = `rotate(${ang}deg)`;
      const span = this.arrow.lastElementChild as HTMLElement;
      const below = p.alt < 0 && this.groundOn() ? ' · sotto l\'orizzonte' : '';
      span.textContent = (sel.kind === 'iss' ? 'ISS' : '') + below;
    }
  }

  isSelected(ref: ObjRef) { return sameRef(ref, this.selected); }

  render(renderer: THREE.WebGLRenderer) {
    renderer.render(this.scene, this.camera);
  }
}
