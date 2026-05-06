#!/usr/bin/env bash
# Uploads YandexGPT secrets to Supabase Edge Functions (do not commit keys to git).
#
# Supported names:
#   YANDEX_GPT_API_KEY / YANDEX_FOLDER_ID
# or Yandex Cloud aliases:
#   YANDEX_CLOUD_API_KEY / YANDEX_CLOUD_FOLDER
#
# Optional model:
#   YANDEX_CLOUD_MODEL=yandexgpt-5.1/latest
# or full URI:
#   YANDEX_MODEL_URI=gpt://b1g.../yandexgpt-5.1/latest
#
# Requires Supabase CLI and project access:
#   export SUPABASE_ACCESS_TOKEN='sbp_…'  (or supabase login + link)
#   npm run llm:secrets
#
# API key and folder id: Yandex Cloud -> folder -> service accounts / API key
# for Foundation Models (LLM), folder id looks like b1g...
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

API_KEY="${YANDEX_GPT_API_KEY:-${YANDEX_CLOUD_API_KEY:-}}"
FOLDER="${YANDEX_FOLDER_ID:-${YANDEX_CLOUD_FOLDER:-}}"
MODEL_URI="${YANDEX_MODEL_URI:-${YANDEX_CLOUD_MODEL_URI:-}}"
MODEL_TAIL="${YANDEX_CLOUD_MODEL:-}"

if [[ -z "$API_KEY" || -z "$FOLDER" ]]; then
  echo "Yandex Cloud keys are missing for Supabase upload." >&2
  echo "Set these in your shell (or in non-committed .env):" >&2
  echo "  export YANDEX_GPT_API_KEY='AQVN…'   # API key with Foundation Models access" >&2
  echo "  export YANDEX_FOLDER_ID='b1g…'     # Folder ID in Yandex Cloud" >&2
  echo "Optional: export YANDEX_CLOUD_MODEL='yandexgpt-5.1/latest'" >&2
  echo "Then run again: npm run llm:secrets" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Install CLI: brew install supabase/tap/supabase" >&2
  exit 1
fi

ARGS=(
  supabase secrets set
  --project-ref "$PROJECT_REF"
  "YANDEX_GPT_API_KEY=${API_KEY}"
  "YANDEX_FOLDER_ID=${FOLDER}"
)

if [[ -n "$MODEL_URI" ]]; then
  ARGS+=("YANDEX_MODEL_URI=${MODEL_URI}")
elif [[ -n "$MODEL_TAIL" ]]; then
  ARGS+=("YANDEX_CLOUD_MODEL=${MODEL_TAIL}")
fi

"${ARGS[@]}"

echo "Yandex secrets were written for project ${PROJECT_REF}. Redeploy is optional - secrets are used on next invocation."
