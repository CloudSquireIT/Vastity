// Tutorial iniziale: evidenzia i comandi uno alla volta e spiega le funzioni di base.
import { h } from './dom';
import { tx } from '../i18n';
import { saveSettings, state } from '../state';

interface Step { target?: string; title: string; text: string; gesture?: boolean; round?: boolean }

// 5 passi in tutto: 4 per l'interfaccia, 1 per le missioni (mostrato quando parte il primo viaggio)
function steps(): Step[] {
  return [
    {
      title: tx('Il cielo è tuo', 'The sky is yours', 'Le ciel est à vous'),
      text: tx('Questo è il cielo di adesso, sopra di te. Trascina per guardarti intorno, allarga due dita per avvicinarti e tocca una stella, un pianeta o una galassia per scoprire cos\'è.',
        'This is the sky above you right now. Drag to look around, spread two fingers to zoom in and tap a star, a planet or a galaxy to find out what it is.',
        'Voici le ciel au-dessus de vous en ce moment. Glissez pour regarder autour, écartez deux doigts pour zoomer et touchez une étoile, une planète ou une galaxie pour la découvrir.'),
      gesture: true,
    },
    {
      target: '.ibtn.lens', round: true,
      title: tx('Cerca e avvicinati', 'Search and zoom in', 'Cherchez et rapprochez-vous'),
      text: tx('Con la lente trovi qualsiasi cosa, per esempio "Andromeda". Lo slider a sinistra ingrandisce come un telescopio: con un oggetto selezionato lo zoom lo segue da solo.',
        'The magnifier finds anything, for example "Andromeda". The slider on the left zooms like a telescope: with an object selected, the zoom follows it on its own.',
        'La loupe trouve n\'importe quoi, par exemple « Andromède ». Le curseur à gauche zoome comme un télescope : avec un objet sélectionné, le zoom le suit tout seul.'),
    },
    {
      target: '.time-ctl',
      title: tx('Tempo e bussola', 'Time and compass', 'Temps et boussole'),
      text: tx('◀◀ e ▶▶ fanno scorrere il cielo nel tempo; tocca l\'ora per tornare al presente. In alto a destra la bussola: alza il telefono e Vastity ti mostra cosa stai guardando.',
        '◀◀ and ▶▶ run the sky through time; tap the time to return to the present. Top right is the compass: raise your phone and Vastity shows what you are looking at.',
        '◀◀ et ▶▶ font défiler le ciel dans le temps ; touchez l\'heure pour revenir au présent. En haut à droite, la boussole : levez le téléphone et Vastity montre ce que vous regardez.'),
    },
    {
      target: '.dock:not(.ship)',
      title: tx('Il menu e la navicella', 'The menu and the spaceship', 'Le menu et le vaisseau'),
      text: tx('Stasera, Missioni, Mondi e Avvisi sono qui. Al centro la navicella: decolla da dove sei e vola fino ad Andromeda, poi atterra su un altro mondo. Il tutorial si rivede dalle Impostazioni.',
        'Tonight, Missions, Worlds and Alerts are here. In the middle, the spaceship: take off from where you are, fly to Andromeda, then land on another world. You can replay this tutorial in Settings.',
        'Ce soir, Missions, Mondes et Alertes sont ici. Au centre, le vaisseau : décollez d\'où vous êtes, volez jusqu\'à Andromède, puis posez-vous sur un autre monde. Le tutoriel se revoit dans les Réglages.'),
    },
  ];
}

function missionSteps(): Step[] {
  return [
    {
      target: '.trip-card',
      title: tx('Il tuo primo viaggio', 'Your first voyage', 'Votre premier voyage'),
      text: tx('Tre tappe guidate, dalla Luna a fuori dalla galassia: il riquadro ti dice sempre cosa fare. In alto trovi l\'obiettivo di oggi; in Missioni i tuoi achievement.',
        'Three guided stops, from the Moon to beyond the galaxy: the card always tells you what to do. At the top is today\'s goal; in Missions, your achievements.',
        'Trois étapes guidées, de la Lune jusqu\'au-delà de la galaxie : le cadre vous dit toujours quoi faire. En haut, l\'objectif du jour ; dans Missions, vos succès.'),
    },
  ];
}

