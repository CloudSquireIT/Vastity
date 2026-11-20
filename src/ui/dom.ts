// Piccole utilità DOM: creazione elementi, pannelli a scomparsa, notifiche "toast".
import { IconName, icons } from './icons';
import { bus } from '../state';

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c != null && c !== false) el.append(c);
  return el;
}

export function icon(name: IconName, cls = 'ico') {
  return h('span', { class: cls, html: icons[name], 'aria-hidden': 'true' });
}

export function iconButton(name: IconName, label: string, onclick: (e: MouseEvent) => void, cls = 'ibtn') {
  return h('button', { class: cls, 'aria-label': label, title: label, onclick }, icon(name), h('span', { class: 'ibtn-label' }, label));
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
    h('div', { class: 'sheet-head' }, h('div', { class: 'sheet-grip' }), sheetTitle, iconButton('close', 'Chiudi', () => closeSheet(), 'ibtn small')),
    sheetBody,
  );
  root.appendChild(sheetEl);
  // trascina verso il basso per chiudere
  let y0 = 0, dy = 0, dragging = false;
  const head = sheetEl.querySelector('.sheet-head') as HTMLElement;
  head.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; dragging = true; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', (e) => { if (!dragging) return; dy = Math.max(0, e.clientY - y0); sheetEl.style.transform = `translateY(${dy}px)`; });
  head.addEventListener('pointerup', () => { dragging = false; sheetEl.style.transform = ''; if (dy > 80) closeSheet(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
}

export function openSheet(id: string, title: string, body: Node, opts: { wide?: boolean; onClose?: () => void; compact?: boolean } = {}) {
  if (current && current !== id) onCloseCb?.();
  current = id;
  onCloseCb = opts.onClose ?? null;
  sheetTitle.textContent = title;
  sheetBody.replaceChildren(body);
  sheetBody.scrollTop = 0;
  sheetEl.classList.toggle('wide', !!opts.wide);
  sheetEl.classList.toggle('compact', !!opts.compact);
  sheetEl.classList.add('open');
  document.body.classList.add('sheet-open');
  bus.emit('sheet', id);
}

export function closeSheet() {
  if (!current) return;
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
export function toast(msg: string, kind = '') {
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastWrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, 4200);
}

export const fmtTime = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
