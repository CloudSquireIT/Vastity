// Gestione unificata di trascinamento, pinch, tap, doppio tap e rotellina.
export interface PointerHandlers {
  drag?(dx: number, dy: number, e: PointerEvent): void;
  dragEnd?(vx: number, vy: number): void;
  pinch?(scale: number): void;
  tap?(x: number, y: number): void;
  doubleTap?(x: number, y: number): void;
  wheel?(delta: number): void;
  down?(): void;
}

export function attachPointer(el: HTMLElement, getHandlers: () => PointerHandlers) {
  const pts = new Map<number, { x: number; y: number }>();
  let moved = 0;
  let downT = 0;
  let lastTap = 0;
  let pinchD = 0;
  let vx = 0, vy = 0, lastMoveT = 0;

  el.addEventListener('pointerdown', (e) => {
    // un nuovo gesto (primo dito, o il mouse) riparte da zero: se un "su" è andato perso durante un
    // pinch (succede su iPhone quando un dito esce dallo schermo o finisce su un pannello) il punto
    // rimasto in memoria farebbe credere a un secondo dito e nessun tocco funzionerebbe più
    if (e.isPrimary || e.pointerType === 'mouse') pts.clear();
    try { el.setPointerCapture(e.pointerId); } catch { /* */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { moved = 0; downT = performance.now(); vx = vy = 0; }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinchD = Math.hypot(a.x - b.x, a.y - b.y);
    }
    getHandlers().down?.();
  });

  el.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) {
      moved += Math.abs(dx) + Math.abs(dy);
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveT);
      lastMoveT = now;
      vx = vx * 0.6 + (dx / dt) * 16 * 0.4;
      vy = vy * 0.6 + (dy / dt) * 16 * 0.4;
      getHandlers().drag?.(dx, dy, e);
    } else if (pts.size === 2) {
      moved += 10;
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD > 0) getHandlers().pinch?.(d / pinchD);
      pinchD = d;
    }
  });

  const up = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 0) {
      const h = getHandlers();
      const dur = performance.now() - downT;
      if (moved < 8 && dur < 400) {
        const now = performance.now();
        if (now - lastTap < 300) { h.doubleTap?.(e.clientX, e.clientY); lastTap = 0; }
        else { h.tap?.(e.clientX, e.clientY); lastTap = now; }
      } else {
        const stale = performance.now() - lastMoveT > 80;
        h.dragEnd?.(stale ? 0 : vx, stale ? 0 : vy);
      }
    }
    if (pts.size < 2) pinchD = 0;
  };
  // dito perso (gesto di sistema, cattura persa): si chiude il gesto senza generare un tocco
  const cancel = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 0) { moved = 99; getHandlers().dragEnd?.(0, 0); }
    if (pts.size < 2) pinchD = 0;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('lostpointercapture', cancel);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    getHandlers().wheel?.(e.deltaY);
  }, { passive: false });
}
