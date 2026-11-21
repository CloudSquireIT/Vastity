// Effetto "vetro liquido" del dock sul web e su Android: tenendo premuto e trascinando, una lente
// di vetro segue il dito con una molla e si allunga con la velocità; rilasciando si attiva il pulsante
// sotto il dito. Su iPhone il dock è nativo (vedi ios/App/App/GlassDock.swift) con le API Liquid Glass.
import { reducedMotion } from '../core/feel';

export function liquidDock(dock: HTMLElement) {
  const lens = document.createElement('i');
  lens.className = 'dock-lens';
  dock.appendChild(lens);
  let lastEnd = 0;
  let active = false, startBtn: HTMLElement | null = null, x = 0, tx = 0, vx = 0, raf = 0;
  const btnAt = (cx: number, cy: number) => (document.elementFromPoint(cx, cy) as HTMLElement | null)?.closest('.dbtn') as HTMLElement | null;
  const loop = () => {
    // molla critica verso il dito; la lente si stira nella direzione del moto
    const k = 0.32;
    const nv = (tx - x) * k;
    vx = vx * 0.55 + nv * 0.45;
    x += vx;
    const stretch = Math.min(0.35, Math.abs(vx) / 40);
    lens.style.setProperty('--lx', `${(x - 32).toFixed(1)}px`);
    lens.style.setProperty('--ls', `${(1.14 + stretch * 0.4).toFixed(3)}`);
    lens.style.transform = `translateX(${(x - 32).toFixed(1)}px) scale(${(1.14 + stretch).toFixed(3)}, ${(1.14 - stretch * 0.45).toFixed(3)})`;
    if (active || Math.abs(tx - x) > 0.3) raf = requestAnimationFrame(loop);
  };
  dock.addEventListener('pointerdown', (e) => {
    if (reducedMotion()) return;
    startBtn = btnAt(e.clientX, e.clientY);
    if (!startBtn) return;
    const r = dock.getBoundingClientRect();
    active = true;
    x = tx = e.clientX - r.left; vx = 0;
    lens.classList.add('on');
    dock.classList.add('pressing');
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    dock.setPointerCapture?.(e.pointerId);
  });
  dock.addEventListener('pointermove', (e) => {
    if (!active) return;
    const r = dock.getBoundingClientRect();
    const nx = Math.max(30, Math.min(r.width - 30, e.clientX - r.left));
    tx = nx;
  });
  const end = (e: PointerEvent, cancel = false) => {
    if (!active) return;
    active = false;
    lastEnd = performance.now();
    lens.classList.remove('on');
    dock.classList.remove('pressing');
    lens.style.transform = '';
    const b = cancel ? null : btnAt(e.clientX, e.clientY);
    // con la cattura del puntatore il click nativo non arriva: lo inviamo noi al pulsante sotto il dito
    if (b) { e.preventDefault(); b.click(); }
    try { dock.releasePointerCapture?.(e.pointerId); } catch { /* */ }
  };
  dock.addEventListener('pointerup', (e) => end(e));
  dock.addEventListener('pointercancel', (e) => end(e, true));
  dock.addEventListener('lostpointercapture', (e) => end(e, true));
  // evita il doppio click: con la cattura attiva il browser non genera click sul pulsante
  dock.addEventListener('click', (e) => { if (e.isTrusted && performance.now() - lastEnd < 450 && (e.target as HTMLElement).closest('.dbtn')) { e.stopPropagation(); e.preventDefault(); } }, true);
}
