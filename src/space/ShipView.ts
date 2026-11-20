// Vista "Navicella": volo libero nello spazio, dalla Terra fino ad Andromeda.
// Posizioni in km (doppia precisione) con "origine mobile": la camera è sempre in (0,0,0).
import * as THREE from 'three';
import * as A from 'astronomy-engine';
import { Background, GALACTIC_CENTER_PC } from '../render/background';
import { BodySprite } from '../render/bodies';
import { planetMaterial, ringMaterial, tempColor } from '../render/planet';
import { BODIES, BodyInfo, V3, v3 } from '../astro/astro';
import { AU_IN_KM, C_KMS, LY_IN_KM, PC_IN_KM, messier, radecToVec, starName, starPhysical, stars } from '../data/catalog';
import { ObjRef, formatDistanceKm, refName, refPosPc } from '../features/objects';
import { bus, simDate, state } from '../state';
import { LabelLayer } from '../ui/labels';
import { num, tx } from '../i18n';
import { PointerHandlers } from '../ui/pointer';

const D2R = Math.PI / 180;
const toV = (v: A.Vector): V3 => [v.x, v.y, v.z];

interface PlanetObj {
  info: BodyInfo;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  sprite: BodySprite;
  ring?: THREE.Mesh;
  pos: V3; // km eliocentrici
  orbit?: { pts: Float64Array; line: THREE.Line; geo: THREE.BufferGeometry };
}

interface NearStar { index: number; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; sprite: BodySprite }

export interface Telemetry {
  speed: number; beta: number; warp: number; gamma: number;
  nearest: string; nearestDist: string;
  target: string | null; targetDist: string; eta: string;
  shipTime: number; earthTime: number; where: string; autopilot: boolean; arrived: string | null;
}

const PLANET_LOOK: Record<string, { type: number; c1: number; c2: number; atm: number }> = {
  mercury: { type: 0, c1: 0x9a948c, c2: 0x6f6a64, atm: 0x000000 },
  venus: { type: 3, c1: 0xe9d7a8, c2: 0xc9a86a, atm: 0x6b5a30 },
  earth: { type: 2, c1: 0x2f6fd0, c2: 0xffffff, atm: 0x3a7bff },
  moon: { type: 0, c1: 0xb5b2ad, c2: 0x777777, atm: 0x000000 },
  mars: { type: 5, c1: 0xc1623a, c2: 0x5a2a18, atm: 0x6a3a22 },
  jupiter: { type: 1, c1: 0xd8c3a0, c2: 0x9c6b45, atm: 0x40342a },
  saturn: { type: 1, c1: 0xe8d6a6, c2: 0xb8996a, atm: 0x3a3426 },
  uranus: { type: 1, c1: 0xa6dde6, c2: 0x8fcad8, atm: 0x3a6a78 },
  neptune: { type: 1, c1: 0x4a6ee8, c2: 0x2c48b8, atm: 0x2a3a88 },
  pluto: { type: 0, c1: 0xd2b89a, c2: 0x8a6a50, atm: 0x000000 },
};

/** Magnitudine assoluta (a 1 UA dal Sole e dall'osservatore). */
const H_MAG: Record<string, number> = { mercury: -0.6, venus: -4.4, earth: -3.99, moon: 0.28, mars: -1.52, jupiter: -9.4, saturn: -8.88, uranus: -7.19, neptune: -6.87, pluto: -1.0 };

/** Velocità (km/s) ↔ posizione della manetta 0..1. */
export function throttleToSpeed(t: number): number {
  if (t < 0.02) return 0;
  if (t < 0.35) return Math.pow(10, ((t - 0.02) / 0.33) * Math.log10(0.1 * C_KMS));
  if (t < 0.55) return Math.tanh(0.1003 + ((t - 0.35) / 0.2) * (4.952 - 0.1003)) * C_KMS;
  return C_KMS * Math.pow(10, ((t - 0.55) / 0.45) * 12);
}
export function speedToThrottle(v: number): number {
  if (v <= 0.5) return 0;
  if (v < 0.1 * C_KMS) return 0.02 + (Math.log10(Math.max(1, v)) / Math.log10(0.1 * C_KMS)) * 0.33;
  if (v < C_KMS * 0.99995) return 0.35 + ((Math.atanh(v / C_KMS) - 0.1003) / (4.952 - 0.1003)) * 0.2;
  return 0.55 + (Math.log10(v / C_KMS) / 12) * 0.45;
}

