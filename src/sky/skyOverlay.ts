// Disegni sopra il cielo (SVG): eclittica tratteggiata, lune attorno ai pianeti con la loro orbita
// e la scia che sfuma quando si ingrandisce, satelliti in orbita terrestre col percorso dei prossimi minuti.
import * as A from 'astronomy-engine';
import { V3, v3, bodyById } from '../astro/astro';
import { AU_IN_KM, PC_IN_KM } from '../data/catalog';
import { CRAFT, allMoons, leoTrackKm, moonOffsetKm, moonOrbitKm } from '../data/ephem';
import { PLANET_TINT } from '../space/smallBodies';
import { state } from '../state';
import type { ObjRef } from '../features/objects';

const NS = 'http://www.w3.org/2000/svg';
const OBL = 23.4392911 * (Math.PI / 180);

type Proj = (dir: V3) => { x: number; y: number; front: boolean; alt: number };
export interface OverlayHit { ref: ObjRef; x: number; y: number }

export class SkyOverlay {
  svg: SVGSVGElement;
  private ecl: SVGPathElement;
  private layer: SVGGElement;
  hits: OverlayHit[] = [];
  private ecliptic: V3[] = [];
  private trackCache: Record<string, { t: number; pts: V3[] }> = {};
  onPick: ((r: ObjRef) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'sky-overlay');
    this.ecl = document.createElementNS(NS, 'path');
    this.ecl.setAttribute('class', 'ecliptic');
    this.layer = document.createElementNS(NS, 'g');
    this.svg.append(this.ecl, this.layer);
    parent.prepend(this.svg);
    for (let k = 0; k <= 240; k++) {
      const l = (k / 240) * Math.PI * 2;
      this.ecliptic.push([Math.cos(l), Math.sin(l) * Math.cos(OBL), Math.sin(l) * Math.sin(OBL)]);
    }
  }

  private path(pts: { x: number; y: number; ok: boolean }[], w: number, h: number) {
    let d = '', pen = false, prev: { x: number; y: number } | null = null;
    for (const p of pts) {
      const inside = p.ok && p.x > -w && p.x < 2 * w && p.y > -h && p.y < 2 * h;
      // salto troppo grande (proiezione che passa dietro la camera): si alza la penna
      if (!inside || (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > w)) { pen = false; prev = inside ? p : null; if (!inside) continue; }
      d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      pen = true; prev = p;
    }
    return d;
  }

  update(o: { proj: Proj; w: number; h: number; fov: number; observerPc: V3; showGround: boolean; earth: boolean; selected: ObjRef | null }) {
    const { proj, w, h } = o;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.hits = [];
    const above = (alt: number) => !o.showGround || alt > -0.5;
    // eclittica: il percorso del Sole e, all'incirca, dei pianeti
    const showEcl = state.settings.ecliptic !== false;
    this.ecl.style.display = showEcl ? '' : 'none';
    if (showEcl) this.ecl.setAttribute('d', this.path(this.ecliptic.map((d) => { const p = proj(d); return { x: p.x, y: p.y, ok: p.front && above(p.alt) }; }), w, h));

    const frag: SVGElement[] = [];
    const obsKm = v3.scale(o.observerPc, PC_IN_KM);
    const t = state.time;
    const date = new Date(t);
    const pxPerRad = h / (2 * Math.tan((o.fov * Math.PI) / 360));
    // lune: compaiono quando l'orbita sullo schermo è abbastanza grande, vicino al loro pianeta
    const planetCache: Record<string, V3> = {};
    for (const m of allMoons()) {
      const b = bodyById(m.planet);
      if (!b?.body) continue;
      const P = planetCache[m.planet] ??= (() => { const v = A.HelioVector(b.body!, date); return [v.x * AU_IN_KM, v.y * AU_IN_KM, v.z * AU_IN_KM] as V3; })();
      const rel = v3.sub(P, obsKm);
      const dist = v3.len(rel);
      const orbitPx = (m.a / dist) * pxPerRad;
      const sel = o.selected && ((o.selected.kind === 'moon' && o.selected.id === m.id) || (o.selected.kind === 'body' && o.selected.id === m.planet));
      if (orbitPx < (sel ? 5 : 9)) continue;
      const pc = proj(v3.norm(rel));
      if (!pc.front || !above(pc.alt) || pc.x < -orbitPx || pc.x > w + orbitPx || pc.y < -orbitPx || pc.y > h + orbitPx) continue;
      const tint = PLANET_TINT[m.planet] ?? '#9fb8ff';
      const pts = moonOrbitKm(m, t, 96).map((q) => { const p = proj(v3.norm(v3.add(rel, q))); return { x: p.x, y: p.y, ok: p.front }; });
      // scia: tratti con opacità che cala allontanandosi dalla luna
      for (let k = 0; k < 4; k++) {
        const seg = pts.slice(k * 24, k * 24 + 25);
        const e = document.createElementNS(NS, 'path');
        e.setAttribute('d', this.path(seg, w, h));
        e.setAttribute('class', 'moon-orbit');
        e.setAttribute('stroke', tint);
        e.setAttribute('stroke-opacity', String(0.75 - k * 0.17));
        frag.push(e);
      }
      const mp = proj(v3.norm(v3.add(rel, moonOffsetKm(m, t))));
      if (!mp.front) continue;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'moon-pt');
      g.setAttribute('transform', `translate(${mp.x.toFixed(1)} ${mp.y.toFixed(1)})`);
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', String(Math.max(1.6, Math.min(5, (m.r / dist) * pxPerRad))));
      const label = document.createElementNS(NS, 'text');
      label.setAttribute('y', '-8');
      label.setAttribute('fill', tint);
      label.textContent = m.name;
      const hit = document.createElementNS(NS, 'circle');
      hit.setAttribute('r', '16');
      hit.setAttribute('class', 'hit');
      g.append(hit, dot, label);
      g.addEventListener('click', (ev) => { ev.stopPropagation(); this.onPick?.({ kind: 'moon', id: m.id }); });
      frag.push(g);
      this.hits.push({ ref: { kind: 'moon', id: m.id }, x: mp.x, y: mp.y });
    }
    // satelliti in orbita terrestre: punto, nome e percorso dei prossimi minuti (solo dalla Terra)
    if (o.earth) {
      const e = A.HelioVector(A.Body.Earth, date);
      const E: V3 = [e.x * AU_IN_KM, e.y * AU_IN_KM, e.z * AU_IN_KM];
      for (const c of CRAFT) {
        if (c.kind !== 'leo') continue;
        const cache = this.trackCache[c.id];
        if (!cache || Math.abs(cache.t - t) > 20000) this.trackCache[c.id] = { t, pts: leoTrackKm(c.id, t, 12, 0.25) };
        const pts = this.trackCache[c.id].pts;
        if (!pts.length) continue;
        const mid = pts[Math.floor(pts.length / 2)];
        const sp = proj(v3.norm(v3.sub(v3.add(E, mid), obsKm)));
        if (!above(sp.alt) && !(o.selected?.kind === 'craft' && o.selected.id === c.id)) continue;
        const pp = pts.map((q) => { const p = proj(v3.norm(v3.sub(v3.add(E, q), obsKm))); return { x: p.x, y: p.y, ok: p.front && above(p.alt) }; });
        const tr = document.createElementNS(NS, 'path');
        tr.setAttribute('d', this.path(pp, w, h));
        tr.setAttribute('class', 'sat-track');
        frag.push(tr);
        if (!sp.front || sp.x < 0 || sp.x > w || sp.y < 0 || sp.y > h) continue;
        if (c.id === 'iss') { this.hits.push({ ref: { kind: 'iss' }, x: sp.x, y: sp.y }); continue; } // la ISS ha già il suo punto
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'sat-pt');
        g.setAttribute('transform', `translate(${sp.x.toFixed(1)} ${sp.y.toFixed(1)})`);
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('r', '2.2');
        const label = document.createElementNS(NS, 'text');
        label.setAttribute('y', '-8');
        label.textContent = c.name;
        const hit = document.createElementNS(NS, 'circle');
        hit.setAttribute('r', '16');
        hit.setAttribute('class', 'hit');
        g.append(hit, dot, label);
        g.addEventListener('click', (ev) => { ev.stopPropagation(); this.onPick?.({ kind: 'craft', id: c.id }); });
        frag.push(g);
        this.hits.push({ ref: { kind: 'craft', id: c.id }, x: sp.x, y: sp.y });
      }
    }
    this.layer.replaceChildren(...frag);
  }

  clear() { this.layer.replaceChildren(); this.ecl.setAttribute('d', ''); this.hits = []; }
}
