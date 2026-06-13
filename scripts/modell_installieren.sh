#!/usr/bin/env bash
# Idiotensicheres Modell-Setup für Cursor Desktop.
# Einfach ausführen — das Skript erkennt automatisch Mac oder Cloud.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/backend/models"
DOWNLOADS_PTH="$HOME/Downloads/model1_resnet18_pneumonia.pth"

echo "============================================"
echo " Pneumonia Modell installieren"
echo "============================================"
echo ""

mkdir -p "$TARGET"

# --- Fall 1: Mac (lokales Projekt in Cursor Desktop) ---
if [[ "$(uname -s)" == "Darwin" ]] && [[ -f "$DOWNLOADS_PTH" ]]; then
  echo "✓ Mac erkannt. Datei in Downloads gefunden."
  echo "  Kopiere nach backend/models/ ..."
  echo ""

  bash "$ROOT/backend/scripts/setup_model.sh" "$HOME/Downloads"

  SIZE=$(stat -f%z "$TARGET/model1_resnet18_pneumonia.pth")
  if [[ "$SIZE" -lt 1000000 ]]; then
    echo "FEHLER: Datei ist zu klein (${SIZE} Bytes)."
    exit 1
  fi

  echo ""
  echo "============================================"
  echo " FERTIG auf dem Mac!"
  echo " Dateigröße: ${SIZE} Bytes"
  echo "============================================"
  echo ""
  echo "Als Nächstes Backend starten:"
  echo "  cd backend && source .venv/bin/activate"
  echo "  uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000"
  exit 0
fi

# --- Fall 2: Cloud (Cursor Cloud Agent / workspace $) ---
if [[ -f "$TARGET/model1_resnet18_pneumonia.pth" ]]; then
  SIZE=$(stat -c%s "$TARGET/model1_resnet18_pneumonia.pth" 2>/dev/null || stat -f%z "$TARGET/model1_resnet18_pneumonia.pth")
  if [[ "$SIZE" -ge 1000000 ]]; then
    echo "✓ Modell ist bereits in backend/models/ (${SIZE} Bytes)."
    echo "  Schreib im Chat: Modell heruntergeladen"
    exit 0
  fi
  echo "WARNUNG: Alte Datei ist kaputt (${SIZE} Bytes). Wird ersetzt."
  rm -f "$TARGET/model1_resnet18_pneumonia.pth"
fi

echo "Cloud-Umgebung erkannt (dein Mac-Downloads ist hier nicht sichtbar)."
echo ""
echo "Du brauchst 2 kurze Schritte:"
echo ""
echo "----------------------------------------"
echo " SCHRITT A — Mac-Terminal (außerhalb Cursor)"
echo "----------------------------------------"
echo "1. Terminal.app öffnen (Spotlight: Terminal)"
echo "2. Diesen Befehl einfügen:"
echo ""
echo "curl -F 'reqtype=fileupload' -F 'time=24h' -F 'fileToUpload=@/Users/nikolausschweigert/Downloads/model1_resnet18_pneumonia.pth' https://litterbox.catbox.moe/resources/internals/api.php"
echo ""
echo "3. Warten (1-3 Min). Am Ende erscheint eine URL."
echo "4. URL kopieren."
echo ""
echo "----------------------------------------"
echo " SCHRITT B — Cursor-Terminal (workspace \$)"
echo "----------------------------------------"
echo "Diesen Befehl einfügen (DEINE URL statt PLATZHALTER):"
echo ""
echo "bash backend/scripts/download_model.sh \"HIER-DEINE-URL-EINFUEGEN\""
echo ""
echo "----------------------------------------"
echo ""
echo "Wenn Schritt A eine URL ausgegeben hat, führe Schritt B jetzt aus."
echo "Oder starte dieses Skript nochmal mit der URL:"
echo ""
echo "bash scripts/modell_installieren.sh \"HIER-DEINE-URL-EINFUEGEN\""
echo ""

if [[ -n "${1:-}" ]]; then
  echo "Lade Modell von URL ..."
  bash "$ROOT/backend/scripts/download_model.sh" "$1"
  echo ""
  echo "============================================"
  echo " FERTIG in der Cloud!"
  echo " Schreib im Chat: Modell heruntergeladen"
  echo "============================================"
fi
