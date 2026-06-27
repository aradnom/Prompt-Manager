#!/usr/bin/env bash
# Runs LOCALLY. Opens an SSH tunnel to the VPS Postgres (which is bound to the
# box's loopback only). While this stays open, connect locally to:
#   postgresql://<user>:<pass>@localhost:5432/<db>
#
# Config (env vars, with defaults):
#   VPS_HOST     SSH host or alias for the box (default: prompt-manager-vps)
#   LOCAL_PORT   local port to forward from    (default: 5432)
set -euo pipefail

VPS_HOST="${VPS_HOST:-prompt-manager-vps}"
LOCAL_PORT="${LOCAL_PORT:-5432}"

echo "Postgres -> localhost:${LOCAL_PORT}  (Ctrl-C to close)"
exec ssh -N -L "${LOCAL_PORT}:localhost:5432" "$VPS_HOST"
