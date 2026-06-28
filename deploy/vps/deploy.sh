#!/usr/bin/env zsh
# Runs ON the VPS. Pulls the latest code, rebuilds the app image, applies any
# new DB migrations, and swaps in the new app container. Postgres, Redis and
# the Cloudflare tunnel keep running untouched.
#
# Trigger it from your laptop with `npm run deploy:vps` (see remote-deploy.sh),
# or run it directly on the box.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$SCRIPT_DIR"

echo "==> Pulling latest from origin..."
git -C "$REPO_ROOT" pull --ff-only

echo "==> Building app image..."
docker compose build app

echo "==> Applying database migrations..."
docker compose run --rm app npm run migrate

echo "==> Recreating containers (only changed ones are replaced)..."
docker compose up -d

echo "==> Pruning dangling images..."
docker image prune -f

echo "==> Deploy complete: $(git -C "$REPO_ROOT" rev-parse --short HEAD)"
