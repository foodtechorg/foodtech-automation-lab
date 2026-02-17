

## Event-driven відправка нотифікацій через webhook

### Архітектура

Коли `enqueue_notification_event` вставляє запис у `notification_outbox` зі статусом `pending`, PostgreSQL-тригер автоматично викликає Edge Function через `pg_net`, яка надсилає POST у n8n webhook.

```text
enqueue_notification_event()
  └─ INSERT INTO notification_outbox (status='pending')
       └─ AFTER INSERT trigger
            └─ net.http_post() → Edge Function "outbox-notify"
                 └─ POST → n8n webhook (з ретраями)
                      └─ UPDATE notification_outbox (webhook_attempts, etc.)
```

---

### 1. SQL міграція

**a) Увімкнути розширення `pg_net`:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

**b) Додати колонки трекінгу до `notification_outbox`:**
- `webhook_attempts` (integer, default 0)
- `webhook_last_error` (text, nullable)
- `webhook_last_attempt_at` (timestamptz, nullable)

**c) Створити тригерну функцію**, яка при INSERT з `status='pending'` AND `channel='telegram'` викликає Edge Function через `net.http_post`:
- URL: `{SUPABASE_URL}/functions/v1/outbox-notify`
- Headers: `Content-Type: application/json`, `Authorization: Bearer {service_role_key}`
- Body: `{"outboxId": "<id>", "createdAt": "<created_at>"}`
- Timeout: 5000ms

**d) Створити тригер** `trg_outbox_notify` AFTER INSERT на `notification_outbox`.

### 2. Edge Function `outbox-notify`

Нова функція `supabase/functions/outbox-notify/index.ts`:

- Приймає `{outboxId, createdAt}` з тіла запиту
- Читає ENV: `N8N_OUTBOX_WEBHOOK_URL`, `N8N_OUTBOX_WEBHOOK_TOKEN`, `N8N_OUTBOX_WEBHOOK_TIMEOUT_MS` (default 5000)
- Виконує POST до n8n:
  - Headers: `Content-Type: application/json`, `x-fta-token: ${token}`
  - Body: `{"event": "outbox.created", "outboxId": "<id>", "createdAt": "<ISO>"}`
- Retry до 5 разів з exponential backoff (1s, 2s, 4s, 8s, 16s)
- Після кожної спроби оновлює `webhook_attempts`, `webhook_last_error`, `webhook_last_attempt_at` через service role client
- Не блокує UX (тригер fire-and-forget через pg_net)

### 3. Конфігурація

**`supabase/config.toml`** -- додати:
```toml
[functions.outbox-notify]
verify_jwt = false
```

### 4. Секрети

Додати через інструмент:
- `N8N_OUTBOX_WEBHOOK_URL` = `https://foodtech.app.n8n.cloud/webhook/fta/outbox-notify`
- `N8N_OUTBOX_WEBHOOK_TOKEN` -- запросити у користувача

`N8N_OUTBOX_WEBHOOK_TIMEOUT_MS` -- hardcoded default 5000 в коді edge function (можна override через ENV).

### 5. Безпека

- Токен зберігається лише в Supabase Secrets, не потрапляє в клієнтський код
- Edge Function викликається з `service_role_key` через тригер (verify_jwt = false, але авторизація через service role)
- Помилки логуються в БД (webhook_last_error), не в клієнтські відповіді

---

### Файли для створення/зміни

| Файл | Дія |
|---|---|
| SQL міграція | Створити: pg_net, колонки, тригер |
| `supabase/functions/outbox-notify/index.ts` | Створити |
| `supabase/config.toml` | Додати секцію outbox-notify |

### Що НЕ змінюється

- Фронтенд-код (`notifications.ts`, `HandoffDialog`, `QuickHandoffDialog`) -- без змін
- Існуючі записи в outbox -- не торкаються
- RPC `enqueue_notification_event` -- без змін

