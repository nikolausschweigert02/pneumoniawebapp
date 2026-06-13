#!/usr/bin/env bash
# Run this on your Mac in Terminal.app (not in the Cursor cloud terminal).
set -euo pipefail

PTH="$HOME/Downloads/model1_resnet18_pneumonia.pth"

if [[ ! -f "$PTH" ]]; then
  echo "Datei nicht gefunden: $PTH"
  echo "Lege model1_resnet18_pneumonia.pth in deinen Downloads-Ordner."
  exit 1
fi

SIZE=$(stat -f%z "$PTH" 2>/dev/null || stat -c%s "$PTH")
if [[ "$SIZE" -lt 1000000 ]]; then
  echo "Die Datei ist zu klein (${SIZE} Bytes). Upload abgebrochen."
  exit 1
fi

echo "Lade Modell hoch (${SIZE} Bytes). Das kann 1-5 Minuten dauern..."
URL=$(curl -fsS \
  -F "reqtype=fileupload" \
  -F "time=24h" \
  -F "fileToUpload=@${PTH}" \
  "https://litterbox.catbox.moe/resources/internals/api.php")

echo ""
echo "=========================================="
echo "FERTIG. Kopiere diese URL:"
echo "$URL"
echo "=========================================="
echo ""
echo "Dann in Cursor im CLOUD-Terminal (workspace $) einfügen:"
echo "bash backend/scripts/download_model.sh \"$URL\""
