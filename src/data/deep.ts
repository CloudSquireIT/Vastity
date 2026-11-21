// Catalogo curato di oggetti notevoli oltre alle stelle HYG e al catalogo di Messier,
// organizzato come le "Lists of astronomical objects" di Wikipedia: buchi neri, quasar,
// stelle di neutroni, ammassi, nebulose, resti di supernova, galassie, stelle estreme.
// Coordinate J2000 (gradi), distanze e dimensioni in anni luce da cataloghi standard.
import { tx } from '../i18n';

export type DeepType = 'galaxy' | 'blackhole' | 'quasar' | 'pulsar' | 'gc' | 'oc' | 'nebula' | 'pn' | 'snr';
export type GalaxyShape = 'spiral' | 'barred' | 'elliptical' | 'lenticular' | 'irregular' | 'ring';

export interface GalaxyLook { shape: GalaxyShape; incl: number; pa: number; arms?: number; tint?: [number, number, number] }

export interface DeepObject {
  id: string;
  name: string;
  type: DeepType;
  ra: number;
  dec: number;
  ly: number;
  /** Raggio visibile in anni luce (per l'arrivo e i render 3D). */
  radiusLy: number;
  desc: string;
  mass?: string;
  galaxy?: GalaxyLook;
  /** Luminosità relativa del render (galassie nane più deboli). */
  bright?: number;
  /** Se l'oggetto coincide con un oggetto di Messier già presente. */
  messier?: string;
}

/** Stelle estreme assenti dal catalogo HYG, aggiunte al catalogo stellare. */
export interface ExtraStar { name: string; desig: string; ra: number; dec: number; ly: number; absmag: number; temp: number; spect: string }

export const EXTRA_STARS: ExtraStar[] = [
  { name: 'UY Scuti', desig: 'BD-12 5055', ra: 276.2627, dec: -12.4614, ly: 5900, absmag: -6.2, temp: 3365, spect: 'M4Ia' },
  { name: 'VY Canis Majoris', desig: 'HD 58061', ra: 110.743, dec: -25.7676, ly: 3840, absmag: -8.5, temp: 3490, spect: 'M3-M4.5' },
  { name: 'Eta Carinae', desig: 'HD 93308', ra: 161.265, dec: -59.6845, ly: 7500, absmag: -8.6, temp: 20000, spect: 'LBV' },
  { name: 'R136a1', desig: 'RMC 136a1', ra: 84.6758, dec: -69.101, ly: 163000, absmag: -7.6, temp: 46000, spect: 'WN5h' },
  { name: 'Stephenson 2-18', desig: 'St2-18', ra: 279.76, dec: -6.086, ly: 19000, absmag: -7.5, temp: 3200, spect: 'M6' },
  { name: 'Mu Cephei', desig: 'μ Cep', ra: 325.877, dec: 58.78, ly: 3060, absmag: -7.6, temp: 3750, spect: 'M2Ia' },
  { name: 'WR 104', desig: 'Wolf-Rayet 104', ra: 271.2525, dec: -23.8061, ly: 8000, absmag: -5.5, temp: 45000, spect: 'WC9d' },
];

const G = (shape: GalaxyShape, incl: number, pa: number, arms = 2, tint?: [number, number, number]): GalaxyLook => ({ shape, incl, pa, arms, tint });

