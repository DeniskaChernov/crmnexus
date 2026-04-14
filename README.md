# BTT Nexus

CRM и внутренний портал: React (Vite) + API на Hono + Postgres (Railway). Код HTTP API: каталог **`src/server/`** (точка входа `server/entry.ts`).

## Локальная разработка

1. Скопируйте `.env.example` в `.env` в корне и задайте `DATABASE_URL`, `JWT_SECRET`, `CRM_WEBHOOK_SECRET`, при необходимости `OPENAI_API_KEY`.
2. `npm install`
3. Примените схему: `npm run migrate`
4. В одном терминале: `npm run server` (API, по умолчанию порт **4000**).
5. В другом: `npm run dev` (Vite, порт **3000**). Запросы на `/make-server-f9553289/*` проксируются на `http://localhost:4000`.

Вход в CRM: после регистрации/логина токен хранится в `localStorage` как `crm_token`.

## Railway

- Сервис **Postgres**: переменная `DATABASE_URL` (Railway подставляет автоматически при линке БД).
- Сервис **Node** для API: корневая команда старта, например `npm run server`; переменные `JWT_SECRET`, `CRM_WEBHOOK_SECRET`, `PUBLIC_BASE_URL` (публичный URL этого сервиса), при необходимости `OPENAI_*`.
- `ALLOW_SELF_SIGNUP=false` в проде. Для первоначального онбординга можно временно поставить `true`, зарегистрировать первый аккаунт и вернуть `false`.
- Для Telegram webhook рекомендуется задать `TELEGRAM_WEBHOOK_SECRET` (проверка источника через `X-Telegram-Bot-Api-Secret-Token`).
- После деплоя выполните миграцию один раз (локально с тем же `DATABASE_URL` или через одноразовую команду в Railway): `npm run migrate`.

## Webhook с сайта (btt-site)

Сайт шлёт подписанное тело на `POST {PUBLIC_BASE_URL}/make-server-f9553289/webhooks/site` с заголовками `X-BTT-*` и тем же секретом, что в `CRM_WEBHOOK_SECRET`. Репозиторий сайта не меняется — только URL и секрет в его конфиге.

## Прочее

Исходный макет: [Figma — BTT Nexus](https://www.figma.com/design/MwPghSYSgBj5P0XEjeCWZv/BTT-Nexus).
