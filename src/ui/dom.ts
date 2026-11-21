// Piccole utilità DOM: creazione elementi, pannelli a scomparsa, notifiche "toast".
import { IconName, icons } from './icons';
import { bus } from '../state';
import { feel } from '../core/feel';
import { LOCALE, tx } from '../i18n';

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') {
      // le variabili CSS (--nome) vanno impostate con setProperty
      for (const [sk, sv] of Object.entries(v)) if (sk.startsWith('--')) el.style.setProperty(sk, String(sv)); else (el.style as any)[sk] = sv;
    }
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c != null && c !== false) el.append(c);
  return el;
}

export function icon(name: IconName, cls = 'ico') {
  return h('span', { class: cls, html: icons[name], 'aria-hidden': 'true' });
}

export function iconButton(name: IconName, label: string, onclick: (e: MouseEvent) => void, cls = 'ibtn') {
  return h('button', { class: cls, 'aria-label': label, title: label, 'data-icon': name, onclick }, icon(name), h('span', { class: 'ibtn-label' }, label));
}

// --- Pannello a scomparsa (bottom sheet su mobile, laterale su desktop) -------
let sheetEl: HTMLDivElement;
let sheetBody: HTMLDivElement;
let sheetTitle: HTMLDivElement;
let current: string | null = null;
let onCloseCb: (() => void) | null = null;

export function initSheet(root: HTMLElement) {
  sheetTitle = h('div', { class: 'sheet-title' });
  sheetBody = h('div', { class: 'sheet-body' });
  sheetEl = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'false' },
    h('div', { class: 'sheet-head' }, h('div', { class: 'sheet-grip' }), sheetTitle, iconButton('close', tx('Chiudi', 'Close', 'Fermer'), () => closeSheet(), 'ibtn small')),
    sheetBody,
  );
  root.appendChild(sheetEl);
  // trascina: su per espandere la scheda a metà altezza, giù per tornare a metà o chiudere
  let y0 = 0, dy = 0, dragging = false;
  const head = sheetEl.querySelector('.sheet-head') as HTMLElement;
  head.addEventListener('pointerdown', (e) => {
    // i pulsanti nell'intestazione (X) devono ricevere il loro click anche con il mouse
    if ((e.target as HTMLElement).closest('button')) return;
    // un secondo dito durante il trascinamento non ricomincia il gesto
    if (dragging && !e.isPrimary) return;
    y0 = e.clientY; dy = 0; dragging = true;
    try { head.setPointerCapture(e.pointerId); } catch { /* */ }
    sheetEl.classList.add('dragging');
  });
  head.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dy = e.clientY - y0;
    sheetEl.style.transform = `translateY(${Math.max(dy, sheetEl.classList.contains('peek') ? -40 : 0)}px)`;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    sheetEl.classList.remove('dragging');
    sheetEl.style.transform = '';
    const peekable = sheetEl.dataset.peekable === '1';
    if (dy < -30 && sheetEl.classList.contains('peek')) sheetEl.classList.remove('peek');
    else if (dy > 80) {
      if (peekable && !sheetEl.classList.contains('peek')) sheetEl.classList.add('peek');
      else closeSheet();
    } else if (Math.abs(dy) < 6 && peekable) sheetEl.classList.toggle('peek');
  };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);
  // se il dito "si perde" (pinch, gesto di sistema) la scheda non resta bloccata a metà
  head.addEventListener('lostpointercapture', endDrag);
  // scorrendo il contenuto di una scheda a metà, si apre del tutto
  sheetBody.addEventListener('scroll', () => { if (sheetEl.classList.contains('peek') && sheetBody.scrollTop > 12) sheetEl.classList.remove('peek'); }, { passive: true });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  // rete di sicurezza per i tocchi: su iPhone, dopo un pinch sul cielo, capita che il "click" di un pulsante
  // della scheda non arrivi (la X o «Vola fin lì» non rispondono). Se il dito si è alzato sullo stesso
  // pulsante senza muoversi e il click non è arrivato, lo inviamo noi.
  let down: { b: HTMLElement; x: number; y: number; t: number } | null = null;
  let clicked: EventTarget | null = null;
  let synth: { b: HTMLElement; t: number } | null = null;
  sheetEl.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    down = b ? { b, x: e.clientX, y: e.clientY, t: performance.now() } : null;
    clicked = null;
  }, { capture: true });
  sheetEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    // il click vero arrivato in ritardo dopo quello di riserva: non lo ripetiamo
    if (e.isTrusted && synth && synth.b === b && performance.now() - synth.t < 800) { e.stopPropagation(); e.preventDefault(); synth = null; return; }
    clicked = b;
  }, { capture: true });
  sheetEl.addEventListener('pointerup', (e) => {
    const d = down; down = null;
    if (!d || e.pointerType === 'mouse') return;
    // dito che faceva parte di un pinch (caduto sul pannello): niente click di riserva
    const g = (window as unknown as { __vxGhost?: Element | null }).__vxGhost;
    if (g && (g === d.b || d.b.contains(g) || g.contains(d.b))) return;
    const b = (e.target as HTMLElement).closest('button');
    if (b !== d.b || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 700) return;
    setTimeout(() => {
      if (clicked === d.b || !document.contains(d.b) || (d.b as HTMLButtonElement).disabled) return;
      synth = { b: d.b, t: performance.now() };
      d.b.click();
    }, 350);
  }, { capture: true });
}

