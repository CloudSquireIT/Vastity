// Tour narrati: viaggi guidati con la navicella, tappa dopo tappa, con un breve racconto per ognuna.
import { h, openSheet, closeSheet } from '../ui/dom';
import { lang, tx } from '../i18n';
import { stars } from '../data/catalog';
import { bus } from '../state';
import { feel } from '../core/feel';
import { ObjRef, refName, sameRef } from './objects';

type T3 = [string, string, string];
type Spec = ObjRef | { hip: string };
interface Stop { ref: Spec; text: T3 }
interface Tour { id: string; name: T3; desc: T3; icon: string; stops: Stop[] }

const L = (t: T3) => (lang === 'en' ? t[1] : lang === 'fr' ? t[2] : t[0]);

export const TOURS: Tour[] = [
  {
    id: 'solar', icon: '☉',
    name: ['Il Sistema Solare in cinque minuti', 'The Solar System in five minutes', 'Le Système solaire en cinq minutes'],
    desc: ['Dal Sole a Plutone, i mondi di casa nostra', 'From the Sun to Pluto, the worlds of home', 'Du Soleil à Pluton, les mondes de chez nous'],
    stops: [
      { ref: { kind: 'body', id: 'sun' }, text: ['Tutto parte da qui: una stella normale, a metà della sua vita. Ogni secondo trasforma 4 milioni di tonnellate di materia in luce.', 'It all starts here: an ordinary star, halfway through its life. Every second it turns 4 million tonnes of matter into light.', 'Tout commence ici : une étoile ordinaire, à la moitié de sa vie. Chaque seconde, elle transforme 4 millions de tonnes de matière en lumière.'] },
      { ref: { kind: 'body', id: 'venus' }, text: ['Venere ha quasi le dimensioni della Terra, ma è un inferno: nuvole di acido solforico e una pressione novanta volte la nostra.', 'Venus is almost Earth-sized, but it is hell: clouds of sulphuric acid and a pressure ninety times ours.', 'Vénus a presque la taille de la Terre, mais c\'est un enfer : nuages d\'acide sulfurique et pression quatre-vingt-dix fois la nôtre.'] },
      { ref: { kind: 'body', id: 'earth' }, text: ['Casa. L\'unico pianeta conosciuto con oceani di acqua liquida in superficie, e con qualcuno che guarda il cielo.', 'Home. The only known planet with oceans of liquid water on its surface, and someone looking up at the sky.', 'Chez nous. La seule planète connue avec des océans d\'eau liquide en surface, et quelqu\'un qui regarde le ciel.'] },
      { ref: { kind: 'body', id: 'mars' }, text: ['Un tempo Marte aveva fiumi e laghi: i rover ne hanno trovato le tracce. Oggi è un deserto freddo con le montagne più alte del Sistema Solare.', 'Mars once had rivers and lakes: rovers have found their traces. Today it is a cold desert with the tallest mountains in the Solar System.', 'Mars avait autrefois des rivières et des lacs : les rovers en ont trouvé les traces. Aujourd\'hui, c\'est un désert froid avec les plus hautes montagnes du Système solaire.'] },
      { ref: { kind: 'body', id: 'jupiter' }, text: ['Il gigante: potrebbe contenere più di mille Terre. Con la sua gravità ha plasmato le orbite di tutti gli altri pianeti.', 'The giant: it could hold more than a thousand Earths. Its gravity shaped the orbits of all the other planets.', 'Le géant : il pourrait contenir plus de mille Terres. Sa gravité a façonné les orbites de toutes les autres planètes.'] },
      { ref: { kind: 'body', id: 'saturn' }, text: ['Gli anelli sono miliardi di frammenti di ghiaccio, dai granelli ai blocchi grandi come case, ognuno sulla sua piccola orbita.', 'The rings are billions of pieces of ice, from grains to blocks the size of houses, each on its own little orbit.', 'Les anneaux sont des milliards de morceaux de glace, du grain au bloc grand comme une maison, chacun sur sa petite orbite.'] },
      { ref: { kind: 'body', id: 'neptune' }, text: ['L\'ultimo pianeta, trenta volte più lontano dal Sole della Terra. Qui un anno dura 165 dei nostri.', 'The last planet, thirty times farther from the Sun than Earth. A year here lasts 165 of ours.', 'La dernière planète, trente fois plus loin du Soleil que la Terre. Ici, une année dure 165 des nôtres.'] },
      { ref: { kind: 'body', id: 'pluto' }, text: ['Oltre Nettuno inizia la fascia di Kuiper, un regno di mondi ghiacciati. Plutone ne è il più famoso. Il viaggio è finito: da qui il Sole è solo la stella più luminosa del cielo.', 'Beyond Neptune lies the Kuiper belt, a realm of icy worlds. Pluto is its most famous member. The journey is over: from here the Sun is just the brightest star in the sky.', 'Au-delà de Neptune commence la ceinture de Kuiper, un royaume de mondes glacés. Pluton en est le plus célèbre. Le voyage est terminé : d\'ici, le Soleil n\'est que l\'étoile la plus brillante du ciel.'] },
    ],
  },
  {
    id: 'lifecycle', icon: '✺',
    name: ['Vita e morte delle stelle', 'The life and death of stars', 'Vie et mort des étoiles'],
    desc: ['Dalla nube in cui nascono al buco nero', 'From the cloud they are born in to the black hole', 'Du nuage où elles naissent au trou noir'],
    stops: [
      { ref: { kind: 'messier', id: 'M42' }, text: ['Una stella nasce così: una nube di gas e polvere collassa sotto il proprio peso finché nel centro si accende la fusione nucleare. Qui sta succedendo adesso.', 'This is how a star is born: a cloud of gas and dust collapses under its own weight until nuclear fusion ignites at its centre. It is happening here right now.', 'Voici comment naît une étoile : un nuage de gaz et de poussière s\'effondre sous son propre poids jusqu\'à ce que la fusion nucléaire s\'allume au centre. Cela se passe ici, maintenant.'] },
      { ref: { kind: 'messier', id: 'M45' }, text: ['Le Pleiadi sono sorelle nate dalla stessa nube. Col tempo si separeranno, come è successo al Sole con le sue.', 'The Pleiades are sisters born from the same cloud. In time they will drift apart, as the Sun did from its own siblings.', 'Les Pléiades sont des sœurs nées du même nuage. Avec le temps, elles se sépareront, comme le Soleil l\'a fait avec les siennes.'] },
      { ref: { kind: 'body', id: 'sun' }, text: ['L\'età adulta: per miliardi di anni una stella brucia idrogeno in equilibrio tra gravità e pressione. Il Sole è qui da 4,6 miliardi di anni.', 'Adulthood: for billions of years a star burns hydrogen, balanced between gravity and pressure. The Sun has been at it for 4.6 billion years.', 'L\'âge adulte : pendant des milliards d\'années, une étoile brûle de l\'hydrogène, en équilibre entre gravité et pression. Le Soleil le fait depuis 4,6 milliards d\'années.'] },
      { ref: { hip: '27989' }, text: ['Quando l\'idrogeno finisce, la stella si gonfia. Betelgeuse è una supergigante rossa alla fine della sua vita breve e furiosa.', 'When the hydrogen runs out, the star swells. Betelgeuse is a red supergiant at the end of its short, furious life.', 'Quand l\'hydrogène s\'épuise, l\'étoile enfle. Bételgeuse est une supergéante rouge au bout de sa vie courte et furieuse.'] },
      { ref: { kind: 'messier', id: 'M57' }, text: ['Le stelle come il Sole finiscono dolcemente: soffiano via gli strati esterni in un anello colorato e lasciano un nucleo caldo, una nana bianca.', 'Stars like the Sun end gently: they puff off their outer layers into a coloured ring and leave a hot core behind, a white dwarf.', 'Les étoiles comme le Soleil finissent en douceur : elles soufflent leurs couches externes en un anneau coloré et laissent un cœur chaud, une naine blanche.'] },
      { ref: { kind: 'messier', id: 'M1' }, text: ['Le stelle massicce invece esplodono. Il ferro, il calcio, l\'oro: gli atomi del tuo corpo sono stati forgiati e sparsi da esplosioni come questa.', 'Massive stars explode instead. Iron, calcium, gold: the atoms in your body were forged and scattered by blasts like this one.', 'Les étoiles massives, elles, explosent. Fer, calcium, or : les atomes de votre corps ont été forgés et dispersés par des explosions comme celle-ci.'] },
      { ref: { kind: 'deep', id: 'cygx1' }, text: ['Se il nucleo rimasto è troppo pesante, nulla può fermarne il crollo: nasce un buco nero. Da qui nemmeno la luce torna indietro.', 'If the leftover core is too heavy, nothing can stop its collapse: a black hole is born. From here not even light comes back.', 'Si le cœur restant est trop lourd, rien ne peut arrêter son effondrement : un trou noir naît. D\'ici, même la lumière ne revient pas.'] },
    ],
  },
  {
    id: 'local', icon: '◎',
    name: ['Il Gruppo Locale', 'The Local Group', 'Le Groupe local'],
    desc: ['La nostra galassia e le sue vicine', 'Our galaxy and its neighbours', 'Notre galaxie et ses voisines'],
    stops: [
      { ref: { kind: 'deep', id: 'milkyway' }, text: ['Usciamo di casa. La Via Lattea è una spirale barrata: noi siamo in un braccio periferico, a 26 000 anni luce dal centro.', 'Let\'s step outside. The Milky Way is a barred spiral: we live in an outer arm, 26,000 light years from the centre.', 'Sortons de chez nous. La Voie lactée est une spirale barrée : nous habitons un bras périphérique, à 26 000 années-lumière du centre.'] },
      { ref: { kind: 'deep', id: 'lmc' }, text: ['La Grande Nube di Magellano, una piccola galassia che orbita intorno alla nostra. Prima o poi la Via Lattea la inghiottirà.', 'The Large Magellanic Cloud, a small galaxy orbiting ours. Sooner or later the Milky Way will swallow it.', 'Le Grand Nuage de Magellan, une petite galaxie en orbite autour de la nôtre. Tôt ou tard, la Voie lactée l\'avalera.'] },
      { ref: { kind: 'deep', id: 'smc' }, text: ['La sua sorella minore, la Piccola Nube. Le due sono legate da un ponte di gas strappato dalla gravità.', 'Its little sister, the Small Cloud. The two are linked by a bridge of gas pulled out by gravity.', 'Sa petite sœur, le Petit Nuage. Les deux sont reliés par un pont de gaz arraché par la gravité.'] },
      { ref: { kind: 'deep', id: 'm33g' }, text: ['La Galassia del Triangolo, terza per grandezza nel nostro gruppo. Le sue nebulose rosa sono fabbriche di stelle enormi.', 'The Triangulum Galaxy, third largest in our group. Its pink nebulae are giant star factories.', 'La galaxie du Triangle, troisième par la taille dans notre groupe. Ses nébuleuses roses sont de gigantesques fabriques d\'étoiles.'] },
      { ref: { kind: 'deep', id: 'm31g' }, text: ['Andromeda, la regina del Gruppo Locale, più grande della Via Lattea. Le due si stanno avvicinando: tra qualche miliardo di anni potrebbero fondersi in un\'unica grande galassia.', 'Andromeda, queen of the Local Group, bigger than the Milky Way. The two are drawing closer: in a few billion years they may merge into one great galaxy.', 'Andromède, reine du Groupe local, plus grande que la Voie lactée. Les deux se rapprochent : dans quelques milliards d\'années, elles pourraient fusionner en une seule grande galaxie.'] },
    ],
  },
  {
    id: 'blackholes', icon: '●',
    name: ['Nel cuore dei buchi neri', 'Into the heart of black holes', 'Au cœur des trous noirs'],
    desc: ['Dal più vicino al più mostruoso', 'From the nearest to the most monstrous', 'Du plus proche au plus monstrueux'],
    stops: [
      { ref: { kind: 'deep', id: 'gaiabh1' }, text: ['Il buco nero più vicino conosciuto: una decina di volte il Sole, silenzioso e invisibile. Lo tradisce la stella che gli danza intorno.', 'The nearest known black hole: about ten times the Sun, silent and invisible. The star dancing around it gives it away.', 'Le trou noir le plus proche connu : une dizaine de fois le Soleil, silencieux et invisible. L\'étoile qui danse autour le trahit.'] },
      { ref: { kind: 'deep', id: 'cygx1' }, text: ['Qui il buco nero strappa gas a una stella gigante: il gas, prima di cadere, si scalda a milioni di gradi e brilla in raggi X.', 'Here the black hole tears gas from a giant star: before falling in, the gas heats to millions of degrees and glows in X-rays.', 'Ici, le trou noir arrache du gaz à une étoile géante : avant de tomber, le gaz chauffe à des millions de degrés et brille en rayons X.'] },
      { ref: { kind: 'deep', id: 'sgra' }, text: ['Al centro della nostra galassia: quattro milioni di Soli in uno spazio più piccolo dell\'orbita di Mercurio.', 'At the centre of our galaxy: four million Suns in a space smaller than Mercury\'s orbit.', 'Au centre de notre galaxie : quatre millions de Soleils dans un espace plus petit que l\'orbite de Mercure.'] },
      { ref: { kind: 'deep', id: 'm87bh' }, text: ['Il primo ritratto di un buco nero: l\'anello luminoso è luce piegata dalla gravità intorno all\'ombra dell\'orizzonte degli eventi.', 'The first portrait of a black hole: the bright ring is light bent by gravity around the shadow of the event horizon.', 'Le premier portrait d\'un trou noir : l\'anneau lumineux est de la lumière courbée par la gravité autour de l\'ombre de l\'horizon des événements.'] },
      { ref: { kind: 'deep', id: 'ton618' }, text: ['Il mostro: decine di miliardi di Soli, acceso come un quasar ai confini dell\'universo osservabile. Qui finisce il viaggio, e quasi lo spazio stesso.', 'The monster: tens of billions of Suns, blazing as a quasar near the edge of the observable universe. Here the journey ends, and almost space itself.', 'Le monstre : des dizaines de milliards de Soleils, allumé en quasar aux confins de l\'univers observable. Ici s\'achève le voyage, et presque l\'espace lui-même.'] },
    ],
  },
];

