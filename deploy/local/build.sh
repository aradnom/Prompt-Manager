#!/usr/bin/env bash
#
# Build the app image locally.
#
#   ./deploy/local/build.sh                  # builds $APP_NAME:latest
#   APP_SHA=abc1234 ./deploy/local/build.sh  # also tags $APP_NAME:abc1234
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

# shellcheck source=../app.env
source "$DEPLOY_DIR/app.env"
: "${APP_NAME:?not set in deploy/app.env}"

TAG="${APP_SHA:-latest}"

echo "==> Building ${APP_NAME}:${TAG}"
docker build -f "$DEPLOY_DIR/Dockerfile" -t "${APP_NAME}:${TAG}" "$ROOT_DIR"

# Ensure :latest exists so the compose default (${APP_SHA:-latest}) resolves.
if [ "$TAG" != "latest" ]; then
  docker tag "${APP_NAME}:${TAG}" "${APP_NAME}:latest"
fi

echo "==> Built ${APP_NAME}:${TAG}"
