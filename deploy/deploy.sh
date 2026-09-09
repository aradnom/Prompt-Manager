#!/usr/bin/env bash
#
# Deploy this app. Runs ON the Hetzner box, from the app checkout at
# /root/apps/$APP_NAME (invoke via deploy/remote-deploy.sh from a laptop,
# or directly over SSH).
#
# Steps: pull latest master -> build image -> tag with the git SHA ->
# export $APP_SHA -> run DB migrations -> `docker compose up -d` to swap
# the container.
#
# Assumes: the repo is already cloned here with an `origin` remote, and the
# shared `web` network + Caddy already exist (Caddy config lives in
# /root/stack), as do the shared postgres/valkey containers on `services`.
# Pushing to master is expected to have happened beforehand.
#
# The whole body lives in main() so bash parses it fully before the git reset
# below can rewrite this very file mid-execution.
set -euo pipefail

main() {
  local SCRIPT_DIR ROOT_DIR BRANCH APP_SHA
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  BRANCH="${DEPLOY_BRANCH:-master}"
  cd "$ROOT_DIR"

  echo "==> Fetching latest ${BRANCH}"
  git fetch --prune origin
  git checkout "$BRANCH"
  git reset --hard "origin/${BRANCH}"

  # Sourced AFTER the reset so we get the deployed commit's name, and because
  # the reset can rewrite app.env out from under us. Exported so compose.yaml
  # can interpolate it.
  # shellcheck source=app.env
  source "$SCRIPT_DIR/app.env"
  : "${APP_NAME:?not set in deploy/app.env}"
  export APP_NAME

  APP_SHA="$(git rev-parse --short HEAD)"
  export APP_SHA
  echo "==> Deploying ${APP_NAME} @ ${APP_SHA}"

  # .env is optional for compose (required: false) so a missing file is
  # silent there — surface it here instead, since the app can't run without it.
  if [ ! -f "$ROOT_DIR/.env" ]; then
    echo "WARNING: $ROOT_DIR/.env not found — the app will exit at boot" >&2
    echo "         missing DATABASE_URL / SESSION_SECRET / the Valkey URLs etc." >&2
  fi

  echo "==> Building image ${APP_NAME}:${APP_SHA}"
  docker build -f "$SCRIPT_DIR/Dockerfile" -t "${APP_NAME}:${APP_SHA}" "$ROOT_DIR"
  docker tag "${APP_NAME}:${APP_SHA}" "${APP_NAME}:latest"

  echo "==> Ensuring shared networks exist"
  for net in web services; do
    docker network inspect "$net" >/dev/null 2>&1 || docker network create "$net" >/dev/null
  done

  # Runs in a one-off container off the image we just built, on the same
  # networks and with the same .env, then exits. --no-deps because there are no
  # compose-managed dependencies to start (postgres/valkey live in the shared
  # `services` stack). The app only WARNS about pending migrations at boot, so
  # this step is what actually applies them — it runs before the swap so a
  # failing migration leaves the old container serving.
  echo "==> Applying database migrations"
  docker compose -f "$SCRIPT_DIR/compose.yaml" --project-directory "$ROOT_DIR" \
    run --rm --no-deps app npm run migrate

  echo "==> Swapping container (compose up -d)"
  docker compose -f "$SCRIPT_DIR/compose.yaml" --project-directory "$ROOT_DIR" up -d

  echo "==> Pruning dangling images"
  docker image prune -f >/dev/null || true

  echo "==> Live: ${APP_NAME} @ ${APP_SHA}"
  docker compose -f "$SCRIPT_DIR/compose.yaml" --project-directory "$ROOT_DIR" ps
}

main "$@"
