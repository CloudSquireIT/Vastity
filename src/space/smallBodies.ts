// Corpi piccoli in navicella: lune dei pianeti (con orbita e scia che sfuma) e veicoli spaziali con
// modelli 3D procedurali (ISS, Tiangong, Hubble, James Webb, Tesla Roadster, sonde Voyager e New Horizons),
// tutti nelle posizioni reali di questo istante. I satelliti in orbita terrestre mostrano la loro traiettoria.
import * as THREE from 'three';
import * as A from 'astronomy-engine';
import { V3, v3, bodyById } from '../astro/astro';
import { AU_IN_KM } from '../data/catalog';
import { CRAFT, Craft, allMoons, craftHelioKm, leoTrackKm, moonOffsetKm, moonOrbitKm, MoonEl } from '../data/ephem';
import { PT, bodySphere, planetMaterial } from '../render/planet';
import type { ObjRef } from '../features/objects';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// modelli 3D ufficiali NASA (NASA 3D Resources, pubblico dominio), compressi con meshopt.
// Estensione .glb.wasm: il contenuto è glTF binario (il caricatore lo riconosce dall'intestazione),
// ma .wasm è servito ovunque, anche dall'anteprima web che non accetta .glb.
const GLB: Record<string, { file: string; sizeM: number }> = {
  iss: { file: 'models/iss.glb.wasm', sizeM: 109 },
  hubble: { file: 'models/hubble.glb.wasm', sizeM: 13.2 },
  jwst: { file: 'models/jwst.glb.wasm', sizeM: 21.2 },
  voyager1: { file: 'models/voyager.glb.wasm', sizeM: 13 },
  voyager2: { file: 'models/voyager.glb.wasm', sizeM: 13 },
};
let gltf: GLTFLoader | null = null;
const glbCache = new Map<string, Promise<THREE.Group>>();
function loadGlb(file: string) {
  if (!gltf) { gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder); }
  if (!glbCache.has(file)) glbCache.set(file, gltf.loadAsync(file).then((g) => g.scene));
  return glbCache.get(file)!;
}

const MOON_LOOK: Record<string, { color?: number; map?: string; gas?: boolean }> = {
  io: { color: 0xe0c45c }, europa: { color: 0xdccdb2 }, ganymede: { map: 'moon', color: 0xb8a990 }, callisto: { map: 'moon', color: 0x8a7a68 },
  titan: { color: 0xd9a04a, gas: true }, enceladus: { color: 0xf2f6ff }, triton: { color: 0xe6d8d0 }, phobos: { map: 'moon', color: 0x8a7a6a }, deimos: { map: 'moon', color: 0x9a8a78 },
};
/** Colore delle etichette e delle orbite: quello del pianeta, così le lune si riconoscono come "famiglia". */
export const PLANET_TINT: Record<string, string> = { mars: '#ff8f6b', jupiter: '#ffcf8f', saturn: '#f3dc9a', uranus: '#9fe6ff', neptune: '#8fa6ff', pluto: '#d8c2a8' };

interface MoonObj { m: MoonEl; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; orbit: THREE.Line; orbitPts: V3[]; pos: V3; planetPos: V3 }
interface CraftObj { c: Craft; model: THREE.Group; track?: THREE.Line; pos: V3 | null }

export interface Pickable { ref: ObjRef; rel: V3; radiusPx: number; label: string; cls: string; dist: number }

export class SmallBodies {
  group = new THREE.Group();
  private moons: MoonObj[] = [];
  private craft: CraftObj[] = [];
  private sun = new THREE.DirectionalLight(0xffffff, 2.6);
  private sphere = bodySphere(48);
  visible: Pickable[] = [];
  private trackT = 0;

  constructor() {
    this.group.add(this.sun, this.sun.target, new THREE.AmbientLight(0x8090b0, 0.22));
  }