function resolve(s: Spec): ObjRef | null {
  if (!('hip' in s)) return s;
  for (let i = 0; i < stars.count; i++) {
    const ni = stars.name[i];
    if (ni >= 0 && stars.names[ni][2] === s.hip) return { kind: 'star', index: i };
  }
  return null;
}

export interface TourHost { root: HTMLElement; flyTo(r: ObjRef): void; stopShip(): void }
let host: TourHost;
let card: HTMLElement | null = null;
export function initTours(h0: TourHost) { host = h0; }

export function openTours() {
  const list = h('div', { class: 'list tours' });
  for (const t of TOURS) {
    list.append(h('button', { class: 'row tour-row', onclick: () => { closeSheet(); setTimeout(() => playTour(t), 350); } },
      h('div', { class: 'row-ico tour-ico' }, t.icon),
      h('div', { class: 'row-main' }, h('div', { class: 'row-t' }, L(t.name)), h('div', { class: 'row-s' }, `${L(t.desc)} · ${t.stops.length} ${tx('tappe', 'stops', 'étapes')}`))));
  }
  openSheet('tours', tx('Tour guidati', 'Guided tours', 'Visites guidées'), h('div', {}, h('p', { class: 'muted' }, tx('Viaggi con la navicella, tappa dopo tappa, con un racconto per ogni luogo.', 'Spaceship journeys, stop by stop, with a story at each place.', 'Des voyages en vaisseau, étape par étape, avec une histoire à chaque lieu.')), list));
}

