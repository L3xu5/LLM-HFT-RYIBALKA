#!/usr/bin/env bash
# Один раз: привязка репозитория к проекту Expo (появится extra.eas.projectId в app.config.ts и .eas/).
# Нужен аккаунт Expo: либо интерактивный `npm run eas:login`, либо переменная EXPO_TOKEN (expo.dev → Access Tokens).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Переменные из .env и .env.eas (не коммитятся). Позже идущий файл перекрывает предыдущий.
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
  echo "Не найден $EAS_BIN — выполните npm install" >&2
  exit 1
fi

if [ -z "${EXPO_TOKEN:-}" ]; then
  echo "Не задан EXPO_TOKEN. Варианты:" >&2
  echo "  1) Добавьте EXPO_TOKEN в .env или .env.eas (см. .env.eas.example)" >&2
  echo "  2) npm run eas:login && npm run eas:init" >&2
  echo "  3) export EXPO_TOKEN='…' && npm run eas:init:project" >&2
  exit 1
fi

exec "$EAS_BIN" init --non-interactive "$@"
