# Pubblicare Vastity

## 1. Avviare una release (web + Android + verifica iOS)

```bash
git tag v1.0.0 && git push origin v1.0.0
```

La pipeline `.github/workflows/release.yml` costruisce tutto e crea la **GitHub Release** con:
- `vastity-web-v1.0.0.zip` — il sito pronto da caricare su qualsiasi hosting statico;
- `vastity-v1.0.0-debug.apk` — da installare direttamente su un telefono Android (prova);
- `vastity-v1.0.0-release.apk` e `vastity-v1.0.0.aab` — per il Play Store (firmati se i secret sono configurati).

Prima volta: **Settings → Pages → Source: GitHub Actions** per pubblicare il sito su GitHub Pages
(oppure caricare lo zip su Netlify, Vercel, Cloudflare Pages…).

## 2. Android (Google Play)

1. Account sviluppatore Google Play (una tantum).
2. Crea la chiave di firma (una volta, conservala al sicuro):
   `keytool -genkey -v -keystore vastity.keystore -alias vastity -keyalg RSA -keysize 2048 -validity 10000`
3. In **Settings → Secrets and variables → Actions** aggiungi:
   `ANDROID_KEYSTORE_BASE64` (`base64 -w0 vastity.keystore`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
4. Pubblica un tag: carica `vastity-vX.Y.Z.aab` su Play Console (traccia di test interno, poi produzione).

## 3. iOS (App Store)

Serve un Mac con Xcode e l'Apple Developer Program.

```bash
npm ci && npm run cap:sync
npx cap open ios
```

In Xcode: *Signing & Capabilities* → scegli il tuo Team; *Product → Archive* → *Distribute App* → App Store Connect.
Poi su App Store Connect: TestFlight per i tester, quindi invio in revisione.

## Prima di inviare agli store

- Bundle ID / application ID: `app.vastity` (cambialo in `capacitor.config.ts`, Xcode e `android/app/build.gradle` se vuoi un dominio tuo).
- Versione: `package.json`, `MARKETING_VERSION` (Xcode) e `versionName`/`versionCode` (Android) — aumenta `versionCode` a ogni invio.
- Icone e splash: generate da `resources/` con `npm run cap:assets`.
- Privacy: l'app non raccoglie dati personali; posizione, sensori e fotocamera restano sul dispositivo.
  Le schede privacy degli store vanno compilate di conseguenza ("Nessun dato raccolto").
- Crediti: le foto CC BY richiedono l'attribuzione, presente in **Impostazioni → Crediti e licenze**.
- Screenshot per gli store: `npm run test:devices` salva immagini di iPhone, iPad, Android e desktop in `test-results/devices`.
