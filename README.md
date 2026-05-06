<div align="center">

# Рыбалка

**Мобильное и веб‑приложение для рыбаков:** интерактивная карта, журнал уловов с фото, общий и приватный обмен точками — и **AI‑подсказка**, куда поехать дальше.

![Expo](https://img.shields.io/badge/Expo-52-000020?style=flat&logo=expo)
![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?style=flat&logo=supabase&logoColor=white)

</div>

---

## О проекте

**Рыбалка** — это клиент на **Expo (React Native)** с общим кодом для **iOS, Android и Web**. Backend — **Supabase** (PostgreSQL, Auth, Row Level Security, Storage). Карта строится на **Яндекс Картах JS API 3.0** (нативно через WebView, в браузере — через iframe/`srcDoc`). Рекомендации места рыбалки считаются на стороне сервера: **Supabase Edge Function** запрашивает языковую модель в **Yandex Cloud** (Foundation Models), использует ваши и чужие публичные отметки в радиусе и возвращает координаты, текст объяснения и подсказки по наживке и рыбе.

Цель продукта — не только хранить точки на карте, а **быстро делиться опытом** (вид рыбы, наживка, снасть, заметки) и **получать следующую идею**, когда база знаний сообщества или сезон меняются.

---

## Возможности

### Карта и точки

- **Интерактивная карта** Яндекса: маркеры улова, зум, режим выбора координат для новой записи.
- **Две видимости улова:** публичная (видят все) и приватная (видите только вы) — на уровне строк в БД и **RLS Supabase**.
- **Цвет маркеров:** свои точки отличаются от чужих; отдельный маркер для **AI‑рекомендации** после ответа модели.

### Журнал улова

- **Создание улова:** координаты с карты, вид рыбы, вес, наживка, снасть, заметки, флаг публичности.
- **Фотографии:** загрузка нескольких снимков в **Supabase Storage** (`catch-photos`), при просмотре — публичные URL и при необходимости подписанные ссылки.
- **Просмотр и редактирование** своих записей; удаление своего улова.
- **Профиль пользователя** и отображение авторства на карточке улова.

### AI «Куда поехать?»

- Большая **красная кнопка** на карте: запрос **геолокации**, вызов Edge Function **`recommend-spot`** с вашим JWT.
- На вход модели уходит **контекст:** ваши координаты, радиус, список доступных улова в радиусе (вид рыбы, наживка, расстояние и т.д.).
- На выходе: **точка на карте**, текст **reason**, опционально **suggested_bait** и **suggested_species**, модальное окно с результатом.

### Учётные записи

- **Регистрация и вход** по email и паролю (Supabase Auth).
- **Защита маршрутов:** без сессии — экран входа; поддержка сценария с подтверждением email (если включено в проекте).

---

## Архитектура (кратко)

```mermaid
flowchart LR
  subgraph client [Клиент Expo]
    UI[Экраны / Карта]
    API[src/lib/api]
  end
  subgraph supa [Supabase]
    PG[(PostgreSQL + RLS)]
    Auth[Auth]
    St[Storage]
    Fn[Edge Function recommend-spot]
  end
  subgraph yc [Yandex Cloud]
    LLM[Foundation Models]
    Maps[Maps JS API]
  end
  UI --> API
  API --> Auth
  API --> PG
  API --> St
  API --> Fn
  Fn --> PG
  Fn --> LLM
  UI --> Maps
```

- **Клиент** хранит только публичные ключи Supabase (anon/publishable) и ключ **Яндекс.Карт** — они попадают в бандл.
- **Секреты LLM** задаются через **`supabase secrets`**, не через `.env` приложения.
- **Политики RLS** ограничивают чтение/запись строк `catches`, `catch_photos`, `profiles` и объекты Storage согласно [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

---

## Стек технологий

| Слой | Технологии |
|------|------------|
| UI | Expo Router, React Native, react-hook-form, Zod, TanStack Query |
| Карта | Яндекс Карты JS API v3, WebView / веб‑iframe, постMessage‑мост |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions Deno) |
| AI | Yandex Cloud Foundation Models (вызов из Edge Function) |
| Качество | TypeScript, Jest |

---

## Скриншоты

> Добавьте сюда скриншоты карты, формы улова и модалки рекомендации — для GitHub можно положить файлы в `docs/screenshots/` и вставить `![…](docs/screenshots/….png)`.

---

## Требования

- **Node.js** 18+
- Аккаунт **Supabase**
- Ключ **JavaScript API / Maps JS API** для [Яндекс.Карт](https://developer.tech.yandex.ru/)
- Для AI: API‑ключ и **ID каталога** в [Yandex Cloud](https://console.cloud.yandex.ru/) (см. раздел LLM ниже)

---

## Быстрый старт

```bash
git clone <repo-url>
cd llm_hft_ryibalka   # или имя вашей папки
npm install
cp .env.example .env
```

Заполните `.env` (см. раздел **«Переменные окружения»** ниже), затем:

```bash
npx expo start
```

Дальше откройте приложение в симуляторе, на устройстве (**Expo Go** или dev build) или выберите **`w`** для веба.

---

## Настройка Supabase

1. Создайте проект в [Supabase](https://supabase.com/).
2. Выполните SQL из [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) (SQL Editor или `supabase db push` после link).
3. Включите **Email / Password** (Authentication → Providers → Email).

### LLM и Edge Function «Куда поехать?»

Нужен [Supabase CLI](https://supabase.com/docs/guides/cli). Ключи **не** кладите в `.env` клиента — только в секреты функции.

1. Вход и привязка проекта:

```bash
supabase login
supabase link --project-ref <ваш-project-ref>
```

(`project-ref`: Dashboard → Settings → General → Reference ID.)

2. Секреты Yandex Cloud (любой из вариантов имён). Ключ и каталог берутся в [Yandex Cloud](https://console.cloud.yandex.ru/) (каталог → доступ к **Foundation Models** / LLM; folder id вида `b1g...`). Без `supabase link` задайте **`SUPABASE_ACCESS_TOKEN`** (Dashboard → Account → Access Tokens) в окружении или в `.env` — скрипт загрузит секреты с **`--project-ref`** для вашего проекта.

```bash
export SUPABASE_ACCESS_TOKEN='sbp_...'   # если не используете supabase login + link
export YANDEX_GPT_API_KEY='AQVN...'
export YANDEX_FOLDER_ID='b1g...'
# опционально модель (иначе lite по умолчанию в коде):
export YANDEX_CLOUD_MODEL='yandexgpt-5.1/latest'
npm run llm:secrets
```

Поддерживаются также **`YANDEX_CLOUD_API_KEY`** / **`YANDEX_CLOUD_FOLDER`** и полный URI **`YANDEX_MODEL_URI=gpt://b1g.../yandexgpt-5.1/latest`** — см. [`scripts/push-llm-secrets.sh`](scripts/push-llm-secrets.sh) и Edge Function.

3. Деплой функции:

```bash
npm run llm:deploy
```

То же: `npm run deploy:function` или `./scripts/deploy-recommend-function.sh`. В [`supabase/config.toml`](supabase/config.toml) для `recommend-spot` указано `verify_jwt = true`. `SUPABASE_URL` и `SUPABASE_ANON_KEY` в рантайме функции задаются платформой.

---

## Переменные окружения

Файл **`.env`** (из [`.env.example`](.env.example)), только публичные для клиента:

| Переменная | Назначение |
|------------|------------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL проекта Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Publishable / anon ключ (не service_role) |
| `EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY` | Ключ JS API Яндекс.Карт |

После изменения `.env` перезапустите Metro.

---

## Скрипты npm

| Команда | Описание |
|---------|----------|
| `npm start` | Expo dev server |
| `npm run android` / `ios` / `web` | Запуск на платформе |
| `npm run typecheck` | Проверка TypeScript |
| `npm test` | Jest |
| `npm run llm:secrets` | Загрузка секретов LLM в Supabase (после `export` ключей) |
| `npm run llm:deploy` | Деплой Edge Function `recommend-spot` |
| `npm run build:web` | Статический бандл для web (`dist/`), как в CI |
| `npm run eas:init:project` | Привязка к Expo при заданном `EXPO_TOKEN` ([`scripts/eas-init.sh`](scripts/eas-init.sh)) |
| `npm run eas:login` / `eas:whoami` | Вход и проверка аккаунта EAS CLI |

---

## CI/CD (GitHub Actions)

В репозитории три workflow:

| Файл | Когда запускается | Что делает |
|------|-------------------|------------|
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Push и PR в `main` / `master`, при желании **Run workflow** вручную | `npm ci` → typecheck → тесты → `expo lint` |
| [`.github/workflows/release.yml`](.github/workflows/release.yml) | Push тега `v*` или **Run workflow** вручную | Те же проверки + **lint** → **GitHub Release** (`rybalka-web-<тег>.zip` + **`rybalka-<тег>.apk`** после полной EAS-сборки) → **web-dist** / **android-apk** → опционально **Object Storage** → **EAS iOS** при включении ([`eas.json`](eas.json)) |
| [`.github/workflows/deploy-recommend-spot.yml`](.github/workflows/deploy-recommend-spot.yml) | Только вручную (**workflow_dispatch**) | Деплой Edge Function `recommend-spot` в Supabase (нужен секрет `SUPABASE_ACCESS_TOKEN`) |

**Релиз на GitHub:** при **push тега `v*`** job **github-release** создаёт [**GitHub Release**](https://docs.github.com/repositories/releasing-projects-on-github/about-releases) с автозаметками и архивом **`rybalka-web-<тег>.zip`**. После успешной **EAS**-сборки Android job **attach-android-apk** добавляет в тот же релиз файл **`rybalka-<тег>.apk`** (профиль **`production-apk`** в [`eas.json`](eas.json): как `production`, но `android.buildType: apk`). Сборка в CI **ждёт** билд на стороне Expo и качает артефакт из ответа `eas build --wait --json`. Если Android-сборка падает, релиз с **web zip** всё равно остаётся; APK просто не появится. Ручной **Release** без тега шаги релиза **пропускает**. Тег: `git tag -a v1.0.0 -m "..." && git push origin v1.0.0`.

**Web (artifact):** в Job «build-web» каталог `dist` также сохраняется как artifact **web-dist** на странице запуска workflow. Если заданы секреты Object Storage (ниже), job **deploy-web-yandex** выкладывает `dist/` в бакет Яндекс.Облака через `aws s3 sync` и [`--endpoint-url` для Storage](https://cloud.yandex.ru/docs/storage/tools/aws-cli).

**Android .apk:** в релизе на GitHub см. выше. Дополнительно статус и артефакты всегда доступны на [expo.dev → Builds](https://expo.dev). **iOS .ipa** в GitHub Release этим workflow не прикрепляется (job **eas-ios** по-прежнему с `--no-wait`); при необходимости — отдельный шаг ожидания и выгрузки, как для Android.

### Веб в Yandex Object Storage (опционально)

1. [Консоль](https://console.cloud.yandex.ru/) → **Object Storage** → создайте **бакет** (например `rybalka-web`), регион **ru-central1**.
2. В бакете включите [**хостинг**](https://cloud.yandex.ru/docs/storage/concepts/hosting): для SPA укажите **главную** и **страницу ошибки** `index.html`, чтобы работали маршруты Expo Router.
3. Откройте чтение объектов с сайта (публичный доступ / политика бакета — по инструкции для статического сайта).
4. **Сервисный аккаунт** с ролью вроде `storage.editor` на каталог, [**статический ключ доступа**](https://cloud.yandex.ru/docs/iam/operations/sa/create-access-key).
5. В **GitHub → Secrets** добавьте:

| Секрет | Значение |
|--------|----------|
| `YANDEX_STORAGE_BUCKET` | Имя бакета |
| `YANDEX_STORAGE_ACCESS_KEY_ID` | Идентификатор ключа |
| `YANDEX_STORAGE_SECRET_ACCESS_KEY` | Секрет ключа |

После следующего **Release** файлы из `dist/` окажутся в бакете. URL сайта — в консоли Storage (хостинг) или через **Cloud CDN** при необходимости.

Если секреты не заданы, job **deploy-web-yandex** завершается с **notice** и не ломает workflow.

**Android и iOS:** сборка идёт в **облаке Expo** ([EAS Build](https://docs.expo.dev/build/introduction/)), не на раннере GitHub — так проще с подписями и Xcode. Нужен аккаунт Expo и один раз локально выполнить **`npx eas init`** (появится `projectId` в `app.config`), затем в [expo.dev](https://expo.dev) настроить учётные данные для iOS/Android при первом продакшен-сборке.

**iOS в GitHub Actions по умолчанию отключён:** без предварительной настройки Apple credentials на Expo неинтерактивный `eas build` падает с *Distribution Certificate is not validated*. Чтобы **не получать красный лог** при каждом релизе, job **eas-ios** запускается только если:
- в репозитории задана переменная **`EAS_IOS_ENABLED`** = `true` (*Settings → Secrets and variables → Actions → Variables*), **или**
- workflow **Release** запущен вручную с галкой **`build_ios`**.

До этого один раз локально: `npx eas credentials -p ios` или `npx eas build --platform ios --profile production` и пройти мастер Apple — затем можно включить CI для iOS. Статус EAS: [status.expo.dev](https://status.expo.dev/).

### Настройка Apple credentials для iOS (EAS)

1. **Apple Developer Program** — активная подписка на [developer.apple.com/programs](https://developer.apple.com/programs/enroll/) (учётная запись разработчика Apple).

2. **Bundle ID** — в проекте задан в [`app.config.ts`](app.config.ts) (`ios.bundleIdentifier`, сейчас `com.rybalka.app`). В [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) создайте **Identifier** типа App IDs с **точно таким же** bundle id (или используйте уже существующий).

3. **Интерактивно на своей машине** (нужны логин в Expo и Apple ID с **двухфакторной аутентификацией**):

   ```bash
   npx eas login
   npx eas credentials -p ios
   ```

   Либо первая сборка — мастер сам запросит сертификаты и профиль:

   ```bash
   npx eas build --platform ios --profile production
   ```

   Рекомендуется разрешить Expo **управлять credentials** («Let Expo handle» / аналог): тогда **Distribution Certificate** и **Provisioning Profile** сохраняются на стороне Expo, и **неинтерактивный** `eas build` из GitHub сможет их подхватить после того, как они созданы.

4. Проверка: [expo.dev](https://expo.dev) → проект **Рыбалка / rybalka** → **Credentials** — должны быть записи для iOS.

5. Включите job **eas-ios** в CI: переменная **`EAS_IOS_ENABLED=true`** или ручной **Release** с галкой **`build_ios`**.

Документация Expo: [App credentials](https://docs.expo.dev/app-signing/app-credentials/), [iOS credentials](https://docs.expo.dev/build-reference/ios-credentials/).

### Секреты GitHub (Settings → Secrets and variables → Actions)

| Секрет | Обязателен для |
|--------|----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Web и EAS |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Web и EAS |
| `EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY` | Web и EAS |
| `EXPO_TOKEN` | Только нативные сборки EAS — токен доступа в настройках аккаунта на [expo.dev](https://expo.dev) (*Access Tokens*) |
| `SUPABASE_ACCESS_TOKEN` | Только workflow **Deploy recommend-spot** ([личный токен](https://supabase.com/dashboard/account/tokens)) |
| `YANDEX_STORAGE_BUCKET`, `YANDEX_STORAGE_ACCESS_KEY_ID`, `YANDEX_STORAGE_SECRET_ACCESS_KEY` | Опционально: выгрузка web в **Object Storage** (см. выше) |

Без `EXPO_TOKEN` job **eas-android** (и **eas-ios**, если включён) завершатся ошибкой на шаге EAS — добавьте токен. Job **eas-ios** при теге не запускается, пока не заданы **`EAS_IOS_ENABLED`** или ручной запуск с **`build_ios`**.

### Один раз: проект EAS и `projectId`

Токен **`EXPO_TOKEN` может создать только владелец аккаунта** на [expo.dev → Access Tokens](https://expo.dev/accounts/_/settings/access-tokens); из репозитория или CI его сгенерировать нельзя.

После `npm install` один раз привяжите приложение к Expo (появится **`extra.eas.projectId`** в `app.config.ts`, каталог **`.eas/`** — их нужно закоммитить):

```bash
cp .env.eas.example .env.eas
# отредактируйте .env.eas — одна строка EXPO_TOKEN=…
npm run eas:init:project
```

Либо впишите **`EXPO_TOKEN`** в локальный **`.env`** (в проекте уже есть пустая строка «4) Expo EAS»).

Либо одной командой: `export EXPO_TOKEN='…' && npm run eas:init:project`.

Либо без токена в одном терминале: `npm run eas:login`, затем интерактивно **`npm run eas:init`**.

Тот же токен добавьте в **GitHub → Secrets → `EXPO_TOKEN`**, чтобы job **release** мог вызывать `eas build`.

Локально проверить web-сборку:

```bash
export EXPO_PUBLIC_SUPABASE_URL=...
export EXPO_PUBLIC_SUPABASE_ANON_KEY=...
export EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY=...
npm run build:web
```

---

## Тесты

```bash
npm test
npm run test:coverage
```

Пресет Jest из React Native ([`jest.config.js`](jest.config.js)). Тесты в [`__tests__/`](__tests__/): Auth, API (catches, profile, recommend), разметка карты (`yandexMapHtml`), UI. E2E (Detox/Maestro) подключаются отдельно.

---

## Структура репозитория

| Путь | Содержание |
|------|------------|
| [`app/`](app/) | Маршруты Expo Router: вкладки карта/профиль, авторизация, экран улова |
| [`src/components/`](src/components/) | Карта (WebView / web), кнопка рекомендации, UI |
| [`src/lib/api/`](src/lib/api/) | Клиент Supabase: уловы, профиль, рекомендации |
| [`src/map/yandexMapHtml.ts`](src/map/yandexMapHtml.ts) | HTML/JS bootstrap Яндекс.Карт для WebView |
| [`supabase/migrations/`](supabase/migrations/) | Схема БД, RLS, bucket хранилища |
| [`supabase/functions/recommend-spot/`](supabase/functions/recommend-spot/) | Edge Function + вызов Foundation Models |

---

## Регистрация и вход

- Если в Supabase включено **подтверждение email**, после регистрации сессии может не быть, пока пользователь не перейдёт по ссылке из письма — приложение это учитывает.
- Для локальной отладки подтверждение можно временно отключить в тех же настройках провайдера.
- Пароль в формах не короче **8 символов** (часто совпадает с политикой Supabase).

---

## Заметки по ключам Яндекса

<details>
<summary><strong>Карты (JS API в клиенте)</strong></summary>

Ключ Яндекс.Карт попадает в клиент — в кабинете разработчика настройте **ограничения** (Referer для web, bundle id / package для стора). Для **JavaScript API 3.0** без корректных ограничений карта может не загружаться: [документация по ограничениям](https://yandex.ru/dev/commercial/doc/ru/concepts/limit).

**Referer (web):** в списке — имена хостов без протокола (`localhost`, при необходимости отдельно `127.0.0.1`, для LAN — хост из адресной строки). После правок ключ может обновляться с задержкой (до ~15 минут).

Если скрипт **403** — смотрите DevTools → Network → запросы к `api-maps.yandex.ru`. После смены `.env` перезапустите Metro.

</details>

<details>
<summary><strong>AI (только Edge Function)</strong></summary>

Ключ Yandex Cloud и folder id не должны попадать в репозиторий клиента — только `supabase secrets` и деплой функции.

</details>

---

## UX сценарии (напоминание)

- **Карта:** публичные точки всех пользователей + ваши приватные (RLS).
- **＋ на карте:** выбор точки → экран нового улова.
- **«Куда поехать?»:** геолокация → Edge Function → ответ модели → маркер и модалка с текстом.

---

<div align="center">

Сделано с Expo и Supabase · карты — Яндекс · подсказки — Yandex Cloud AI

</div>