export function formatSpeed(v: number): string {
  const light = tx('luce', 'light', 'lumière');
  if (v < 1) return tx('ferma', 'stationary', 'à l\'arrêt');
  if (v < 1000) return `${num(v, v < 10 ? 1 : 0)} km/s`;
  if (v < 0.01 * C_KMS) return `${num(Math.round(v))} km/s`;
  if (v < C_KMS * 0.99995) { const d = v / C_KMS > 0.99 ? 4 : 2; return `${num(v / C_KMS, d, d)} c`; }
  const w = v / C_KMS;
  if (w < 1000) return `${num(w, w < 10 ? 1 : 0)} × ${light}`;
  const e = Math.floor(Math.log10(w));
  const m = w / Math.pow(10, e);
  return `${num(m, 1, 1)}·10${sup(e)} × ${light}`;
}
const sup = (n: number) => String(n).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('');

export function formatDuration(s: number): string {
  if (!isFinite(s)) return '—';
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400 * 2) return `${num(s / 3600, 1)} ${tx('ore', 'hours', 'heures')}`;
  if (s < 86400 * 365 * 2) return `${Math.round(s / 86400)} ${tx('giorni', 'days', 'jours')}`;
  const y = s / (86400 * 365.25);
  if (y < 1e6) return `${num(Math.round(y))} ${tx('anni', 'years', 'ans')}`;
  return `${num(y / 1e6, 1)} ${tx('milioni di anni', 'million years', 'millions d\'années')}`;
}

