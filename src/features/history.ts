// Idea 2 — "Viaggio della luce": cosa succedeva sulla Terra quando è partita la luce che vedi.
import { lang, num, tx } from '../i18n';

/** [anno (negativo = a.C.), italiano, inglese, francese] in ordine cronologico. */
const EVENTS_RAW: [number, string, string, string][] = [
  [-13.8e9, 'il Big Bang: nasceva l\'universo stesso', 'the Big Bang: the universe itself was born', 'le Big Bang : l\'univers lui-même naissait'],
  [-13.2e9, 'si accendevano le prime stelle dell\'universo', 'the first stars in the universe were lighting up', 'les premières étoiles de l\'univers s\'allumaient'],
  [-10e9, 'si formava il disco della Via Lattea', 'the disc of the Milky Way was forming', 'le disque de la Voie lactée se formait'],
  [-4.6e9, 'nasceva il Sole da una nube di gas e polvere', 'the Sun was born from a cloud of gas and dust', 'le Soleil naissait d\'un nuage de gaz et de poussière'],
  [-4.5e9, 'una collisione gigante formava la Luna', 'a giant collision was forming the Moon', 'une collision géante formait la Lune'],
  [-3.8e9, 'comparivano le prime forme di vita negli oceani', 'the first life was appearing in the oceans', 'les premières formes de vie apparaissaient dans les océans'],
  [-2.4e9, 'i cianobatteri riempivano l\'aria di ossigeno', 'cyanobacteria were filling the air with oxygen', 'les cyanobactéries remplissaient l\'air d\'oxygène'],
  [-540e6, 'esplodeva la vita: l\'esplosione del Cambriano', 'life was exploding: the Cambrian explosion', 'la vie explosait : l\'explosion cambrienne'],
  [-375e6, 'i primi animali uscivano dall\'acqua', 'the first animals were crawling out of the water', 'les premiers animaux sortaient de l\'eau'],
  [-230e6, 'comparivano i primi dinosauri', 'the first dinosaurs were appearing', 'les premiers dinosaures apparaissaient'],
  [-66e6, 'un asteroide poneva fine all\'era dei dinosauri', 'an asteroid was ending the age of the dinosaurs', 'un astéroïde mettait fin à l\'ère des dinosaures'],
  [-55e6, 'comparivano i primi primati', 'the first primates were appearing', 'les premiers primates apparaissaient'],
  [-7e6, 'i nostri antenati iniziavano a camminare su due zampe', 'our ancestors were starting to walk on two legs', 'nos ancêtres commençaient à marcher sur deux jambes'],
  [-3.2e6, 'viveva Lucy, l\'australopiteco', 'Lucy the australopithecine was alive', 'vivait Lucy, l\'australopithèque'],
  [-2.5e6, 'i primi esseri umani scheggiavano utensili di pietra', 'the first humans were chipping stone tools', 'les premiers humains taillaient des outils en pierre'],
  [-1e6, 'gli esseri umani addomesticavano il fuoco', 'humans were taming fire', 'les humains domestiquaient le feu'],
  [-300000, 'comparivano i primi Homo sapiens in Africa', 'the first Homo sapiens were appearing in Africa', 'les premiers Homo sapiens apparaissaient en Afrique'],
  [-70000, 'i sapiens iniziavano a uscire dall\'Africa', 'Homo sapiens were beginning to leave Africa', 'les sapiens commençaient à quitter l\'Afrique'],
  [-40000, 'i Neanderthal vivevano ancora in Europa', 'Neanderthals still lived in Europe', 'les Néandertaliens vivaient encore en Europe'],
  [-36000, 'qualcuno dipingeva la grotta Chauvet', 'someone was painting the Chauvet Cave', 'quelqu\'un peignait la grotte Chauvet'],
  [-17000, 'si dipingevano i tori della grotta di Lascaux', 'the bulls of Lascaux were being painted', 'on peignait les taureaux de la grotte de Lascaux'],
  [-11600, 'finiva l\'ultima era glaciale', 'the last ice age was ending', 'la dernière période glaciaire s\'achevait'],
  [-9500, 'si costruiva Göbekli Tepe, il tempio più antico', 'Göbekli Tepe, the oldest temple, was being built', 'on construisait Göbekli Tepe, le plus ancien temple'],
  [-7000, 'nascevano i primi villaggi agricoli', 'the first farming villages were appearing', 'naissaient les premiers villages agricoles'],
  [-3200, 'in Mesopotamia si inventava la scrittura', 'writing was being invented in Mesopotamia', 'l\'écriture était inventée en Mésopotamie'],
  [-3000, 'si innalzavano le pietre di Stonehenge', 'the stones of Stonehenge were being raised', 'on dressait les pierres de Stonehenge'],
  [-2560, 'si completava la Grande Piramide di Giza', 'the Great Pyramid of Giza was being completed', 'on achevait la Grande Pyramide de Gizeh'],
  [-1750, 'Hammurabi scriveva il suo codice di leggi', 'Hammurabi was writing his code of laws', 'Hammurabi rédigeait son code de lois'],
  [-1323, 'veniva sepolto Tutankhamon', 'Tutankhamun was being buried', 'Toutânkhamon était enterré'],
  [-1200, 'cadeva Troia (secondo la leggenda)', 'Troy was falling (according to legend)', 'Troie tombait (selon la légende)'],
  [-776, 'si svolgevano le prime Olimpiadi', 'the first Olympic Games were held', 'avaient lieu les premiers Jeux olympiques'],
  [-753, 'secondo la tradizione veniva fondata Roma', 'Rome was founded, according to tradition', 'Rome était fondée, selon la tradition'],
  [-585, 'Talete prevedeva un\'eclissi di Sole', 'Thales was predicting a solar eclipse', 'Thalès prédisait une éclipse de Soleil'],
  [-490, 'si combatteva la battaglia di Maratona', 'the Battle of Marathon was being fought', 'se déroulait la bataille de Marathon'],
  [-432, 'si completava il Partenone ad Atene', 'the Parthenon in Athens was being completed', 'on achevait le Parthénon à Athènes'],
  [-399, 'moriva Socrate', 'Socrates was dying', 'Socrate mourait'],
  [-323, 'moriva Alessandro Magno', 'Alexander the Great was dying', 'Alexandre le Grand mourait'],
  [-240, 'Eratostene misurava la circonferenza della Terra', 'Eratosthenes was measuring the Earth\'s circumference', 'Ératosthène mesurait la circonférence de la Terre'],
  [-218, 'Annibale attraversava le Alpi con gli elefanti', 'Hannibal was crossing the Alps with elephants', 'Hannibal franchissait les Alpes avec ses éléphants'],
  [-44, 'veniva assassinato Giulio Cesare', 'Julius Caesar was being assassinated', 'Jules César était assassiné'],
  [0, 'iniziava l\'anno zero del nostro calendario', 'year zero of our calendar was beginning', 'commençait l\'an zéro de notre calendrier'],
  [79, 'il Vesuvio seppelliva Pompei', 'Vesuvius was burying Pompeii', 'le Vésuve ensevelissait Pompéi'],
  [80, 'si inaugurava il Colosseo', 'the Colosseum was being inaugurated', 'on inaugurait le Colisée'],
  [150, 'Tolomeo scriveva l\'Almagesto e catalogava le stelle', 'Ptolemy was writing the Almagest and cataloguing the stars', 'Ptolémée écrivait l\'Almageste et cataloguait les étoiles'],
  [476, 'cadeva l\'Impero romano d\'Occidente', 'the Western Roman Empire was falling', 'l\'Empire romain d\'Occident tombait'],
  [622, 'nasceva il calendario islamico', 'the Islamic calendar was beginning', 'naissait le calendrier musulman'],
  [800, 'Carlo Magno veniva incoronato imperatore', 'Charlemagne was being crowned emperor', 'Charlemagne était couronné empereur'],
  [1000, 'i Vichinghi arrivavano in America', 'the Vikings were reaching America', 'les Vikings atteignaient l\'Amérique'],
  [1054, 'si vedeva in pieno giorno la supernova che creò la Nebulosa del Granchio', 'the supernova that made the Crab Nebula was visible in broad daylight', 'la supernova à l\'origine de la nébuleuse du Crabe était visible en plein jour'],
  [1088, 'nasceva a Bologna la prima università del mondo', 'the world\'s first university was founded in Bologna', 'naissait à Bologne la première université du monde'],
  [1271, 'Marco Polo partiva per la Cina', 'Marco Polo was setting off for China', 'Marco Polo partait pour la Chine'],
  [1321, 'Dante completava la Divina Commedia', 'Dante was completing the Divine Comedy', 'Dante achevait la Divine Comédie'],
  [1348, 'la peste nera devastava l\'Europa', 'the Black Death was ravaging Europe', 'la peste noire ravageait l\'Europe'],
  [1436, 'Brunelleschi completava la cupola di Firenze', 'Brunelleschi was completing the dome of Florence', 'Brunelleschi achevait la coupole de Florence'],
  [1455, 'Gutenberg stampava la prima Bibbia', 'Gutenberg was printing the first Bible', 'Gutenberg imprimait la première Bible'],
  [1492, 'Colombo arrivava in America', 'Columbus was reaching America', 'Christophe Colomb atteignait l\'Amérique'],
  [1503, 'Leonardo iniziava a dipingere la Gioconda', 'Leonardo was starting to paint the Mona Lisa', 'Léonard commençait à peindre la Joconde'],
  [1512, 'Michelangelo completava la Cappella Sistina', 'Michelangelo was finishing the Sistine Chapel', 'Michel-Ange achevait la chapelle Sixtine'],
  [1543, 'Copernico metteva il Sole al centro', 'Copernicus was putting the Sun at the centre', 'Copernic plaçait le Soleil au centre'],
  [1572, 'Tycho Brahe osservava una "stella nuova"', 'Tycho Brahe was observing a "new star"', 'Tycho Brahe observait une « nouvelle étoile »'],
  [1610, 'Galileo puntava il telescopio verso Giove', 'Galileo was pointing his telescope at Jupiter', 'Galilée pointait sa lunette vers Jupiter'],
  [1687, 'Newton pubblicava la legge di gravitazione', 'Newton was publishing the law of gravitation', 'Newton publiait la loi de la gravitation'],
  [1769, 'Watt brevettava la macchina a vapore', 'Watt was patenting the steam engine', 'Watt brevetait la machine à vapeur'],
  [1776, 'veniva firmata la Dichiarazione d\'Indipendenza americana', 'the American Declaration of Independence was being signed', 'on signait la Déclaration d\'indépendance américaine'],
  [1781, 'Herschel scopriva Urano', 'Herschel was discovering Uranus', 'Herschel découvrait Uranus'],
  [1789, 'scoppiava la Rivoluzione francese', 'the French Revolution was breaking out', 'éclatait la Révolution française'],
  [1800, 'Alessandro Volta inventava la pila', 'Alessandro Volta was inventing the battery', 'Alessandro Volta inventait la pile'],
  [1815, 'Napoleone veniva sconfitto a Waterloo', 'Napoleon was being defeated at Waterloo', 'Napoléon était vaincu à Waterloo'],
  [1838, 'si misurava per la prima volta la distanza di una stella', 'the distance to a star was measured for the first time', 'on mesurait pour la première fois la distance d\'une étoile'],
  [1846, 'si scopriva Nettuno', 'Neptune was being discovered', 'on découvrait Neptune'],
  [1861, 'nasceva il Regno d\'Italia', 'the Kingdom of Italy was born', 'naissait le royaume d\'Italie'],
  [1869, 'Mendeleev pubblicava la tavola periodica', 'Mendeleev was publishing the periodic table', 'Mendeleïev publiait le tableau périodique'],
  [1876, 'si brevettava il telefono', 'the telephone was being patented', 'on brevetait le téléphone'],
  [1895, 'Marconi trasmetteva i primi segnali radio', 'Marconi was sending the first radio signals', 'Marconi transmettait les premiers signaux radio'],
  [1903, 'i fratelli Wright facevano volare il primo aereo', 'the Wright brothers were flying the first aeroplane', 'les frères Wright faisaient voler le premier avion'],
  [1905, 'Einstein pubblicava la relatività ristretta', 'Einstein was publishing special relativity', 'Einstein publiait la relativité restreinte'],
  [1915, 'Einstein completava la relatività generale', 'Einstein was completing general relativity', 'Einstein achevait la relativité générale'],
  [1918, 'finiva la Prima guerra mondiale', 'the First World War was ending', 'la Première Guerre mondiale s\'achevait'],
  [1924, 'Hubble dimostrava che esistono altre galassie', 'Hubble was showing that other galaxies exist', 'Hubble montrait que d\'autres galaxies existent'],
  [1930, 'veniva scoperto Plutone', 'Pluto was being discovered', 'on découvrait Pluton'],
  [1945, 'finiva la Seconda guerra mondiale', 'the Second World War was ending', 'la Seconde Guerre mondiale s\'achevait'],
  [1946, 'nasceva la Repubblica Italiana', 'the Italian Republic was born', 'naissait la République italienne'],
  [1957, 'lo Sputnik diventava il primo satellite artificiale', 'Sputnik was becoming the first artificial satellite', 'Spoutnik devenait le premier satellite artificiel'],
  [1961, 'Jurij Gagarin diventava il primo uomo nello spazio', 'Yuri Gagarin was becoming the first person in space', 'Youri Gagarine devenait le premier homme dans l\'espace'],
  [1969, 'l\'Apollo 11 portava l\'uomo sulla Luna', 'Apollo 11 was landing people on the Moon', 'Apollo 11 posait l\'homme sur la Lune'],
  [1977, 'partivano le sonde Voyager', 'the Voyager probes were launching', 'les sondes Voyager décollaient'],
  [1989, 'cadeva il muro di Berlino', 'the Berlin Wall was falling', 'le mur de Berlin tombait'],
  [1990, 'veniva lanciato il telescopio spaziale Hubble', 'the Hubble Space Telescope was being launched', 'on lançait le télescope spatial Hubble'],
  [1991, 'nasceva il World Wide Web', 'the World Wide Web was born', 'naissait le World Wide Web'],
  [1995, 'si scopriva il primo pianeta attorno a un\'altra stella simile al Sole', 'the first planet around another Sun-like star was discovered', 'on découvrait la première planète autour d\'une autre étoile semblable au Soleil'],
  [1998, 'iniziava la costruzione della Stazione Spaziale Internazionale', 'construction of the International Space Station was starting', 'commençait la construction de la Station spatiale internationale'],
  [2000, 'la Stazione Spaziale ospitava il suo primo equipaggio', 'the Space Station was welcoming its first crew', 'la Station spatiale accueillait son premier équipage'],
  [2007, 'veniva presentato il primo iPhone', 'the first iPhone was being unveiled', 'on présentait le premier iPhone'],
  [2012, 'si scopriva il bosone di Higgs', 'the Higgs boson was being discovered', 'on découvrait le boson de Higgs'],
  [2015, 'si rilevavano per la prima volta le onde gravitazionali', 'gravitational waves were detected for the first time', 'on détectait pour la première fois des ondes gravitationnelles'],
  [2019, 'si fotografava il primo buco nero', 'the first black hole was being photographed', 'on photographiait le premier trou noir'],
  [2021, 'veniva lanciato il telescopio spaziale James Webb', 'the James Webb Space Telescope was being launched', 'on lançait le télescope spatial James Webb'],
  [2024, 'il telescopio Webb scopriva galassie antichissime', 'the Webb telescope was finding extremely ancient galaxies', 'le télescope Webb découvrait des galaxies très anciennes'],
];

