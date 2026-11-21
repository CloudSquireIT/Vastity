// Tutorial iniziale: evidenzia i comandi uno alla volta e spiega le funzioni di base.
import { h } from './dom';
import { tx } from '../i18n';
import { saveSettings, state } from '../state';

interface Step { target?: string; title: string; text: string; gesture?: boolean; round?: boolean }

function steps(): Step[] {
  return [
    {
      title: tx('Il cielo è tuo', 'The sky is yours', 'Le ciel est à vous'),
      text: tx('Questo è il cielo di adesso, sopra di te. Trascina con un dito per guardarti intorno e allarga due dita per avvicinarti.',
        'This is the sky above you right now. Drag with one finger to look around and spread two fingers to zoom in.',
        'Voici le ciel au-dessus de vous en ce moment. Glissez un doigt pour regarder autour et écartez deux doigts pour zoomer.'),
      gesture: true,
    },
    {
      title: tx('Tocca quello che vedi', 'Tap what you see', 'Touchez ce que vous voyez'),
      text: tx('Tocca una stella, un pianeta, una galassia o il suo nome: scopri cos\'è, quanto è lontano e da quanto tempo viaggia la sua luce.',
        'Tap a star, a planet, a galaxy or its name: find out what it is, how far away it is and how long its light has been travelling.',
        'Touchez une étoile, une planète, une galaxie ou son nom : découvrez ce que c\'est, sa distance et depuis combien de temps voyage sa lumière.'),
    },
    {
      target: '.ibtn.lens', round: true,
      title: tx('Cerca qualsiasi cosa', 'Search for anything', 'Cherchez n\'importe quoi'),
      text: tx('Non trovi qualcosa nel cielo? Tocca la lente e scrivi, per esempio "Andromeda", oppure sfoglia le categorie: stelle, pianeti, galassie, nebulose e altro.',
        'Can\'t find something in the sky? Tap the magnifier and type, for example "Andromeda", or browse the categories: stars, planets, galaxies, nebulae and more.',
        'Vous ne trouvez pas quelque chose ? Touchez la loupe et tapez par exemple « Andromède », ou parcourez les catégories : étoiles, planètes, galaxies, nébuleuses et plus.'),
    },
    {
      target: '.zoom-ctl',
      title: tx('Ingrandisci', 'Zoom in', 'Zoomez'),
      text: tx('Usa lo slider (o + e −) per avvicinarti come con un telescopio: Saturno, gli anelli, le galassie. La vista parte sempre dallo zoom minimo; in navicella lo slider è in basso a sinistra.',
        'Use the slider (or + and −) to zoom in like a telescope: Saturn, its rings, galaxies. The view always starts fully zoomed out; in the spaceship the slider is at the bottom left.',
        'Utilisez le curseur (ou + et −) pour vous rapprocher comme avec un télescope : Saturne, ses anneaux, les galaxies. La vue part toujours du zoom minimal ; dans le vaisseau, le curseur est en bas à gauche.'),
    },
    {
      target: '.journal-btn', round: true,
      title: tx('Il tuo diario', 'Your log', 'Votre journal'),
      text: tx('Tutto quello che salvi con «Diario» o trovi con le missioni finisce qui, giorno per giorno. Tocca un oggetto per riaprirlo.',
        'Everything you save with “Log” or find through missions ends up here, day by day. Tap an object to open it again.',
        'Tout ce que vous enregistrez avec « Journal » ou trouvez avec les missions arrive ici, jour par jour. Touchez un objet pour le rouvrir.'),
    },
    {
      target: '.top-r .ibtn:nth-child(3)', round: true,
      title: tx('Punta il telefono', 'Point your phone', 'Pointez votre téléphone'),
      text: tx('Attiva la bussola e alza il telefono verso il cielo: Vastity ti mostra esattamente cosa stai guardando.',
        'Turn on the compass and raise your phone to the sky: Vastity shows exactly what you are looking at.',
        'Activez la boussole et levez votre téléphone vers le ciel : Vastity vous montre exactement ce que vous regardez.'),
    },
    {
      target: '.time-ctl',
      title: tx('Viaggia nel tempo', 'Travel in time', 'Voyagez dans le temps'),
      text: tx('Con ◀◀ e ▶▶ il cielo scorre indietro o avanti: premili di nuovo per andare più veloce, fino a ×5. ⏸ mette in pausa (succede da solo quando zoommi su un oggetto). Tocca l\'ora per tornare al presente, tienila premuta per aprire la macchina del tempo e scegliere una data.',
        'Use ◀◀ and ▶▶ to run the sky backwards or forwards: press again to go faster, up to ×5. ⏸ pauses (it happens on its own when you zoom in on an object). Tap the time to return to the present, press and hold it to open the time machine and pick a date.',
        'Avec ◀◀ et ▶▶ le ciel défile en arrière ou en avant : appuyez encore pour aller plus vite, jusqu\'à ×5. ⏸ met en pause (automatiquement quand vous zoomez sur un objet). Touchez l\'heure pour revenir au présent, maintenez-la pour ouvrir la machine à remonter le temps et choisir une date.'),
    },
    {
      target: '.dock:not(.ship)',
      title: tx('Il menu principale', 'The main menu', 'Le menu principal'),
      text: tx('Stasera ti dice se vale la pena osservare e cosa guardare. Missioni sono sfide quotidiane con badge. Mondi ti porta a guardare il cielo da Marte o da un esopianeta. Avvisi ti segnala ISS, stelle cadenti ed eclissi.',
        'Tonight tells you whether it is worth observing and what to look at. Missions are daily challenges with badges. Worlds lets you see the sky from Mars or an exoplanet. Alerts tells you about the ISS, meteor showers and eclipses.',
        'Ce soir vous dit si ça vaut la peine d\'observer et quoi regarder. Missions propose des défis quotidiens avec des badges. Mondes vous montre le ciel depuis Mars ou une exoplanète. Alertes vous signale l\'ISS, les étoiles filantes et les éclipses.'),
    },
    {
      target: '.dock:not(.ship) .dbtn.accent', round: true,
      title: tx('Decolla con la navicella', 'Take off in the spaceship', 'Décollez avec le vaisseau'),
      text: tx('Parti dalla tua posizione e vola ovunque: pianeti, stelle, nebulose, fino ad Andromeda. Usa "Vai a" per il pilota automatico o la manetta per accelerare fino alla velocità della luce e oltre.',
        'Start from where you are and fly anywhere: planets, stars, nebulae, all the way to Andromeda. Use "Go to" for the autopilot or the throttle to accelerate to the speed of light and beyond.',
        'Partez de votre position et volez partout : planètes, étoiles, nébuleuses, jusqu\'à Andromède. Utilisez « Aller à » pour le pilote automatique ou la manette pour atteindre la vitesse de la lumière et au-delà.'),
    },
    {
      title: tx('Buon viaggio', 'Enjoy the journey', 'Bon voyage'),
      text: tx('I comandi spariscono dopo qualche secondo per lasciarti solo il cielo: tocca lo schermo per farli tornare. Puoi rivedere questo tutorial nelle Impostazioni.',
        'Controls fade after a few seconds to leave you with just the sky: tap the screen to bring them back. You can replay this tutorial in Settings.',
        'Les commandes disparaissent après quelques secondes pour ne laisser que le ciel : touchez l\'écran pour les faire revenir. Vous pouvez revoir ce tutoriel dans les Réglages.'),
    },
  ];
}

