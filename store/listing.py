# Testi delle pagine store di Vastity in it/en/fr, scritti nel formato di fastlane:
#   fastlane/metadata/<lingua>/*.txt            (App Store, "deliver")
#   fastlane/metadata/android/<lingua>/*.txt    (Google Play, "supply")
# Uso: python3 store/listing.py  (controlla anche i limiti di lunghezza di ogni campo)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

L = {
 'it': dict(
  name='Vastity: cielo e spazio',
  subtitle='Esplora il cielo e lo spazio',
  promo="Punta il telefono al cielo e scopri cosa stai guardando, poi sali sulla navicella e vola fino ad Andromeda. Nuovi tour narrati tra stelle e buchi neri.",
  keywords='stelle,pianeti,astronomia,costellazioni,telescopio,luna,galassie,esopianeti,ISS,eclissi,universo',
  short="Il cielo di stanotte e una navicella per volare fino ai confini dell'universo.",
  whatsnew="Apertura cinematografica dallo spazio profondo fino al tuo cielo, missione guidata, tour narrati, racconti per gli oggetti più famosi, musica ambientale e bussola più precisa su iPhone.",
  desc="""Vastity è il cielo, vero e in tempo reale, e insieme una navicella per esplorarlo.

PUNTA IL TELEFONO AL CIELO
Alza il telefono: Vastity ti mostra stelle, pianeti, costellazioni e la Stazione Spaziale esattamente dove sono, sopra casa tua. Con la realtà aumentata li vedi sopra il cielo vero, ripreso dalla fotocamera.

VOLA OLTRE LA VELOCITÀ DELLA LUCE
Sali sulla navicella e decolla dalla tua città. Avvicinati agli anelli di Saturno, attraversa la Nebulosa di Orione, esci dalla Via Lattea per vederla dall'alto, raggiungi Andromeda o il buco nero al centro della galassia. Ogni viaggio è a scala reale.

STASERA VALE LA PENA?
Un punteggio da 0 a 100 per la notte che arriva: meteo, nuvole, Luna e cosa guardare, ora per ora. Avvisi per eclissi, piogge di stelle cadenti, congiunzioni e passaggi della ISS, anche da aggiungere al calendario.

IL VIAGGIO DELLA LUCE
Ogni scheda ti dice quando è partita la luce che stai vedendo e cosa succedeva sulla Terra in quel momento: dai faraoni ai dinosauri, fino al Big Bang.

STORIE, TOUR E MISSIONI
Racconti brevi per gli oggetti più famosi, tour narrati (il Sistema Solare, la vita delle stelle, il Gruppo Locale, i buchi neri), missioni quotidiane, badge e un diario delle tue osservazioni.

UN UNIVERSO INTERO
• Oltre 50.000 stelle, con i loro colori reali
• Tutti i 6.000 e più esopianeti confermati dalla NASA, con render generati dai dati
• Oggetti di Messier e Caldwell, nebulose, ammassi e galassie con foto reali
• Buchi neri, quasar e pulsar
• Il cielo visto da altri mondi: Marte, la Luna, le lune di Giove e i sistemi di altre stelle

PRECISO
Le posizioni di Sole, Luna e pianeti coincidono con le effemeridi NASA/JPL entro pochi secondi d'arco.

RISPETTA LA TUA PRIVACY
Nessun account, nessuna pubblicità, nessun tracciamento. La tua posizione resta sul telefono; per il meteo viene inviata solo una posizione approssimata (circa 10 km).

Funziona anche offline. In italiano, inglese e francese.""",
 ),
 'en': dict(
  name='Vastity: Sky & Space',
  subtitle='Explore the sky and beyond',
  promo="Point your phone at the sky to see what you are looking at, then board the spaceship and fly to Andromeda. New narrated tours through stars and black holes.",
  keywords='stars,planets,astronomy,constellations,telescope,moon,galaxy,exoplanets,ISS,eclipse,universe',
  short="Tonight's real sky, plus a spaceship to fly to the edge of the universe.",
  whatsnew="A cinematic opening from deep space down to your own sky, a guided first mission, narrated tours, stories for the most famous objects, ambient music and a more accurate compass on iPhone.",
  desc="""Vastity is the real sky, live, and a spaceship to explore it.

POINT YOUR PHONE AT THE SKY
Raise your phone: Vastity shows stars, planets, constellations and the Space Station exactly where they are, above your home. With augmented reality you see them over the real sky through your camera.

FLY FASTER THAN LIGHT
Board the spaceship and take off from your city. Skim Saturn's rings, cross the Orion Nebula, leave the Milky Way to see it from above, reach Andromeda or the black hole at the heart of the galaxy. Every journey is at true scale.

IS TONIGHT WORTH IT?
A 0–100 score for the coming night: weather, clouds, the Moon and what to look at, hour by hour. Alerts for eclipses, meteor showers, conjunctions and ISS passes, ready to add to your calendar.

LIGHT'S JOURNEY
Every card tells you when the light you are seeing set off and what was happening on Earth at that moment: from the pharaohs to the dinosaurs, all the way back to the Big Bang.

STORIES, TOURS AND MISSIONS
Short stories for the most famous objects, narrated tours (the Solar System, the life of stars, the Local Group, black holes), daily missions, badges and a log of your observations.

A WHOLE UNIVERSE
• More than 50,000 stars in their true colours
• All 6,000+ exoplanets confirmed by NASA, with renders generated from the data
• Messier and Caldwell objects, nebulae, clusters and galaxies with real photos
• Black holes, quasars and pulsars
• The sky seen from other worlds: Mars, the Moon, Jupiter's moons and other star systems

ACCURATE
Positions of the Sun, Moon and planets match NASA/JPL ephemerides to within a few arcseconds.

RESPECTS YOUR PRIVACY
No account, no ads, no tracking. Your location stays on your phone; only an approximate position (about 10 km) is sent for the weather forecast.

Works offline. In English, Italian and French.""",
 ),
 'fr': dict(
  name='Vastity : ciel et espace',
  subtitle="Explorez le ciel et l'espace",
  promo="Pointez votre téléphone vers le ciel pour savoir ce que vous regardez, puis montez à bord du vaisseau jusqu'à Andromède. Nouveau : des visites guidées racontées.",
  keywords='étoiles,planètes,astronomie,constellations,télescope,lune,galaxies,exoplanètes,ISS,éclipse',
  short="Le vrai ciel de ce soir, et un vaisseau pour voler aux confins de l'univers.",
  whatsnew="Une ouverture cinématographique de l'espace lointain jusqu'à votre ciel, une première mission guidée, des visites racontées, des histoires pour les objets célèbres, une musique d'ambiance et une boussole plus précise sur iPhone.",
  desc="""Vastity, c'est le vrai ciel, en direct, et un vaisseau pour l'explorer.

POINTEZ VOTRE TÉLÉPHONE VERS LE CIEL
Levez votre téléphone : Vastity montre les étoiles, les planètes, les constellations et la Station spatiale exactement là où elles sont, au-dessus de chez vous. Avec la réalité augmentée, vous les voyez sur le vrai ciel filmé par la caméra.

VOLEZ PLUS VITE QUE LA LUMIÈRE
Montez à bord et décollez de votre ville. Frôlez les anneaux de Saturne, traversez la nébuleuse d'Orion, sortez de la Voie lactée pour la voir d'en haut, rejoignez Andromède ou le trou noir au cœur de la galaxie. Chaque voyage est à l'échelle réelle.

CE SOIR, ÇA VAUT LE COUP ?
Une note de 0 à 100 pour la nuit qui vient : météo, nuages, Lune et quoi observer, heure par heure. Des alertes pour les éclipses, les pluies d'étoiles filantes, les conjonctions et les passages de l'ISS, à ajouter à votre calendrier.

LE VOYAGE DE LA LUMIÈRE
Chaque fiche vous dit quand est partie la lumière que vous voyez et ce qui se passait sur Terre à ce moment-là : des pharaons aux dinosaures, jusqu'au Big Bang.

HISTOIRES, VISITES ET MISSIONS
De courtes histoires pour les objets les plus célèbres, des visites guidées racontées (le Système solaire, la vie des étoiles, le Groupe local, les trous noirs), des missions quotidiennes, des badges et un journal de vos observations.

UN UNIVERS ENTIER
• Plus de 50 000 étoiles avec leurs vraies couleurs
• Les plus de 6 000 exoplanètes confirmées par la NASA, avec des rendus générés à partir des données
• Objets de Messier et de Caldwell, nébuleuses, amas et galaxies avec de vraies photos
• Trous noirs, quasars et pulsars
• Le ciel vu d'autres mondes : Mars, la Lune, les lunes de Jupiter et d'autres systèmes stellaires

PRÉCIS
Les positions du Soleil, de la Lune et des planètes correspondent aux éphémérides NASA/JPL à quelques secondes d'arc près.

RESPECTE VOTRE VIE PRIVÉE
Pas de compte, pas de publicité, pas de pistage. Votre position reste sur votre téléphone ; seule une position approximative (environ 10 km) est envoyée pour la météo.

Fonctionne hors ligne. En français, italien et anglais.""",
 ),
}
LIMITS = dict(name=30, subtitle=30, promo=170, keywords=100, short=80, whatsnew=4000, desc=4000)
IOS = {'it': 'it', 'en': 'en-US', 'fr': 'fr-FR'}
PLAY = {'it': 'it-IT', 'en': 'en-US', 'fr': 'fr-FR'}
ok = True
for lg, d in L.items():
    for k, v in d.items():
        if len(v) > LIMITS[k]: ok = False; print(f'TROPPO LUNGO {lg}.{k}: {len(v)}/{LIMITS[k]}')
    ios = os.path.join(ROOT, 'fastlane/metadata', IOS[lg]); os.makedirs(ios, exist_ok=True)
    for f, k in [('name', 'name'), ('subtitle', 'subtitle'), ('promotional_text', 'promo'), ('keywords', 'keywords'), ('description', 'desc'), ('release_notes', 'whatsnew')]:
        open(os.path.join(ios, f + '.txt'), 'w').write(d[k] + '\n')
    sup = {'it': 'https://cloudsquireit.github.io/Vastity/about.html', 'en': 'https://cloudsquireit.github.io/Vastity/about.html?lang=en', 'fr': 'https://cloudsquireit.github.io/Vastity/about.html?lang=fr'}[lg]
    open(os.path.join(ios, 'support_url.txt'), 'w').write(sup + '\n')
    open(os.path.join(ios, 'marketing_url.txt'), 'w').write(sup + '\n')
    open(os.path.join(ios, 'privacy_url.txt'), 'w').write(sup.replace('about.html', 'privacy.html') + '\n')
    pl = os.path.join(ROOT, 'fastlane/metadata/android', PLAY[lg]); os.makedirs(os.path.join(pl, 'changelogs'), exist_ok=True)
    open(os.path.join(pl, 'title.txt'), 'w').write(d['name'] + '\n')
    open(os.path.join(pl, 'short_description.txt'), 'w').write(d['short'] + '\n')
    open(os.path.join(pl, 'full_description.txt'), 'w').write(d['desc'] + '\n')
    open(os.path.join(pl, 'changelogs', 'default.txt'), 'w').write(d['whatsnew'][:500] + '\n')
print('ok' if ok else 'controlla i limiti')