const EVENTS: [number, string][] = EVENTS_RAW.map((e) => [e[0], lang === 'it' ? e[1] : lang === 'fr' ? e[3] : e[2]]);

export function formatYear(y: number): string {
  const ay = Math.abs(y);
  if (ay >= 1e9) return tx(`${num(ay / 1e9, 1)} miliardi di anni fa`, `${num(ay / 1e9, 1)} billion years ago`, `il y a ${num(ay / 1e9, 1)} milliards d'années`);
  if (ay >= 1e6) return tx(`${num(ay / 1e6, 1)} milioni di anni fa`, `${num(ay / 1e6, 1)} million years ago`, `il y a ${num(ay / 1e6, 1)} millions d'années`);
  if (ay >= 20000) return tx(`${num(Math.round(ay / 1000))} mila anni fa`, `${num(Math.round(ay / 1000))},000 years ago`, `il y a ${num(Math.round(ay / 1000))} 000 ans`);
  if (y < 0) return tx(`${Math.round(ay)} a.C.`, `${Math.round(ay)} BC`, `${Math.round(ay)} av. J.-C.`);
  return `${Math.round(y)}`;
}

export interface LightJourney {
  lightYears: number;
  departureYear: number;
  departureText: string;
  event: string;
  eventYear: number;
  /** Testo dell'"inverso": cosa vedrebbero da lì guardando la Terra. */
  mirror: string;
  /** 0..1 posizione dell'evento su una scala logaritmica del tempo. */
  timeline: number;
}

