# Changelog

Vastity è in sviluppo: la numerazione riparte da 0.5.0 (le build provvisorie 1.0.0 e 1.1.0 sono state ritirate).

## 0.5.8

- Android: le APK ora sono sempre firmate. La `-release.apk` usciva senza firma (manca la chiave del Play Store)
  e Android la rifiutava come «pacchetto non valido». Le build di prova usano una chiave di test fissa, quindi le
  prossime versioni si installano sopra la precedente senza disinstallare.

## 0.5.7

- Caricamento: niente più lampo dello sfondo. Le stelle si vedono come dalla Terra: scintillano, cambiano colore
  a lampi e si avvicinano lentamente; due stelle cadenti attraversano lo schermo dietro la scritta.
- Pinch più tollerante: contano anche le dita che finiscono su un'etichetta, un piccolo movimento non avvia il
  trascinamento, e un gesto a due dita non diventa mai un tocco né sposta la vista. All'inizio del pinch: un "tic"
  e il badge dello zoom.
- Missioni in alto a sinistra, sotto il luogo: compaiono con una dissolvenza alla fine del primo tutorial.
- Badge sbloccati: scheda compatta in vetro liquido, leggibile su qualsiasi sfondo.
- Achievement nelle Missioni: completamento totale 0–100% e avanzamento di ciascun obiettivo; nuovo «Cacciatore di
  missioni» e tre achievement segreti da scoprire.

## 0.5.6

- Tocchi più affidabili dopo lo zoom: se durante un pinch un dito "si perde" (esce dallo schermo o finisce su un
  pannello) i tocchi successivi non vengono più scambiati per un secondo dito, quindi funzionano subito.
- Pannelli: la scheda non resta più bloccata a metà trascinamento; toccare il cielo vuoto chiude il pannello aperto;
  deselezionare un oggetto chiude la sua scheda.
- Niente più zoom involontario della pagina (pinch su un pannello o doppio tocco) che spostava l'interfaccia.
- Cursore dello zoom e manetta non restano "agganciati" se il dito scivola via.

## 0.5.5

- Caricamento: niente più cerchio; le lettere V A S T I T Y si accendono una dopo l'altra e sono l'indicatore.
  Si entra quando la Y è accesa (4 secondi in tutto), con un campo di stelle che si avvicina.
- Terreni veri: quote NASA LOLA (Luna) e MOLA (Marte) per il paesaggio fino a ~600 km, con la curvatura del pianeta
  e i colori della mappa del pianeta. Nuovi luoghi in «Mondi»: Olympus Mons, Valles Marineris, Cratere Gale,
  Hadley-Apennino (Apollo 15), Cratere Tycho. Anche atterrando dalla navicella si vede il paesaggio reale del punto.
- Globi 3D di Luna e Marte con il rilievo vero (Olympus Mons, Valles Marineris, bacini e crateri), uguali in cielo e in
  navicella; corretto il rilievo "granuloso" della Luna nel cielo a forte ingrandimento.
- Filmato iniziale: una sola carrellata in avanti, senza riposizionamenti; Gruppo Locale popolato (Via Lattea e
  Andromeda affiancate, Triangolo, Nubi di Magellano e dodici galassie nane); sosta sul Sole; dal Sole alla Terra
  si passa di lato, senza attraversarlo.
- Selezione agganciata: l'oggetto resta selezionato chiudendo la scheda; ritoccarlo lo deseleziona. Ingrandendo,
  la vista si centra da sola sull'oggetto selezionato (anche in navicella sul bersaglio).
- Navicella: arrivando a ISS, telescopi, sonde e Tesla ci si ferma a meno di due volte la loro dimensione.

## 0.5.4

- Atterraggio dalla navicella (ispirato a SpaceEngine): vicino a Luna, Mercurio, Venere, Marte, Giove, Saturno o Plutone,
  «Atterra» fa scendere la navicella sulla verticale del punto sottostante e apre il cielo da lì, con latitudine e
  longitudine reali; vicino a Proxima Centauri, TRAPPIST-1 o Kepler-186 si atterra sul loro pianeta; vicino alla Terra
  si torna a casa. Durante la discesa orbite ed etichette si nascondono.
- Suolo procedurale per i mondi rocciosi (crateri, dune, ghiaccio, curvatura del pianeta, foschia) illuminato dal Sole
  vero; copre stelle ed etichette sotto l'orizzonte.
- Badge rotondo dello zoom in alto («8.0X») che appare solo quando ingrandisci tu.
- Puntatore giallo sul bordo dello schermo verso il bersaglio fuori campo.
- Scritta V A S T I T Y del caricamento animata (comparsa lettera per lettera e respiro), senza artefatti.

## 0.5.3

