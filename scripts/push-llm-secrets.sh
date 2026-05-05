#!/usr/bin/env bash
# Загружает секреты YandexGPT в Supabase Edge Functions (не коммитьте ключи в git).
#
# Поддерживаются имена:
#   YANDEX_GPT_API_KEY / YANDEX_FOLDER_ID
# или алиасы из Yandex Cloud:
#   YANDEX_CLOUD_API_KEY / YANDEX_CLOUD_FOLDER
#
# Опционально модель:
#   YANDEX_CLOUD_MODEL=yandexgpt-5.1/latest
# или полный URI:
#   YANDEX_MODEL_URI=gpt://b1g.../yandexgpt-5.1/latest
#
# Нужен Supabase CLI и доступ к проекту:
#   export SUPABASE_ACCESS_TOKEN='sbp_…'  (или supabase login + link)
#   npm run llm:secrets
#
# Ключ API и folder id: Yandex Cloud → каталог → сервисные аккаунты / API-ключ
# для Foundation Models (LLM), folder id вида b1g...
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
  echo "Нет ключей Yandex Cloud для загрузки в Supabase." >&2
  echo "Задайте в консоли (или в .env без коммита):" >&2
  echo "  export YANDEX_GPT_API_KEY='AQVN…'   # API-ключ с доступом к Foundation Models" >&2
  echo "  export YANDEX_FOLDER_ID='b1g…'     # ID каталога в Yandex Cloud" >&2
  echo "Опционально: export YANDEX_CLOUD_MODEL='yandexgpt-5.1/latest'" >&2
  echo "Затем снова: npm run llm:secrets" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Установите CLI: brew install supabase/tap/supabase" >&2
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

echo "Секреты Yandex записаны для проекта ${PROJECT_REF}. Повторный деплой функции не обязателен — секреты подхватятся при следующем вызове."