  /** Da chiamare quando le effemeridi sono caricate. */
  build() {
    if (this.moons.length || this.craft.length) return;
    for (const m of allMoons()) {
      const look = MOON_LOOK[m.id] ?? { map: 'moon' };
      const mat = planetMaterial({ type: look.gas ? PT.gas : PT.rocky, map: look.map, color: look.color ?? 0xbfbfbf, bump: look.gas ? 0 : 1.6, atm: look.gas ? 0xe0a050 : 0, atmK: look.gas ? 0.5 : 0 });
      mat.transparent = true;
      const mesh = new THREE.Mesh(this.sphere, mat);
      mesh.scale.setScalar(m.r);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      const n = 160;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 1) * 3), 3));
      // scia: luminosa vicino alla luna, sfuma lungo l'orbita percorsa
      const col = new Float32Array((n + 1) * 3);
      const tint = new THREE.Color(PLANET_TINT[m.planet] ?? '#9fb8ff');
      for (let k = 0; k <= n; k++) { const f = Math.pow(1 - k / n, 1.6) * 0.9 + 0.08; col[k * 3] = tint.r * f; col[k * 3 + 1] = tint.g * f; col[k * 3 + 2] = tint.b * f; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const orbit = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      orbit.frustumCulled = false;
      orbit.renderOrder = 2;
      this.group.add(mesh, orbit);
      this.moons.push({ m, mesh, mat, orbit, orbitPts: [], pos: [0, 0, 0], planetPos: [0, 0, 0] });
    }
    for (const c of CRAFT) {
      const model = buildModel(c.id);
      // se c'è il modello NASA, sostituisce quello procedurale appena è scaricato (centrato e in scala reale)
      const g = GLB[c.id];
      if (g) loadGlb(g.file).then((scene) => {
        const m = scene.clone(true);
        const box = new THREE.Box3().setFromObject(m);
        const size = box.getSize(new THREE.Vector3());
        const k = (g.sizeM / 1000) / Math.max(size.x, size.y, size.z);
        const c0 = box.getCenter(new THREE.Vector3());
        m.position.copy(c0).multiplyScalar(-k);
        m.scale.setScalar(k);
        m.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) { me.frustumCulled = false; const mt = me.material as THREE.MeshStandardMaterial; if (mt && 'metalness' in mt) mt.metalness = Math.min(mt.metalness, 0.6); } });
        model.clear();
        model.add(m);
      }).catch(() => { /* resta il modello procedurale */ });
      model.visible = false;
      this.group.add(model);
      const o: CraftObj = { c, model, pos: null };
      if (c.kind === 'leo') {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(93 * 3), 3));
        o.track = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0x8fd0ff, dashSize: 60, gapSize: 50, transparent: true, opacity: 0.55, depthWrite: false }));
        o.track.frustumCulled = false;
        this.group.add(o.track);
      }
      this.craft.push(o);
    }
  }

  /** Posizione attuale (eliocentrica, km) di una luna o di un veicolo, per il pilota automatico. */
  posOf(ref: ObjRef): V3 | null {
    if (ref.kind === 'moon') return this.moons.find((x) => x.m.id === ref.id)?.pos ?? null;
    const id = ref.kind === 'iss' ? 'iss' : ref.kind === 'craft' ? ref.id : '';
    return this.craft.find((x) => x.c.id === id)?.pos ?? null;
  }

  update(shipPos: V3, t: number, pixPerRad: number, view: THREE.Matrix4, target: ObjRef | null, dt: number) {
    this.visible = [];
    const date = new Date(t);
    // luce del Sole per i modelli dei veicoli
    this.sun.position.set(-shipPos[0], -shipPos[1], -shipPos[2]).normalize().multiplyScalar(1000);
    this.sun.target.position.set(0, 0, 0);
    const planetCache: Record<string, V3> = {};
    const planetPos = (id: string): V3 => {
      if (planetCache[id]) return planetCache[id];
      const b = bodyById(id);
      const h = b?.body ? A.HelioVector(b.body, date) : { x: 0, y: 0, z: 0 };
      return (planetCache[id] = [h.x * AU_IN_KM, h.y * AU_IN_KM, h.z * AU_IN_KM]);
    };
    for (const o of this.moons) {
      const P = planetPos(o.m.planet);
      o.planetPos = P;
      o.pos = v3.add(P, moonOffsetKm(o.m, t));
      const rel = v3.sub(o.pos, shipPos);
      const dist = v3.len(rel);
      const distPlanet = v3.len(v3.sub(P, shipPos));
      const isTarget = target?.kind === 'moon' && target.id === o.m.id;
      // il sistema di lune "si accende" avvicinandosi al pianeta
      const near = distPlanet < o.m.a * 60 || isTarget || (target?.kind === 'body' && target.id === o.m.planet && distPlanet < o.m.a * 400);
      const disc = Math.atan(o.m.r / Math.max(dist, o.m.r * 1.0001)) * pixPerRad;
      o.mesh.visible = near && disc > 0.8;
      o.mesh.position.set(rel[0], rel[1], rel[2]);
      o.mat.uniforms.uLight.value.set(-o.pos[0], -o.pos[1], -o.pos[2]).normalize().transformDirection(view);
      o.orbit.visible = near;
      if (near) {
        o.orbitPts = moonOrbitKm(o.m, t, 160);
        const arr = o.orbit.geometry.attributes.position.array as Float32Array;
        for (let k = 0; k < o.orbitPts.length; k++) {
          arr[k * 3] = P[0] + o.orbitPts[k][0] - shipPos[0];
          arr[k * 3 + 1] = P[1] + o.orbitPts[k][1] - shipPos[1];
          arr[k * 3 + 2] = P[2] + o.orbitPts[k][2] - shipPos[2];
        }
        o.orbit.geometry.attributes.position.needsUpdate = true;
        this.visible.push({ ref: { kind: 'moon', id: o.m.id }, rel, radiusPx: disc, label: o.m.name, cls: `pill moon m-${o.m.planet}`, dist });
      }
    }
    this.trackT -= dt;
    const refreshTrack = this.trackT <= 0;
    if (refreshTrack) this.trackT = 1;
    const earth = planetPos('earth');
    for (const o of this.craft) {
      o.pos = craftHelioKm(o.c.id, t);
      if (!o.pos) { o.model.visible = false; if (o.track) o.track.visible = false; continue; }
      const rel = v3.sub(o.pos, shipPos);
      const dist = v3.len(rel);
      const isTarget = (target?.kind === 'craft' && target.id === o.c.id) || (o.c.id === 'iss' && target?.kind === 'iss');
      const px = (o.c.sizeKm / Math.max(dist, 1e-6)) * pixPerRad;
      o.model.visible = px > 0.6;
      o.model.position.set(rel[0], rel[1], rel[2]);
      if (o.c.kind === 'leo') {
        // orientamento: pannelli verso il Sole, asse lungo la direzione del moto
        const g = v3.sub(o.pos, earth);
        o.model.lookAt(o.model.position.x - g[0], o.model.position.y - g[1], o.model.position.z - g[2]);
      } else if (o.c.id === 'tesla') {
        // la Roadster fluttua ruotando lentamente su se stessa, come nelle immagini di Starman
        o.model.rotation.set(0.35 + Math.sin(t / 47000) * 0.25, (t / 26000) % (Math.PI * 2), 0.18);
      } else o.model.lookAt(o.model.position.x - o.pos[0], o.model.position.y - o.pos[1], o.model.position.z - o.pos[2]);
      const nearEarth = v3.len(v3.sub(earth, shipPos)) < 3e5;
      const show = o.c.kind === 'leo' ? nearEarth || isTarget : dist < 0.6 * AU_IN_KM || isTarget;
      if (o.track) {
        o.track.visible = show;
        if (show && refreshTrack) {
          const pts = leoTrackKm(o.c.id, t, 46, 1);
          const arr = o.track.geometry.attributes.position.array as Float32Array;
          // i punti sono geocentrici: li memorizziamo e li spostiamo ogni fotogramma
          (o.track.userData as any).pts = pts;
          arr.fill(0);
        }
        const pts: V3[] | undefined = (o.track.userData as any).pts;
        if (show && pts) {
          const arr = o.track.geometry.attributes.position.array as Float32Array;
          for (let k = 0; k < pts.length && k < 93; k++) {
            arr[k * 3] = earth[0] + pts[k][0] - shipPos[0];
            arr[k * 3 + 1] = earth[1] + pts[k][1] - shipPos[1];
            arr[k * 3 + 2] = earth[2] + pts[k][2] - shipPos[2];
          }
          o.track.geometry.setDrawRange(0, Math.min(93, pts.length));
          o.track.geometry.attributes.position.needsUpdate = true;
          o.track.computeLineDistances();
        }
      }
      if (show) this.visible.push({ ref: o.c.id === 'iss' ? { kind: 'iss' } : { kind: 'craft', id: o.c.id }, rel, radiusPx: px, label: o.c.name, cls: 'pill craft', dist });
    }
  }
}

