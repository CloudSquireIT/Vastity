# Vastity

Web app (PWA) per esplorare il cielo in tempo reale e viaggiare nello spazio in full immersion.
È pensata per diventare un'app iOS/Android con Capacitor senza riscrivere il codice.

## Funzionalità

**Cielo in tempo reale**
- Circa 15.000 stelle reali (catalogo HYG) con posizione 3D, colore e luminosità, insieme a pianeti, Luna con le fasi, Sole, ISS, 88 costellazioni e 110 oggetti di Messier.
- Atmosfera dinamica (alba, giorno, crepuscolo), inquinamento luminoso (scala di Bortle) e Via Lattea generata da particelle.
- Trascinamento con inerzia, zoom con pinch, giroscopio ("punta il telefono"), realtà aumentata con la fotocamera e modalità notte rossa.
- Macchina del tempo: trascina la pillola dell'orario per scorrere il cielo come un film.
- L'interfaccia sparisce dopo qualche secondo per lasciare spazio solo al cielo.

**Idee innovative**
1. **Stasera vale la pena?** Dà un punteggio da 0 a 100 alla serata combinando meteo reale (Open-Meteo), Luna, buio e inquinamento luminoso. Mostra l'andamento della notte, l'ora migliore e cosa guardare.
2. **Viaggio della luce.** Per ogni stella indica quando è partita la luce che vedi e cosa succedeva sulla Terra in quel periodo. Mostra anche cosa vedrebbe della Terra chi si trovasse lì oggi.
4. **Il cielo da altri mondi.** Puoi osservare dalla Luna, da Mercurio, Venere, Marte, Giove, Saturno e Plutone, o dagli esopianeti Proxima b, TRAPPIST-1e e Kepler-186f. Le stelle sono in 3D, quindi le costellazioni si deformano e il Sole diventa una stella come le altre.
5. **Caccia al tesoro celeste.** Ogni giorno propone missioni basate su ciò che è visibile dalla tua posizione. Si completano tenendo l'oggetto nel mirino (col giroscopio valgono doppio). Ci sono 13 badge, livelli e un diario delle osservazioni.
6. **Viste condivise.** Per ora è un link che riapre lo stesso cielo, alla stessa ora e nella stessa direzione. L'osservazione di gruppo in diretta richiederà un piccolo server.
9. **Avvisi intelligenti.** Copre passaggi della ISS, sciami di meteore, congiunzioni, opposizioni, elongazioni, eclissi e fasi lunari, tutti incrociati con il meteo. Le notifiche arrivano mentre l'app è aperta, e c'è l'esportazione nel calendario (.ics) per promemoria affidabili.

**Grafica e movimento**
- Texture reali per pianeti, Luna e Sole (Terra con notte, luci delle città, nuvole che si muovono e oceani che riflettono il Sole), atmosfere luminose, anelli di Saturno con l'ombra del pianeta.
- Via Lattea volumetrica con polveri scure, regioni di formazione stellare e nucleo luminoso, che ruota lentamente vista da fuori. Nebulose 3D da attraversare.
- Qualità adattiva: risoluzione e dettaglio si regolano sul dispositivo per restare fluidi anche a 120 Hz.
- Interfaccia in stile liquid glass, etichette leggibili e toccabili, tutorial iniziale.

**Navicella**
- Puoi posizionarla ovunque: in orbita terrestre, vicino ai pianeti, su Proxima Centauri, Sirio, Betelgeuse, le Pleiadi, la Nebulosa di Orione, sopra la Via Lattea o su Andromeda.
- La manetta va da 1 km/s fino a 0,9999 c con effetti relativistici reali: aberrazione, effetto Doppler e dilatazione del tempo. Oltre c'è un "motore a curvatura" fino a 10¹² volte la luce.
- Il pilota automatico ("Vai a") porta verso qualsiasi oggetto. I pianeti sono procedurali (la Terra ha continenti, nuvole e luci delle città), Saturno ha gli anelli e le stelle vicine diventano veri soli.

## Lingue

L'interfaccia è in **italiano, inglese e francese**. La lingua si sceglie automaticamente da quella del dispositivo e si può cambiare in Impostazioni → Lingua. Sono tradotti anche i nomi di stelle, costellazioni e galassie, le descrizioni, gli eventi storici del "Viaggio della luce", missioni, badge e avvisi.

Per aggiungere una lingua: estendi `Lang` in `src/i18n.ts` e aggiungi il testo nelle chiamate `tx(it, en, fr)`.

## Sviluppo

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # produzione in dist/
npm run data      # rigenera public/data/ dai cataloghi originali
```

Controlli da tastiera nella navicella: `W`/`S` per la manetta, `A`/`D` e le frecce per girare, `Q`/`E` per il rollio, `Spazio` per fermarsi.

## Struttura

```
src/
  astro/astro.ts        calcoli astronomici, luoghi di osservazione, esopianeti
  data/catalog.ts       caricamento dei cataloghi
  render/               stelle e Via Lattea (shader con relatività), dischi dei corpi, pianeti procedurali
  sky/SkyView.ts        vista Cielo
  space/ShipView.ts     vista Navicella
  features/             stasera, viaggio della luce, missioni, avvisi, ISS, meteo, ricerca
  ui/                   pannelli, icone, gestione touch