- Modelli 3D ufficiali NASA (pubblico dominio) per ISS, Hubble, James Webb e Voyager, in scala reale.
- Tesla Roadster con Starman: nuovo modello 3D (carrozzeria sagomata, vernice lucida, ruote), che ruota lentamente.
- Marcatore di selezione: di nuovo i quattro angoli del riquadro, più sottili e minimali.
- Caricamento: scritta V A S T I T Y grande e centrata entro i margini sicuri, senza effetti per lettera; menu nascosti.
- Dock: torna in vetro HTML su tutti i dispositivi (reagisce allo sfondo) e sfuma via quando si apre un pannello;
  il tutorial sta sempre sopra a tutto e la sua scheda non scorre più.

## 0.5.2

- Triangolo di selezione bianco e sottile, come il riquadro di prima.
- La posizione torna facoltativa: senza, si usa il cielo di Roma.

## 0.5.1

- Marcatore di selezione: triangolo che ruota e racchiude sempre l'oggetto (cielo e navicella).
- Caricamento di almeno 2 secondi con la scritta V A S T I T Y; menu nascosti durante il caricamento.
- Tutorial fermo al centro, sopra tutto; durante il tutorial il dock nativo lascia il posto a quello evidenziato.
- ISS raggiungibile con la navicella («Vola fin lì»); immagini dedicate per ISS, Tesla Roadster, Hubble, James Webb e sonde;
  sonde e Tesla visibili anche nel cielo quando si ingrandisce.
- Ricerca: suggerimenti su una riga scorrevole, tastiera solo toccando la barra; in navicella una sola lente (nel dock).
- Niente selezione del testo nelle schede (bloccava lo scorrimento su iPhone).
- Filmato iniziale più fluido (velocità continua, camera senza scatti).
- Le notifiche si chiedono solo quando le attivi tu.

## 0.5.0

- Benvenuto al primo avvio con i permessi spiegati uno alla volta (posizione nativa: niente più richiesta «localhost»).
- Corretto il blocco dopo il filmato su iPhone (tutorial invisibile che catturava i tocchi); dopo il filmato: tutorial
  dell'interfaccia saltabile e poi tutorial delle missioni.
- Caricamento con la scritta V A S T I T Y sempre leggibile.
- Marcatore a lineette rotanti, eclittica tratteggiata, lune dei pianeti con orbite e scie, satelliti col loro percorso.
- In navicella: lune in 3D con le orbite reali (JPL), ISS, Tiangong, Hubble, James Webb, Tesla Roadster, Voyager 1 e 2,
  New Horizons in tempo reale; la navicella accompagna gli oggetti in movimento (si può "visitare" la ISS).
- Tocchi più precisi: un oggetto piccolo toccato con precisione vince, altrimenti il disco più vicino; mai la Via Lattea da dentro.
- Icona ufficiale (Saturno a linea) in quattro stili, cambiabile dalle impostazioni su iPhone; ingranaggio nuovo.
- Dock in vero vetro liquido su iOS 26 (tieni premuto e trascina); effetto lente anche su web e Android.
- Modulo «Segnala un problema o suggerisci un'idea».

## Build provvisorie ritirate (1.1.0)

- Bussola e giroscopio corretti su iPhone, anche nell'app nativa e con il telefono in orizzontale.
- Apertura cinematografica al primo avvio, dallo spazio profondo al cielo di casa tua (rivedibile dalle impostazioni).
- Prima missione guidata «Primo viaggio»: dalla Luna a Saturno, fino a uscire dalla galassia.
- Musica ambientale composta in tempo reale e una ventina di effetti sonori; interruttore per la musica.
- Racconti per circa 60 oggetti famosi e quattro tour narrati con la navicella, nelle tre lingue.
- «Da non perdere nei prossimi 30 giorni» nella sezione Stasera.
- Nuovo marchio: simbolo, wordmark e combinazioni.
- Precisione verificata con NASA/JPL Horizons: scarto massimo 16″ (docs/ACCURACY.md).
- App nativa più leggera (15 MB): le texture 4K arrivano dal sito solo con qualità Ultra.
- Aggiornamento mensile dei dati senza server; testi dei permessi iOS in it/en/fr; VoiceOver e TalkBack.
- Meteo: la posizione inviata è arrotondata a circa 10 km.

## Build provvisorie ritirate (1.0.0)

- Cielo in tempo reale da qualsiasi luogo della Terra e da altri mondi, con 52.000 stelle, 88 costellazioni,
  Via Lattea fotografica, pianeti 3D, giorno/notte e cielo notturno sotto l'orizzonte.
- Navicella: viaggio libero fino e oltre la velocità della luce, pilota automatico, teletrasporto,
  relatività, galassie con foto reali, buchi neri, pulsar, quasar, nebulose e ammassi.
- 6.438 esopianeti confermati (NASA) con render 3D generati dai dati reali.
- Cataloghi Messier e Caldwell completi, ricerca con categorie e ordinamento.
- "Stasera vale la pena?", viaggio della luce, missioni con badge, diario, avvisi (ISS, meteore, eclissi).
- Macchina del tempo, zoom fino a ×230, qualità grafica regolabile, modalità notte e accessibilità.
- Italiano, inglese, francese. Funziona offline. App per iOS e Android (Capacitor).
