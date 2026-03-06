

## Діагностика: Автокомпліт сировини не працює

### Знайдена проблема

Edge Function `proxy-1c` використовує метод `supabase.auth.getClaims(token)`, який **не існує** в `@supabase/supabase-js`. Кожен запит до функції повертає **401 Unauthorized**, тому що `getClaims` завжди повертає помилку.

Це підтверджено тестовим викликом функції — відповідь: `{"error":"Unauthorized"}` зі статусом 401.

В логах функції видно тільки `booted` → `shutdown` без жодних логів бізнес-логіки — функція падає на етапі авторизації і не доходить до виклику 1С API.

### Виправлення

**Файл:** `supabase/functions/proxy-1c/index.ts`, рядки 25-29

Замінити `getClaims(token)` на `supabase.auth.getUser(token)` — це стандартний метод перевірки JWT токена:

```typescript
// Було:
const token = authHeader.replace('Bearer ', '');
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
if (claimsError || !claimsData?.claims) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
}

// Стане:
const { data: { user }, error: userError } = await supabase.auth.getUser(token);
if (userError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
}
```

Одна зміна, один файл. Після деплою автокомпліт почне працювати (за умови що 1С сервер доступний ззовні).

