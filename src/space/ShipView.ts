// Vista "Navicella": volo libero nello spazio, dalla Terra fino ad Andromeda.
// Posizioni in km (doppia precisione) con "origine mobile": la camera è sempre in (0,0,0).
import * as THREE from 'three';
import * as A from 'astronomy-engine';
import { Background, GALACTIC_CENTER_PC } from '../render/background';
import { BodySprite } from '../render/bodies';
import { LOOKS, PT, atmosphereMaterial, bodySphere, planetMaterial, ringMaterial, tempColor } from '../render/planet';
import { Streaks } from '../render/streaks';
import { BODIES, BodyInfo, V3, bodyAxes, v3 } from '../astro/astro';
import { AU_IN_KM, C_KMS, LY_IN_KM, PC_IN_KM, galaxyPhotos, messier, radecToVec, starName, starPhysical, stars } from '../data/catalog';
import { ObjRef, formatDistanceKm, refName, refPosPc, sameRef } from '../features/objects';
import { deepById, deepForMessier, deepObjects } from '../data/deep';
import { bus, simDate, state } from '../state';
import { LabelLayer } from '../ui/labels';
import { num, tx } from '../i18n';
import { PointerHandlers } from '../ui/pointer';
import { reducedMotion } from '../core/feel';
import { quality } from '../core/quality';
import { SmoothValue, damp, easeInOutCubic, smoothstep } from '../core/motion';

const D2R = Math.PI / 180;
const toV = (v: A.Vector): V3 => [v.x, v.y, v.z];

interface PlanetObj {
  info: BodyInfo;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  atm?: THREE.Mesh;
  sprite: BodySprite;
  ring?: THREE.Mesh;
  pos: V3; // km eliocentrici
  orbit?: { pts: Float64Array; line: THREE.Line; geo: THREE.BufferGeometry };
}

interface NearStar { index: number; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; sprite: BodySprite; color: THREE.Color }

