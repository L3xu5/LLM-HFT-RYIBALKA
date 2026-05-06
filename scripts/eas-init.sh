#!/usr/bin/env bash
# One-time step: link repository to Expo project (adds extra.eas.projectId in app.config.ts and .eas/).
# Requires Expo account: either interactive `npm run eas:login` or EXPO_TOKEN (expo.dev -> Access Tokens).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Variables from .env and .env.eas (not committed). Later file overrides earlier one.
for _envfile in "$ROOT/.env" "$ROOT/.env.eas"; do
  if [ -f "$_envfile" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$_envfile"
    set +a
  fi
done

EAS_BIN="$ROOT/node_modules/.bin/eas"
if [ ! -x "$EAS_BIN" ]; then
  echo "$EAS_BIN not found - run npm install" >&2
  exit 1
fi

if [ -z "${EXPO_TOKEN:-}" ]; then
  echo "EXPO_TOKEN is not set. Options:" >&2
  echo "  1) Add EXPO_TOKEN to .env or .env.eas (see .env.eas.example)" >&2
  echo "  2) npm run eas:login && npm run eas:init" >&2
  echo "  3) export EXPO_TOKEN='…' && npm run eas:init:project" >&2
  exit 1
fi

exec "$EAS_BIN" init --non-interactive "$@"
