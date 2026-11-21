// Sistema esoplanetario attivo: quando la navicella è vicina a una stella con pianeti confermati,
// i suoi pianeti appaiono in 3D sulle loro orbite (render generato dai dati reali).
import * as THREE from 'three';
import { BodySprite } from '../render/bodies';
import { PT, bodySphere, coronaMesh, planetMaterial, tempColor } from '../render/planet';
import { ExoClass, exoHosts, exoPosPc, exoTexture, exoplanets, hostPosPc } from '../data/exoplanets';
import { PC_IN_KM, stars } from '../data/catalog';
import { V3, v3 } from '../astro/astro';

const EMIT: Partial<Record<ExoClass, [number, number, number]>> = {
  lava: [1.4, 0.55, 0.2], hotjupiter: [0.7, 0.22, 0.1], hotneptune: [0.15, 0.06, 0.03],
};
const ACTIVE_PC = 0.06; // ~12 000 UA: il sistema si "accende" entrando nella sua regione

export interface ExoVisible { index: number; rel: V3; radiusKm: number; discPx: number }
type SetSprite = (sp: BodySprite, rel: V3, discPx: number, glowPx: number, glow: number, color: THREE.Color, star: boolean, pixPerRad: number) => void;

export class ExoSystemView {
  group = new THREE.Group();
  activeHost = -1;
  visible: ExoVisible[] = [];
  private planets: { index: number; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; sprite: BodySprite; color: THREE.Color }[] = [];
  private star: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; sprite: BodySprite; color: THREE.Color; corona: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial } } | null = null;
  private scanT = 0;
  private sphere = bodySphere(160);
  private tv = new THREE.Vector3();

  /** Il pianeta più vicino a una stella con esopianeti entro la distanza indicata (pc). */
  forceScan() { this.scanT = 0; }

  static nearestHost(posPc: V3, maxPc: number) {
    let best = -1, bd = maxPc;
    for (let h = 0; h < exoHosts.length; h++) {
      const p = hostPosPc(exoHosts[h]);
      const d = Math.hypot(p[0] - posPc[0], p[1] - posPc[1], p[2] - posPc[2]);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }

  update(posKm: V3, timeMs: number, time: number, dt: number, pixPerRad: number, dpr: number, view: THREE.Matrix4, setSprite: SetSprite) {
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.5;
      const h = ExoSystemView.nearestHost(v3.scale(posKm, 1 / PC_IN_KM), ACTIVE_PC);
      if (h !== this.activeHost) this.activate(h);
    }
    this.visible = [];
    if (this.activeHost < 0) return;
    const host = exoHosts[this.activeHost];
    const hostKm = v3.scale(hostPosPc(host), PC_IN_KM);
    // stella ospite (se non è già nel catalogo stellare)
    if (this.star) {
      const rel = v3.sub(hostKm, posKm);
      const dist = v3.len(rel);
      const R = this.star.mesh.scale.x;
      const disc = Math.atan(R / Math.max(dist, R * 1.0001)) * pixPerRad;
      this.star.mesh.position.set(rel[0], rel[1], rel[2]);
      this.star.mesh.visible = disc > 1.2;
      this.star.mat.uniforms.uTime.value = time;
      const co = this.star.corona;
      co.mesh.visible = disc > 5;
      co.mesh.position.copy(this.star.mesh.position);
      co.mesh.scale.setScalar(R);
      co.mat.uniforms.uTime.value = time;
      setSprite(this.star.sprite, rel, 0, Math.max(disc * 1.7 + 18 * dpr, 22 * dpr), 0.9 * Math.max(0, 1 - disc / 45), this.star.color, true, pixPerRad);
      this.star.sprite.mesh.renderOrder = 5;
    }
    for (const p of this.planets) {
      const e = exoplanets[p.index];
      const pos = v3.scale(exoPosPc(p.index, timeMs), PC_IN_KM);
      const rel = v3.sub(pos, posKm);
      const dist = v3.len(rel);
      const R = p.mesh.scale.x;
      const disc = Math.atan(R / Math.max(dist, R * 1.0001)) * pixPerRad;
      p.mesh.position.set(rel[0], rel[1], rel[2]);
      p.mesh.visible = disc > 1.2;
      p.mesh.rotation.z = time * (e.radiusEarth > 2 ? 0.05 : 0.02);
      const toStar = this.tv.set(hostKm[0] - pos[0], hostKm[1] - pos[1], hostKm[2] - pos[2]).normalize();
      p.mat.uniforms.uLight.value.copy(toStar).transformDirection(view);
      p.mat.uniforms.uTime.value = time;
      if (disc <= 2.5) {
        setSprite(p.sprite, rel, 0, 3.2 * dpr, 0.9, p.color, false, pixPerRad);
        p.sprite.mesh.renderOrder = 4;
      } else p.sprite.mesh.visible = false;
      this.visible.push({ index: p.index, rel, radiusKm: R, discPx: disc });
    }
  }

  private activate(h: number) {
    for (const p of this.planets) { this.group.remove(p.mesh, p.sprite.mesh); p.mat.dispose(); }
    this.planets = [];
    if (this.star) { this.group.remove(this.star.mesh, this.star.sprite.mesh, this.star.corona.mesh); this.star.mat.dispose(); this.star.corona.mat.dispose(); this.star = null; }
    this.activeHost = h;
    if (h < 0) return;
    const host = exoHosts[h];
    // la stella c'è già nel catalogo? (allora la disegna il renderer delle stelle vicine)
    const hp = hostPosPc(host);
    let inCatalog = false;
    for (let i = 0; i < stars.count && !inCatalog; i++) {
      const dx = stars.pos[i * 3] - hp[0], dy = stars.pos[i * 3 + 1] - hp[1], dz = stars.pos[i * 3 + 2] - hp[2];
      if (dx * dx + dy * dy + dz * dz < 4e-6 * Math.max(1, host.distPc / 50) ** 2) inCatalog = true;
    }
    if (!inCatalog) {
      const color = tempColor(host.teff);
      const mat = planetMaterial({ type: PT.star, map: 'sun', color: color.getHex(), bright: 1.0 });
      mat.transparent = true;
      const mesh = new THREE.Mesh(this.sphere, mat);
      mesh.scale.setScalar(Math.max(0.08, host.radiusSun) * 696340);
      mesh.renderOrder = 3;
      mesh.frustumCulled = false;
      const sprite = new BodySprite(h);
      const corona = coronaMesh(color, 1.7, 0.85);
      this.group.add(mesh, sprite.mesh, corona.mesh);
      this.star = { mesh, mat, sprite, color, corona };
    }
    for (const i of host.planets.slice(0, 12)) {
      const e = exoplanets[i];
      const gas = /jupiter|neptune/.test(e.cls);
      const mat = planetMaterial({ type: gas ? PT.gas : PT.rocky, bump: gas ? 0 : 1.2, atm: gas ? 0xbfd4ff : e.cls === 'temperate' || e.cls === 'ocean' ? 0x7fb0ff : 0, atmK: gas ? 0.2 : e.cls === 'temperate' || e.cls === 'ocean' ? 0.5 : 0 });
      mat.uniforms.uMap.value = exoTexture(i);
      mat.uniforms.uHasMap.value = 1;
      const em = EMIT[e.cls];
      if (em) mat.uniforms.uEmit.value.setRGB(...em);
      mat.transparent = true;
      const mesh = new THREE.Mesh(this.sphere, mat);
      mesh.scale.setScalar(e.radiusEarth * 6371);
      mesh.renderOrder = 3;
      mesh.frustumCulled = false;
      const sprite = new BodySprite(i);
      const c = (mat.uniforms.uMap.value as THREE.CanvasTexture).image as HTMLCanvasElement;
      const px = c.getContext('2d')!.getImageData(256, 128, 1, 1).data;
      const color = new THREE.Color(px[0] / 255, px[1] / 255, px[2] / 255);
      this.group.add(mesh, sprite.mesh);
      this.planets.push({ index: i, mesh, mat, sprite, color });
    }
  }
}