export function deepCatalog(): DeepObject[] {
  return [
    // --- buchi neri -------------------------------------------------------
    { id: 'sgra', name: 'Sagittarius A*', type: 'blackhole', ra: 266.4168, dec: -29.0078, ly: 26670, radiusLy: 0.02, mass: '4,3 × 10⁶ M☉',
      desc: tx('Il buco nero supermassiccio al centro della Via Lattea, fotografato nel 2022.', 'The supermassive black hole at the centre of the Milky Way, imaged in 2022.', 'Le trou noir supermassif au centre de la Voie lactée, photographié en 2022.') },
    { id: 'm87bh', name: 'M87*', type: 'blackhole', ra: 187.7059, dec: 12.3911, ly: 53.5e6, radiusLy: 0.5, mass: '6,5 × 10⁹ M☉',
      desc: tx('Il primo buco nero mai fotografato (2019), nel cuore della galassia M87.', 'The first black hole ever imaged (2019), at the heart of the galaxy M87.', 'Le premier trou noir jamais photographié (2019), au cœur de la galaxie M87.') },
    { id: 'cygx1', name: 'Cygnus X-1', type: 'blackhole', ra: 299.5903, dec: 35.2016, ly: 7240, radiusLy: 0.002, mass: '21 M☉',
      desc: tx('Il primo buco nero scoperto: divora una supergigante blu compagna.', 'The first black hole discovered: it feeds on a blue supergiant companion.', 'Le premier trou noir découvert : il dévore une supergéante bleue compagne.') },
    { id: 'gaiabh1', name: 'Gaia BH1', type: 'blackhole', ra: 262.1713, dec: -0.5809, ly: 1560, radiusLy: 0.001, mass: '9,6 M☉',
      desc: tx('Il buco nero più vicino alla Terra conosciuto, scoperto da Gaia nel 2022.', 'The closest known black hole to Earth, found by Gaia in 2022.', 'Le trou noir connu le plus proche de la Terre, découvert par Gaia en 2022.') },
    { id: 'gaiabh3', name: 'Gaia BH3', type: 'blackhole', ra: 294.831, dec: 14.932, ly: 1926, radiusLy: 0.001, mass: '33 M☉',
      desc: tx('Il buco nero stellare più massiccio della nostra galassia.', 'The most massive stellar black hole in our galaxy.', 'Le trou noir stellaire le plus massif de notre galaxie.') },
    { id: 'v404', name: 'V404 Cygni', type: 'blackhole', ra: 306.0159, dec: 33.8672, ly: 7800, radiusLy: 0.002, mass: '9 M☉',
      desc: tx('Un buco nero che strappa materia a una stella e si accende in violente esplosioni.', 'A black hole that strips matter from a star and flares in violent outbursts.', 'Un trou noir qui arrache de la matière à une étoile et s\'embrase en violents sursauts.') },
    // --- quasar ---------------------------------------------------------
    { id: 'ton618', name: 'TON 618', type: 'quasar', ra: 187.1038, dec: 31.477, ly: 10.4e9, radiusLy: 2, mass: '4 × 10¹⁰ M☉',
      desc: tx('Uno dei buchi neri più massicci conosciuti: il suo quasar brilla come 140.000 miliardi di Soli.', 'One of the most massive black holes known: its quasar shines like 140 trillion Suns.', 'L\'un des trous noirs les plus massifs connus : son quasar brille comme 140 000 milliards de Soleils.') },
    { id: '3c273', name: '3C 273', type: 'quasar', ra: 187.2779, dec: 2.0524, ly: 2.44e9, radiusLy: 1, mass: '8,9 × 10⁸ M☉',
      desc: tx('Il primo quasar identificato e il più luminoso visto dalla Terra, con un getto lungo 200.000 anni luce.', 'The first quasar identified and the brightest seen from Earth, with a 200,000-light-year jet.', 'Le premier quasar identifié et le plus brillant vu de la Terre, avec un jet de 200 000 années-lumière.') },
    // --- stelle di neutroni ---------------------------------------------
    { id: 'crabpsr', name: tx('Pulsar del Granchio', 'Crab Pulsar', 'Pulsar du Crabe'), type: 'pulsar', ra: 83.6332, dec: 22.0145, ly: 6500, radiusLy: 0.05,
      desc: tx('Il cuore della Nebulosa del Granchio: una stella di neutroni che ruota 30 volte al secondo.', 'The heart of the Crab Nebula: a neutron star spinning 30 times a second.', 'Le cœur de la nébuleuse du Crabe : une étoile à neutrons qui tourne 30 fois par seconde.') },
    { id: 'velapsr', name: tx('Pulsar delle Vele', 'Vela Pulsar', 'Pulsar de Vela'), type: 'pulsar', ra: 128.8358, dec: -45.1764, ly: 959, radiusLy: 0.05,
      desc: tx('Una delle pulsar più luminose, resto di una supernova di 11.000 anni fa.', 'One of the brightest pulsars, left by a supernova 11,000 years ago.', 'L\'un des pulsars les plus brillants, vestige d\'une supernova d\'il y a 11 000 ans.') },
    { id: 'psr1919', name: 'PSR B1919+21', type: 'pulsar', ra: 290.4367, dec: 21.884, ly: 2283, radiusLy: 0.05,
      desc: tx('La prima pulsar scoperta (1967): all\'inizio i suoi impulsi furono chiamati "LGM-1", "omini verdi".', 'The first pulsar discovered (1967): its pulses were first nicknamed "LGM-1", little green men.', 'Le premier pulsar découvert (1967) : ses impulsions furent d\'abord surnommées « LGM-1 », petits hommes verts.') },
    { id: 'sgr1806', name: 'SGR 1806-20', type: 'pulsar', ra: 272.1638, dec: -20.411, ly: 42400, radiusLy: 0.05,
      desc: tx('Una magnetar: il suo campo magnetico è un milione di miliardi di volte quello terrestre.', 'A magnetar: its magnetic field is a quadrillion times Earth\'s.', 'Un magnétar : son champ magnétique est un million de milliards de fois celui de la Terre.') },
    { id: 'geminga', name: 'Geminga', type: 'pulsar', ra: 98.4756, dec: 17.7703, ly: 815, radiusLy: 0.05,
      desc: tx('Una pulsar vicina e silenziosa nelle onde radio, scoperta nei raggi gamma.', 'A nearby pulsar that is quiet in radio waves, discovered in gamma rays.', 'Un pulsar proche et silencieux en ondes radio, découvert en rayons gamma.') },
    // --- ammassi --------------------------------------------------------
    { id: 'omegacen', name: 'Omega Centauri', type: 'gc', ra: 201.697, dec: -47.4795, ly: 17090, radiusLy: 86,
      desc: tx('Il più grande ammasso globulare della Via Lattea: 10 milioni di stelle, forse il nucleo di una galassia inghiottita.', 'The largest globular cluster in the Milky Way: 10 million stars, perhaps the core of a swallowed galaxy.', 'Le plus grand amas globulaire de la Voie lactée : 10 millions d\'étoiles, peut-être le cœur d\'une galaxie avalée.') },
    { id: '47tuc', name: '47 Tucanae', type: 'gc', ra: 6.0236, dec: -72.0813, ly: 14700, radiusLy: 60,
      desc: tx('Un ammasso globulare splendido, visibile a occhio nudo dall\'emisfero sud.', 'A splendid globular cluster, visible to the naked eye from the southern hemisphere.', 'Un splendide amas globulaire, visible à l\'œil nu depuis l\'hémisphère sud.') },
    { id: 'm13c', name: tx('Grande Ammasso di Ercole', 'Great Hercules Cluster', 'Grand amas d\'Hercule'), type: 'gc', ra: 250.4235, dec: 36.4613, ly: 22200, radiusLy: 84, messier: 'M13',
      desc: tx('Circa 300.000 stelle antichissime; nel 1974 gli fu inviato il messaggio di Arecibo.', 'About 300,000 ancient stars; the Arecibo message was beamed towards it in 1974.', 'Environ 300 000 étoiles très anciennes ; le message d\'Arecibo lui fut envoyé en 1974.') },
    { id: 'hyades', name: tx('Iadi', 'Hyades', 'Hyades'), type: 'oc', ra: 66.75, dec: 15.87, ly: 153, radiusLy: 10,
      desc: tx('L\'ammasso aperto più vicino al Sole, che disegna la "V" del Toro.', 'The open cluster closest to the Sun, forming the "V" of Taurus.', 'L\'amas ouvert le plus proche du Soleil, qui dessine le « V » du Taureau.') },
    { id: 'doublec', name: tx('Doppio Ammasso del Perseo', 'Double Cluster', 'Double amas de Persée'), type: 'oc', ra: 34.75, dec: 57.13, ly: 7500, radiusLy: 35,
      desc: tx('Due ammassi giovani affiancati, spettacolari al binocolo.', 'Two young clusters side by side, spectacular in binoculars.', 'Deux jeunes amas côte à côte, spectaculaires aux jumelles.') },
    // --- nebulose -------------------------------------------------------
    { id: 'tarantula', name: tx('Nebulosa Tarantola', 'Tarantula Nebula', 'Nébuleuse de la Tarentule'), type: 'nebula', ra: 84.6767, dec: -69.1009, ly: 160000, radiusLy: 300,
      desc: tx('La più grande fabbrica di stelle del Gruppo Locale, nella Grande Nube di Magellano.', 'The largest stellar nursery in the Local Group, in the Large Magellanic Cloud.', 'La plus grande pouponnière d\'étoiles du Groupe local, dans le Grand Nuage de Magellan.') },
    { id: 'carina', name: tx('Nebulosa della Carena', 'Carina Nebula', 'Nébuleuse de la Carène'), type: 'nebula', ra: 161.27, dec: -59.87, ly: 7500, radiusLy: 120,
      desc: tx('Una nube immensa di gas che ospita Eta Carinae, una stella prossima a esplodere.', 'A vast gas cloud hosting Eta Carinae, a star close to exploding.', 'Un immense nuage de gaz qui abrite Eta Carinae, une étoile proche d\'exploser.') },
    { id: 'helix', name: tx('Nebulosa Elica', 'Helix Nebula', 'Nébuleuse de l\'Hélice'), type: 'pn', ra: 337.41, dec: -20.84, ly: 655, radiusLy: 1.4,
      desc: tx('Soprannominata "Occhio di Dio": il guscio espulso da una stella simile al Sole.', 'Nicknamed the "Eye of God": the shell shed by a Sun-like star.', 'Surnommée « l\'Œil de Dieu » : l\'enveloppe rejetée par une étoile semblable au Soleil.') },
    { id: 'catseye', name: tx('Nebulosa Occhio di Gatto', 'Cat\'s Eye Nebula', 'Nébuleuse de l\'Œil de chat'), type: 'pn', ra: 269.6392, dec: 66.6331, ly: 3300, radiusLy: 0.4,
      desc: tx('Una delle nebulose planetarie più complesse: gusci concentrici e getti.', 'One of the most intricate planetary nebulae: concentric shells and jets.', 'L\'une des nébuleuses planétaires les plus complexes : coquilles concentriques et jets.') },
    { id: 'butterfly', name: tx('Nebulosa Farfalla', 'Butterfly Nebula', 'Nébuleuse du Papillon'), type: 'pn', ra: 258.435, dec: -37.1033, ly: 3400, radiusLy: 1.5,
      desc: tx('Due ali di gas a 20.000 °C attorno a una delle stelle più calde conosciute.', 'Two wings of 20,000 °C gas around one of the hottest stars known.', 'Deux ailes de gaz à 20 000 °C autour de l\'une des étoiles les plus chaudes connues.') },
    { id: 'bubble', name: tx('Nebulosa Bolla', 'Bubble Nebula', 'Nébuleuse de la Bulle'), type: 'nebula', ra: 350.2, dec: 61.2, ly: 7100, radiusLy: 5,
      desc: tx('Una bolla soffiata dal vento di una stella 40 volte più massiccia del Sole.', 'A bubble blown by the wind of a star 40 times the Sun\'s mass.', 'Une bulle soufflée par le vent d\'une étoile 40 fois plus massive que le Soleil.') },
    { id: 'horsehead', name: tx('Nebulosa Testa di Cavallo', 'Horsehead Nebula', 'Nébuleuse de la Tête de Cheval'), type: 'nebula', ra: 85.25, dec: -2.46, ly: 1375, radiusLy: 3.5,
      desc: tx('Una nube di polvere scura a forma di testa di cavallo davanti a un gas rosso.', 'A dark dust cloud shaped like a horse\'s head against glowing red gas.', 'Un nuage de poussière sombre en forme de tête de cheval devant un gaz rouge.') },
    { id: 'veil', name: tx('Nebulosa Velo', 'Veil Nebula', 'Dentelles du Cygne'), type: 'snr', ra: 312.75, dec: 30.7, ly: 2400, radiusLy: 50,
      desc: tx('I filamenti di una supernova esplosa circa 10.000 anni fa.', 'The filaments of a supernova that exploded about 10,000 years ago.', 'Les filaments d\'une supernova qui a explosé il y a environ 10 000 ans.') },
    { id: 'casa', name: 'Cassiopeia A', type: 'snr', ra: 350.85, dec: 58.815, ly: 11000, radiusLy: 5,
      desc: tx('Il resto di supernova più giovane della galassia: la sua luce arrivò sulla Terra intorno al 1680.', 'The youngest supernova remnant in the galaxy: its light reached Earth around 1680.', 'Le plus jeune vestige de supernova de la galaxie : sa lumière a atteint la Terre vers 1680.') },
    // --- galassie -------------------------------------------------------
    { id: 'milkyway', name: tx('Via Lattea', 'Milky Way', 'Voie lactée'), type: 'galaxy', ra: 266.4051, dec: -28.9362, ly: 26670, radiusLy: 52000,
      desc: tx('La nostra galassia: una spirale barrata con 100-400 miliardi di stelle. Il Sole è in un braccio minore, a 26.000 anni luce dal centro.', 'Our galaxy: a barred spiral with 100-400 billion stars. The Sun sits in a minor arm, 26,000 light years from the centre.', 'Notre galaxie : une spirale barrée de 100 à 400 milliards d\'étoiles. Le Soleil est dans un bras mineur, à 26 000 années-lumière du centre.'),
      galaxy: G('barred', 0, 0, 4) },
    { id: 'm31g', name: tx('Galassia di Andromeda', 'Andromeda Galaxy', 'Galaxie d\'Andromède'), type: 'galaxy', ra: 10.6847, dec: 41.2687, ly: 2537000, radiusLy: 110000, messier: 'M31',
      desc: tx('La galassia grande più vicina: tra 4,5 miliardi di anni si fonderà con la Via Lattea.', 'The nearest large galaxy: in 4.5 billion years it will merge with the Milky Way.', 'La grande galaxie la plus proche : dans 4,5 milliards d\'années, elle fusionnera avec la Voie lactée.'),
      galaxy: G('spiral', 77, 38, 2) },
    { id: 'm33g', name: tx('Galassia del Triangolo', 'Triangulum Galaxy', 'Galaxie du Triangle'), type: 'galaxy', ra: 23.4621, dec: 30.6599, ly: 2730000, radiusLy: 30000, messier: 'M33',
      desc: tx('La terza galassia del Gruppo Locale, una spirale ricca di regioni di formazione stellare.', 'The third galaxy of the Local Group, a spiral full of star-forming regions.', 'La troisième galaxie du Groupe local, une spirale riche en régions de formation d\'étoiles.'),
      galaxy: G('spiral', 55, 23, 2, [0.75, 0.85, 1]) },
    { id: 'lmc', name: tx('Grande Nube di Magellano', 'Large Magellanic Cloud', 'Grand Nuage de Magellan'), type: 'galaxy', ra: 80.894, dec: -69.756, ly: 163000, radiusLy: 7000,
      desc: tx('Una galassia satellite della Via Lattea, visibile a occhio nudo dall\'emisfero sud.', 'A satellite galaxy of the Milky Way, visible to the naked eye from the southern hemisphere.', 'Une galaxie satellite de la Voie lactée, visible à l\'œil nu depuis l\'hémisphère sud.'),
      galaxy: G('irregular', 35, 170, 1) },
    { id: 'smc', name: tx('Piccola Nube di Magellano', 'Small Magellanic Cloud', 'Petit Nuage de Magellan'), type: 'galaxy', ra: 13.187, dec: -72.829, ly: 200000, radiusLy: 3500,
      desc: tx('La sorella minore della Grande Nube, deformata dalla gravità della Via Lattea.', 'The smaller sister of the Large Cloud, distorted by the Milky Way\'s gravity.', 'La petite sœur du Grand Nuage, déformée par la gravité de la Voie lactée.'),
      galaxy: G('irregular', 60, 45, 1) },
    // galassie nane del Gruppo Locale (raggi delle parti visibili; luminosità ridotta)
    ...([
      ['ngc185', 'NGC 185', 9.7415, 48.3374, 2.08e6, 4000, 'elliptical'],
      ['ngc147', 'NGC 147', 8.3005, 48.5087, 2.53e6, 5500, 'elliptical'],
      ['ngc6822', tx('Galassia di Barnard', 'Barnard\'s Galaxy', 'Galaxie de Barnard'), 296.2404, -14.8031, 1.63e6, 4500, 'irregular'],
      ['ic1613', 'IC 1613', 16.1992, 2.1178, 2.38e6, 6000, 'irregular'],
      ['ic10', 'IC 10', 5.0721, 59.3039, 2.2e6, 3500, 'irregular'],
      ['wlm', 'Wolf-Lundmark-Melotte', 0.4925, -15.461, 3.04e6, 5500, 'irregular'],
      ['leo1', tx('Nana del Leone I', 'Leo I Dwarf', 'Naine du Lion I'), 152.117, 12.3065, 820000, 2500, 'elliptical'],
      ['sagdeg', tx('Nana del Sagittario', 'Sagittarius Dwarf', 'Naine du Sagittaire'), 283.83, -30.545, 65000, 9000, 'elliptical'],
      ['fornaxd', tx('Nana della Fornace', 'Fornax Dwarf', 'Naine du Fourneau'), 39.997, -34.449, 460000, 4500, 'elliptical'],
      ['sculptord', tx('Nana dello Scultore', 'Sculptor Dwarf', 'Naine du Sculpteur'), 15.039, -33.709, 290000, 3000, 'elliptical'],
      ['pegdig', tx('Nana irregolare di Pegaso', 'Pegasus Dwarf Irregular', 'Naine irrégulière de Pégase'), 352.1512, 14.7431, 3.0e6, 3500, 'irregular'],
    ] as [string, string, number, number, number, number, string][]).map(([id, name, ra, dec, ly, r, shape], i): DeepObject => ({
      id, name, type: 'galaxy', ra, dec, ly, radiusLy: r, bright: shape === 'irregular' ? 0.75 : 0.55,
      desc: tx('Una galassia nana del Gruppo Locale, la "famiglia" di una cinquantina di galassie a cui appartiene la Via Lattea.',
        'A dwarf galaxy of the Local Group, the "family" of about fifty galaxies the Milky Way belongs to.',
        'Une galaxie naine du Groupe local, la « famille » d\'une cinquantaine de galaxies à laquelle appartient la Voie lactée.'),
      galaxy: G(shape as GalaxyShape, 30 + (i * 37) % 50, (i * 53) % 180, 1, shape === 'irregular' ? [0.8, 0.88, 1] : [1, 0.9, 0.78]),
    })),
    { id: 'm51g', name: tx('Galassia Vortice', 'Whirlpool Galaxy', 'Galaxie du Tourbillon'), type: 'galaxy', ra: 202.4696, dec: 47.1952, ly: 23e6, radiusLy: 38000, messier: 'M51',
      desc: tx('Una spirale perfetta vista di fronte, che interagisce con una galassia compagna.', 'A perfect face-on spiral interacting with a companion galaxy.', 'Une spirale parfaite vue de face, en interaction avec une galaxie compagne.'),
      galaxy: G('spiral', 20, 163, 2) },
    { id: 'm81g', name: tx('Galassia di Bode', 'Bode\'s Galaxy', 'Galaxie de Bode'), type: 'galaxy', ra: 148.8882, dec: 69.0653, ly: 11.8e6, radiusLy: 45000, messier: 'M81',
      desc: tx('Una grande spirale luminosa, tra le galassie più belle per i telescopi amatoriali.', 'A large bright spiral, among the finest galaxies for amateur telescopes.', 'Une grande spirale lumineuse, parmi les plus belles galaxies pour les télescopes amateurs.'),
      galaxy: G('spiral', 59, 157, 2) },
    { id: 'm82g', name: tx('Galassia Sigaro', 'Cigar Galaxy', 'Galaxie du Cigare'), type: 'galaxy', ra: 148.9685, dec: 69.6797, ly: 11.5e6, radiusLy: 20000, messier: 'M82',
      desc: tx('Una galassia "starburst" vista di taglio, che forma stelle a ritmo frenetico.', 'An edge-on starburst galaxy forming stars at a frantic pace.', 'Une galaxie à flambée d\'étoiles vue par la tranche, qui forme des étoiles à un rythme effréné.'),
      galaxy: G('irregular', 80, 65, 1, [1, 0.85, 0.75]) },
    { id: 'm101g', name: tx('Galassia Girandola', 'Pinwheel Galaxy', 'Galaxie du Moulinet'), type: 'galaxy', ra: 210.8023, dec: 54.3489, ly: 20.9e6, radiusLy: 85000, messier: 'M101',
      desc: tx('Una spirale enorme vista di fronte, quasi il doppio della Via Lattea.', 'A huge face-on spiral, almost twice the size of the Milky Way.', 'Une énorme spirale vue de face, presque deux fois plus grande que la Voie lactée.'),
      galaxy: G('spiral', 15, 40, 4) },
    { id: 'm104g', name: tx('Galassia Sombrero', 'Sombrero Galaxy', 'Galaxie du Sombrero'), type: 'galaxy', ra: 189.9976, dec: -11.6231, ly: 31.1e6, radiusLy: 25000, messier: 'M104',
      desc: tx('Vista quasi di taglio, con un grande rigonfiamento e una banda di polvere: ricorda un cappello messicano.', 'Seen almost edge-on, with a large bulge and a dust lane: it looks like a Mexican hat.', 'Vue presque par la tranche, avec un gros bulbe et une bande de poussière : elle rappelle un chapeau mexicain.'),
      galaxy: G('lenticular', 84, 90, 2, [1, 0.9, 0.75]) },
    { id: 'm87g', name: 'Virgo A (M87)', type: 'galaxy', ra: 187.7059, dec: 12.3911, ly: 53.5e6, radiusLy: 60000, messier: 'M87',
      desc: tx('Una galassia ellittica gigante con un getto di plasma lungo 5.000 anni luce.', 'A giant elliptical galaxy with a 5,000-light-year plasma jet.', 'Une galaxie elliptique géante avec un jet de plasma de 5 000 années-lumière.'),
      galaxy: G('elliptical', 30, 0, 0, [1, 0.88, 0.72]) },
    { id: 'm64g', name: tx('Galassia Occhio Nero', 'Black Eye Galaxy', 'Galaxie de l\'Œil noir'), type: 'galaxy', ra: 194.1821, dec: 21.6828, ly: 17.3e6, radiusLy: 27000, messier: 'M64',
      desc: tx('Una spirale con una spessa banda di polvere davanti al nucleo, come un occhio nero.', 'A spiral with a thick dust band in front of its core, like a black eye.', 'Une spirale avec une épaisse bande de poussière devant le noyau, comme un œil au beurre noir.'),
      galaxy: G('spiral', 60, 115, 2) },
    { id: 'cena', name: 'Centaurus A', type: 'galaxy', ra: 201.3651, dec: -43.0191, ly: 12e6, radiusLy: 30000,
      desc: tx('Una galassia gigante attraversata da una banda di polvere, residuo di una fusione tra galassie.', 'A giant galaxy crossed by a dust lane, the aftermath of a galaxy merger.', 'Une galaxie géante traversée par une bande de poussière, vestige d\'une fusion de galaxies.'),
      galaxy: G('lenticular', 70, 115, 2, [1, 0.88, 0.72]) },
    { id: 'ngc253', name: tx('Galassia dello Scultore', 'Sculptor Galaxy', 'Galaxie du Sculpteur'), type: 'galaxy', ra: 11.888, dec: -25.2883, ly: 11.4e6, radiusLy: 45000,
      desc: tx('Una spirale polverosa e luminosa, tra le più facili da osservare dopo Andromeda.', 'A bright, dusty spiral, among the easiest to observe after Andromeda.', 'Une spirale brillante et poussiéreuse, parmi les plus faciles à observer après Andromède.'),
      galaxy: G('spiral', 78, 52, 2) },
    { id: 'ngc1300', name: 'NGC 1300', type: 'galaxy', ra: 49.9208, dec: -19.4111, ly: 61e6, radiusLy: 55000,
      desc: tx('L\'esempio da manuale di spirale barrata.', 'The textbook example of a barred spiral.', 'L\'exemple type de la spirale barrée.'),
      galaxy: G('barred', 35, 106, 2) },
    { id: 'cartwheel', name: tx('Galassia Ruota di Carro', 'Cartwheel Galaxy', 'Galaxie de la Roue de chariot'), type: 'galaxy', ra: 9.421, dec: -33.716, ly: 500e6, radiusLy: 75000,
      desc: tx('Un anello di stelle nato dall\'urto con una galassia più piccola che l\'ha attraversata.', 'A ring of stars created when a smaller galaxy plunged through it.', 'Un anneau d\'étoiles né de la traversée d\'une galaxie plus petite.'),
      galaxy: G('ring', 40, 20, 0) },
    { id: 'hoag', name: tx('Oggetto di Hoag', 'Hoag\'s Object', 'Objet de Hoag'), type: 'galaxy', ra: 229.31, dec: 21.585, ly: 600e6, radiusLy: 60000,
      desc: tx('Un anello quasi perfetto di stelle blu attorno a un nucleo giallo: la sua origine è ancora un mistero.', 'An almost perfect ring of blue stars around a yellow core: its origin is still a mystery.', 'Un anneau presque parfait d\'étoiles bleues autour d\'un noyau jaune : son origine reste un mystère.'),
      galaxy: G('ring', 10, 0, 0, [0.7, 0.8, 1]) },
    { id: 'antennae', name: tx('Galassie Antenne', 'Antennae Galaxies', 'Galaxies des Antennes'), type: 'galaxy', ra: 180.4708, dec: -18.8675, ly: 45e6, radiusLy: 25000,
      desc: tx('Due galassie in piena collisione, con lunghe code di stelle che sembrano antenne.', 'Two galaxies in full collision, with long tails of stars like antennae.', 'Deux galaxies en pleine collision, avec de longues queues d\'étoiles comme des antennes.'),
      galaxy: G('irregular', 30, 0, 2, [1, 0.8, 0.85]) },
    { id: 'ic1101', name: 'IC 1101', type: 'galaxy', ra: 227.734, dec: 5.745, ly: 1.04e9, radiusLy: 300000,
      desc: tx('Una delle galassie più grandi conosciute: un\'ellittica gigante al centro di un ammasso.', 'One of the largest galaxies known: a giant elliptical at the heart of a cluster.', 'L\'une des plus grandes galaxies connues : une elliptique géante au cœur d\'un amas.'),
      galaxy: G('elliptical', 50, 20, 0, [1, 0.88, 0.7]) },
  ];
}

