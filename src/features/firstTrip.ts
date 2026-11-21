// Prima missione guidata ("Primo viaggio"): tre passi che in due minuti insegnano tutto l'essenziale.
// 1. Trova la Luna nel cielo  2. Vola su Saturno con la navicella  3. Esci dalla Via Lattea.
import { h } from '../ui/dom';
import { tx } from '../i18n';
import { bus, saveSettings, state } from '../state';
import { awardSecret } from './missions';
import { feel } from '../core/feel';
import type { ObjRef } from './objects';

interface Step { title: string; hint: string; done: (ev: string, r: ObjRef | null) => boolean }
const STEPS: Step[] = [
  { title: tx('Trova la Luna', 'Find the Moon', 'Trouvez la Lune'),
    hint: tx('Tocca la lente e cerca «Luna», oppure trascina il cielo e toccala.', 'Tap the lens and search “Moon”, or drag the sky and tap it.', 'Touchez la loupe et cherchez « Lune », ou faites glisser le ciel et touchez-la.'),
    done: (ev, r) => ev === 'select' && r?.kind === 'body' && r.id === 'moon' },
  { title: tx('Vola su Saturno', 'Fly to Saturn', 'Volez vers Saturne'),
    hint: tx('Cerca «Saturno» e nella scheda tocca «Vola»: la navicella ti porta tra gli anelli.', 'Search “Saturn” and tap “Fly” on its card: the ship takes you to the rings.', 'Cherchez « Saturne » et touchez « Voler » sur sa fiche : le vaisseau vous emmène aux anneaux.'),
    done: (ev, r) => ev === 'arrived' && r?.kind === 'body' && r.id === 'saturn' },
  { title: tx('Esci dalla galassia', 'Leave the galaxy', 'Quittez la galaxie'),
    hint: tx('Cerca «Via Lattea» e vola: la vedrai dall\'esterno, con tutte le sue braccia.', 'Search “Milky Way” and fly: you will see it from outside, arms and all.', 'Cherchez « Voie lactée » et volez : vous la verrez de l\'extérieur, avec tous ses bras.'),
    done: (ev, r) => ev === 'arrived' && r?.kind === 'deep' && r.id === 'milkyway' },
];

export function startFirstTrip(root: HTMLElement) {
  if ((state.settings.firstTrip ?? 0) >= STEPS.length) return;
  const card = h('div', { class: 'trip-card', role: 'status' });
  root.appendChild(card);
  const render = (pulse = false) => {
    const i = state.settings.firstTrip ?? 0;
    if (i >= STEPS.length) { card.classList.add('out'); setTimeout(() => card.remove(), 600); return; }
    const s = STEPS[i];
    card.replaceChildren(
      h('div', { class: 'trip-k' }, tx('Primo viaggio', 'First voyage', 'Premier voyage'), h('span', { class: 'trip-dots' }, ...STEPS.map((_, j) => h('i', { class: j < i ? 'ok' : j === i ? 'now' : '' })))),
      h('div', { class: 'trip-t' }, s.title),
      h('div', { class: 'trip-h' }, s.hint),
      h('button', { class: 'trip-x', 'aria-label': tx('Chiudi', 'Close', 'Fermer'), onclick: () => { state.settings.firstTrip = STEPS.length; saveSettings(); render(); } }, '×'));
    if (pulse) { card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse'); }
  };
  const on = (ev: string) => (r: ObjRef | null) => {
    const i = state.settings.firstTrip ?? 0;
    if (i >= STEPS.length || !STEPS[i].done(ev, r)) return;
    state.settings.firstTrip = i + 1;
    saveSettings();
    if (i + 1 >= STEPS.length) awardSecret('trip');
    else feel.step();
    render(true);
  };
  bus.on('select', on('select'));
  bus.on('arrived', on('arrived'));
  bus.on('mode', (m: string) => card.classList.toggle('ship', m === 'ship'));
  requestAnimationFrame(() => card.classList.add('in'));
  render();
}
