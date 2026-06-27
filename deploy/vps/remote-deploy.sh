#!/usr/bin/env bash
# Runs LOCALLY (wired up as `npm run deploy:vps`). Pushes the current branch to
# origin, then SSHes into the VPS and runs deploy.sh there. The VPS pulls from
# origin, so anything you want deployed must be committed first.
#
# Config (env vars, with defaults):
#   VPS_HOST      SSH host or alias for the box        (default: prompt-manager-vps)
#   VPS_APP_DIR   path to the repo checkout on the box (default: /opt/app)
set -euo pipefail

VPS_HOST="${VPS_HOST:-prompt-manager-vps}"
VPS_APP_DIR="${VPS_APP_DIR:-/opt/app}"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "==> Pushing $BRANCH to origin..."
git push origin "$BRANCH"

echo "==> Triggering deploy on $VPS_HOST..."
ssh "$VPS_HOST" "cd '$VPS_APP_DIR/deploy/vps' && ./deploy.sh"