export const DEEP_TYPE_NAME = (t: DeepType, g?: GalaxyLook): string => {
  switch (t) {
    case 'blackhole': return tx('Buco nero', 'Black hole', 'Trou noir');
    case 'quasar': return tx('Quasar', 'Quasar', 'Quasar');
    case 'pulsar': return tx('Stella di neutroni', 'Neutron star', 'Étoile à neutrons');
    case 'gc': return tx('Ammasso globulare', 'Globular cluster', 'Amas globulaire');
    case 'oc': return tx('Ammasso aperto', 'Open cluster', 'Amas ouvert');
    case 'nebula': return tx('Nebulosa', 'Nebula', 'Nébuleuse');
    case 'pn': return tx('Nebulosa planetaria', 'Planetary nebula', 'Nébuleuse planétaire');
    case 'snr': return tx('Resto di supernova', 'Supernova remnant', 'Rémanent de supernova');
    case 'galaxy':
      if (g?.shape === 'elliptical') return tx('Galassia ellittica', 'Elliptical galaxy', 'Galaxie elliptique');
      if (g?.shape === 'barred') return tx('Galassia spirale barrata', 'Barred spiral galaxy', 'Galaxie spirale barrée');
      if (g?.shape === 'irregular') return tx('Galassia irregolare', 'Irregular galaxy', 'Galaxie irrégulière');
      if (g?.shape === 'lenticular') return tx('Galassia lenticolare', 'Lenticular galaxy', 'Galaxie lenticulaire');
      if (g?.shape === 'ring') return tx('Galassia ad anello', 'Ring galaxy', 'Galaxie annulaire');
      return tx('Galassia spirale', 'Spiral galaxy', 'Galaxie spirale');
  }
};

let cache: DeepObject[] | null = null;
export const deepObjects = () => (cache ??= deepCatalog());
export const deepById = (id: string) => deepObjects().find((d) => d.id === id);
/** Oggetto profondo collegato a un oggetto di Messier (per riusare i render 3D). */
export const deepForMessier = (mid: string) => deepObjects().find((d) => d.messier === mid);
