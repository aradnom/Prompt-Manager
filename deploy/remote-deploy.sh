#!/usr/bin/env bash
#
# Trigger a deploy from your laptop: SSH into the box and run the box-side
# deploy.sh. Assumes master has already been pushed.
#
#   ./deploy/remote-deploy.sh
#   DEPLOY_HOST=general-vps DEPLOY_APP_DIR=/root/apps/other ./deploy/remote-deploy.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=app.env
source "$SCRIPT_DIR/app.env"
: "${APP_NAME:?not set in deploy/app.env}"

HOST="${DEPLOY_HOST:-general-vps}"
APP_DIR="${DEPLOY_APP_DIR:-/root/apps/${APP_NAME}}"

echo "==> Deploying ${APP_NAME} to ${HOST}:${APP_DIR}"
ssh "$HOST" "cd '${APP_DIR}' && ./deploy/deploy.sh"
