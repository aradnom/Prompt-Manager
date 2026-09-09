#!/usr/bin/env bash
#
# Stop and remove the locally-running app container(s).
#
#   ./deploy/local/stop.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"

# shellcheck source=../app.env
source "$DEPLOY_DIR/app.env"
: "${APP_NAME:?not set in deploy/app.env}"
export APP_NAME

echo "==> Stopping ${APP_NAME} (compose down)"
docker compose -f "$DEPLOY_DIR/compose.yaml" --project-directory "$ROOT_DIR" down

echo "==> Stopped."
