#!/usr/bin/env bash
# Deploy Edge Function recommend-spot (requires SUPABASE_ACCESS_TOKEN).
# Token: https://supabase.com/dashboard/account/tokens
# CLI: brew install supabase/tap/supabase OR npm install -g supabase
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
  echo "SUPABASE_ACCESS_TOKEN is not set." >&2
  echo "  Local: export SUPABASE_ACCESS_TOKEN='sbp_…' or add it to .env" >&2
  echo "  Or use GitHub -> Actions -> 'Deploy recommend-spot' (SUPABASE_ACCESS_TOKEN secret)." >&2
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

echo "Install Supabase CLI: brew install supabase/tap/supabase" >&2
echo "or: npm install -g supabase" >&2
exit 1
