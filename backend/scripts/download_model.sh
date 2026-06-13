#!/usr/bin/env bash
# Run this in the Cursor CLOUD terminal (workspace $).
set -euo pipefail

URL="${1:-}"
TARGET_DIR="$(cd "$(dirname "$0")/../models" && pwd)"
TARGET_FILE="$TARGET_DIR/model1_resnet18_pneumonia.pth"

if [[ -z "$URL" ]]; then
  echo "Usage: bash backend/scripts/download_model.sh \"https://DEINE-URL\""
  echo ""
  echo "Zuerst auf dem Mac ausführen:"
  echo "  bash scripts/upload_from_mac.sh"
  exit 1
fi

mkdir -p "$TARGET_DIR"
echo "Lade Modell nach $TARGET_FILE ..."
curl -fsSL --progress-bar "$URL" -o "$TARGET_FILE"

SIZE=$(stat -c%s "$TARGET_FILE" 2>/dev/null || stat -f%z "$TARGET_FILE")
if [[ "$SIZE" -lt 1000000 ]]; then
  echo "FEHLER: Datei ist nur ${SIZE} Bytes. Upload hat nicht geklappt."
  rm -f "$TARGET_FILE"
  exit 1
fi

echo "OK: model1_resnet18_pneumonia.pth (${SIZE} Bytes)"
echo ""
echo "Schreib im Chat: \"Modell heruntergeladen\""
