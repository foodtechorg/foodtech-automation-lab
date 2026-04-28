## Проблема

Поточні URL для контрагентів у Edge-функції `proxy-1c` не співпадають з тим, що віддає 1С API. Тому пошук постачальника не працює.

Розробник 1С підтвердив правильні шляхи:
- `GET /api/v1/SearchContractors/{ContractorsName}` — пошук за назвою (path-based)
- `GET /api/v1/SearchContractorsid/{Contractorsid}` — картка контрагента + банківські рахунки

## Що змінюється

### 1. `supabase/functions/proxy-1c/index.ts`

Замінити URL у двох гілках `switch (action)`:

**`search-contractors`:**
```ts
// Було:
targetUrl = `${BASE_URL}/contractors/search?q=${encodeURIComponent(q)}&limit=${limit}`;
// Стає:
targetUrl = `${BASE_URL}/api/v1/SearchContractors/${encodeURIComponent(q)}`;
```
Параметр `limit` більше не передається в 1С (його там немає) — обмеження відбувається на фронті.

**`get-contractor`:**
```ts
// Було:
targetUrl = `${BASE_URL}/contractors/${id}`;
// Стає:
targetUrl = `${BASE_URL}/api/v1/SearchContractorsid/${encodeURIComponent(id)}`;
```

Гілки `create-contractor` та `create-supplier-order` НЕ чіпаємо (за вимогою).

### 2. `src/services/rawMaterial1cApi.ts`

- У `search1cContractors`: жорстко обмежити результат до **7 елементів** на боці фронту (`items.slice(0, 7)`), щоб не залежати від того, скільки повертає 1С. Параметр `limit` у URL до проксі залишається, але фактично ігнорується.
- Перевірити маппінг полів у відповіді 1С. Зараз код очікує плоский об'єкт `{ id, name, taxId }` всередині `json.items[]`. Можливо, реальна відповідь — масив (`[...]`) або інша обгортка. Зробимо мапінг гнучким за зразком сировини:
  - Корінь: підтримати і `Array.isArray(json)`, і `json.items`.
  - Поля ID: `id || code || Ref_Key`.
  - Поля назви: `name || Description`.
  - Поля коду ЄДРПОУ: `taxId || tax_id || EDRPOU || edrpou || code`.
- У `get1cContractor`: розширити мапінг тими ж правилами + витягнути банківські рахунки, якщо вони є у відповіді (поле під назвою `bankAccounts`/`accounts`/`BankAccounts`). Поки що зберігати їх у новому опціональному полі `bank_accounts` об'єкта `Supplier1cCache` (не записуючи в БД — тільки повертати в UI для майбутнього використання).

### 3. Мінімальна довжина запиту

Залишається 2 символи (без змін).

## Уточнення, які ще треба підтвердити після першого тесту

- Точна структура відповіді `/SearchContractors/{name}` — масив чи `{ items: [...] }`. Перевіримо логами з `proxy-1c` після деплою. Якщо буде неочікуваний формат — швидко доправимо мапінг.
- Формат картки `/SearchContractorsid/{id}` — як саме оформлені банківські рахунки (масив, об'єкт, які поля). Поки що мапінг буде «м'який»: якщо знайдемо — повернемо, якщо ні — пропустимо без помилки.

## Як перевіримо

1. Деплой Edge-функції `proxy-1c` (відбувається автоматично).
2. У формі заявки-рахунку «Закупівля сировини» почати вводити назву постачальника (≥2 символи).
3. Перевірити логи `proxy-1c` (`[proxy-1c] Fetching 1C: .../api/v1/SearchContractors/...`) і відповідь 1С.
4. За потреби — підкоригувати мапінг полів у `rawMaterial1cApi.ts`.

## Що НЕ змінюється

- URL та логіка для сировини (`/Search/{q}`, `/raw-materials/{id}`) — працює.
- POST-ендпоінти (`create-contractor`, `create-supplier-order`) — за вашою вимогою не чіпаємо.
- Мінімальна довжина запиту (2 символи).
- Авторизація (Bearer/Basic/None через `ONE_C_API_KEY`).
