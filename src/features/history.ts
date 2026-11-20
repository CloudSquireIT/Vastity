// Idea 2 — "Viaggio della luce": cosa succedeva sulla Terra quando è partita la luce che vedi.

/** [anno (negativo = a.C.), evento] in ordine cronologico. */
const EVENTS: [number, string][] = [
  [-13.8e9, 'il Big Bang: nasceva l\'universo stesso'],
  [-13.2e9, 'si accendevano le prime stelle dell\'universo'],
  [-10e9, 'si formava il disco della Via Lattea'],
  [-4.6e9, 'nasceva il Sole da una nube di gas e polvere'],
  [-4.5e9, 'una collisione gigante formava la Luna'],
  [-3.8e9, 'comparivano le prime forme di vita negli oceani'],
  [-2.4e9, 'i cianobatteri riempivano l\'aria di ossigeno'],
  [-540e6, 'esplodeva la vita: l\'esplosione del Cambriano'],
  [-375e6, 'i primi animali uscivano dall\'acqua'],
  [-230e6, 'comparivano i primi dinosauri'],
  [-66e6, 'un asteroide poneva fine all\'era dei dinosauri'],
  [-55e6, 'comparivano i primi primati'],
  [-7e6, 'i nostri antenati iniziavano a camminare su due zampe'],
  [-3.2e6, 'viveva Lucy, l\'australopiteco'],
  [-2.5e6, 'i primi esseri umani scheggiavano utensili di pietra'],
  [-1e6, 'gli esseri umani addomesticavano il fuoco'],
  [-300000, 'comparivano i primi Homo sapiens in Africa'],
  [-70000, 'i sapiens iniziavano a uscire dall\'Africa'],
  [-40000, 'i Neanderthal vivevano ancora in Europa'],
  [-36000, 'qualcuno dipingeva la grotta Chauvet'],
  [-17000, 'si dipingevano i tori della grotta di Lascaux'],
  [-11600, 'finiva l\'ultima era glaciale'],
  [-9500, 'si costruiva Göbekli Tepe, il tempio più antico'],
  [-7000, 'nascevano i primi villaggi agricoli'],
  [-3200, 'in Mesopotamia si inventava la scrittura'],
  [-3000, 'si innalzavano le pietre di Stonehenge'],
  [-2560, 'si completava la Grande Piramide di Giza'],
  [-1750, 'Hammurabi scriveva il suo codice di leggi'],
  [-1323, 'veniva sepolto Tutankhamon'],
  [-1200, 'cadeva Troia (secondo la leggenda)'],
  [-776, 'si svolgevano le prime Olimpiadi'],
  [-753, 'secondo la tradizione veniva fondata Roma'],
  [-585, 'Talete prevedeva un\'eclissi di Sole'],
  [-490, 'si combatteva la battaglia di Maratona'],
  [-432, 'si completava il Partenone ad Atene'],
  [-399, 'moriva Socrate'],
  [-323, 'moriva Alessandro Magno'],
  [-240, 'Eratostene misurava la circonferenza della Terra'],
  [-218, 'Annibale attraversava le Alpi con gli elefanti'],
  [-44, 'veniva assassinato Giulio Cesare'],
  [0, 'iniziava l\'anno zero del nostro calendario'],
  [79, 'il Vesuvio seppelliva Pompei'],
  [80, 'si inaugurava il Colosseo'],
  [150, 'Tolomeo scriveva l\'Almagesto e catalogava le stelle'],
  [476, 'cadeva l\'Impero romano d\'Occidente'],
  [622, 'nasceva il calendario islamico'],
  [800, 'Carlo Magno veniva incoronato imperatore'],
  [1000, 'i Vichinghi arrivavano in America'],
  [1054, 'si vedeva in pieno giorno la supernova che creò la Nebulosa del Granchio'],
  [1088, 'nasceva a Bologna la prima università del mondo'],
  [1271, 'Marco Polo partiva per la Cina'],
  [1321, 'Dante completava la Divina Commedia'],
  [1348, 'la peste nera devastava l\'Europa'],
  [1436, 'Brunelleschi completava la cupola di Firenze'],
  [1455, 'Gutenberg stampava la prima Bibbia'],
  [1492, 'Colombo arrivava in America'],
  [1503, 'Leonardo iniziava a dipingere la Gioconda'],
  [1512, 'Michelangelo completava la Cappella Sistina'],
  [1543, 'Copernico metteva il Sole al centro'],
  [1572, 'Tycho Brahe osservava una "stella nuova"'],
  [1610, 'Galileo puntava il telescopio verso Giove'],
  [1687, 'Newton pubblicava la legge di gravitazione'],
  [1769, 'Watt brevettava la macchina a vapore'],
  [1776, 'veniva firmata la Dichiarazione d\'Indipendenza americana'],
  [1781, 'Herschel scopriva Urano'],
  [1789, 'scoppiava la Rivoluzione francese'],
  [1800, 'Alessandro Volta inventava la pila'],
  [1815, 'Napoleone veniva sconfitto a Waterloo'],
  [1838, 'si misurava per la prima volta la distanza di una stella'],
  [1846, 'si scopriva Nettuno'],
  [1861, 'nasceva il Regno d\'Italia'],
  [1869, 'Mendeleev pubblicava la tavola periodica'],
  [1876, 'si brevettava il telefono'],
  [1895, 'Marconi trasmetteva i primi segnali radio'],
  [1903, 'i fratelli Wright facevano volare il primo aereo'],
  [1905, 'Einstein pubblicava la relatività ristretta'],
  [1915, 'Einstein completava la relatività generale'],
  [1918, 'finiva la Prima guerra mondiale'],
  [1924, 'Hubble dimostrava che esistono altre galassie'],
  [1930, 'veniva scoperto Plutone'],
  [1945, 'finiva la Seconda guerra mondiale'],
  [1946, 'nasceva la Repubblica Italiana'],
  [1957, 'lo Sputnik diventava il primo satellite artificiale'],
  [1961, 'Jurij Gagarin diventava il primo uomo nello spazio'],
  [1969, 'l\'Apollo 11 portava l\'uomo sulla Luna'],
  [1977, 'partivano le sonde Voyager'],
  [1989, 'cadeva il muro di Berlino'],
  [1990, 'veniva lanciato il telescopio spaziale Hubble'],
  [1991, 'nasceva il World Wide Web'],
  [1995, 'si scopriva il primo pianeta attorno a un\'altra stella simile al Sole'],
  [1998, 'iniziava la costruzione della Stazione Spaziale Internazionale'],
  [2000, 'la Stazione Spaziale ospitava il suo primo equipaggio'],
  [2007, 'veniva presentato il primo iPhone'],
  [2012, 'si scopriva il bosone di Higgs'],
  [2015, 'si rilevavano per la prima volta le onde gravitazionali'],
  [2019, 'si fotografava il primo buco nero'],
  [2021, 'veniva lanciato il telescopio spaziale James Webb'],
  [2024, 'il telescopio Webb scopriva galassie antichissime'],
];