export class ShipView {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.001, 1e13);
  pos: V3 = [0, 0, 0];
  quat = new THREE.Quaternion();
  speed = 0;
  targetSpeed = 0;
  shipTime = 0;
  earthTime = 0;
  target: ObjRef | null = null;
  autopilot = false;
  arrived: string | null = null;

  private root = new THREE.Group();
  private planets: PlanetObj[] = [];
  private near: NearStar[] = [];
  private nearScanT = 0;
  private labels: LabelLayer;
  private w = 1;
  private h = 1;
  private yawV = 0;
  private pitchV = 0;
  private rollV = 0;
  private keys = new Set<string>();
  private dust: THREE.LineSegments;
  private dustPts: Float32Array;
  private dustMat: THREE.LineBasicMaterial;
  private sunGlow: BodySprite;
  private time = 0;
  private labelStars: number[] = [];
  private labelScanT = 0;
  private apStart = 0;
  private fov = 70;

  constructor(private bg: Background, overlay: HTMLElement) {
    this.scene.add(this.root);
    this.scene.add(this.camera);
    this.labels = new LabelLayer(overlay);
    this.labels.el.style.display = 'none';
    const sphere = new THREE.SphereGeometry(1, 96, 48);
    for (const b of BODIES) {
      const look = PLANET_LOOK[b.id];
      const mat = b.id === 'sun' ? planetMaterial(4, 0xfff1d6, 0xffffff, 0, 1) : planetMaterial(look.type, look.c1, look.c2, look.atm, b.id.length * 3.1);
      mat.transparent = true;
      const mesh = new THREE.Mesh(sphere, mat);
      mesh.renderOrder = 3;
      mesh.scale.setScalar(b.radiusKm);
      mesh.frustumCulled = false;
      this.root.add(mesh);
      const sprite = new BodySprite(b.id.length);
      this.root.add(sprite.mesh);
      const p: PlanetObj = { info: b, mesh, mat, sprite, pos: [0, 0, 0] };
      if (b.rings) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(74500, 140220, 128, 1), ringMaterial(74500, 140220));
        ring.frustumCulled = false;
        ring.renderOrder = 6;
        this.root.add(ring);
        p.ring = ring;
      }
      this.planets.push(p);
    }
    this.sunGlow = new BodySprite(1);
    this.root.add(this.sunGlow.mesh);
    this.buildOrbits();

    // polvere spaziale per percepire la velocità
    const N = 500;
    this.dustPts = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) this.dustPts[i] = Math.random() * 2 - 1;
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    this.dustMat = new THREE.LineBasicMaterial({ color: 0x9fc3ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
    this.dust = new THREE.LineSegments(dg, this.dustMat);
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 20;
    this.camera.add(this.dust);

    window.addEventListener('keydown', (e) => { if (state.mode === 'ship' && !(e.target instanceof HTMLInputElement)) this.keys.add(e.key.toLowerCase()); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  attach() { this.root.add(this.bg.group); this.labels.el.style.display = ''; }
  detach() { this.labels.clear(); this.labels.el.style.display = 'none'; }

  private buildOrbits() {
    const now = simDate();
    for (const p of this.planets) {
      const b = p.info;
      if (!b.period || !b.body || b.id === 'sun') continue;
      const n = b.id === 'moon' ? 180 : 360;
      const pts = new Float64Array(n * 3);
      for (let i = 0; i < n; i++) {
        const t = new Date(now.getTime() + (i / n) * b.period * 86400e3);
        const v = b.id === 'moon' ? A.GeoMoon(t) : A.HelioVector(b.body, t);
        pts[i * 3] = v.x * AU_IN_KM; pts[i * 3 + 1] = v.y * AU_IN_KM; pts[i * 3 + 2] = v.z * AU_IN_KM;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: b.id === 'moon' ? 0x8899aa : 0x4a6a9a, transparent: true, opacity: 0.45, depthWrite: false }));
      line.frustumCulled = false;
      line.renderOrder = 1;
      this.root.add(line);
      p.orbit = { pts, line, geo };
    }
  }

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // --- posizionamento --------------------------------------------------------
  bodyPosKm(id: string, date = simDate()): V3 {
    const b = BODIES.find((x) => x.id === id);
    if (!b?.body || id === 'sun') return [0, 0, 0];
    return v3.scale(toV(A.HelioVector(b.body, date)), AU_IN_KM);
  }

  /** Posizione (km) e raggio di "arrivo" per un oggetto. */
  targetInfo(ref: ObjRef): { pos: V3; standoff: number } | null {
    if (ref.kind === 'body') {
      const b = BODIES.find((x) => x.id === ref.id)!;
      return { pos: this.bodyPosKm(ref.id), standoff: b.radiusKm * (b.id === 'sun' ? 12 : b.rings ? 7 : 4) };
    }
    if (ref.kind === 'star') {
      const R = Math.min(1500, starPhysical(ref.index).R) * 696340;
      return { pos: v3.scale([stars.pos[ref.index * 3], stars.pos[ref.index * 3 + 1], stars.pos[ref.index * 3 + 2]], PC_IN_KM), standoff: Math.max(R * 10, 3e6) };
    }
    if (ref.kind === 'messier') {
      const p = refPosPc(ref)!;
      const m = messier.find((x) => x.id === ref.id)!;
      const gal = ['sg', 's0', 'sd', 'i', 'e'].includes(m.type);
      const ly = gal ? (m.id === 'M31' ? 160000 : 90000) : m.type === 'gc' ? 250 : 40;
      return { pos: v3.scale(p, PC_IN_KM), standoff: ly * LY_IN_KM };
    }
    return null;
  }

  /** Teletrasporto vicino a un oggetto, guardandolo. */
  placeNear(ref: ObjRef) {
    const t = this.targetInfo(ref);
    if (!t) return;
    let away: V3 = v3.norm(v3.sub([0, 0, 0], t.pos));
    if (v3.len(t.pos) < 1) away = [1, 0, 0];
    // illuminato dal Sole, leggermente di lato
    const side = v3.norm(v3.cross(away, [0, 0, 1]));
    const dir = v3.norm(v3.add(away, v3.scale(side, 0.45)));
    this.pos = v3.add(t.pos, v3.scale(dir, t.standoff * 1.3));
    this.lookAt(t.pos);
    this.stop();
    this.target = ref;
    this.arrived = refName(ref);
  }

  placeAt(pos: V3, look: V3, up: V3 = [0, 0, 1]) {
    this.pos = pos;
    this.lookAt(look, up);
    this.stop();
  }

  aboveGalaxy() {
    const ngp = radecToVec(192.85948, 27.12825);
    const c = v3.scale(GALACTIC_CENTER_PC as V3, PC_IN_KM);
    const pos = v3.add(c, v3.add(v3.scale(ngp, 26000 * PC_IN_KM), v3.scale(v3.norm(v3.scale(c, -1)), 12000 * PC_IN_KM)));
    this.placeAt(pos, c, v3.norm(v3.scale(c, -1)));
    this.target = null;
    this.arrived = tx('Sopra la Via Lattea', 'Above the Milky Way', 'Au-dessus de la Voie lactée');
  }

  lookAt(p: V3, up: V3 = [0, 0, 1]) {
    const d = v3.norm(v3.sub(p, this.pos));
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(...d), new THREE.Vector3(...up));
    this.quat.setFromRotationMatrix(m);
  }

  stop() { this.speed = 0; this.targetSpeed = 0; this.autopilot = false; }

  goTo(ref: ObjRef) {
    this.target = ref;
    this.autopilot = true;
    this.arrived = null;
    this.apStart = this.time;
  }

  setThrottle(t: number) {
    this.autopilot = false;
    this.targetSpeed = throttleToSpeed(t);
  }
  get throttle() { return speedToThrottle(this.speed); }

  // --- input ----------------------------------------------------------------
  handlers(): PointerHandlers {
    const k = () => ((this.fov * D2R) / this.h);
    return {
      drag: (dx, dy) => {
        this.rotate(-dx * k(), -dy * k(), 0);
        if (this.autopilot) this.autopilot = false;
      },
      dragEnd: (vx, vy) => { this.yawV = -vx * k() * 60; this.pitchV = -vy * k() * 60; },
      down: () => { this.yawV = this.pitchV = 0; },
      pinch: (s) => { this.fov = Math.max(10, Math.min(100, this.fov / s)); },
      wheel: (d) => { this.fov = Math.max(10, Math.min(100, this.fov * Math.exp(d * 0.001))); },
      tap: (x, y) => { const r = this.pick(x, y); if (r) bus.emit('ship-select', r); },
    };
  }

  private rotate(yaw: number, pitch: number, roll: number) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
    this.quat.multiply(q).normalize();
  }

  forward(): V3 {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat);
    return [f.x, f.y, f.z];
  }

  // --- simulazione ----------------------------------------------------------
  update(dt: number) {
    this.time += dt;
    const date = simDate();
    const K = this.keys;
    const kr = 1.2 * dt;
    if (K.has('a') || K.has('arrowleft')) this.rotate(kr, 0, 0);
    if (K.has('d') || K.has('arrowright')) this.rotate(-kr, 0, 0);
    if (K.has('arrowup')) this.rotate(0, kr, 0);
    if (K.has('arrowdown')) this.rotate(0, -kr, 0);
    if (K.has('q')) this.rotate(0, 0, kr);
    if (K.has('e')) this.rotate(0, 0, -kr);
    if (K.has('w')) this.setThrottle(Math.min(1, speedToThrottle(Math.max(this.targetSpeed, 1)) + dt * 0.12));
    if (K.has('s')) this.setThrottle(Math.max(0, speedToThrottle(this.targetSpeed) - dt * 0.12));
    if (K.has(' ')) this.stop();
    if (Math.abs(this.yawV) + Math.abs(this.pitchV) + Math.abs(this.rollV) > 1e-5) {
      this.rotate(this.yawV * dt, this.pitchV * dt, this.rollV * dt);
      const damp = Math.pow(0.05, dt);
      this.yawV *= damp; this.pitchV *= damp; this.rollV *= damp;
    }

    // pilota automatico
    if (this.autopilot && this.target) {
      const t = this.targetInfo(this.target);
      if (t) {
        const to = v3.sub(t.pos, this.pos);
        const dist = v3.len(to);
        const remaining = dist - t.standoff;
        const desired = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), new THREE.Vector3(...v3.norm(to)), new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat)));
        this.quat.slerp(desired, 1 - Math.pow(0.02, dt));
        const aligned = this.quat.angleTo(desired) < 0.08 || this.time - this.apStart > 3;
        if (remaining <= t.standoff * 0.02 || remaining < 1) {
          this.stop();
          this.arrived = refName(this.target);
          bus.emit('arrived', this.target);
        } else {
          this.targetSpeed = aligned ? Math.max(1, remaining / 1.1) : 0;
        }
      }
    }

    // accelerazione "logaritmica": ogni ordine di grandezza richiede lo stesso tempo
    const rate = this.autopilot ? 4.2 : 2.5;
    if (this.targetSpeed > this.speed) {
      this.speed = Math.min(this.targetSpeed, Math.max(this.speed, 1) * Math.exp(rate * dt));
    } else {
      this.speed = Math.max(this.targetSpeed, this.speed * Math.exp(-rate * 1.6 * dt));
      if (this.speed < 0.5) this.speed = this.targetSpeed;
    }
    const f = this.forward();
    let step = this.speed * dt;
    // non oltrepassare il bersaglio
    if (this.autopilot && this.target) {
      const t = this.targetInfo(this.target);
      if (t) step = Math.min(step, Math.max(0, v3.len(v3.sub(t.pos, this.pos)) - t.standoff));
    }
    this.pos = v3.add(this.pos, v3.scale(f, step));
    const beta = this.speed < C_KMS * 0.99995 ? this.speed / C_KMS : 0;
    const gamma = 1 / Math.sqrt(1 - beta * beta);
    this.shipTime += dt;
    this.earthTime += dt * gamma;

    // camera
    this.camera.quaternion.copy(this.quat);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixPerRad = (this.h * dpr) / (2 * Math.tan((this.fov * D2R) / 2));
    this.bg.update({
      obsPc: new THREE.Vector3(...v3.scale(this.pos, 1 / PC_IN_KM)),
      beta: new THREE.Vector3(...v3.scale(f, Math.min(beta, 0.9995))),
      magLimit: 7.2, pixelScale: dpr, pixPerRad, dim: 1, galaxyDim: state.settings.milkyWay ? 1 : 0,
      linesOpacity: state.settings.constellations ? 0.18 * Math.max(0, Math.min(1, (100 - v3.len(this.pos) / LY_IN_KM) / 80)) : 0, twinkle: 0, time: this.time, nearCutPc: 0.003,
    });
    this.updateSolarSystem(date, pixPerRad, dpr);
    this.updateNearStars(dt, pixPerRad, dpr);
    this.updateDust(dt, f);
  }

  private setSprite(sp: BodySprite, rel: V3, discPx: number, glowPx: number, glow: number, color: THREE.Color, star: boolean, pixPerRad: number, light?: THREE.Vector3) {
    const d = v3.norm(rel);
    sp.mesh.position.set(d[0] * 900, d[1] * 900, d[2] * 900);
    sp.mesh.quaternion.copy(this.quat);
    const u = sp.mat.uniforms;
    const quadPx = Math.max(discPx * 1.2, glowPx * 2.4);
    u.uQuad.value = (quadPx / pixPerRad) * 900;
    u.uQuadPx.value = quadPx;
    u.uDiscPx.value = discPx;
    u.uGlowPx.value = glowPx;
    u.uGlow.value = glow;
    u.uStar.value = star ? 1 : 0;
    u.uColor.value.copy(color);
    if (light) u.uLight.value.copy(light);
    sp.mesh.visible = true;
  }

  private updateSolarSystem(date: Date, pixPerRad: number, dpr: number) {
    const sunRel = v3.scale(this.pos, -1);
    const sunDist = v3.len(sunRel);
    const inSystem = sunDist < 2e5 * AU_IN_KM;
    const view = this.camera.matrixWorldInverse;
    for (const p of this.planets) {
      const b = p.info;
      p.pos = b.id === 'sun' ? [0, 0, 0] : this.bodyPosKm(b.id, date);
      const rel = v3.sub(p.pos, this.pos);
      const dist = v3.len(rel);
      const disc = Math.atan(b.radiusKm / Math.max(dist, b.radiusKm * 1.0001)) * pixPerRad;
      const visibleMesh = inSystem && disc > 1.2;
      p.mesh.visible = visibleMesh;
      p.mesh.position.set(rel[0], rel[1], rel[2]);
      const toSun = new THREE.Vector3(...v3.norm(v3.scale(p.pos, -1)));
      if (b.body && b.id !== 'sun') {
        try {
          const ax = A.RotationAxis(b.body, date);
          const pole = new THREE.Vector3(ax.north.x, ax.north.y, ax.north.z);
          const a0 = ax.ra * 15 * D2R;
          const node = new THREE.Vector3(-Math.sin(a0), Math.cos(a0), 0);
          const W = ax.spin * D2R;
          const X = node.clone().multiplyScalar(Math.cos(W)).add(new THREE.Vector3().crossVectors(pole, node).multiplyScalar(Math.sin(W)));
          const Y = new THREE.Vector3().crossVectors(pole, X);
          p.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, pole));
          if (p.ring) {
            p.ring.position.copy(p.mesh.position);
            p.ring.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, pole));
            p.ring.visible = visibleMesh || disc * 2.4 > 1.2;
            (p.ring.material as THREE.ShaderMaterial).uniforms.uLit.value = 0.25 + 0.75 * Math.abs(toSun.dot(pole));
          }
        } catch { /* */ }
      }
      p.mat.uniforms.uLight.value.copy(toSun).transformDirection(view);
      p.mat.uniforms.uTime.value = this.time;
      // punto luminoso quando il pianeta è troppo piccolo
      if (b.id === 'sun') {
        p.sprite.mesh.visible = false;
        const glowPx = Math.max(disc * 5, 26 * dpr);
        const fade = Math.max(0, Math.min(1, 1 - Math.log10(sunDist / AU_IN_KM / 50) / 3));
        if (fade > 0.01) this.setSprite(this.sunGlow, rel, 0, glowPx, 0.9 * fade, new THREE.Color(1, 0.93, 0.8), true, pixPerRad);
        else this.sunGlow.mesh.visible = false;
        this.sunGlow.mesh.renderOrder = 5;
      } else if (inSystem && disc <= 2.5) {
        const mag = (H_MAG[b.id] ?? 0) + 5 * Math.log10((dist / AU_IN_KM) * Math.max(0.01, v3.len(p.pos) / AU_IN_KM));
        const s = 7 - mag * 0.6;
        if (s > 0) this.setSprite(p.sprite, rel, 0, Math.max(2, Math.min(9, 1.8 + s * 0.5)) * dpr, Math.min(1.2, 0.3 + s * 0.08), new THREE.Color(...b.color), false, pixPerRad);
        else p.sprite.mesh.visible = false;
        p.sprite.mesh.renderOrder = 4;
      } else p.sprite.mesh.visible = false;

      if (p.orbit) {
        const o = p.orbit;
        const arr = o.geo.attributes.position.array as Float32Array;
        const base = b.id === 'moon' ? this.bodyPosKm('earth', date) : [0, 0, 0];
        for (let i = 0; i < o.pts.length; i += 3) {
          arr[i] = o.pts[i] + base[0] - this.pos[0];
          arr[i + 1] = o.pts[i + 1] + base[1] - this.pos[1];
          arr[i + 2] = o.pts[i + 2] + base[2] - this.pos[2];
        }
        o.geo.attributes.position.needsUpdate = true;
        const near = b.id === 'moon' ? dist < 5e6 : sunDist < 300 * AU_IN_KM;
        o.line.visible = state.settings.constellations && near;
        (o.line.material as THREE.LineBasicMaterial).opacity = b.id === 'moon' ? 0.3 : 0.26 * Math.max(0.15, Math.min(1, 1 - Math.log10(sunDist / AU_IN_KM / 40) / 1.2));
      }
    }
  }

  private updateNearStars(dt: number, pixPerRad: number, dpr: number) {
    this.nearScanT -= dt;
    const obs = v3.scale(this.pos, 1 / PC_IN_KM);
    if (this.nearScanT <= 0) {
      this.nearScanT = 0.5;
      const found: { i: number; d: number }[] = [];
      for (let i = 0; i < stars.count; i++) {
        const dx = stars.pos[i * 3] - obs[0], dy = stars.pos[i * 3 + 1] - obs[1], dz = stars.pos[i * 3 + 2] - obs[2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < 0.25) found.push({ i, d });
      }
      found.sort((a, b) => a.d - b.d);
      const want = found.slice(0, 6).map((f) => f.i);
      // ricicla le stelle vicine
      for (const n of this.near) if (!want.includes(n.index)) { this.root.remove(n.mesh, n.sprite.mesh); }
      this.near = this.near.filter((n) => want.includes(n.index));
      for (const i of want) {
        if (this.near.some((n) => n.index === i)) continue;
        const ph = starPhysical(i);
        const col = tempColor(ph.T);
        const mat = planetMaterial(4, col, col, 0, i);
        mat.transparent = true;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
        mesh.renderOrder = 3;
        mesh.scale.setScalar(Math.min(1500, ph.R) * 696340);
        mesh.frustumCulled = false;
        const sprite = new BodySprite(i);
        this.root.add(mesh, sprite.mesh);
        this.near.push({ index: i, mesh, mat, sprite });
      }
    }
    for (const n of this.near) {
      const i = n.index;
      const p: V3 = [stars.pos[i * 3] * PC_IN_KM, stars.pos[i * 3 + 1] * PC_IN_KM, stars.pos[i * 3 + 2] * PC_IN_KM];
      const rel = v3.sub(p, this.pos);
      const dist = v3.len(rel);
      const R = n.mesh.scale.x;
      const disc = Math.atan(R / Math.max(dist, R * 1.0001)) * pixPerRad;
      n.mesh.position.set(rel[0], rel[1], rel[2]);
      n.mesh.visible = disc > 1.2;
      n.mat.uniforms.uTime.value = this.time;
      const col = tempColor(stars.temp[i]);
      const fade = Math.max(0, Math.min(1, 1 - Math.log10(dist / AU_IN_KM / 50) / 3));
      if (fade > 0.01) this.setSprite(n.sprite, rel, 0, Math.max(disc * 5, 22 * dpr), 0.9 * fade, col, true, pixPerRad);
      else n.sprite.mesh.visible = false;
      n.sprite.mesh.renderOrder = 5;
    }
  }

  private updateDust(dt: number, _f: V3) {
    const v = this.speed;
    const arr = this.dust.geometry.attributes.position.array as Float32Array;
    const flow = v < 1 ? 0 : 0.15 + 0.11 * Math.log10(1 + v);
    const warp = v > C_KMS;
    this.dustMat.opacity = Math.min(0.55, flow * 0.5) * (warp ? 1 : 0.7);
    this.dustMat.color.setRGB(warp ? 0.7 : 0.6, warp ? 0.8 : 0.75, 1);
    const len = Math.min(1.2, flow * (warp ? 0.9 : 0.35));
    const P = this.dustPts;
    const S = 40;
    for (let i = 0; i < P.length; i += 3) {
      P[i + 2] += flow * dt * 1.4;
      if (P[i + 2] > 1) { P[i + 2] -= 2; P[i] = Math.random() * 2 - 1; P[i + 1] = Math.random() * 2 - 1; }
      let x = P[i], y = P[i + 1];
      const r = Math.hypot(x, y);
      if (r < 0.12) { x *= 0.12 / (r || 1); y *= 0.12 / (r || 1); }
      const z = P[i + 2];
      const j = i * 2;
      arr[j] = x * S; arr[j + 1] = y * S; arr[j + 2] = z * S - S * 0.2;
      arr[j + 3] = x * S; arr[j + 4] = y * S; arr[j + 5] = (z - len * 0.25) * S - S * 0.2;
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
    this.dust.visible = flow > 0;
  }

  // --- overlay ----------------------------------------------------------------
  private project(rel: V3) {
    const v = new THREE.Vector3(...v3.norm(rel)).multiplyScalar(1000).applyMatrix4(this.camera.matrixWorldInverse);
    const front = v.z < 0;
    v.applyMatrix4(this.camera.projectionMatrix);
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h, front };
  }

  private pick(x: number, y: number): ObjRef | null {
    let best: ObjRef | null = null;
    let bs = 28;
    const c = (ref: ObjRef, rel: V3) => {
      const p = this.project(rel);
      if (!p.front) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bs) { bs = d; best = ref; }
    };
    for (const p of this.planets) c({ kind: 'body', id: p.info.id }, v3.sub(p.pos, this.pos));
    const obs = v3.scale(this.pos, 1 / PC_IN_KM);
    for (let i = 0; i < stars.count; i++) {
      const dx = stars.pos[i * 3] - obs[0], dy = stars.pos[i * 3 + 1] - obs[1], dz = stars.pos[i * 3 + 2] - obs[2];
      const d = Math.hypot(dx, dy, dz);
      if (stars.absmag[i] + 5 * Math.log10(d) - 5 > 5.5) continue;
      c({ kind: 'star', index: i }, [dx, dy, dz]);
    }
    for (const m of messier) {
      const p = refPosPc({ kind: 'messier', id: m.id })!;
      c({ kind: 'messier', id: m.id }, v3.sub(p, obs));
    }
    return best;
  }

  updateOverlay() {
    const L = this.labels;
    L.begin();
    const sunDist = v3.len(this.pos);
    const put = (rel: V3, text: string, cls: string, force = false) => {
      const p = this.project(rel);
      if (!p.front || p.x < -40 || p.x > this.w + 40 || p.y < -20 || p.y > this.h + 20) return;
      L.add(p.x, p.y, text, cls, force);
    };
    if (this.target) {
      const t = this.targetInfo(this.target);
      if (t) put(v3.sub(t.pos, this.pos), '◎ ' + refName(this.target), 'target', true);
    }
    if (state.settings.labels) {
      if (sunDist > 2000 * AU_IN_KM) put(v3.scale(this.pos, -1), tx('Sole', 'Sun', 'Soleil'), 'body sun-far', true);
      for (const p of this.planets) {
        const rel = v3.sub(p.pos, this.pos);
        const d = v3.len(rel);
        const show = p.info.id === 'sun' ? sunDist < 2000 * AU_IN_KM : (p.info.id === 'moon' ? d < 3e7 : sunDist < 200 * AU_IN_KM);
        const isTarget = this.target?.kind === 'body' && this.target.id === p.info.id;
        if (show && !isTarget) put(rel, p.info.name, p.info.id === 'sun' ? 'body star' : 'body', true);
      }
      // stelle più luminose dalla posizione attuale
      this.labelScanT -= 1;
      const obs = v3.scale(this.pos, 1 / PC_IN_KM);
      if (this.labelScanT <= 0) {
        this.labelScanT = 30;
        const cand: { i: number; m: number }[] = [];
        for (let i = 0; i < stars.count; i++) {
          const ni = stars.name[i];
          if (ni < 0) continue;
          const d = Math.hypot(stars.pos[i * 3] - obs[0], stars.pos[i * 3 + 1] - obs[1], stars.pos[i * 3 + 2] - obs[2]);
          cand.push({ i, m: stars.absmag[i] + 5 * Math.log10(Math.max(d, 1e-6)) - 5 });
        }
        cand.sort((a, b) => a.m - b.m);
        this.labelStars = cand.filter((c) => c.m < 6).slice(0, 30).map((c) => c.i);
      }
      for (const i of this.labelStars) {
        const rel: V3 = [stars.pos[i * 3] - obs[0], stars.pos[i * 3 + 1] - obs[1], stars.pos[i * 3 + 2] - obs[2]];
        const dpc = v3.len(rel);
        const near = dpc < 2 ? ` · ${formatDistanceKm(dpc * PC_IN_KM)}` : '';
        put(rel, starName(i) + near, 'star');
      }
      if (sunDist > 3000 * PC_IN_KM) {
        put(v3.sub(GALACTIC_CENTER_PC as V3, obs), tx('Centro galattico', 'Galactic centre', 'Centre galactique'), 'dso');
      }
      for (const m of messier) {
        if (!['M31', 'M33', 'M42', 'M45', 'M13', 'M44', 'M1'].includes(m.id)) continue;
        put(v3.sub(refPosPc({ kind: 'messier', id: m.id })!, obs), refName({ kind: 'messier', id: m.id }), 'dso');
      }
    }
    L.end();
  }

  telemetry(): Telemetry {
    let nearest = tx('Sole', 'Sun', 'Soleil'), nd = v3.len(this.pos);
    for (const p of this.planets) {
      const d = v3.len(v3.sub(p.pos, this.pos)) - p.info.radiusKm;
      if (d < nd) { nd = d; nearest = p.info.name; }
    }
    for (const n of this.near) {
      const i = n.index;
      const d = v3.len(v3.sub([stars.pos[i * 3] * PC_IN_KM, stars.pos[i * 3 + 1] * PC_IN_KM, stars.pos[i * 3 + 2] * PC_IN_KM], this.pos)) - n.mesh.scale.x;
      if (d < nd) { nd = d; nearest = starName(i); }
    }
    const beta = this.speed < C_KMS * 0.99995 ? this.speed / C_KMS : 1;
    let target: string | null = null, td = '', eta = '';
    if (this.target) {
      target = refName(this.target);
      const t = this.targetInfo(this.target);
      if (t) {
        const full = v3.len(v3.sub(t.pos, this.pos));
        const radius = this.target.kind === 'body' ? (BODIES.find((b) => b.id === (this.target as any).id)?.radiusKm ?? 0) : 0;
        td = formatDistanceKm(Math.max(0, full - radius));
        const v = this.speed;
        eta = v > 1 && this.autopilot ? formatDuration(Math.max(0, full - t.standoff) / v) : '';
      }
    }
    const sd = v3.len(this.pos);
    const where = sd < 50 * AU_IN_KM ? tx('Sistema Solare', 'Solar System', 'Système solaire') : sd < 0.5 * LY_IN_KM ? tx('Nube di Oort', 'Oort cloud', 'Nuage d\'Oort') : tx(`a ${formatDistanceKm(sd)} dal Sole`, `${formatDistanceKm(sd)} from the Sun`, `à ${formatDistanceKm(sd)} du Soleil`);
    if (nd > 0.3 * LY_IN_KM) nearest = '';
    return {
      speed: this.speed, beta, warp: this.speed / C_KMS, gamma: beta < 1 ? 1 / Math.sqrt(1 - beta * beta) : Infinity,
      nearest, nearestDist: formatDistanceKm(Math.max(0, nd)), target, targetDist: td, eta,
      shipTime: this.shipTime, earthTime: this.earthTime, where, autopilot: this.autopilot, arrived: this.arrived,
    };
  }

  render(renderer: THREE.WebGLRenderer) {
    renderer.render(this.scene, this.camera);
  }
}
