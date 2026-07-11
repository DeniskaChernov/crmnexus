# BTT Nexus

CRM и внутренний портал: React (Vite) + API на Hono + Postgres (Railway).

- **Фронт:** Vite + React, сборка в `build/`
- **API:** `src/server/`, точка входа `server/entry.ts`
- **Префикс API:** `/api/*` (ранее legacy Supabase Edge Function)

## Локальная разработка

1. Скопируйте `.env.example` в `.env` и задайте `DATABASE_URL`, `JWT_SECRET`, `CRM_WEBHOOK_SECRET`.
2. `npm install`
3. `npm run migrate`
4. Терминал 1: `npm run server` (API, порт **4000**)
5. Терминал 2: `npm run dev` (Vite, порт **3000**). Запросы `/api/*` проксируются на `http://localhost:4000`.

Вход: токен в `localStorage` как `crm_token`.

## Railway

- **Postgres** — `DATABASE_URL` (линкуется автоматически)
- **Node-сервис** — `npm start`; переменные `JWT_SECRET`, `CRM_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`, `CORS_ORIGINS`
- После деплоя: `npm run migrate` один раз

## Webhook с сайта (btt-site)

`POST {PUBLIC_BASE_URL}/api/webhooks/site` с заголовками `X-BTT-*` и секретом `CRM_WEBHOOK_SECRET`.

## Склад

Единый склад **BTT Nexus**. Данные AIKO/Bizly при чтении автоматически объединяются в BTT.

## ИИ-память

CRM-чат сохраняет историю диалога в Postgres (`ai_chat_history_*`) и подгружает контекст страницы при каждом запросе.