let returnFocus: HTMLElement | null = null;
export function openSheet(id: string, title: string, body: Node, opts: { wide?: boolean; onClose?: () => void; compact?: boolean; peek?: boolean } = {}) {
  if (current && current !== id) onCloseCb?.();
  if (!current) feel.open();
  current = id;
  onCloseCb = opts.onClose ?? null;
  sheetTitle.textContent = title;
  sheetBody.replaceChildren(body);
  sheetBody.scrollTop = 0;
  sheetEl.classList.toggle('wide', !!opts.wide);
  sheetEl.classList.toggle('compact', !!opts.compact);
  sheetEl.classList.toggle('peek', !!opts.peek);
  sheetEl.dataset.peekable = opts.peek ? '1' : '';
  sheetEl.classList.add('open');
  document.body.classList.add('sheet-open');
  // lettori di schermo: il pannello prende il fuoco sul titolo; alla chiusura il fuoco torna dov'era
  if (!returnFocus) returnFocus = document.activeElement as HTMLElement | null;
  sheetEl.setAttribute('aria-label', title);
  sheetTitle.setAttribute('tabindex', '-1');
  requestAnimationFrame(() => sheetTitle.focus({ preventScroll: true }));
  bus.emit('sheet', id);
}

export function closeSheet() {
  if (!current) return;
  feel.close();
  const rf = returnFocus; returnFocus = null;
  if (rf && document.contains(rf)) setTimeout(() => rf.focus({ preventScroll: true }), 50);
  const cb = onCloseCb;
  current = null;
  onCloseCb = null;
  sheetEl.classList.remove('open');
  document.body.classList.remove('sheet-open');
  cb?.();
  bus.emit('sheet', null);
}

export function sheetOpen(id?: string) { return id ? current === id : current !== null; }

// --- Toast --------------------------------------------------------------------
let toastWrap: HTMLDivElement;
export function initToasts(root: HTMLElement) {
  toastWrap = h('div', { class: 'toasts', 'aria-live': 'polite' });
  root.appendChild(toastWrap);
  bus.on('toast', (msg: string, kind = '') => toast(msg, kind));
}
export function toast(msg: string, kind: string | number = '', ms = 4200) {
  if (typeof kind === 'number') { ms = kind; kind = ''; }
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastWrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, ms);
}

export const fmtTime = (d: Date) => d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (d: Date) => d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
