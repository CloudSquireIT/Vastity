# Precisione astronomica di Vastity

Verifica eseguita con `tests/accuracy.cjs` il 21 novembre 2026, confrontando la pipeline di calcolo
dell'app (`skyFrame` + `eqjToHor`, cioè le posizioni disegnate sullo schermo) con le effemeridi
**NASA/JPL Horizons** e con gli istanti delle eclissi pubblicati dalla NASA.

## Posizioni di Sole, Luna e pianeti

240 confronti: 10 corpi × 3 città (Roma, Sydney, New York) × 8 istanti tra gennaio 2026 e giugno 2027.
Altezza e azimut senza rifrazione atmosferica.

| Corpo | Scarto massimo | Scarto mediano |
|---|---|---|
| Sole | 2,6″ | 1,6″ |
| Luna | 5,0″ | 3,3″ |
| Mercurio | 4,2″ | 2,2″ |
| Venere | 9,2″ | 2,9″ |
| Marte | 2,4″ | 1,9″ |
| Giove | 4,5″ | 2,4″ |
| Saturno | 13,1″ | 10,1″ |
| Urano | 7,1″ | 5,3″ |
| Nettuno | 15,7″ | 15,1″ |
| Plutone | 4,5″ | 1,4″ |

Lo scarto massimo è 16 secondi d'arco: circa un centesimo del diametro della Luna, invisibile anche
allo zoom massimo dell'app.

## Alba e tramonto del Sole (Roma, equinozi e solstizi 2026)

Negli istanti calcolati dall'app, JPL mette il centro del Sole a −0,21°/−0,22° di altezza (rifrazione
inclusa) invece dei −0,27° attesi: l'app anticipa l'alba e posticipa il tramonto di **21–26 secondi**.
La differenza viene dal modello di rifrazione standard (34′) e rientra nella tolleranza delle
effemeridi pubbliche, che arrotondano al minuto.

## Eclissi

| Evento | App (UT) | NASA (UT) |
|---|---|---|
| Eclissi totale di Luna, 3 marzo 2026 | 11:33 | 11:33 |
| Eclissi parziale di Luna, 28 agosto 2026 | 04:12 | 04:13 |
| Eclissi totale di Sole, 12 agosto 2026 | 17:45 | 17:46 |

Tutti gli istanti coincidono entro un minuto.

## Limiti noti

- **Rifrazione nel disegno del cielo:** il cielo è disegnato senza rifrazione atmosferica. Vicino
  all'orizzonte gli astri appaiono fino a 0,5° più in basso di come li vedi; a 45° l'effetto scende a 1′.
  Gli orari di alba e tramonto la includono.
- **ISS:** i passaggi dipendono dagli elementi orbitali (TLE) scaricati all'avvio. Con dati vecchi di
  qualche giorno l'errore cresce a qualche grado; l'app li aggiorna a ogni apertura.
- **Stelle:** le posizioni vengono dal catalogo HYG (Hipparcos), con moto proprio all'epoca J2000.
  Lo scarto è di pochi secondi d'arco, tranne che per le stelle con moto proprio elevatissimo.

## Ripetere la verifica

```
npx vite --port 5173 &
NODE_USE_ENV_PROXY=1 node tests/accuracy.cjs
```