function missionSteps(): Step[] {
  return [
    {
      target: '.trip-card',
      title: tx('Il tuo primo viaggio', 'Your first voyage', 'Votre premier voyage'),
      text: tx('Questa è la tua prima missione guidata: tre tappe, dalla Luna fino a fuori dalla galassia. Il riquadro ti dice sempre cosa fare; quando completi una tappa passa alla successiva.',
        'This is your first guided mission: three stops, from the Moon to beyond the galaxy. The card always tells you what to do; when you complete a stop it moves on to the next.',
        'Voici votre première mission guidée : trois étapes, de la Lune jusqu\'au-delà de la galaxie. Le cadre vous dit toujours quoi faire ; chaque étape réussie mène à la suivante.'),
    },
    {
      target: '.mission-chip',
      title: tx('Le missioni di oggi', 'Today\'s missions', 'Les missions du jour'),
      text: tx('Ogni giorno nuove sfide in base al cielo di stanotte. Trova l\'oggetto e tienilo nel mirino al centro per qualche istante: con la bussola attiva i punti valgono doppio.',
        'New challenges every day, based on tonight\'s sky. Find the object and keep it in the central reticle for a moment: with the compass on, points count double.',
        'Chaque jour de nouveaux défis selon le ciel de ce soir. Trouvez l\'objet et gardez-le dans le viseur central quelques instants : avec la boussole, les points comptent double.'),
    },
    {
      target: '.dock:not(.ship) .dbtn:nth-child(2)', round: true,
      title: tx('Badge, livelli e tour', 'Badges, ranks and tours', 'Badges, niveaux et visites'),
      text: tx('Qui trovi i tuoi progressi, i badge da sbloccare e i tour guidati con la navicella, con un racconto per ogni tappa.',
        'Here you find your progress, badges to unlock and guided spaceship tours, with a story at every stop.',
        'Ici, vos progrès, les badges à débloquer et les visites guidées en vaisseau, avec une histoire à chaque étape.'),
    },
  ];
}

let active: HTMLElement | null = null;

export function startTutorial(root: HTMLElement, kind: 'ui' | 'missions' = 'ui', onDone?: () => void) {
  if (active) { onDone?.(); return; }
  const list = (kind === 'ui' ? steps() : missionSteps()).filter((s) => !s.target || document.querySelector(s.target));
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
    if (t && t.offsetParent !== null) {
      const r = t.getBoundingClientRect();
      const pad = 8;
      hole.classList.remove('none');
      Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`, borderRadius: s.round ? '999px' : '30px' });
    } else hole.classList.add('none');
    // la scheda resta ferma al centro: i comandi evidenziati stanno ai bordi, così non vengono coperti
    card.style.top = `${Math.max(12, vh * 0.5 - (card.offsetHeight || 220) / 2 - 18)}px`;
  }

  function go(n: number) {
    if (n >= list.length) return finish();
    i = n;
    const s = list[i];
    stepEl.textContent = `${i + 1} / ${list.length}`;
    title.textContent = s.title;
    text.textContent = s.text;
    gesture.style.display = s.gesture ? '' : 'none';
    next.textContent = i === list.length - 1 ? tx('Inizia', 'Start', 'Commencer') : tx('Avanti', 'Next', 'Suivant');
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    requestAnimationFrame(place);
  }

  function finish() {
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
