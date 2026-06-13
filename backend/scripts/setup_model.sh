#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-$HOME/Downloads}"
TARGET_DIR="$(cd "$(dirname "$0")/../models" && pwd)"

copy_file() {
  local filename="$1"
  local source="$SOURCE_DIR/$filename"
  local target="$TARGET_DIR/$filename"

  if [[ ! -f "$source" ]]; then
    echo "Missing source file: $source" >&2
    exit 1
  fi

  cp "$source" "$target"
  local size
  size=$(stat -f%z "$target" 2>/dev/null || stat -c%s "$target")
  echo "Copied $filename -> $target (${size} Bytes)"
}

copy_file "model1_resnet18_pneumonia.pth"

PTH_SIZE=$(stat -f%z "$TARGET_DIR/model1_resnet18_pneumonia.pth" 2>/dev/null || stat -c%s "$TARGET_DIR/model1_resnet18_pneumonia.pth")
if [[ "$PTH_SIZE" -lt 1000000 ]]; then
  echo "FEHLER: model1_resnet18_pneumonia.pth ist zu klein (${PTH_SIZE} Bytes)." >&2
  exit 1
fi
copy_file "model1_config.json"
copy_file "model1_summary.txt"

echo "Model setup complete."
