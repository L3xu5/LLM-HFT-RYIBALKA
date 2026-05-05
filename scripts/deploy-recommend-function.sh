#!/usr/bin/env bash
# Деплой Edge Function recommend-spot (нужен SUPABASE_ACCESS_TOKEN).
# Токен: https://supabase.com/dashboard/account/tokens
# CLI: brew install supabase/tap/supabase  ИЛИ  npm install -g supabase
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-cxzpcsdydsrkthlenvrj}"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Не задан SUPABASE_ACCESS_TOKEN." >&2
  echo "  Локально: export SUPABASE_ACCESS_TOKEN='sbp_…' или добавьте в .env" >&2
  echo "  Либо GitHub → Actions → «Deploy recommend-spot» (секрет SUPABASE_ACCESS_TOKEN)." >&2
  exit 1
fi

run_deploy() {
  local bin="$1"
  shift
  exec "$bin" functions deploy recommend-spot --project-ref "$PROJECT_REF" "$@"
}

if command -v supabase >/dev/null 2>&1; then
  run_deploy supabase "$@"
fi

echo "Установите Supabase CLI: brew install supabase/tap/supabase" >&2
echo "или: npm install -g supabase" >&2
exit 1
