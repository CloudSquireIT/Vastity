// Apertura cinematografica del primo avvio: si parte a due milioni di anni luce, si attraversa
// la Via Lattea, il Sistema Solare e la Terra, e si atterra esattamente sopra casa tua, sul cielo
// di questo momento. ~24 s, saltabile; rivedibile dalle impostazioni.
import { h } from './dom';
import { tx } from '../i18n';
import { V3, v3 } from '../astro/astro';
import { PC_IN_KM, radecToVec } from '../data/catalog';
import { GALACTIC_CENTER_PC } from '../render/background';
import { refDirection, refPosPc } from '../features/objects';
import type { ShipView } from '../space/ShipView';
import type { SkyView } from '../sky/SkyView';
import { feel, reducedMotion } from '../core/feel';
import { state } from '../state';

const R_EARTH = 6371;
// [tempo s, log10 distanza dalla Terra in km]: ogni chiave è una "stazione" dove il volo rallenta
const KEYS: [number, number][] = [
  [0, 19.3], [6, 18.25], [10.5, 16.9], [14.5, 10.7], [19, 5.3], [23.5, Math.log10(R_EARTH + 260)],
];
const END = KEYS[KEYS.length - 1][0];

function logDist(t: number) {
  if (t <= 0) return KEYS[0][1];
  for (let i = 1; i < KEYS.length; i++) {
    const [t1, d1] = KEYS[i];
    const [t0, d0] = KEYS[i - 1];
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0);
      return d0 + (d1 - d0) * u * u * (3 - 2 * u);
    }
  }
  return KEYS[KEYS.length - 1][1];
}
const sm = (a: number, b: number, x: number) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const mix = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

interface Caption { at: number; k: string; n: string }

export interface Prologue { tick(dt: number): void; skip(): void; seek(t: number): void; readonly running: boolean }

