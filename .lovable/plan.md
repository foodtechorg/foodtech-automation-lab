

## Діагностика: Edge Function `proxy-1c` — спінер крутиться, дані не приходять

### Знайдені проблеми

**Проблема 1: Функція не обробляє запити**
Логи показують тільки `booted` → `shutdown`, жодного рядка з бізнес-логіки (ні auth check, ні 1C fetch, ні error). Це означає, що функція падає ще до обробки запиту — ймовірно, на етапі імпорту `esm.sh`.

**Проблема 2: `getUser()` може зависати**
Метод `supabase.auth.getUser()` робить HTTP-запит до Supabase Auth API. Якщо JWT протермінований (а він може бути — `exp: 1772803005`), виклик все одно повертає помилку, але може зависнути в edge runtime.

**Проблема 3: 1С API може бути недоступний з хмари**
`http://srv.foodtech.org.ua:3280` — це on-premise сервер. Supabase Edge Functions працюють у хмарі Deno Deploy. Якщо сервер не доступний ззовні або `fetch` до HTTP (не HTTPS) блокується — запит повисне без таймауту.

### План виправлення

**Крок 1: Додати діагностичне логування** в `proxy-1c/index.ts` — `console.log` на кожному етапі (початок запиту, після auth, перед 1С fetch, після 1С fetch). Це покаже точно де зависає.

**Крок 2: Додати таймаут на fetch до 1С** — `AbortController` з таймаутом 10 секунд, щоб запит не висів нескінченно:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);
response = await fetch(url, { headers, signal: controller.signal });
clearTimeout(timeout);
```

**Крок 3: Переключити імпорт** з `https://esm.sh/@supabase/supabase-js@2` на `npm:@supabase/supabase-js@2` — це стабільніший спосіб імпорту в Deno runtime.

**Крок 4: Передеплоїти і перевірити** — задеплоїти функцію, подивитись в логи, і викликати через curl щоб побачити реальну помилку.

### Файли для зміни

Один файл: `supabase/functions/proxy-1c/index.ts`