export function lightJourney(lightYears: number, now = new Date()): LightJourney {
  const yearNow = now.getFullYear() + now.getMonth() / 12;
  const dep = yearNow - lightYears;
  let best = EVENTS[0];
  let bestScore = Infinity;
  for (const e of EVENTS) {
    const score = Math.abs(Math.log((yearNow - e[0] + 1) / (yearNow - dep + 1)));
    if (score < bestScore) { bestScore = score; best = e; }
  }
  const recent = dep > -20000;
  const yearTxt = recent ? (dep < 0 ? formatYear(dep) : String(Math.round(dep))) : formatYear(dep);
  const departureText = lightYears < 1
    ? tx('meno di un anno fa', 'less than a year ago', 'il y a moins d\'un an')
    : recent ? tx(`nel ${yearTxt}`, `in ${yearTxt}`, `en ${yearTxt}`) : yearTxt;
  const mirror = lightYears < 30
    ? tx(`Se qualcuno lì guardasse la Terra adesso, vedrebbe il ${Math.round(dep)}.`, `If someone there looked at Earth right now, they would see the year ${Math.round(dep)}.`, `Si quelqu'un, là-bas, regardait la Terre maintenant, il verrait l'année ${Math.round(dep)}.`)
    : recent
      ? tx(`Un osservatore lì, puntando un telescopio sulla Terra, vedrebbe il mondo del ${yearTxt}.`, `An observer there, pointing a telescope at Earth, would see the world of ${yearTxt}.`, `Un observateur là-bas, pointant un télescope vers la Terre, verrait le monde de ${yearTxt}.`)
      : tx(`Un osservatore lì, puntando un telescopio sulla Terra, vedrebbe la Terra di ${yearTxt}.`, `An observer there, pointing a telescope at Earth, would see the Earth of ${yearTxt}.`, `Un observateur là-bas, pointant un télescope vers la Terre, verrait la Terre d'${yearTxt}.`);
  const timeline = Math.min(1, Math.log10(lightYears + 1) / Math.log10(13.8e9));
  return { lightYears, departureYear: dep, departureText, event: best[1], eventYear: best[0], mirror, timeline };
}

