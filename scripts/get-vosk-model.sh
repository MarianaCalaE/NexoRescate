#!/usr/bin/env bash
# Descarga el modelo de español de Vosk y lo deja en public/models/ para servirlo desde la propia app.
# Opcional: sin este archivo, la app usa la copia pública del proyecto vosk-browser.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/models
tmp=$(mktemp -d)
curl -L -o "$tmp/model.zip" https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
unzip -q "$tmp/model.zip" -d "$tmp"
tar -czf public/models/vosk-model-small-es.tar.gz -C "$tmp" vosk-model-small-es-0.42
rm -rf "$tmp"
ls -lh public/models/vosk-model-small-es.tar.gz
