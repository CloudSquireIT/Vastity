// Animazioni dell'interfaccia: badge sbloccato, onda al tocco, stelle cadenti, icone vive,
// passaggio tra mondi. Rispettano "Riduci movimento".
import { h } from './dom';
import { reducedMotion, feel } from '../core/feel';
import { tx } from '../i18n';
import type { Badge } from '../features/missions';

let layer: HTMLElement;
export function initFx(root: HTMLElement) {
  layer = h('div', { class: 'fx-layer' });
  root.appendChild(layer);
}

// ---------------------------------------------------------------- 6. badge sbloccato
export function badgeUnlocked(b: Badge, secret = false) {
  // scheda compatta su vetro: si legge su qualsiasi sfondo (cielo chiaro, pianeti, galassie)
  const coin = h('div', { class: 'bp-coin' }, h('span', {}, b.icon));
  const card = h('div', { class: 'badge-pop glass-pop' + (secret ? ' secret' : ''), role: 'status' },
    h('div', { class: 'bp-c' }, h('div', { class: 'bp-ring' }), coin),
    h('div', { class: 'bp-t' },
      h('div', { class: 'bp-k' }, secret ? tx('Achievement segreto', 'Secret achievement', 'Succès secret') : tx('Nuovo badge', 'New badge', 'Nouveau badge')),
      h('div', { class: 'bp-n' }, b.name),
      h('div', { class: 'bp-d' }, b.desc)));
  // scintille dorate che esplodono dalla moneta
  if (!reducedMotion()) for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const d = 30 + Math.random() * 26;
    coin.parentElement!.appendChild(h('i', { class: 'bp-spark', style: { '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`, animationDelay: `${0.3 + Math.random() * 0.15}s` } }));
  }
  layer.appendChild(card);
  feel.success();
  setTimeout(() => card.classList.add('out'), 3600);
  setTimeout(() => card.remove(), 4200);
}

// ---------------------------------------------------------------- 7. onda al tocco
let lastDown = { x: 0, y: 0, t: 0 };
export function trackPointer() {
  window.addEventListener('pointerdown', (e) => { lastDown = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { capture: true, passive: true });
}
/** Onda concentrica dove l'utente ha appena toccato (se il tocco è recente). */
export function rippleAtLastTap() {
  if (performance.now() - lastDown.t > 600 || reducedMotion()) return;
  const r = h('div', { class: 'tap-ripple', style: { left: `${lastDown.x}px`, top: `${lastDown.y}px` } });
  layer.appendChild(r);
  setTimeout(() => r.remove(), 900);
}

// ---------------------------------------------------------------- 10. stelle cadenti
let shootTimer = 0;
/** Programma stelle cadenti casuali (solo di notte, nel cielo). `canShow` decide se mostrarle. */
export function startShootingStars(canShow: () => boolean, onCaught: () => void) {
  const schedule = () => { shootTimer = window.setTimeout(fire, 18000 + Math.random() * 40000); };
  const fire = () => {
    if (canShow() && !reducedMotion() && document.visibilityState === 'visible') {
      const W = innerWidth, H = innerHeight;
      const x = W * (0.15 + Math.random() * 0.7), y = H * (0.08 + Math.random() * 0.35);
      const ang = (Math.random() < 0.5 ? 1 : -1) * (20 + Math.random() * 30);
      const len = 160 + Math.random() * 200;
      const s = h('button', { class: 'shooting-star', 'aria-label': tx('Stella cadente', 'Shooting star', 'Étoile filante'),
        style: { left: `${x}px`, top: `${y}px`, '--ang': `${ang}deg`, '--len': `${len}px` } }, h('i', {}));
      let caught = false;
      s.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (caught) return;
        caught = true;
        s.classList.add('caught');
        feel.catchStar();
        onCaught();
      });
      layer.appendChild(s);
      feel.sparkle();
      setTimeout(() => s.remove(), 1700);
    }
    schedule();
  };
  clearTimeout(shootTimer);
  schedule();
}

// ---------------------------------------------------------------- 2. icone che "vivono"
export function animateIcon(btn: HTMLElement) {
  if (reducedMotion()) return;
  btn.classList.remove('ico-play');
  void btn.offsetWidth;
  btn.classList.add('ico-play');
  setTimeout(() => btn.classList.remove('ico-play'), 900);
}

// ---------------------------------------------------------------- 12. passaggio tra mondi
/** Ruota via dal cielo attuale, mostra il nome del nuovo mondo e "atterra" nel suo cielo. */
export function worldTransition(name: string, color: string, swap: () => void, land: () => void) {
  if (reducedMotion()) { swap(); land(); return; }
  const card = h('div', { class: 'world-travel' }, h('div', { class: 'wt-planet', style: { '--c': color } }),
    h('div', { class: 'wt-k' }, tx('In viaggio verso', 'Travelling to', 'En route vers')), h('div', { class: 'wt-n' }, name));
  layer.appendChild(card);
  document.body.classList.add('world-out');
  setTimeout(() => {
    swap();
    document.body.classList.remove('world-out');
    document.body.classList.add('world-in');
    land();
    card.classList.add('out');
  }, 1100);
  setTimeout(() => { document.body.classList.remove('world-in'); card.remove(); }, 2300);
}