let active: HTMLElement | null = null;

export function startTutorial(root: HTMLElement, kind: 'ui' | 'missions' = 'ui', onDone?: () => void) {
  if (active) { onDone?.(); return; }
  const list = (kind === 'ui' ? steps() : missionSteps()).filter((s) => !s.target || document.querySelector(s.target));
  // numerazione unica sui 5 passi: l'ultimo (missioni) arriva all'inizio del primo viaggio
  const withMission = kind === 'ui' && !state.settings.missionTutorialDone;
  const offset = kind === 'missions' ? 4 : 0;
  const total = kind === 'missions' ? 5 : list.length + (withMission ? 1 : 0);
  let i = 0;
  const hole = h('div', { class: 'tour-hole none' });
  const stepEl = h('div', { class: 'tour-step' });
  const title = h('div', { class: 'tour-title' });
  const text = h('div', { class: 'tour-text' });
  const gesture = h('div', { class: 'tour-gesture', 'aria-hidden': 'true' });
  const dots = h('div', { class: 'tour-dots' }, ...list.map(() => h('b')));
  const skip = h('button', { class: 'link', onclick: () => finish() }, tx('Salta', 'Skip', 'Passer'));
  const next = h('button', { class: 'btn primary', onclick: () => go(i + 1) });
  const card = h('div', { class: 'tour-card', role: 'dialog', 'aria-live': 'polite' }, stepEl, gesture, title, text, h('div', { class: 'tour-actions' }, skip, dots, next));
  const el = h('div', { class: 'tour' }, hole, card);
  active = el;
  document.body.classList.add('touring');
  root.appendChild(el);

  function place() {
    const s = list[i];
    const t = s.target ? (document.querySelector(s.target) as HTMLElement | null) : null;
    const vh = window.innerHeight;
    document.querySelectorAll('.tour-lit').forEach((e) => e.classList.remove('tour-lit'));
    if (t && t.offsetParent !== null) {
      t.classList.add('tour-lit');
      const r = t.getBoundingClientRect();
      const pad = 8;
      hole.classList.remove('none');
      Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`, borderRadius: s.round ? '999px' : '30px' });
    } else hole.classList.add('none');
    // la scheda resta al centro; se l'elemento evidenziato sta sul lato sinistro, si sposta di fianco
    const vw = window.innerWidth, cw = card.offsetWidth || 520;
    let dx = 0;
    if (t && t.offsetParent !== null) {
      const r = t.getBoundingClientRect();
      const left0 = (vw - cw) / 2;
      if (r.right < vw * 0.5 && r.bottom > (vh - (card.offsetHeight || 220)) / 2) dx = Math.max(0, Math.min(r.right + 16 - left0, vw - 12 - cw - left0));
    }
    card.style.translate = `${dx}px 0`;
    card.style.top = `${Math.max(12, vh * 0.5 - (card.offsetHeight || 220) / 2 - 18)}px`;
  }

  function go(n: number) {
    if (n >= list.length) return finish();
    i = n;
    const s = list[i];
    stepEl.textContent = `${offset + i + 1} / ${total}`;
    title.textContent = s.title;
    text.textContent = s.text;
    gesture.style.display = s.gesture ? '' : 'none';
    next.textContent = i === list.length - 1 ? tx('Inizia', 'Start', 'Commencer') : tx('Avanti', 'Next', 'Suivant');
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    requestAnimationFrame(place);
  }

  function finish() {
    document.querySelectorAll('.tour-lit').forEach((e) => e.classList.remove('tour-lit'));
    el.remove();
    active = null;
    document.body.classList.remove('touring');
    window.removeEventListener('resize', place);
    if (kind === 'ui') state.settings.tutorialDone = true;
    else state.settings.missionTutorialDone = true;
    saveSettings();
    onDone?.();
  }

  window.addEventListener('resize', place);
  go(0);
}
