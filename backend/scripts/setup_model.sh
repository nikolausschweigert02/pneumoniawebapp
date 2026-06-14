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
  echo "Copied $filename -> $target"
}

copy_file "model1_resnet18_pneumonia.pth"
copy_file "model1_config.json"
copy_file "model1_summary.txt"

echo "Model setup complete."
