#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

docker run --rm -it \
  --env-file "$PROJECT_ROOT/.env" \
  -e DOCKER_HOST=host.docker.internal \
  -p 3001:3001 \
  prompt-manager:latest
