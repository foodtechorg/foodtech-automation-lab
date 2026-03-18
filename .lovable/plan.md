

## План: Оновити URL пошуку сировини в proxy-1c

### Проблема
Ендпоінт пошуку сировини використовує шлях `/raw-materials/search`, але 1С API очікує `/Search`.

### Зміна
**`supabase/functions/proxy-1c/index.ts`** — рядок 93:

Замінити:
```
targetUrl = `${BASE_URL}/raw-materials/search?q=${encodeURIComponent(q)}&limit=${limit}`;
```

На:
```
targetUrl = `${BASE_URL}/Search?q=${encodeURIComponent(q)}&limit=${limit}`;
```

Після зміни — задеплоїти функцію.