/** Avvia l'apertura. `toShip`/`toSky` cambiano modalità all'istante; `done` viene chiamato alla fine. */
export function startPrologue(o: {
  root: HTMLElement; ship: ShipView; sky: SkyView; toShip: () => void; toSky: () => void; done: () => void;
}): Prologue {
  const { ship, sky } = o;
  const place = state.location.name;
  const caps: Caption[] = [
    { at: 0.6, k: tx('Due milioni di anni luce da casa', 'Two million light years from home', 'À deux millions d\'années-lumière de chez vous'), n: tx('Il Gruppo Locale', 'The Local Group', 'Le Groupe local') },
    { at: 5.4, k: tx('Duecento miliardi di stelle. Una è la nostra.', 'Two hundred billion stars. One of them is ours.', 'Deux cents milliards d\'étoiles. L\'une d\'elles est la nôtre.'), n: tx('La Via Lattea', 'The Milky Way', 'La Voie lactée') },
    { at: 13.6, k: tx('Otto pianeti attorno a una stella', 'Eight planets around one star', 'Huit planètes autour d\'une étoile'), n: tx('Il Sistema Solare', 'The Solar System', 'Le Système solaire') },
    { at: 18.2, k: tx('Un puntino azzurro, il nostro', 'A pale blue dot, our own', 'Un point bleu pâle, le nôtre'), n: tx('La Terra', 'Earth', 'La Terre') },
    { at: 22.4, k: place ? `${place} · ${tx('adesso', 'right now', 'maintenant')}` : tx('adesso', 'right now', 'maintenant'), n: tx('Ecco il tuo cielo', 'This is your sky', 'Voici votre ciel') },
  ];

  // geometria: tutto in km eliocentrici EQJ
  const gc = v3.scale(GALACTIC_CENTER_PC as V3, PC_IN_KM);
  const ngp = radecToVec(192.85948, 27.12825);
  const m31 = v3.norm((refPosPc({ kind: 'deep', id: 'm31g' }) as V3) ?? [0.5, 0.2, 0.8]);
  const gcDir = v3.norm(gc);
  const dFar = v3.norm(v3.add(v3.scale(m31, -1), v3.scale(ngp, 0.55))); // Andromeda dietro la Via Lattea
  const dGal = v3.norm(v3.add(ngp, v3.scale(gcDir, -0.45)));            // galassia vista di tre quarti
  const earth = () => ship.bodyPosKm('earth');
  const zenith = (): V3 => (sky.place.id === 'earth' && sky.frame?.rows ? (sky.frame.rows[1] as V3) : ngp);

  let t = 0;
  let running = true;
  let finished = false;
  const layer = h('div', { class: 'prologue' });
  const capEl = h('div', { class: 'pro-cap' });
  const skipBtn = h('button', { class: 'pro-skip', onclick: (e: Event) => { e.stopPropagation(); skip(); } }, tx('Salta', 'Skip', 'Passer'), ' ›');
  const bar = h('div', { class: 'pro-bar' }, h('i', {}));
  layer.append(capEl, bar, skipBtn);
  // blocca i gesti sulla scena (la navicella non deve girare durante l'apertura)
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart']) layer.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  o.root.appendChild(layer);
  document.body.classList.add('prologue-on');
  o.toShip();
  let shown = -1;

  function showCaption(i: number) {
    shown = i;
    capEl.classList.remove('in');
    void capEl.offsetWidth;
    capEl.replaceChildren(h('div', { class: 'pro-n' }, caps[i].n), h('div', { class: 'pro-k' }, caps[i].k));
    capEl.classList.add('in');
  }

  function finish(fast: boolean) {
    if (finished) return;
    finished = true;
    running = false;
    feel.setWarp(0);
    const land = () => {
      o.toSky();
      // atterraggio guardando qualcosa di bello: la Luna se è alta, altrimenti verso sud a mezza altezza
      sky.setView(180, 38, 75);
      const moon = sky.frame ? refDirection({ kind: 'body', id: 'moon' }, sky.frame) : null;
      if (moon && v3.dot(moon, sky.frame.rows[1] as V3) > 0.17) sky.lookAtEqj(moon, false);
      sky.landIn();
      layer.classList.add('out');
      document.body.classList.remove('prologue-on');
      setTimeout(() => layer.remove(), 900);
      o.done();
    };
    if (fast || reducedMotion()) { land(); return; }
    // ingresso in atmosfera: velo azzurro, poi il cielo
    layer.classList.add('entry');
    feel.entry();
    setTimeout(land, 650);
  }

  function skip() { finish(true); }

  return {
    get running() { return running; },
    skip,
    seek(x: number) { t = x; shown = -1; },
    tick(dt: number) {
      if (!running) return;
      t += Math.min(dt, 0.05);
      const next = caps.findIndex((c, i) => i > shown && t >= c.at);
      if (next >= 0) showCaption(caps.reduce((m, c, i) => (t >= c.at ? i : m), next));
      if (t >= caps[shown]?.at + 3.4 && shown < caps.length - 1) capEl.classList.remove('in');
      (bar.firstChild as HTMLElement).style.transform = `scaleX(${Math.min(1, t / END)})`;
      const ld = logDist(t);
      const D = Math.pow(10, ld);
      // punto guardato: centro galattico da lontano, poi la Terra
      const E = earth();
      const focus = mix(E, gc, sm(16.9, 18.0, ld));
      // direzione da cui si guarda: Andromeda alle spalle → galassia di tre quarti → zenit di casa
      const up = zenith();
      let dir = v3.norm(mix(dFar, dGal, sm(19.2, 18.4, ld)));
      dir = v3.norm(mix(dir, up, sm(17.6, 11.5, ld)));
      const pos = v3.add(focus, v3.scale(dir, D));
      // negli ultimi istanti lo sguardo scivola dal pianeta verso l'orizzonte
      const horizonK = sm(4.6, 3.83, ld) * 0.55;
      let north: V3 = v3.sub([0, 0, 1], v3.scale(up, v3.dot([0, 0, 1], up)));
      if (v3.len(north) < 1e-3) north = [1, 0, 0];
      north = v3.norm(north);
      // lo sguardo lascia il centro galattico più lentamente della posizione: la galassia resta in vista
      const lookFocus = mix(E, gc, sm(15.2, 18.0, ld));
      const lookPt = v3.add(pos, v3.scale(v3.norm(v3.add(v3.scale(v3.norm(v3.sub(lookFocus, pos)), 1 - horizonK), v3.scale(north, horizonK))), Math.max(D, 1000)));
      const camUp = v3.norm(mix(north, [0, 0, 1], sm(17, 18.5, ld)));
      ship.placeAt(pos, lookPt, Math.abs(v3.dot(camUp, v3.norm(v3.sub(lookPt, pos)))) > 0.98 ? [1, 0, 0] : camUp);
      // suono del viaggio: l'aria sale quando si attraversano molti ordini di grandezza
      const speedDec = Math.abs(logDist(t + 0.1) - ld) * 10;
      feel.setWarp(Math.min(1, speedDec / 2.5));
      if (t >= END) finish(false);
    },
  };
}