export interface Telemetry {
  speed: number; beta: number; warp: number; gamma: number;
  nearest: string; nearestDist: string;
  target: string | null; targetDist: string; eta: string;
  shipTime: number; earthTime: number; where: string; autopilot: boolean; arrived: string | null;
}


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
  private labels: LabelLayer<ObjRef>;
  private w = 1;
  private h = 1;
  private pendYaw = 0;
  private pendPitch = 0;
  private yawV = 0;
  private pitchV = 0;
  private keys = new Set<string>();
  private dust: THREE.LineSegments;
  private dustPts: Float32Array;
  private dustMat: THREE.LineBasicMaterial;
  private sunGlow: BodySprite;
  private streaks = new Streaks();
  private time = 0;
  private labelStars: number[] = [];
  private labelScanT = 0;
  private baseFov = 70;
  private fov = new SmoothValue(70, 0.6);
  private logSpeed = new SmoothValue(-1, 0.9);
  private lastLog = -1;
  private shake = 0;
  private galSpin = 0;
  private launch: { t: number; base: V3; up: V3; quat: THREE.Quaternion } | null = null;
  private marker: HTMLDivElement;
  private markerArrow: HTMLDivElement;
  private cloudOffset = 0;
  /** Dopo l'arrivo, punto verso cui girarsi dolcemente. */
  private settleLook: V3 | null = null;
  /** Punto di vista sulla Via Lattea, fissato alla partenza (vista 3/4 dall'alto, dal lato da cui arrivi). */
  private mwView: V3 | null = null;
  /** Orientamento e distanza alla partenza del pilota automatico (per una rotazione distribuita su tutto il viaggio). */
  private apStart: { quat: THREE.Quaternion; rem0: number; t: number } | null = null;

  private milkyWayViewpoint(): V3 {
    const c = v3.scale(GALACTIC_CENTER_PC as V3, PC_IN_KM);
    const ngp = radecToVec(192.85948, 27.12825);
    let side = v3.sub(this.pos, c);
    side = v3.sub(side, v3.scale(ngp, v3.dot(side, ngp)));
    const u = v3.len(side) > 1 ? v3.norm(side) : v3.norm(v3.scale(c, -1));
    const dir = v3.norm(v3.add(v3.scale(ngp, 0.86), v3.scale(u, 0.5)));
    return v3.add(c, v3.scale(dir, 95000 * LY_IN_KM));
  }
  // oggetti riutilizzati per non allocare a ogni fotogramma
  private tq = new THREE.Quaternion();
  private tq2 = new THREE.Quaternion();
  private te = new THREE.Euler();
  private tv = new THREE.Vector3();
  private tv2 = new THREE.Vector3();
  private upV = new THREE.Vector3();
  private fwdTmp = new THREE.Vector3();
  private tm = new THREE.Matrix4();
  private obsV = new THREE.Vector3();
  private betaV = new THREE.Vector3();
  private fwdV = new THREE.Vector3();
  private color = new THREE.Color();

  constructor(private bg: Background, overlay: HTMLElement) {
    this.scene.add(this.root);
    this.scene.add(this.camera);
    // blu notte profondo invece del nero assoluto
    this.scene.background = new THREE.Color(0x050a18);
    this.labels = new LabelLayer<ObjRef>(overlay);
    this.labels.el.style.display = 'none';
    this.labels.onPick = (r) => bus.emit('ship-select', r);
    const sphere = bodySphere(quality.sphereSegments);
    for (const b of BODIES) {
      const look = LOOKS[b.id];
      const mat = planetMaterial(look);
      mat.transparent = true;
      const mesh = new THREE.Mesh(sphere, mat);
      mesh.renderOrder = 3;
      mesh.scale.setScalar(b.radiusKm);
      mesh.frustumCulled = false;
      this.root.add(mesh);
      const sprite = new BodySprite(b.id.length);
      this.root.add(sprite.mesh);
      const p: PlanetObj = { info: b, mesh, mat, sprite, pos: [0, 0, 0] };
      if (look.shell) {
        const atm = new THREE.Mesh(sphere, atmosphereMaterial(look.shell[0], look.shell[2]));
        atm.scale.setScalar(b.radiusKm * look.shell[1]);
        atm.frustumCulled = false;
        atm.renderOrder = 4;
        this.root.add(atm);
        p.atm = atm;
      }
      if (b.rings) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(74500, 140220, 160, 1), ringMaterial(74500, 140220));
        ring.frustumCulled = false;
        ring.renderOrder = 6;
        this.root.add(ring);
        p.ring = ring;
      }
      this.planets.push(p);
    }
    this.sunGlow = new BodySprite(1);
    this.root.add(this.sunGlow.mesh);
    this.root.add(this.streaks.lines);
    this.buildOrbits();

    // polvere spaziale per percepire la velocità
    const N = 420;
    this.dustPts = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) this.dustPts[i] = Math.random() * 2 - 1;
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    this.dustMat = new THREE.LineBasicMaterial({ color: 0x9fc3ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
    this.dust = new THREE.LineSegments(dg, this.dustMat);
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 20;
    this.camera.add(this.dust);

    // mirino del bersaglio e freccia quando è fuori schermo
    this.marker = document.createElement('div');
    this.marker.className = 'ship-target';
    this.marker.innerHTML = '<i></i><i></i><i></i><i></i><span></span>';
    this.markerArrow = document.createElement('div');
    this.markerArrow.className = 'sel-arrow ship';
    this.markerArrow.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3l7 12h-14z"/></svg><span></span>';
    overlay.append(this.marker, this.markerArrow);
    // anche il nome del bersaglio è toccabile
    this.marker.querySelector('span')!.addEventListener('click', (e) => { e.stopPropagation(); if (this.target) bus.emit('ship-select', this.target); });
    this.marker.style.display = this.markerArrow.style.display = 'none';

    window.addEventListener('keydown', (e) => { if (state.mode === 'ship' && !(e.target instanceof HTMLInputElement)) this.keys.add(e.key.toLowerCase()); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  attach() { this.root.add(this.bg.group); this.labels.el.style.display = ''; }
  detach() {
    this.labels.clear();
    this.labels.el.style.display = 'none';
    this.marker.style.display = this.markerArrow.style.display = 'none';
  }

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
      const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: b.id === 'moon' ? 0x8899aa : 0x5a7aaa, transparent: true, opacity: 0.4, depthWrite: false }));
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
  targetInfo(ref: ObjRef): { pos: V3; standoff: number; radius: number; look?: V3 } | null {
    if (ref.kind === 'body') {
      const b = BODIES.find((x) => x.id === ref.id)!;
      return { pos: this.bodyPosKm(ref.id), standoff: b.radiusKm * (b.id === 'sun' ? 10 : b.rings ? 6.5 : 3.6), radius: b.radiusKm };
    }
    if (ref.kind === 'star') {
      const R = Math.min(1500, starPhysical(ref.index).R) * 696340;
      return { pos: v3.scale([stars.pos[ref.index * 3], stars.pos[ref.index * 3 + 1], stars.pos[ref.index * 3 + 2]], PC_IN_KM), standoff: Math.max(R * 7, 3e5), radius: R };
    }
    if (ref.kind === 'deep') {
      const o = deepById(ref.id);
      if (!o) return null;
      const R = o.radiusLy * LY_IN_KM;
      if (o.id === 'milkyway') {
        // la Via Lattea si guarda dall'alto: punto di vista sopra il polo galattico
        const c = v3.scale(GALACTIC_CENTER_PC as V3, PC_IN_KM);
        if (!this.mwView) this.mwView = this.milkyWayViewpoint();
        return { pos: this.mwView, standoff: 0, radius: 0, look: c };
      }
      const k = o.type === 'galaxy' ? 1.7 : o.type === 'blackhole' || o.type === 'quasar' ? 3.2 : o.type === 'pulsar' ? 6 : 2.2;
      return { pos: v3.scale(refPosPc(ref)!, PC_IN_KM), standoff: R * k, radius: R };
    }
    if (ref.kind === 'messier') {
      const linked = deepForMessier(ref.id);
      if (linked) return this.targetInfo({ kind: 'deep', id: linked.id });
      const p = refPosPc(ref)!;
      const m = messier.find((x) => x.id === ref.id)!;
      const gal = ['s', 'sg', 's0', 'sd', 'i', 'e'].includes(m.type);
      const ly = gal ? (m.id === 'M31' ? 105000 : 60000) : m.type === 'gc' ? 250 : 40;
      return { pos: v3.scale(p, PC_IN_KM), standoff: ly * LY_IN_KM, radius: ly * LY_IN_KM * 0.3 };
    }
    return null;
  }

  /** Teletrasporto vicino a un oggetto, guardandolo. */
  placeNear(ref: ObjRef) {
    if (ref.kind === 'deep' && ref.id === 'milkyway') this.mwView = this.milkyWayViewpoint();
    const t = this.targetInfo(ref);
    if (!t) return;
    if (t.look) {
      this.placeAt(t.pos, t.look, v3.norm(v3.scale(t.look, -1)));
      this.target = ref;
      this.arrived = refName(ref);
      return;
    }
    let away: V3 = v3.norm(v3.sub([0, 0, 0], t.pos));
    if (v3.len(t.pos) < 1) away = [1, 0, 0];
    const side = v3.norm(v3.cross(away, [0, 0, 1]));
    // galassie con foto reale: si arriva lungo la linea di vista della foto (da Terra), così il render coincide
    const photoGal = ref.kind === 'deep' && galaxyPhotos[ref.id]?.kind === 'face';
    const dir = v3.norm(v3.add(away, v3.scale(side, photoGal ? 0.06 : 0.45)));
    this.launch = null;
    this.pos = v3.add(t.pos, v3.scale(dir, t.standoff * 1.3));
    this.lookAt(t.pos);
    this.stop(true);
    this.target = ref;
    this.arrived = refName(ref);
  }

  placeAt(pos: V3, look: V3, up: V3 = [0, 0, 1]) {
    this.launch = null;
    this.pos = pos;
    this.lookAt(look, up);
    this.stop(true);
  }

  /** Decollo cinematografico dalla superficie della Terra. */
  launchFrom(surface: V3, lookDir: V3, up: V3) {
    this.placeAt(v3.add(surface, v3.scale(up, 60)), v3.add(surface, v3.scale(lookDir, 1e5)), up);
    this.launch = { t: 0, base: surface, up, quat: this.quat.clone() };
    this.target = null;
    this.arrived = null;
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
    this.tm.lookAt(this.tv.set(0, 0, 0), this.tv2.set(d[0], d[1], d[2]), new THREE.Vector3(...up));
    this.quat.setFromRotationMatrix(this.tm);
  }

  stop(instant = false) {
    this.targetSpeed = 0;
    this.autopilot = false;
    if (instant) { this.speed = 0; this.logSpeed.value = -1; this.logSpeed.velocity = 0; }
  }

  goTo(ref: ObjRef) {
    this.target = ref;
    if (ref.kind === 'deep' && ref.id === 'milkyway') this.mwView = this.milkyWayViewpoint();
    const t0 = this.targetInfo(ref);
    this.apStart = t0 ? { quat: this.quat.clone(), rem0: Math.max(1, v3.len(v3.sub(t0.pos, this.pos)) - t0.standoff), t: 0 } : null;
    this.autopilot = true;
    this.arrived = null;
    this.launch = null;
  }

  setThrottle(t: number) {
    this.autopilot = false;
    this.targetSpeed = throttleToSpeed(t);
  }
  get throttle() { return speedToThrottle(this.speed); }

  // --- input ----------------------------------------------------------------
  handlers(): PointerHandlers {
    const k = () => ((this.camera.fov * D2R) / this.h);
    return {
      drag: (dx, dy) => {
        this.settleLook = null;
        this.pendYaw += -dx * k();
        this.pendPitch += -dy * k();
        if (this.autopilot) this.autopilot = false;
        this.launch = null;
      },
      dragEnd: (vx, vy) => { this.yawV = -vx * k() * 50; this.pitchV = -vy * k() * 50; },
      down: () => { this.yawV = this.pitchV = 0; },
      pinch: (s) => { this.baseFov = Math.max(15, Math.min(100, this.baseFov / s)); },
      wheel: (d) => { this.baseFov = Math.max(15, Math.min(100, this.baseFov * Math.exp(d * 0.001))); },
      tap: (x, y) => { const r = this.pick(x, y); if (r) bus.emit('ship-select', r); },
    };
  }

  private rotate(yaw: number, pitch: number, roll: number) {
    this.tq.setFromEuler(this.te.set(pitch, yaw, roll, 'YXZ'));
    this.quat.multiply(this.tq).normalize();
  }

  forward(): V3 {
    const f = this.tv.set(0, 0, -1).applyQuaternion(this.quat);
    return [f.x, f.y, f.z];
  }

  // --- simulazione ----------------------------------------------------------
  update(dt: number) {
    this.time += dt;
    const date = simDate();
    const K = this.keys;
    const kr = 1.1 * dt;
    if (K.has('a') || K.has('arrowleft')) this.rotate(kr, 0, 0);
    if (K.has('d') || K.has('arrowright')) this.rotate(-kr, 0, 0);
    if (K.has('arrowup')) this.rotate(0, kr, 0);
    if (K.has('arrowdown')) this.rotate(0, -kr, 0);
    if (K.has('q')) this.rotate(0, 0, kr);
    if (K.has('e')) this.rotate(0, 0, -kr);
    if (K.has('w')) this.setThrottle(Math.min(1, speedToThrottle(Math.max(this.targetSpeed, 1)) + dt * 0.12));
    if (K.has('s')) this.setThrottle(Math.max(0, speedToThrottle(this.targetSpeed) - dt * 0.12));
    if (K.has(' ')) this.stop();

    // rotazione morbida: il dito guida, la navicella segue con un leggero ritardo
    const f1 = 1 - Math.exp(-16 * dt);
    const ry = this.pendYaw * f1, rp = this.pendPitch * f1;
    this.pendYaw -= ry; this.pendPitch -= rp;
    this.rotate(ry + this.yawV * dt, rp + this.pitchV * dt, 0);
    const damping = Math.exp(-2.2 * dt);
    this.yawV *= damping; this.pitchV *= damping;

    if (this.settleLook && !this.autopilot) {
      const n = v3.norm(v3.sub(this.settleLook, this.pos));
      this.tm.lookAt(this.tv.set(0, 0, 0), this.tv2.set(n[0], n[1], n[2]), this.upV.set(0, 1, 0).applyQuaternion(this.quat));
      this.tq.setFromRotationMatrix(this.tm);
      this.quat.slerp(this.tq, 1 - Math.exp(-2 * dt));
      if (this.quat.angleTo(this.tq) < 0.005) this.settleLook = null;
    }
    // decollo
    if (this.launch) {
      const L = this.launch;
      L.t += dt / 4.2;
      const e = easeInOutCubic(Math.min(1, L.t));
      const alt = 60 + 2400 * e * e + 40 * e;
      this.pos = v3.add(L.base, v3.scale(L.up, alt));
      // la vista si inclina verso il basso per mostrare la Terra che si allontana
      this.tq.setFromAxisAngle(this.tv.set(1, 0, 0), -0.55 * e);
      this.quat.copy(L.quat).multiply(this.tq);
      if (L.t >= 1) this.launch = null;
    }

    // pilota automatico
    if (this.autopilot && this.target) {
      const t = this.targetInfo(this.target);
      if (t) {
        const to = v3.sub(t.pos, this.pos);
        const dist = v3.len(to);
        const remaining = dist - t.standoff;
        // con un punto di vista (es. Via Lattea dall'alto) la camera guarda già il soggetto durante il viaggio:
        // si sale vedendo la galassia aprirsi, senza la virata finale
        let angle: number;
        if (t.look && this.apStart) {
          // orientamento finale (dal punto d'arrivo verso il soggetto), raggiunto gradualmente lungo tutto il viaggio
          const fin = v3.norm(v3.sub(t.look, t.pos));
          this.tm.lookAt(this.tv.set(0, 0, 0), this.tv2.set(fin[0], fin[1], fin[2]), this.upV.set(0, 1, 0).applyQuaternion(this.apStart.quat));
          this.tq.setFromRotationMatrix(this.tm);
          // virata calma nei primi secondi (a velocità ancora bassa), poi volo dritto verso la meta
          this.apStart.t += dt;
          const p = Math.max(Math.min(1, this.apStart.t / 2.6), Math.sqrt(Math.max(0, 1 - Math.max(0, remaining) / this.apStart.rem0)));
          const e = p * p * (3 - 2 * p);
          this.tq2.copy(this.apStart.quat).slerp(this.tq, Math.min(1, Math.max(0, e)));
          this.quat.slerp(this.tq2, 1 - Math.exp(-4 * dt));
          angle = 0;
        } else {
          const n = v3.norm(to);
          this.tm.lookAt(this.tv.set(0, 0, 0), this.tv2.set(n[0], n[1], n[2]), this.upV.set(0, 1, 0).applyQuaternion(this.quat));
          this.tq.setFromRotationMatrix(this.tm);
          this.quat.slerp(this.tq, 1 - Math.exp(-2.6 * dt));
          angle = this.quat.angleTo(this.tq);
        }
        // soglia d'arrivo proporzionale alla scala del bersaglio (anche per i punti di vista con standoff 0)
        const scale = t.look ? v3.len(v3.sub(t.pos, t.look)) : t.standoff;
        if (remaining <= Math.max(1, scale * 0.015)) {
          this.stop(true);
          if (t.look) this.settleLook = t.look;
          this.arrived = refName(this.target);
          bus.emit('arrived', this.target);
          bus.emit('flash');
        } else {
          const aligned = smoothstep(1.1, 0.3, angle);
          this.targetSpeed = Math.max(1, remaining / 0.55) * aligned;
        }
      }
    }

    // velocità con accelerazione "logaritmica" e smorzata: ogni ordine di grandezza
    // richiede circa lo stesso tempo, senza strappi in partenza o in frenata
    const goal = this.targetSpeed < 0.5 ? -1 : Math.log10(this.targetSpeed);
    this.logSpeed.smoothTime = this.autopilot ? 0.75 : 0.9;
    const ls = this.logSpeed.to(goal, dt);
    this.speed = ls <= -0.5 ? 0 : Math.pow(10, ls);
    // in avvicinamento la velocità non supera mai quella che permette di fermarsi in tempo
    if (this.autopilot && this.target) {
      const t = this.targetInfo(this.target);
      if (t) {
        const rem = Math.max(0, v3.len(v3.sub(t.pos, this.pos)) - t.standoff);
        const cap = rem / 0.32;
        if (this.speed > cap) { this.speed = cap; this.logSpeed.value = Math.log10(Math.max(cap, 0.1)); this.logSpeed.velocity = Math.min(0, this.logSpeed.velocity); }
      }
    }
    const accel = (ls - this.lastLog) / Math.max(dt, 1e-3);
    this.lastLog = ls;
    this.shake = damp(this.shake, Math.min(1, Math.abs(accel) * 0.12) * (this.speed > 1000 ? 1 : 0), 6, dt);

    const f = this.forward();
    let step = this.speed * dt;
    let dir: V3 = f;
    if (this.autopilot && this.target) {
      const t = this.targetInfo(this.target);
      if (t) {
        const to = v3.sub(t.pos, this.pos);
        step = Math.min(step, Math.max(0, v3.len(to) - t.standoff));
        // il pilota automatico va dritto verso la meta (niente archi mentre la vista si allinea)
        if (v3.len(to) > 0) dir = v3.norm(to);
      }
    }
    this.pos = v3.add(this.pos, v3.scale(dir, step));
    const beta = this.speed < C_KMS * 0.99995 ? this.speed / C_KMS : 0;
    const gamma = 1 / Math.sqrt(1 - beta * beta);
    this.shipTime += dt;
    this.earthTime += dt * gamma;

    // camera: campo visivo che si allarga con la velocità, leggero tremolio nelle accelerazioni
    const calm = reducedMotion();
    const warp = calm ? 0 : smoothstep(4.0, 10.0, Math.log10(Math.max(1, this.speed)));
    const fov = this.fov.to(this.baseFov + 26 * warp, dt);
    this.camera.quaternion.copy(this.quat);
    if (this.shake > 0.002 && !calm) {
      const s = this.shake * 0.0035;
      this.tq.setFromEuler(this.te.set(Math.sin(this.time * 37) * s, Math.sin(this.time * 29 + 1) * s, 0));
      this.camera.quaternion.multiply(this.tq);
    }
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixPerRad = (this.h * dpr) / (2 * Math.tan((fov * D2R) / 2));
    // effetti relativistici: "cinematografici" (leggeri) di default, realistici su richiesta
    const betaVis = state.settings.realRelativity ? Math.min(beta, 0.9995) : beta * 0.35;
    this.obsV.set(this.pos[0] / PC_IN_KM, this.pos[1] / PC_IN_KM, this.pos[2] / PC_IN_KM);
    this.fwdV.set(f[0], f[1], f[2]);
    this.betaV.copy(this.fwdV).multiplyScalar(betaVis);
    // la galassia ruota lentamente quando la si guarda da fuori
    const gcDist = v3.len(v3.sub(GALACTIC_CENTER_PC as V3, [this.obsV.x, this.obsV.y, this.obsV.z]));
    this.galSpin = gcDist > 16000 ? this.galSpin + dt * 0.035 : damp(this.galSpin, 0, 0.6, dt);
    this.bg.update({
      obsPc: this.obsV, beta: this.betaV,
      magLimit: 7.2, pixelScale: dpr, pixPerRad, dim: 1, galaxyDim: state.settings.milkyWay ? 1 : 0,
      linesOpacity: state.settings.constellations ? 0.16 * Math.max(0, Math.min(1, (100 - v3.len(this.pos) / LY_IN_KM) / 80)) : 0,
      twinkle: 0, time: this.time, nearCutPc: 0.003, galSpin: this.galSpin, deepField: true,
    });
    this.streaks.update(this.obsV, this.fwdV, warp);
    this.updateSolarSystem(date, pixPerRad, dpr, dt);
    this.updateNearStars(dt, pixPerRad, dpr);
    this.updateDust(dt, warp);
  }

  private setSprite(sp: BodySprite, rel: V3, discPx: number, glowPx: number, glow: number, color: THREE.Color, star: boolean, pixPerRad: number) {
    const d = v3.norm(rel);
    sp.mesh.position.set(d[0] * 900, d[1] * 900, d[2] * 900);
    const u = sp.mat.uniforms;
    const quadPx = Math.max(discPx * 1.2, glowPx * 2.4);
    u.uQuad.value = (quadPx / pixPerRad) * 900;
    u.uQuadPx.value = quadPx;
    u.uDiscPx.value = discPx;
    u.uGlowPx.value = glowPx;
    u.uGlow.value = glow;
    u.uStar.value = star ? 1 : 0;
    u.uColor.value.copy(color);
    sp.mesh.visible = true;
  }

  private updateSolarSystem(date: Date, pixPerRad: number, dpr: number, dt: number) {
    const sunDist = v3.len(this.pos);
    const inSystem = sunDist < 2e5 * AU_IN_KM;
    const view = this.camera.matrixWorldInverse;
    this.cloudOffset = (this.cloudOffset + dt * 0.0012) % 1;
    for (const p of this.planets) {
      const b = p.info;
      p.pos = b.id === 'sun' ? [0, 0, 0] : this.bodyPosKm(b.id, date);
      const rel = v3.sub(p.pos, this.pos);
      const dist = v3.len(rel);
      const disc = Math.atan(b.radiusKm / Math.max(dist, b.radiusKm * 1.0001)) * pixPerRad;
      const visibleMesh = inSystem && disc > 1.2;
      p.mesh.visible = visibleMesh;
      p.mesh.position.set(rel[0], rel[1], rel[2]);
      const toSun = this.tv2.set(-p.pos[0], -p.pos[1], -p.pos[2]).normalize();
      if (b.body && b.id !== 'sun' && visibleMesh) {
        try {
          const ax = bodyAxes(b.body, date);
          this.tm.makeBasis(this.tv.set(...ax.X), this.upV.set(...ax.Y), this.fwdTmp.set(...ax.Z));
          p.mesh.quaternion.setFromRotationMatrix(this.tm);
          if (p.ring) {
            p.ring.position.copy(p.mesh.position);
            p.ring.quaternion.copy(p.mesh.quaternion);
            const ru = (p.ring.material as THREE.ShaderMaterial).uniforms;
            ru.uLit.value = 0.25 + 0.75 * Math.abs(toSun.dot(this.tv.set(...ax.Z)));
            ru.uTime.value = this.time;
            ru.uPlanetV.value.copy(p.mesh.position).applyMatrix4(view);
            ru.uLight.value.copy(toSun).transformDirection(view);
          }
        } catch { /* */ }
      }
      if (p.ring) p.ring.visible = inSystem && disc * 2.4 > 1.2;
      if (p.atm) {
        p.atm.visible = visibleMesh && disc > 4;
        p.atm.position.copy(p.mesh.position);
        (p.atm.material as THREE.ShaderMaterial).uniforms.uLight.value.copy(toSun).transformDirection(view);
      }
      const u = p.mat.uniforms;
      u.uLight.value.copy(toSun).transformDirection(view);
      u.uTime.value = this.time;
      u.uCloudOffset.value = this.cloudOffset;
      if (b.id === 'sun') {
        p.sprite.mesh.visible = false;
        const glowPx = Math.max(disc * 5, 26 * dpr);
        const fade = Math.max(0, Math.min(1, 1 - Math.log10(sunDist / AU_IN_KM / 50) / 3));
        if (fade > 0.01) this.setSprite(this.sunGlow, rel, 0, glowPx, 0.9 * fade, this.color.setRGB(1, 0.9, 0.75), true, pixPerRad);
        else this.sunGlow.mesh.visible = false;
        this.sunGlow.mesh.renderOrder = 5;
      } else if (inSystem && disc <= 2.5) {
        const mag = (H_MAG[b.id] ?? 0) + 5 * Math.log10((dist / AU_IN_KM) * Math.max(0.01, v3.len(p.pos) / AU_IN_KM));
        const s = 7 - mag * 0.6;
        if (s > 0) this.setSprite(p.sprite, rel, 0, Math.max(2, Math.min(9, 1.8 + s * 0.5)) * dpr, Math.min(1.2, 0.3 + s * 0.08), this.color.setRGB(...b.color), false, pixPerRad);
        else p.sprite.mesh.visible = false;
        p.sprite.mesh.renderOrder = 4;
      } else p.sprite.mesh.visible = false;

      if (p.orbit) {
        const o = p.orbit;
        const showOrbit = state.settings.constellations && (b.id === 'moon' ? dist < 5e6 : sunDist < 300 * AU_IN_KM);
        o.line.visible = showOrbit;
        if (!showOrbit) continue;
        const arr = o.geo.attributes.position.array as Float32Array;
        const base = b.id === 'moon' ? this.bodyPosKm('earth', date) : [0, 0, 0];
        for (let i = 0; i < o.pts.length; i += 3) {
          arr[i] = o.pts[i] + base[0] - this.pos[0];
          arr[i + 1] = o.pts[i + 1] + base[1] - this.pos[1];
          arr[i + 2] = o.pts[i + 2] + base[2] - this.pos[2];
        }
        o.geo.attributes.position.needsUpdate = true;
        (o.line.material as THREE.LineBasicMaterial).opacity = b.id === 'moon' ? 0.3 : 0.24 * Math.max(0.15, Math.min(1, 1 - Math.log10(sunDist / AU_IN_KM / 40) / 1.2));
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
      for (const n of this.near) if (!want.includes(n.index)) { this.root.remove(n.mesh, n.sprite.mesh); n.mat.dispose(); }
      this.near = this.near.filter((n) => want.includes(n.index));
      for (const i of want) {
        if (this.near.some((n) => n.index === i)) continue;
        const ph = starPhysical(i);
        const col = tempColor(ph.T);
        const mat = planetMaterial({ type: PT.star, map: 'sun', color: col.getHex(), bright: 1.5 });
        mat.transparent = true;
        const mesh = new THREE.Mesh(bodySphere(64), mat);
        mesh.renderOrder = 3;
        mesh.scale.setScalar(Math.min(1500, ph.R) * 696340);
        mesh.frustumCulled = false;
        const sprite = new BodySprite(i);
        this.root.add(mesh, sprite.mesh);
        this.near.push({ index: i, mesh, mat, sprite, color: col });
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
      n.mesh.rotation.z = this.time * 0.01;
      n.mesh.visible = disc > 1.2;
      n.mat.uniforms.uTime.value = this.time;
      const fade = Math.max(0, Math.min(1, 1 - Math.log10(dist / AU_IN_KM / 50) / 3));
      if (fade > 0.01) this.setSprite(n.sprite, rel, 0, Math.max(disc * 5, 22 * dpr), 0.9 * fade, n.color, true, pixPerRad);
      else n.sprite.mesh.visible = false;
      n.sprite.mesh.renderOrder = 5;
    }
  }

  private updateDust(dt: number, warp: number) {
    const v = this.speed;
    const arr = this.dust.geometry.attributes.position.array as Float32Array;
    const flow = v < 1 ? 0 : 0.15 + 0.11 * Math.log10(1 + v);
    this.dustMat.opacity = Math.min(0.5, flow * 0.45) * (1 - warp * 0.6);
    const len = Math.min(1.2, flow * (0.35 + warp * 0.6));
    const P = this.dustPts;
    const S = 40;
    for (let i = 0; i < P.length; i += 3) {
      P[i + 2] += flow * dt * 1.4;
      if (P[i + 2] > 1) { P[i + 2] -= 2; P[i] = Math.random() * 2 - 1; P[i + 1] = Math.random() * 2 - 1; }
      let x = P[i], y = P[i + 1];
      const r = Math.hypot(x, y);
      if (r < 0.15) { x *= 0.15 / (r || 1); y *= 0.15 / (r || 1); }
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
    const v = this.tv.set(...v3.norm(rel)).multiplyScalar(1000).applyMatrix4(this.camera.matrixWorldInverse);
    const front = v.z < 0;
    const vx = v.x, vy = v.y;
    v.applyMatrix4(this.camera.projectionMatrix);
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h, front, vx, vy };
  }

  private discPxCss(radius: number, dist: number) {
    return (Math.atan(radius / Math.max(dist, radius * 1.0001)) * this.h) / (2 * Math.tan((this.camera.fov * D2R) / 2));
  }

  private pick(x: number, y: number): ObjRef | null {
    // gerarchia: dentro il disco di un oggetto grande vince l'oggetto grande; gli oggetti
    // piccoli e deboli vicino al dito vincono solo se si tocca proprio loro
    let best: ObjRef | null = null;
    let bs = Infinity;
    const c = (ref: ObjRef, rel: V3, radiusPx: number, weight = 0) => {
      const p = this.project(rel);
      if (!p.front) return;
      const d = Math.hypot(p.x - x, p.y - y);
      const lim = Math.max(26 + weight, radiusPx + 12);
      if (d > lim) return;
      const score = d - Math.min(radiusPx, d + radiusPx * 0.25) - weight;
      if (score < bs) { bs = score; best = ref; }
    };
    for (const p of this.planets) {
      const rel = v3.sub(p.pos, this.pos);
      c({ kind: 'body', id: p.info.id }, rel, this.discPxCss(p.info.radiusKm * (p.info.rings ? 2.3 : 1), v3.len(rel)), 10);
    }
    const obs = v3.scale(this.pos, 1 / PC_IN_KM);
    for (let i = 0; i < stars.count; i++) {
      const dx = stars.pos[i * 3] - obs[0], dy = stars.pos[i * 3 + 1] - obs[1], dz = stars.pos[i * 3 + 2] - obs[2];
      const d = Math.hypot(dx, dy, dz);
      const m = stars.absmag[i] + 5 * Math.log10(d) - 5;
      if (m > 5.5) continue;
      const R = Math.min(1500, starPhysical(i).R) * 696340;
      c({ kind: 'star', index: i }, [dx, dy, dz], this.discPxCss(R, d * PC_IN_KM), (2.5 - m) * 3);
    }
    for (const m of messier) {
      if (deepForMessier(m.id)) continue;
      const p = refPosPc({ kind: 'messier', id: m.id })!;
      c({ kind: 'messier', id: m.id }, v3.sub(p, obs), 0, -4);
    }
    for (const o of deepObjects()) {
      const ref: ObjRef = { kind: 'deep', id: o.id };
      const rel = v3.sub(refPosPc(ref)!, obs);
      c(ref, rel, this.discPxCss(o.radiusLy / 3.26156, v3.len(rel)), o.type === 'galaxy' || o.type === 'blackhole' ? 6 : 0);
    }
    return best;
  }

  updateOverlay() {
    const L = this.labels;
    L.begin();
    const sunDist = v3.len(this.pos);
    const put = (rel: V3, text: string, cls: string, force = false, ref?: ObjRef, radiusPx = 0) => {
      const p = this.project(rel);
      if (!p.front || p.x < -40 || p.x > this.w + 40 || p.y < -20 || p.y > this.h + 20) return;
      // dischi enormi: l'etichetta resta in vista sotto il centro
      L.add(p.x, p.y, text, cls, force, ref, Math.min(radiusPx, this.h * 0.32));
    };
    // dischi dei pianeti sullo schermo: le etichette delle stelle dietro di essi vengono nascoste
    const discs: number[] = [];
    for (const p of this.planets) {
      if (!p.mesh.visible) continue;
      const rel = v3.sub(p.pos, this.pos);
      const r = this.discPxCss(p.info.radiusKm * (p.info.rings ? 2.2 : 1), v3.len(rel));
      if (r < 8) continue;
      const q = this.project(rel);
      if (q.front) discs.push(q.x, q.y, r, v3.len(rel));
    }
    // un'etichetta è nascosta se il suo oggetto sta dietro il disco di un pianeta più vicino
    const hidden = (rel: V3, dist = Infinity) => {
      if (!discs.length) return false;
      const q = this.project(rel);
      for (let k = 0; k < discs.length; k += 4) if (discs[k + 3] < dist * 0.999 && Math.hypot(q.x - discs[k], q.y - discs[k + 1]) < discs[k + 2]) return true;
      return false;
    };
    if (state.settings.labels) {
      if (sunDist > 2000 * AU_IN_KM && sunDist < 30000 * PC_IN_KM) put(v3.scale(this.pos, -1), tx('Sole', 'Sun', 'Soleil'), 'pill star', true, { kind: 'body', id: 'sun' });
      for (const p of this.planets) {
        const rel = v3.sub(p.pos, this.pos);
        const d = v3.len(rel);
        const show = p.info.id === 'sun' ? sunDist < 2000 * AU_IN_KM : (p.info.id === 'moon' ? d < 3e7 : sunDist < 200 * AU_IN_KM);
        const isTarget = this.target?.kind === 'body' && this.target.id === p.info.id;
        if (show && !isTarget && !hidden(rel, d)) put(rel, p.info.name, 'pill' + (p.info.id === 'sun' ? ' star' : ''), true, { kind: 'body', id: p.info.id }, this.discPxCss(p.info.radiusKm, d));
      }
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
        if (this.target?.kind === 'star' && this.target.index === i) continue;
        const rel: V3 = [stars.pos[i * 3] - obs[0], stars.pos[i * 3 + 1] - obs[1], stars.pos[i * 3 + 2] - obs[2]];
        const dpc = v3.len(rel);
        const near = dpc < 2 ? ` · ${formatDistanceKm(dpc * PC_IN_KM)}` : '';
        if (hidden(rel)) continue;
        put(rel, starName(i) + near, 'star', false, { kind: 'star', index: i });
      }
      if (sunDist > 3000 * PC_IN_KM) {
        const far = v3.len(v3.sub(GALACTIC_CENTER_PC as V3, obs)) > 40000;
        put(v3.sub(GALACTIC_CENTER_PC as V3, obs), far ? tx('Via Lattea', 'Milky Way', 'Voie lactée') : tx('Centro galattico', 'Galactic centre', 'Centre galactique'), far ? 'pill' : 'dso', far, { kind: 'deep', id: 'milkyway' });
      }
      for (const m of messier) {
        if (!['M31', 'M33', 'M42', 'M45', 'M13', 'M44', 'M1', 'M8', 'M16'].includes(m.id) || deepForMessier(m.id)) continue;
        const ref: ObjRef = { kind: 'messier', id: m.id };
        put(v3.sub(refPosPc(ref)!, obs), refName(ref), 'dso', false, ref);
      }
      // oggetti del catalogo profondo: etichetta quando sono abbastanza grandi o (galassie) quando sei fuori dalla Via Lattea
      const outside = v3.len(v3.sub(GALACTIC_CENTER_PC as V3, obs)) > 40000;
      const pxr = this.h / (2 * Math.tan((this.camera.fov * D2R) / 2));
      for (const o of deepObjects()) {
        if (o.id === 'milkyway') continue;
        const ref: ObjRef = { kind: 'deep', id: o.id };
        if (this.target && sameRef(this.target, ref)) continue; // il nome del bersaglio è già nel mirino
        const rel = v3.sub(refPosPc(ref)!, obs);
        const d = v3.len(rel);
        const px = ((o.radiusLy / 3.26156) / d) * pxr;
        if (px > 5 || (outside && o.type === 'galaxy') || d < 60) put(rel, o.name, o.type === 'galaxy' && (outside || px > 30) ? 'pill' : 'dso', px > 30, ref, o.type === 'galaxy' || o.type === 'nebula' || o.type === 'gc' ? px * 0.55 : px);
      }
    }
    L.end();
    this.updateTargetMarker();
  }

  /** Mirino sul bersaglio (o freccia ai bordi se è fuori dallo schermo). */
  private updateTargetMarker() {
    const t = this.target ? this.targetInfo(this.target) : null;
    if (!t || !this.target) { this.marker.style.display = this.markerArrow.style.display = 'none'; return; }
    const rel = v3.sub(t.look ?? t.pos, this.pos);
    const dist = v3.len(rel);
    const p = this.project(rel);
    const label = `${refName(this.target)} · ${formatDistanceKm(Math.max(0, dist - t.radius))}`;
    const on = p.front && p.x > 24 && p.x < this.w - 24 && p.y > 24 && p.y < this.h - 24;
    if (on) {
      const size = Math.max(46, Math.min(this.h * 0.7, this.discPxCss(t.radius, dist) * 2 + 26));
      this.marker.style.display = '';
      this.marker.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      this.marker.style.setProperty('--s', `${size}px`);
      // il nome sta sotto il mirino, o sopra se finirebbe dietro la barra dei comandi
      const below = p.y + size / 2 + 44 > this.h - 86, above = p.y - size / 2 - 44 < 78;
      this.marker.classList.toggle('top', below && !above);
      // se non c'è spazio né sopra né sotto, il nome resta solo nella pillola in alto
      this.marker.classList.toggle('nolabel', below && above);
      this.marker.classList.toggle('locked', this.autopilot);
      (this.marker.lastElementChild as HTMLElement).textContent = label;
      this.markerArrow.style.display = 'none';
    } else {
      this.marker.style.display = 'none';
      let ax = p.vx, ay = -p.vy;
      if (!p.front && Math.hypot(ax, ay) < 1e-3) { ax = 0; ay = 1; }
      const l = Math.hypot(ax, ay) || 1;
      ax /= l; ay /= l;
      const cx = this.w / 2, cy = this.h / 2, m = 56;
      const k = Math.min((cx - m) / Math.abs(ax || 1e-6), (cy - m) / Math.abs(ay || 1e-6));
      this.markerArrow.style.display = '';
      this.markerArrow.style.transform = `translate3d(${cx + ax * k}px, ${cy + ay * k}px, 0)`;
      (this.markerArrow.firstElementChild as HTMLElement).style.transform = `rotate(${Math.atan2(ay, ax) * 180 / Math.PI + 90}deg)`;
      (this.markerArrow.lastElementChild as HTMLElement).textContent = label;
    }
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
      if (d < nd && stars.name[i] >= 0) { nd = d; nearest = starName(i); }
    }
    const beta = this.speed < C_KMS * 0.99995 ? this.speed / C_KMS : 1;
    let target: string | null = null, td = '', eta = '';
    if (this.target) {
      target = refName(this.target);
      const t = this.targetInfo(this.target);
      if (t) {
        const full = v3.len(v3.sub(t.pos, this.pos));
        td = formatDistanceKm(t.look ? v3.len(v3.sub(t.look, this.pos)) : Math.max(0, full - t.radius));
        // il pilota automatico rallenta in modo esponenziale: stima del tempo reale di arrivo
        const rem = Math.max(0, full - t.standoff);
        eta = this.autopilot && rem > 0 ? formatDuration(Math.max(1, 0.55 * Math.log(Math.max(1, rem / Math.max(1, t.standoff * 0.015))) + 0.8)) : '';
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