scripts/build-data.mjs  conversione dei cataloghi in JSON compatto
```

## Qualità grafica

In **Impostazioni → Grafica** uno slider sceglie la qualità: *Automatica* (in base al dispositivo), Bassa, Media, Alta, **Massima** (tutto al massimo, senza riduzioni automatiche).
In automatico un regolatore abbassa la risoluzione e, se serve, spegne gli effetti più costosi quando il dispositivo fatica.
Per test e assistenza: `?q=low|mid|high|ultra` nell'indirizzo.

## Test su più dispositivi

```bash
npm run build && npx vite preview --port 4173 &
npm run test:devices        # = node tests/device-check.mjs http://localhost:4173/ test-results/devices
```

Apre l'app con profili iPhone, Pixel, iPad e desktop × qualità (auto, alta, massima), visita cielo di notte e di giorno,
Via Lattea, Andromeda e Saturno, salva gli screenshot e fallisce se ci sono errori o zone trasparenti nel canvas.
WebKit e Firefox vengono usati se installati (`npx playwright install webkit firefox`).

## Offline

Il service worker (`public/sw.js`) salva all'installazione il "guscio" elencato in `dist/precache.json` (generato dalla build)
e conserva texture e foto alla prima visualizzazione: dopo il primo utilizzo l'app funziona senza rete (meteo e orbita ISS a parte).

## App nativa (iOS / Android)

Capacitor è già configurato (`capacitor.config.ts`, plugin haptics, notifiche locali, sensori di movimento):

```bash
npm i -D @capacitor/ios @capacitor/android
npm run build && npx cap add ios && npx cap add android
npm run cap:sync            # dopo ogni modifica
npx cap open ios            # Xcode (serve un Mac) · npx cap open android
```

Nell'app nativa: vibrazioni del Taptic Engine, notifiche di sistema degli avvisi per 7 giorni (anche ad app chiusa),
bussola/giroscopio dai sensori nativi. Su iOS aggiungere in `Info.plist` la descrizione per l'uso dei sensori di movimento.

## Diagnostica

Gli errori (JavaScript, perdita del contesto WebGL) restano solo sul dispositivo; da **Impostazioni → Diagnostica**
si copia un rapporto anonimo (dispositivo, GPU, qualità, errori) da allegare a una segnalazione.

## Crediti e licenze dei dati

- Stelle: [HYG Database](https://codeberg.org/astronexus/hyg) v4.1, CC BY-SA 4.0
- Costellazioni e Messier: [d3-celestial](https://github.com/ofrohn/d3-celestial), BSD-3-Clause
- Calcoli: [Astronomy Engine](https://github.com/cosinekitty/astronomy), MIT; [satellite.js](https://github.com/shashwatak/satellite-js), MIT
- Meteo: [Open-Meteo](https://open-meteo.com); orbite ISS: [CelesTrak](https://celestrak.org)
- Foto nelle schede: NASA, ESA, ESO, Hubble via Wikimedia Commons (fonte di ogni immagine in `public/photos/credits.json`)
- Font: Inter, Space Grotesk, JetBrains Mono (SIL Open Font License) tramite Fontsource
- Texture di pianeti, Luna e Sole e panorama della Via Lattea: [Solar System Scope](https://www.solarsystemscope.com/textures/), CC BY 4.0, basate su dati NASA/ESO (convertite in WebP in 3 risoluzioni in `public/textures`)
- Esopianeti confermati (6.438): [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) (dati pubblici), `node scripts/build-exoplanets.mjs`; render 3D generati dai dati reali (raggio, temperatura)
- Foto reali delle galassie (66): solo immagini in pubblico dominio, CC0 o CC BY da Wikimedia Commons (NASA/ESA Hubble, Webb, ESO, NOIRLab…), elaborate con `python3 scripts/galaxy_photos.py`; elenco con autori e licenze in `public/data/galaxy-photos.json` e in Impostazioni
- Render delle galassie viste da fuori: foto di M101 (NASA/ESA Hubble), M83 (NOIRLab/CTIO), NGC 1300 (NASA/ESA Hubble) via Wikimedia Commons e illustrazione della Via Lattea di NASA/JPL-Caltech/R. Hurt, con stelle in primo piano rimosse (`public/textures/*/gal_*.webp`)
- Distanze del catalogo di Messier e catalogo Caldwell completo: [Wikipedia](https://en.wikipedia.org/wiki/Caldwell_catalogue), CC BY-SA 4.0 (`public/data/deepsky.json`, rigenerabile con `node scripts/wiki-catalog.mjs`)