export function playTour(t: Tour) {
  card?.remove();
  const stops = t.stops.map((s) => ({ ref: resolve(s.ref), text: L(s.text) })).filter((s) => s.ref) as { ref: ObjRef; text: string }[];
  let i = -1;
  let arrived = false;
  const el = h('div', { class: 'ntour-card', role: 'dialog', 'aria-label': L(t.name) });
  card = el;
  host.root.appendChild(el);
  const off = bus.on('arrived', (r: ObjRef) => { if (i >= 0 && sameRef(r, stops[i].ref)) { arrived = true; render(); } });
  const end = () => { off(); el.classList.remove('in'); setTimeout(() => el.remove(), 500); if (card === el) card = null; document.body.classList.remove('touring-tour'); };
  const go = (k: number) => {
    if (k >= stops.length) { feel.success(); end(); return; }
    i = Math.max(0, k);
    arrived = false;
    host.flyTo(stops[i].ref);
    render();
  };
  function render() {
    const s = stops[i];
    el.replaceChildren(
      h('div', { class: 'tc-k' }, h('span', {}, `${L(t.name)} · ${i + 1}/${stops.length}`), h('button', { class: 'tc-x', 'aria-label': tx('Termina il tour', 'End tour', 'Terminer la visite'), onclick: () => { host.stopShip(); end(); } }, '×')),
      h('div', { class: 'tc-t' }, arrived ? refName(s.ref) : `${tx('In viaggio verso', 'Heading to', 'En route vers')} ${refName(s.ref)}…`),
      h('p', { class: 'tc-p' }, s.text),
      h('div', { class: 'tc-a' },
        i > 0 ? h('button', { class: 'btn ghost', onclick: () => go(i - 1) }, '‹ ', tx('Indietro', 'Back', 'Retour')) : h('span', {}),
        h('button', { class: 'btn primary', onclick: () => go(i + 1) }, i + 1 < stops.length ? tx('Prossima tappa', 'Next stop', 'Étape suivante') : tx('Fine', 'Finish', 'Terminer'), ' ›')));
  }
  document.body.classList.add('touring-tour');
  requestAnimationFrame(() => el.classList.add('in'));
  go(0);
}