// ------------------------------------------------------------------ modelli procedurali (unità: km)
const M = 0.001; // metri → km
function mat(color: number, metal = 0.2, emissive = 0) {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: 0.55, emissive: emissive ? new THREE.Color(emissive) : undefined, emissiveIntensity: emissive ? 0.25 : 0 });
}
const box = (x: number, y: number, z: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(x * M, y * M, z * M), m);
const cyl = (r: number, l: number, m: THREE.Material, seg = 20) => { const g = new THREE.CylinderGeometry(r * M, r * M, l * M, seg); return new THREE.Mesh(g, m); };
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) { o.position.set(x * M, y * M, z * M); o.rotation.set(rx, ry, rz); return o; }

function solarWing(w: number, h: number) {
  const g = new THREE.Group();
  const panel = mat(0x23345f, 0.5, 0x0a1430);
  const frame = mat(0xc9a25a, 0.7);
  g.add(box(w, 0.3, h, panel), at(box(w, 0.5, 0.6, frame), 0, 0, h / 2), at(box(0.8, 0.6, h, frame), 0, 0, 0));
  return g;
}

export function buildModel(id: string): THREE.Group {
  const g = new THREE.Group();
  const white = mat(0xe6e8ee, 0.3), grey = mat(0x9aa0aa, 0.6), gold = mat(0xd9a84a, 0.85, 0x3a2400), dark = mat(0x2a2d35, 0.4);
  if (id === 'iss') {
    g.add(box(109, 5, 5, grey)); // traliccio principale
    for (const sx of [-1, 1]) for (const k of [0, 1]) for (const sy of [-1, 1]) {
      const w = at(solarWing(12, 34), sx * (40 + k * 14), 0, sy * 20);
      g.add(w);
    }
    for (const x of [-14, 0, 14]) g.add(at(box(11, 0.4, 22, white), x, -6, 0, 0, 0, 0)); // radiatori
    // moduli pressurizzati lungo l'asse perpendicolare
    g.add(at(cyl(2.2, 52, white), 0, 4, 0, Math.PI / 2, 0, 0));
    g.add(at(cyl(2.2, 14, white), 0, 4, -20, 0, 0, Math.PI / 2));
    g.add(at(cyl(2.2, 12, white), 9, 4, -22, Math.PI / 2, 0, 0));
    g.add(at(cyl(2.0, 13, white), -9, 4, -22, Math.PI / 2, 0, 0));
    g.add(at(cyl(2.1, 16, grey), 0, 4, 34, Math.PI / 2, 0, 0)); // segmento russo
    for (const sx of [-1, 1]) g.add(at(solarWing(4, 14), sx * 10, 4, 34));
  } else if (id === 'tiangong') {
    g.add(at(cyl(2.1, 17, white), 0, 0, 0, Math.PI / 2, 0, 0));
    g.add(at(cyl(2.1, 18, white), 0, 0, -10, 0, 0, Math.PI / 2));
    for (const sx of [-1, 1]) {
      g.add(at(solarWing(27, 4.5), sx * 23, 0, -10, 0, 0, 0));
      g.add(at(solarWing(4, 12), sx * 6, 0, 6));
    }
  } else if (id === 'hubble') {
    g.add(at(cyl(2.1, 13.2, mat(0xd8dce4, 0.85)), 0, 0, 0, Math.PI / 2, 0, 0));
    g.add(at(cyl(2.15, 0.4, dark), 0, 0, 6.8, Math.PI / 2, 0, 0));
    for (const sx of [-1, 1]) g.add(at(solarWing(2.5, 12), sx * 3.6, 0, -1, 0, 0, Math.PI / 2));
  } else if (id === 'jwst') {
    const mirror = new THREE.Mesh(new THREE.CircleGeometry(3.3 * M, 6), gold);
    mirror.material.side = THREE.DoubleSide;
    g.add(at(mirror, 0, 2.5, 0, -Math.PI / 2.4, 0, 0));
    const shield = new THREE.Mesh(new THREE.CircleGeometry(10.5 * M, 4), mat(0xb8a6d8, 0.6, 0x20163a));
    shield.scale.set(1, 0.68, 1);
    (shield.material as THREE.Material).side = THREE.DoubleSide;
    g.add(at(shield, 0, -1.5, 0, -Math.PI / 2, 0, 0));
  } else if (id === 'tesla') {
    // Tesla Roadster (2008) con Starman: profilo estruso e smussato, vernice lucida, vetri, ruote e manichino
    const paint = new THREE.MeshPhysicalMaterial({ color: 0xb3121c, metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c1118, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.55 });
    const tire = mat(0x15171c, 0.1), rim = mat(0xbfc4cc, 0.9);
    const prof = new THREE.Shape();
    // lato della carrozzeria (metri: lunghezza 3,95, altezza 1,13), muso a sinistra
    prof.moveTo(-1.97, 0.18); prof.lineTo(-1.97, 0.42); prof.quadraticCurveTo(-1.9, 0.62, -1.4, 0.68);
    prof.lineTo(-0.55, 0.74); prof.quadraticCurveTo(0.6, 0.86, 1.55, 0.78); prof.quadraticCurveTo(1.95, 0.72, 1.97, 0.5);
    prof.lineTo(1.97, 0.2); prof.lineTo(1.45, 0.18); prof.absarc(1.25, 0.18, 0.36, 0, Math.PI, false); prof.lineTo(-0.85, 0.18);
    prof.absarc(-1.25, 0.18, 0.36, 0, Math.PI, false); prof.lineTo(-1.97, 0.18);
    const body = new THREE.ExtrudeGeometry(prof, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4, curveSegments: 18 });
    body.translate(0, 0, -0.75);
    body.scale(M, M, M);
    g.add(new THREE.Mesh(body, paint));
    // abitacolo aperto, parabrezza e roll bar
    g.add(at(box(1.3, 0.25, 1.25, dark), -0.25, 0.82, 0));
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.25 * M, 0.42 * M), glass);
    ws.material.side = THREE.DoubleSide;
    g.add(at(ws, -0.92, 0.98, 0, 0, Math.PI / 2, -0.95));
    // ruote
    for (const x of [-1.25, 1.25]) for (const z of [-0.78, 0.78]) {
      g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.27 * M, 0.08 * M, 10, 24), tire), x, 0.2, z));
      g.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.22 * M, 18), rim), x, 0.2, z + Math.sign(z) * 0.06, 0, z > 0 ? 0 : Math.PI, 0));
    }
    // Starman: tuta bianca, casco con visiera scura, braccio sul volante
    const suit = mat(0xf2f2f2, 0.15), visor = new THREE.MeshPhysicalMaterial({ color: 0x0a0d14, metalness: 0.9, roughness: 0.1, clearcoat: 1 });
    g.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.2 * M, 0.42 * M, 6, 12), suit), -0.05, 1.12, 0.32, 0, 0, -0.25));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.16 * M, 18, 12), suit), -0.14, 1.52, 0.32));
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.115 * M, 16, 10, 0, Math.PI, 0, Math.PI), visor), -0.2, 1.53, 0.32, 0, -Math.PI / 2, 0));
    g.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * M, 0.42 * M, 4, 8), suit), -0.36, 1.05, 0.42, 0, 0, -1.05));
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.17 * M, 0.025 * M, 8, 20), dark), -0.62, 1.0, 0.32, 0, Math.PI / 2, 0.3));
  } else {
    // sonde: antenna parabolica e bracci
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.85 * M, 24, 8, 0, Math.PI * 2, 0, 0.5), white);
    (dish.material as THREE.Material).side = THREE.DoubleSide;
    g.add(at(dish, 0, 0.6, 0, Math.PI, 0, 0));
    g.add(at(box(1.8, 0.5, 1.8, gold), 0, 0, 0));
    g.add(at(box(13, 0.15, 0.15, grey), 6.5, 0, 0));
    g.add(at(box(0.15, 0.15, 3, grey), 0, 0, -2.4));
  }
  return g;
}
