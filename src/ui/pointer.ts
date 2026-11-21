// Gestione unificata di trascinamento, pinch, tap, doppio tap e rotellina.
// Tollerante con i gesti imperfetti: le dita contano anche se cadono su un'etichetta del cielo, un
// piccolo movimento non avvia il trascinamento, e un gesto che ha visto due dita non diventa mai un
// tocco (né sposta la vista con il dito rimasto) finché tutte le dita non si sono alzate.
export interface PointerHandlers {
  drag?(dx: number, dy: number, e: PointerEvent): void;
  dragEnd?(vx: number, vy: number): void;
  pinch?(scale: number): void;
  tap?(x: number, y: number): void;
  doubleTap?(x: number, y: number): void;
  wheel?(delta: number): void;
  down?(): void;
}

export interface PointerOptions {
  /** Elementi sopra la scena (etichette) che partecipano ai gesti: il loro tocco singolo resta un loro click. */
  overlay?: HTMLElement;
  /** Avviso all'inizio di un pinch (feedback). */
  onPinchStart?(): void;
}

const SLOP = 7; // px prima che un dito diventi trascinamento

export function attachPointer(el: HTMLElement, getHandlers: () => PointerHandlers, opts: PointerOptions = {}) {
  const pts = new Map<number, { x: number; y: number; ctl: boolean }>();
  let moved = 0;
  let downT = 0;
  let lastTap = 0;
  let pinchD = 0;
  let multi = false;
  let dragging = false;
  let pendX = 0, pendY = 0;
  let vx = 0, vy = 0, lastMoveT = 0;
  let lastMultiEnd = 0;
  const root = opts.overlay?.parentElement ?? el;
  const inScene = (t: EventTarget | null) => t === el || (!!opts.overlay && t instanceof Node && opts.overlay.contains(t));

  root.addEventListener('pointerdown', (e) => {
    if (!inScene(e.target)) return;
    // un nuovo gesto (primo dito, o il mouse) riparte da zero: un "su" perso non lascia dita fantasma
    if (e.isPrimary || e.pointerType === 'mouse') { pts.clear(); multi = false; }
    const ctl = e.target !== el;
    // sulle etichette niente cattura: il loro click deve arrivare
    if (!ctl) { try { el.setPointerCapture(e.pointerId); } catch { /* */ } }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, ctl });
    if (pts.size === 1) { moved = 0; dragging = false; pendX = pendY = 0; downT = performance.now(); vx = vy = 0; }
    if (pts.size >= 2) {
      if (!multi) opts.onPinchStart?.();
      multi = true;
      const [a, b] = [...pts.values()];
      pinchD = Math.hypot(a.x - b.x, a.y - b.y);
    }
    getHandlers().down?.();
  });

  root.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) {
      // dopo un pinch il dito rimasto non trascina: niente salti della vista
      if (multi) return;
      moved += Math.abs(dx) + Math.abs(dy);
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveT);
      lastMoveT = now;
      vx = vx * 0.6 + (dx / dt) * 16 * 0.4;
      vy = vy * 0.6 + (dy / dt) * 16 * 0.4;
      if (!dragging) {
        pendX += dx; pendY += dy;
        if (moved < SLOP) return;
        dragging = true;
        getHandlers().drag?.(pendX, pendY, e);
        return;
      }
      getHandlers().drag?.(dx, dy, e);
    } else if (pts.size >= 2) {
      moved += 10;
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      // distanza minima tra le dita: due dita molto vicine danno rapporti instabili
      if (pinchD > 24 && d > 24) getHandlers().pinch?.(d / pinchD);
      pinchD = d;
    }
  });

  const finish = (e: PointerEvent, cancelled: boolean) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    pts.delete(e.pointerId);
    if (pts.size === 0) {
      const h = getHandlers();
      const dur = performance.now() - downT;
      if (multi) {
        lastMultiEnd = performance.now();
        h.dragEnd?.(0, 0);
      } else if (!cancelled && moved < SLOP + 3 && dur < 450) {
        // un tocco su un'etichetta lo gestisce l'etichetta (il suo click)
        if (!p.ctl) {
          const now = performance.now();
          if (now - lastTap < 300) { h.doubleTap?.(e.clientX, e.clientY); lastTap = 0; }
          else { h.tap?.(e.clientX, e.clientY); lastTap = now; }
        }
      } else {
        const stale = cancelled || performance.now() - lastMoveT > 80;
        h.dragEnd?.(stale ? 0 : vx, stale ? 0 : vy);
      }
      multi = false;
    }
    if (pts.size < 2) pinchD = 0;
  };
  root.addEventListener('pointerup', (e) => finish(e, false));
  root.addEventListener('pointercancel', (e) => finish(e, true));
  el.addEventListener('lostpointercapture', (e) => finish(e, true));
  // un dito finito su un'etichetta durante un pinch non deve aprirne la scheda
  root.addEventListener('click', (e) => {
    if (performance.now() - lastMultiEnd < 450 && inScene(e.target)) { e.stopPropagation(); e.preventDefault(); }
  }, { capture: true });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    getHandlers().wheel?.(e.deltaY);
  }, { passive: false });
}