export function formatYear(y: number): string {
  const ay = Math.abs(y);
  if (ay >= 1e9) return `${(ay / 1e9).toLocaleString('it-IT', { maximumFractionDigits: 1 })} miliardi di anni fa`;
  if (ay >= 1e6) return `${(ay / 1e6).toLocaleString('it-IT', { maximumFractionDigits: 1 })} milioni di anni fa`;
  if (ay >= 20000) return `${Math.round(ay / 1000).toLocaleString('it-IT')} mila anni fa`;
  if (y < 0) return `${Math.round(ay)} a.C.`;
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
  // evento più vicino all'anno di partenza (in scala relativa al tempo trascorso)
  let best = EVENTS[0];
  let bestScore = Infinity;
  for (const e of EVENTS) {
    const score = Math.abs(Math.log((yearNow - e[0] + 1) / (yearNow - dep + 1)));
    if (score < bestScore) { bestScore = score; best = e; }
  }
  const departureText = lightYears < 1
    ? 'meno di un anno fa'
    : dep > -20000 ? (dep < 0 ? `nel ${formatYear(dep)}` : `nel ${Math.round(dep)}`) : formatYear(dep);
  const mirror = lightYears < 30
    ? `Se qualcuno lì guardasse la Terra adesso, vedrebbe il ${Math.round(dep)}.`
    : `Un osservatore lì, puntando un telescopio sulla Terra, vedrebbe ${dep > -20000 ? 'il mondo del ' + formatYear(dep) : 'la Terra di ' + formatYear(dep)}.`;
  const timeline = Math.min(1, Math.log10(lightYears + 1) / Math.log10(13.8e9));
  return { lightYears, departureYear: dep, departureText, event: best[1], eventYear: best[0], mirror, timeline };
}

export function formatLightTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1).replace('.', ',')} secondi`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1).replace('.', ',')} minuti`;
  if (seconds < 86400 * 2) return `${(seconds / 3600).toFixed(1).replace('.', ',')} ore`;
  return `${(seconds / 86400).toFixed(1).replace('.', ',')} giorni`;
}
