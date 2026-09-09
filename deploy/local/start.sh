#!/usr/bin/env bash
#
# Run the app locally via the same compose file used in production.
#
#   ./deploy/local/start.sh
#
# Builds the image if it's missing, ensures the shared networks exist (created
# for real on the box; made on demand here), then brings the stack up.
#
# NOTE: this only runs the APP container. Postgres and Valkey come from the
# shared `services` stack on the box — locally, point the repo-root .env at
# whatever you use for dev (local-dev/docker-compose.yml, or a tunnel).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

# shellcheck source=../app.env
source "$DEPLOY_DIR/app.env"
: "${APP_NAME:?not set in deploy/app.env}"
export APP_NAME

TAG="${APP_SHA:-latest}"

# The compose file attaches to external `web` and `services` networks (Caddy and
# the shared Postgres/Valkey on the box). Create them locally if absent so
# compose doesn't error.
for net in web services; do
  if ! docker network inspect "$net" >/dev/null 2>&1; then
    echo "==> Creating local '$net' network"
    docker network create "$net" >/dev/null
  fi
done

# Build on demand if the requested image isn't present yet.
if ! docker image inspect "${APP_NAME}:${TAG}" >/dev/null 2>&1; then
  echo "==> Image ${APP_NAME}:${TAG} not found; building"
  "$SCRIPT_DIR/build.sh"
fi

echo "==> Starting ${APP_NAME} (compose up -d)"
docker compose -f "$DEPLOY_DIR/compose.yaml" --project-directory "$ROOT_DIR" up -d

# Keep this default in sync with the ports mapping in ../compose.yaml.
echo "==> Up: http://127.0.0.1:${HOST_PORT:-3001}"
