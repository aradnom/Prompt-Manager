#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PLATFORM=()

while getopts "l" opt; do
  case $opt in
    l) PLATFORM=(--platform linux/amd64) ;;
    *) echo "Usage: $0 [-l]" && exit 1 ;;
  esac
done

docker build "${PLATFORM[@]}" -t prompt-manager:latest -f "$SCRIPT_DIR/Dockerfile" "$PROJECT_ROOT"