export function formatLightTime(seconds: number): string {
  if (seconds < 60) return tx(`${num(seconds, 1)} secondi`, `${num(seconds, 1)} seconds`, `${num(seconds, 1)} secondes`);
  if (seconds < 3600) return tx(`${num(seconds / 60, 1)} minuti`, `${num(seconds / 60, 1)} minutes`, `${num(seconds / 60, 1)} minutes`);
  if (seconds < 86400 * 2) return tx(`${num(seconds / 3600, 1)} ore`, `${num(seconds / 3600, 1)} hours`, `${num(seconds / 3600, 1)} heures`);
  return tx(`${num(seconds / 86400, 1)} giorni`, `${num(seconds / 86400, 1)} days`, `${num(seconds / 86400, 1)} jours`);
}

/** Posizione 0..1 sulla scala logaritmica del tempo (anni fa = anni luce di distanza). */
export const timelinePos = (yearsAgo: number) => Math.min(1, Math.max(0, Math.log10(Math.max(0, yearsAgo) + 1) / Math.log10(13.8e9)));
export const timelineYears = (p: number) => Math.pow(10, p * Math.log10(13.8e9)) - 1;

/** Epoche della linea del tempo (anni fa, testo). */
export function timelineEvents(now = new Date()): { ago: number; text: string; pos: number }[] {
  const yearNow = now.getFullYear();
  return EVENTS.map(([y, t]) => ({ ago: Math.max(1, yearNow - y), text: t, pos: timelinePos(Math.max(1, yearNow - y)) }));
}

