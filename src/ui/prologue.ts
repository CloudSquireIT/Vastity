// Apertura cinematografica del primo avvio: si parte a due milioni di anni luce, si attraversa
// la Via Lattea, il Sistema Solare e la Terra, e si atterra esattamente sopra casa tua, sul cielo
// di questo momento. ~33 s, saltabile; rivedibile dalle impostazioni.
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
// [tempo s, log10 distanza dal punto inquadrato in km]. Il volo è una sola carrellata in avanti, come gli
// "zoom dell'universo": la camera guarda sempre dove sta andando e la distanza scorre senza strappi.
//   0-6 Gruppo Locale · 6-10.5 Via Lattea · 10.5-15 tuffo verso il Sole · 15-19 Sistema Solare ·
//   19-23.5 il Sole da vicino · 23.5-28.5 dal Sole alla Terra (passando di lato) · 28.5-33 discesa su casa
const KEYS: [number, number][] = [
  [0, 19.33], [6, 18.4], [10.5, 17.97], [15, 10.4], [19, 9.15], [23.5, 6.95], [26, 6.85], [29, 6.1], [33, Math.log10(R_EARTH + 260)],
];
const END = KEYS[KEYS.length - 1][0];

// interpolazione cubica monotona (PCHIP): la velocità varia con continuità, senza fermate brusche
const SLOPES = (() => {
  const n = KEYS.length, d: number[] = [], m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((KEYS[i + 1][1] - KEYS[i][1]) / (KEYS[i + 1][0] - KEYS[i][0]));
  m[0] = d[0] * 0.5; m[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (d[i - 1] + d[i])) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i]);
  return m;
})();
function logDist(t: number) {
  if (t <= 0) return KEYS[0][1];
  for (let i = 1; i < KEYS.length; i++) {
    const [t1, d1] = KEYS[i];
    const [t0, d0] = KEYS[i - 1];
    if (t <= t1) {
      const h = t1 - t0, u = (t - t0) / h;
      const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
      return h00 * d0 + h10 * h * SLOPES[i - 1] + h01 * d1 + h11 * h * SLOPES[i];
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
    { at: 6.4, k: tx('Duecento miliardi di stelle. Una è la nostra.', 'Two hundred billion stars. One of them is ours.', 'Deux cents milliards d\'étoiles. L\'une d\'elles est la nôtre.'), n: tx('La Via Lattea', 'The Milky Way', 'La Voie lactée') },
    { at: 15.2, k: tx('Otto pianeti attorno a una stella', 'Eight planets around one star', 'Huit planètes autour d\'une étoile'), n: tx('Il Sistema Solare', 'The Solar System', 'Le Système solaire') },
    { at: 19.6, k: tx('Ogni secondo trasforma 4 milioni di tonnellate di materia in luce', 'Every second it turns 4 million tonnes of matter into light', 'Chaque seconde, il transforme 4 millions de tonnes de matière en lumière'), n: tx('Il Sole', 'The Sun', 'Le Soleil') },
    { at: 27.6, k: tx('Un puntino azzurro, il nostro', 'A pale blue dot, our own', 'Un point bleu pâle, le nôtre'), n: tx('La Terra', 'Earth', 'La Terre') },
    { at: 31.2, k: place ? `${place} · ${tx('adesso', 'right now', 'maintenant')}` : tx('adesso', 'right now', 'maintenant'), n: tx('Ecco il tuo cielo', 'This is your sky', 'Voici votre ciel') },
  ];

  // geometria: tutto in km eliocentrici EQJ
  const gc = v3.scale(GALACTIC_CENTER_PC as V3, PC_IN_KM);
  const ngp = radecToVec(192.85948, 27.12825);
  const m31 = v3.norm((refPosPc({ kind: 'deep', id: 'm31g' }) as V3) ?? [0.5, 0.2, 0.8]);
  const gcDir = v3.norm(gc);
  const dGal = v3.norm(v3.add(ngp, v3.scale(gcDir, -0.45)));            // galassia vista di tre quarti
  // Gruppo Locale: si parte di lato rispetto all'asse Via Lattea–Andromeda, così si vedono entrambe con
  // Triangolo, Nubi di Magellano e le nane attorno; si guarda il baricentro, poi la Via Lattea
  const m31Km = v3.scale((refPosPc({ kind: 'deep', id: 'm31g' }) as V3) ?? v3.scale(m31, 778000), PC_IN_KM);
  const dLG = v3.norm(v3.sub(dGal, v3.scale(m31, v3.dot(dGal, m31) + 0.25)));
  const lgMid = v3.scale(m31Km, 0.42);
  // Via Lattea e Andromeda affiancate in orizzontale
  const upLG = v3.norm(v3.cross(dLG, m31));
  const earth = () => ship.bodyPosKm('earth');
  // vista del Sistema Solare: di tre quarti sopra l'eclittica, con la Terra oltre il Sole ma di lato,
  // così il viaggio Sole → Terra scorre accanto al Sole invece di attraversarlo
  const nEcl: V3 = [0, -0.3978, 0.9175];
  const eDir = v3.norm(earth());
  const side = v3.norm(v3.cross(nEcl, eDir));
  const dSS = v3.norm(v3.add(v3.add(v3.scale(eDir, -0.5), v3.scale(nEcl, 0.55)), v3.scale(side, 0.67)));
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
  let lookDir: V3 | null = null;
  let camUp: V3 | null = null;

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
    ship.setLocalBoost(0);
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
      const E = earth();
      ship.setLocalBoost(1 - sm(4.5, 8.5, t));
      const up = zenith();
      // punto inquadrato: il Sole (a queste scale coincide con casa), poi si scivola verso la Terra
      const focus = mix([0, 0, 0], E, sm(24, 29, t));
      // direzione da cui si guarda: Andromeda alle spalle → galassia di tre quarti (poi dritti nel tuffo)
      // → Sistema Solare di tre quarti → zenit di casa. Cambia solo quando si è lontani dal soggetto.
      let dir = v3.norm(mix(dLG, dGal, sm(3.5, 10.5, t)));
      dir = v3.norm(mix(dir, dSS, sm(14.6, 19.5, t)));
      dir = v3.norm(mix(dir, up, sm(27, 31.5, t)));
      const pos = v3.add(focus, v3.scale(dir, D));
      // negli ultimi istanti lo sguardo scivola dal pianeta verso l'orizzonte
      const horizonK = sm(4.6, 3.83, ld) * 0.55;
      let north: V3 = v3.sub([0, 0, 1], v3.scale(up, v3.dot([0, 0, 1], up)));
      if (v3.len(north) < 1e-3) north = [1, 0, 0];
      north = v3.norm(north);
      // sguardo: centro galattico da lontano, poi il Sole (quando la differenza è di pochi gradi), poi la Terra
      let lookAtP = mix(lgMid, gc, sm(2.5, 7.5, t));
      lookAtP = mix(lookAtP, [0, 0, 0], sm(6.8, 10.2, t));
      lookAtP = mix(lookAtP, E, sm(24.2, 27.6, t));
      const lookTarget = v3.norm(v3.add(v3.scale(v3.norm(v3.sub(lookAtP, pos)), 1 - horizonK), v3.scale(north, horizonK)));
      // sguardo e "alto" della camera inseguono il bersaglio con dolcezza: niente scatti né ribaltamenti
      const kk = 1 - Math.exp(-Math.min(dt, 0.05) * 3.2);
      lookDir = lookDir ? v3.norm(mix(lookDir, lookTarget, kk)) : lookTarget;
      // "alto": nord celeste nello spazio profondo, nord dell'eclittica nel Sistema Solare, nord di casa alla fine
      let upGoal: V3 = v3.norm(mix(upLG, [0, 0, 1], sm(4, 10, t)));
      upGoal = v3.norm(mix(upGoal, nEcl, sm(13, 18, t)));
      upGoal = v3.norm(mix(upGoal, north, sm(28.5, 32, t)));
      let u0: V3 = camUp ?? upGoal;
      u0 = v3.norm(mix(u0, upGoal, kk * 0.6));
      const ortho = v3.sub(u0, v3.scale(lookDir, v3.dot(u0, lookDir)));
      if (v3.len(ortho) > 1e-4) camUp = v3.norm(ortho);
      ship.placeAt(pos, v3.add(pos, v3.scale(lookDir, Math.max(D, 1000))), camUp ?? upGoal);
      // suono del viaggio: l'aria sale quando si attraversano molti ordini di grandezza
      const speedDec = Math.abs(logDist(t + 0.1) - ld) * 10;
      feel.setWarp(Math.min(1, speedDec / 2.5));
      if (t >= END) finish(false);
    },
  };
}
