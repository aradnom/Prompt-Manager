#!/usr/bin/env bash
# Runs LOCALLY (wired up as `npm run deploy:vps`). SSHes into the VPS and runs
# deploy.sh there. The VPS pulls from origin, so commit and push whatever you
# want deployed BEFORE running this.
#
# Config (env vars, with defaults):
#   VPS_HOST      SSH host or alias for the box        (default: prompt-manager-vps)
#   VPS_APP_DIR   path to the repo checkout on the box (default: /opt/app)
set -euo pipefail

VPS_HOST="${VPS_HOST:-prompt-manager-vps}"
VPS_APP_DIR="${VPS_APP_DIR:-/opt/app}"

echo "==> Triggering deploy on $VPS_HOST..."
ssh "$VPS_HOST" "cd '$VPS_APP_DIR/deploy/vps' && ./deploy.sh"
