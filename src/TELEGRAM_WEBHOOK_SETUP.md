# Telegram webhook (BTT Nexus API)

Сервер — **Hono** в `src/server/index.tsx`, деплой например на **Railway** (см. корневой `README.md`).

## Проблема 401

Telegram не отправляет заголовок `Authorization`. Если маршрут вебхука случайно защищён JWT-middleware, запросы получат **401**.

## Решение

В коде API маршрут `POST .../make-server-f9553289/telegram-webhook` должен быть **публичным** (без обязательного Bearer), либо проверка должна опираться на данные Telegram (например секрет в query/body), а не на CRM JWT.

После деплоя укажите в BotFather URL вида:

```text
https://<ваш-домен-railway>/make-server-f9553289/telegram-webhook
```

где `<ваш-домен-railway>` совпадает с `PUBLIC_BASE_URL` без завершающего `/`.

## Проверка

1. CRM → **Настройки** → **Отладка**: статус webhook, при необходимости **«Исправить Webhook»**.
2. Боту: `/ping` — ожидается ответ о работе системы.
3. Логи сервиса на Railway (или локально `npm run server`).

## Безопасность

Публичный только вебхук Telegram; остальные маршруты CRM по-прежнему с JWT. При желании добавьте проверку `secret_token` из настроек Telegram Bot API.
