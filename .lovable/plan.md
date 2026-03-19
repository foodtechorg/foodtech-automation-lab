

## План: Виправити URL та парсинг відповіді пошуку 1С

### Проблема

З скріншота видно, що 1С API використовує **path-based** пошук:
- Правильний URL: `/Search/часник`
- Поточний URL (невірний): `/Search?q=часник&limit=15`

Також відповідь — це **один об'єкт**, а не масив `{ items: [...] }`. Фронтенд очікує `json.items`, тому навіть при правильному URL результати не відобразяться.

### Зміни

**1. `supabase/functions/proxy-1c/index.ts`** — case `search-raw-materials`:

```
// Було:
targetUrl = `${BASE_URL}/Search?q=${encodeURIComponent(q)}&limit=${limit}`;

// Стане:
targetUrl = `${BASE_URL}/Search/${encodeURIComponent(q)}`;
```

**2. `src/services/rawMaterial1cApi.ts`** — парсинг відповіді `search1cRawMaterials`:

1С повертає один об'єкт (або масив — потрібно обробити обидва варіанти). Замінити:
```ts
const items: any[] = json.items || [];
```
На:
```ts
const items: any[] = Array.isArray(json) ? json : json.items ? json.items : [json];
```

Також `code` може використовуватись замість `id` для ідентифікатора.

**3. Контрагенти** — аналогічно потрібно уточнити URL. Поки що 1С повертає 404 на `/contractors/search`. Ймовірно правильний шлях також path-based (наприклад `/Contractors/пошук`). Поки що залишити як є, або спитати адміна 1С.

### Результат

Після цих змін пошук сировини по `/Search/{query}` почне працювати, і відповідь коректно парситиметься у список автокомпліту.

