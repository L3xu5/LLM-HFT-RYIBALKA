#!/usr/bin/env bash
# Reads YANDEX_STORAGE_* from env (or .env near repository root) and writes them to GitHub Secrets.
# Requires: brew install gh && gh auth login
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${YANDEX_STORAGE_BUCKET:?Set YANDEX_STORAGE_BUCKET (bucket name in Object Storage)}"
: "${YANDEX_STORAGE_ACCESS_KEY_ID:?}"
: "${YANDEX_STORAGE_SECRET_ACCESS_KEY:?}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: https://cli.github.com/ (macOS: brew install gh)" >&2
  exit 1
fi

echo -n "$YANDEX_STORAGE_BUCKET" | gh secret set YANDEX_STORAGE_BUCKET
echo -n "$YANDEX_STORAGE_ACCESS_KEY_ID" | gh secret set YANDEX_STORAGE_ACCESS_KEY_ID
echo -n "$YANDEX_STORAGE_SECRET_ACCESS_KEY" | gh secret set YANDEX_STORAGE_SECRET_ACCESS_KEY
echo "YANDEX_STORAGE_* secrets were updated in the GitHub repository."
