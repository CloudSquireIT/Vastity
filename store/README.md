# Pubblicazione sugli store

Tutto il materiale per le pagine di App Store e Google Play è qui, in italiano, inglese e francese.

| Cosa | Dove |
|---|---|
| Testi (nome, sottotitolo, descrizione, parole chiave, novità) | `fastlane/metadata/` (generati da `store/listing.py`) |
| Immagini App Store iPhone 6,9″ (2868×1320) | `store/screens/<lingua>/appstore-iphone69/` |
| Immagini App Store iPad 13″ (2752×2064) | `store/screens/<lingua>/appstore-ipad13/` |
| Immagini Google Play telefono (2400×1200) | `store/screens/<lingua>/play-phone/` |
| Grafica in evidenza Google Play (1024×500) | `store/screens/<lingua>/play-feature/` |
| Privacy policy | `public/privacy.html` → `https://cloudsquireit.github.io/Vastity/privacy.html` |
| Pagina di presentazione (supporto e marketing) | `public/about.html` → `https://cloudsquireit.github.io/Vastity/about.html` |

Per rigenerare: `npx vite --port 5173 &`, poi `SHOT_LANG=it node tests/store-shots.cjs` (anche `en` e `fr`),
`python3 store/compose.py` e `python3 store/listing.py`.

## Prima di pubblicare (azioni tue)

1. **GitHub Pages:** Settings → Pages → Source: GitHub Actions. Servono per la privacy policy, la pagina
   di supporto, le texture 4K e gli aggiornamenti mensili dei dati.
2. **Apple Developer Program** (99 $/anno): crea l'app con bundle ID `app.vastity` in App Store Connect.
3. **Google Play Console** (25 $ una tantum): crea l'app con package `app.vastity`.
4. **Firma:** certificati Apple e keystore Android come descritto in `RELEASE.md`.

## Risposte pronte per i questionari

**App Store · Privacy dell'app (etichetta "nutrizionale")**
- Dati raccolti: *Posizione approssimativa*, usata solo per la *funzionalità dell'app*, **non collegata
  all'identità** e **non usata per il tracciamento**. Serve alle previsioni meteo di Open-Meteo, che
  ricevono la posizione arrotondata a circa 10 km.
- Nessun altro dato raccolto. Nessun tracciamento.

**Google Play · Sicurezza dei dati**
- Posizione approssimativa: condivisa con un servizio terzo (meteo), non raccolta da noi, cifrata in
  transito (HTTPS), non obbligatoria (si può scegliere un luogo a mano).
- Nessun account, nessuna eliminazione dati da richiedere: tutto resta sul dispositivo.

**Classificazione per età:** 4+ (App Store), PEGI 3 / Everyone (Play). Nessun contenuto sensibile, nessun
acquisto, nessuna chat.

**Categoria:** Istruzione (secondaria: Consultazione).

**Note per la revisione Apple:** "L'app funziona senza account. Per provare la bussola, tocca l'icona
della bussola in alto a destra e alza il telefono al cielo. La navicella si apre dal pulsante con il
razzo in basso."
