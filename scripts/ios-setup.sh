#!/usr/bin/env bash
# Prepara il progetto iOS per Xcode (simulatore o iPhone) partendo da una copia pulita del repository.
# Uso:  npm run ios     (dalla cartella del progetto; funziona anche se il percorso contiene spazi o "+")
#
# Cosa fa: installa le dipendenze, compila l'app web per il nativo, copia tutto nel progetto Xcode e
# genera la cartella ios/App/Pods (CocoaPods). Senza Pods Xcode dà l'errore
# "Unable to open base configuration reference file ... Pods-App.debug.xcconfig".
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods non è installato."
  if command -v brew >/dev/null 2>&1; then
    echo "Lo installo con Homebrew…"; brew install cocoapods
  else
    echo "Installa CocoaPods con:  sudo gem install cocoapods   (oppure: brew install cocoapods), poi rilancia npm run ios"; exit 1
  fi
fi

npm ci
VASTITY_NATIVE=1 npm run build
npx cap sync ios
(cd ios/App && pod install)

echo
echo "Pronto. Si apre Xcode con il WORKSPACE (App.xcworkspace, non App.xcodeproj)."
echo "Scegli un simulatore (es. iPhone 16) in alto e premi ▶."
open "ios/App/App.xcworkspace"
