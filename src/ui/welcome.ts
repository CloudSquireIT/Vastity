// Benvenuto al primo avvio: saluta il viaggiatore e chiede, uno alla volta e spiegandoli, i permessi
// utili (posizione, sensori di movimento, notifiche). Tutti facoltativi. «Iniziamo» avvia il filmato.
// Il layout si adatta a orizzontale e verticale, a telefoni bassi e a tablet.
import { h } from './dom';
import { tx } from '../i18n';
import { native } from '../core/native';
import { feel } from '../core/feel';
import { saveSettings, state } from '../state';

type PermState = 'ask' | 'ok' | 'no';

export function showWelcome(o: { root: HTMLElement; locate: () => Promise<boolean>; motion: () => Promise<boolean>; onStart: () => void }) {
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const rows: { key: string; icon: string; t: string; d: string; run: () => Promise<boolean> }[] = [
    { key: 'loc', icon: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
      t: tx('Posizione', 'Location', 'Position'),
      d: tx('Per mostrarti il cielo esattamente come lo vedi da dove sei. Resta sul telefono.', 'To show the sky exactly as you see it from where you are. It stays on your phone.', 'Pour vous montrer le ciel exactement comme vous le voyez. Elle reste sur votre téléphone.'),
      run: o.locate },
    ...(isTouch ? [{ key: 'motion', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
      t: tx('Bussola e movimento', 'Compass and motion', 'Boussole et mouvement'),
      d: tx('Alza il telefono verso il cielo e Vastity ti dice cosa stai guardando.', 'Raise your phone to the sky and Vastity tells you what you are looking at.', 'Levez le téléphone vers le ciel et Vastity vous dit ce que vous regardez.'),
      run: o.motion }] : []),
    { key: 'notif', icon: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
      t: tx('Notifiche', 'Notifications', 'Notifications'),
      d: tx('Un avviso prima di eclissi, piogge di stelle cadenti e passaggi della ISS.', 'A heads-up before eclipses, meteor showers and ISS passes.', 'Un rappel avant les éclipses, les pluies d\'étoiles filantes et les passages de l\'ISS.'),
      run: () => native.notificationsPermission() },
  ];
  const states: Record<string, PermState> = {};
  const list = h('div', { class: 'wl-perms' });
  const paint = () => {
    list.replaceChildren(...rows.map((r) => {
      const st = states[r.key] ?? 'ask';
      // la posizione è obbligatoria: se negata si può riprovare
      const retry = r.key === 'loc' && st === 'no';
      const btn = h('button', { class: `wl-btn ${st}`, disabled: st === 'ok' || (st === 'no' && !retry), onclick: async () => {
        btn.classList.add('busy');
        const ok = await r.run().catch(() => false);
        states[r.key] = ok ? 'ok' : 'no';
        feel.toggle(ok);
        paintAll();
      } }, st === 'ok' ? tx('Attivo', 'On', 'Activé') : retry ? tx('Riprova', 'Try again', 'Réessayer') : st === 'no' ? tx('Non ora', 'Not now', 'Pas maintenant') : tx('Consenti', 'Allow', 'Autoriser'));
      return h('div', { class: 'wl-row' }, h('span', { class: 'wl-ico', html: r.icon }), h('div', { class: 'wl-txt' }, h('b', {}, r.t), h('span', {}, r.d)), btn);
    }));
  };
  const need = h('p', { class: 'wl-need', role: 'status' });
  // la posizione è facoltativa: se negata si usa un luogo predefinito e lo si dice
  const paintAll = () => {
    paint();
    need.textContent = states.loc === 'no'
      ? tx('Senza la posizione useremo il cielo di Roma: puoi attivarla quando vuoi in Impostazioni › Vastity › Posizione.', 'Without your location we will show the sky over Rome: you can turn it on any time in Settings › Vastity › Location.', 'Sans votre position, nous afficherons le ciel de Rome : vous pouvez l\'activer à tout moment dans Réglages › Vastity › Position.')
      : '';
  };
  const start = h('button', { class: 'wl-start', onclick: () => {
    feel.unlock();
    state.settings.welcomeDone = true;
    saveSettings();
    el.classList.add('out');
    document.body.classList.remove('welcome-on');
    setTimeout(() => { el.remove(); o.onStart(); }, 650);
  } }, tx('Iniziamo', 'Let\'s begin', 'Commençons'));
  const el = h('div', { class: 'welcome', role: 'dialog', 'aria-label': tx('Benvenuto', 'Welcome', 'Bienvenue') },
    h('div', { class: 'wl-inner' },
      h('div', { class: 'wl-hero' },
        h('div', { class: 'wl-word' }, 'V A S T I T Y'),
        h('h1', {}, tx('Benvenuto, viaggiatore.', 'Welcome, traveller.', 'Bienvenue, voyageur.')),
        h('p', {}, tx('Stai per vedere il cielo di stanotte, e tutto quello che c\'è oltre: pianeti, stelle, galassie e buchi neri, fino a mille miliardi di volte più veloce della luce.',
          'You are about to see tonight\'s sky, and everything beyond it: planets, stars, galaxies and black holes, at up to a trillion times the speed of light.',
          'Vous allez voir le ciel de ce soir, et tout ce qu\'il y a au-delà : planètes, étoiles, galaxies et trous noirs, jusqu\'à mille milliards de fois la vitesse de la lumière.'))),
      h('div', { class: 'wl-side' },
        h('div', { class: 'wl-k' }, tx('Prima di partire', 'Before we leave', 'Avant de partir')),
        list,
        need,
        h('p', { class: 'wl-note' }, tx('Puoi cambiare idea quando vuoi nelle impostazioni del telefono.', 'You can change your mind any time in your phone settings.', 'Vous pouvez changer d\'avis à tout moment dans les réglages du téléphone.')),
        start)));
  paintAll();
  o.root.appendChild(el);
  document.body.classList.add('welcome-on');
  requestAnimationFrame(() => el.classList.add('in'));
}
