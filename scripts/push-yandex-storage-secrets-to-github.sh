#!/usr/bin/env bash
# Читает YANDEX_STORAGE_* из окружения (или из .env рядом с корнем репозитория) и пишет в GitHub Secrets.
# Требуется: brew install gh && gh auth login
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${YANDEX_STORAGE_BUCKET:?Задайте YANDEX_STORAGE_BUCKET (имя бакета в Object Storage)}"
: "${YANDEX_STORAGE_ACCESS_KEY_ID:?}"
: "${YANDEX_STORAGE_SECRET_ACCESS_KEY:?}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Установите GitHub CLI: https://cli.github.com/ (macOS: brew install gh)" >&2
  exit 1
fi

echo -n "$YANDEX_STORAGE_BUCKET" | gh secret set YANDEX_STORAGE_BUCKET
echo -n "$YANDEX_STORAGE_ACCESS_KEY_ID" | gh secret set YANDEX_STORAGE_ACCESS_KEY_ID
echo -n "$YANDEX_STORAGE_SECRET_ACCESS_KEY" | gh secret set YANDEX_STORAGE_SECRET_ACCESS_KEY
echo "Секреты YANDEX_STORAGE_* обновлены в репозитории GitHub."