/** Paralleli: oggetti noti a distanze crescenti (anni luce), per dare una scala alla luce. */
export const PARALLELS: [number, string, string, string][] = [
  [4.24, 'Proxima Centauri', 'Proxima Centauri', 'Proxima Centauri'],
  [8.6, 'Sirio', 'Sirius', 'Sirius'],
  [548, 'Betelgeuse', 'Betelgeuse', 'Bételgeuse'],
  [1344, 'la Nebulosa di Orione', 'the Orion Nebula', 'la nébuleuse d\'Orion'],
  [26000, 'il centro della Via Lattea', 'the centre of the Milky Way', 'le centre de la Voie lactée'],
  [163000, 'la Grande Nube di Magellano', 'the Large Magellanic Cloud', 'le Grand Nuage de Magellan'],
  [2.5e6, 'la Galassia di Andromeda', 'the Andromeda Galaxy', 'la galaxie d\'Andromède'],
  [54e6, 'l\'Ammasso della Vergine', 'the Virgo Cluster', 'l\'amas de la Vierge'],
  [2.4e9, 'il quasar 3C 273', 'the quasar 3C 273', 'le quasar 3C 273'],
  [13.1e9, 'le galassie più lontane viste dal Webb', 'the most distant galaxies seen by Webb', 'les galaxies les plus lointaines vues par Webb'],
];
export function parallelAt(yearsAgo: number) {
  let best = PARALLELS[0], bs = Infinity;
  for (const p of PARALLELS) { const sc = Math.abs(Math.log(p[0] / Math.max(1, yearsAgo))); if (sc < bs) { bs = sc; best = p; } }
  return { ly: best[0], name: lang === 'it' ? best[1] : lang === 'fr' ? best[3] : best[2] };
}
export function nearestEvent(yearsAgo: number, now = new Date()) {
  const ev = timelineEvents(now);
  let best = ev[0], bs = Infinity;
  for (const e of ev) { const sc = Math.abs(Math.log((e.ago + 1) / (yearsAgo + 1))); if (sc < bs) { bs = sc; best = e; } }
  return best;
}
