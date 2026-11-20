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

**Navicella**
- Puoi posizionarla ovunque: in orbita terrestre, vicino ai pianeti, su Proxima Centauri, Sirio, Betelgeuse, le Pleiadi, la Nebulosa di Orione, sopra la Via Lattea o su Andromeda.
- La manetta va da 1 km/s fino a 0,9999 c con effetti relativistici reali: aberrazione, effetto Doppler e dilatazione del tempo. Oltre c'è un "motore a curvatura" fino a 10¹² volte la luce.
- Il pilota automatico ("Vai a") porta verso qualsiasi oggetto. I pianeti sono procedurali (la Terra ha continenti, nuvole e luci delle città), Saturno ha gli anelli e le stelle vicine diventano veri soli.

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

## Trasformarla in app

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init Vastity it.vastity.app --web-dir dist
npm run build && npx cap add ios && npx cap add android && npx cap sync
```

Con `@capacitor/local-notifications` gli avvisi diventano notifiche di sistema anche ad app chiusa.

## Crediti e licenze dei dati

- Stelle: [HYG Database](https://codeberg.org/astronexus/hyg) v4.1, CC BY-SA 4.0
- Costellazioni e Messier: [d3-celestial](https://github.com/ofrohn/d3-celestial), BSD-3-Clause
- Calcoli: [Astronomy Engine](https://github.com/cosinekitty/astronomy), MIT; [satellite.js](https://github.com/shashwatak/satellite-js), MIT
- Meteo: [Open-Meteo](https://open-meteo.com); orbite ISS: [CelesTrak](https://celestrak.org)
