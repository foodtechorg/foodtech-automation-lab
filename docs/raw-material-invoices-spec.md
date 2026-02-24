# Фінальне ТЗ: Модуль "Закупка сировини — Рахунки"

## Зміни відносно попередньої версії ТЗ

На основі ваших коригувань:

1. **Без окремого модуля в сайдбарі** — сировина інтегрується в існуючий модуль "Закупівля ТМЦ". На формі "Нова заявка на закупівлю" додається третій тип "Закупівля сировини". При його виборі форма заявки замінюється формою рахунку на сировину.

2. **Єдиний список рахунків** — рахунки на сировину відображаються в тому ж списку `/purchase/invoices`, використовуючи існуючі колонки (Номер, Постачальник, Умови, Сума, Статус, Створено). Колонка "Умови" для сировини показуватиме payer_entity.

3. **Фільтр по статусу** — до списку рахунків додається фільтр по колонці "Статус".

4. **Спільний платіжний календар** — рахунки на сировину потрапляють у ту ж чергу/календар.

---

## Що буде реалізовано

### База даних

- Нові таблиці: `raw_material_invoices`, `raw_material_invoice_items`
- Кеш-таблиці: `suppliers_1c_cache`, `raw_materials_1c_cache`
- Нові enum: `raw_material_invoice_status`, `payer_entity`
- Оновлення enum `purchase_log_entity_type` (додати `RAW_INVOICE`)
- DB тригер паралельного погодження (3/3 approve -> APPROVED, будь-який reject -> REJECTED)
- DB тригер автонумерації `RAW-XXXX`
- RLS-політики для нових таблиць
- Оновлення `purchase_type` enum (додати `RAW_MATERIAL`)

### Frontend

- Зміна форми "Нова заявка": при виборі типу "Закупівля сировини" — рендериться форма рахунку на сировину замість форми заявки
- Компоненти автокомпліту: `SupplierAutocomplete`, `RawMaterialAutocomplete`
- Об'єднаний список рахунків: відображення як TMC/SERVICE, так і RAW_MATERIAL рахунків
- Фільтр по статусу в списку рахунків
- Картка рахунку на сировину з блоком паралельного погодження (3 особи)
- Інтеграція в чергу погодження

### Edge Functions

- `sync-1c-cache` — синхронізація довідників постачальників та сировини з 1С (cron 15 хв + on-demand)
- `create-1c-supplier-order` — створення "Заказ постачальника" в 1С після APPROVED

---

## Архітектура даних

### Таблиця `raw_material_invoices` (шапка рахунку)

| Поле | Тип | Опис |
|---|---|---|
| id | uuid PK | |
| number | text UNIQUE | Автонумерація, префікс RAW-XXXX |
| status | raw_material_invoice_status | Enum |
| approval_round | int DEFAULT 1 | Номер раунду погодження |
| invoice_date | date DEFAULT today | Дата створення рахунку |
| supplier_1c_id | text NOT NULL | ID постачальника з 1С |
| supplier_name | text NOT NULL | Денормалізовано для відображення |
| supplier_tax_id | text | ЄДРПОУ/ІПН |
| payer_entity | payer_entity NOT NULL | Enum: FOODTECH / FOP |
| expected_delivery_date | date NULL | |
| planned_payment_date | date NULL | |
| comment | text NULL | Внутрішній коментар |
| total_amount | numeric DEFAULT 0 | Оновлюється при зміні items |
| currency | text DEFAULT 'UAH' | |
| created_by | uuid FK profiles | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| **Погодження admin_director** | | |
| admin_director_decision | approval_decision NULL | |
| admin_director_comment | text NULL | |
| admin_director_decided_by | uuid NULL | |
| admin_director_decided_at | timestamptz NULL | |
| **Погодження COO** | | |
| coo_decision | approval_decision NULL | |
| coo_comment | text NULL | |
| coo_decided_by | uuid NULL | |
| coo_decided_at | timestamptz NULL | |
| **Погодження CEO** | | |
| ceo_decision | approval_decision NULL | |
| ceo_comment | text NULL | |
| ceo_decided_by | uuid NULL | |
| ceo_decided_at | timestamptz NULL | |
| **Інтеграція 1С** | | |
| one_c_po_id | text NULL | |
| one_c_po_number | text NULL | |
| one_c_po_date | date NULL | |
| integration_error_message | text NULL | |
| integration_status | text NULL | pending / sent / success / error |
| integration_idempotency_key | text UNIQUE NULL | raw_invoice:{id} |

### Таблиця `raw_material_invoice_items` (позиції)

| Поле | Тип | Опис |
|---|---|---|
| id | uuid PK | |
| invoice_id | uuid FK raw_material_invoices ON DELETE CASCADE | |
| raw_material_1c_id | text NOT NULL | ID сировини з 1С |
| raw_material_name | text NOT NULL | Денормалізовано |
| uom | text DEFAULT 'кг' | Одиниця виміру; підставляється default_uom з кешу |
| qty | numeric NOT NULL CHECK > 0 | |
| price | numeric NOT NULL CHECK >= 0 | |
| line_amount | numeric GENERATED ALWAYS AS (qty * price) STORED | |
| sort_order | int DEFAULT 0 | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Таблиця `suppliers_1c_cache`

| Поле | Тип | Опис |
|---|---|---|
| supplier_1c_id | text PK | |
| name | text NOT NULL | |
| tax_id | text | ЄДРПОУ |
| is_active | boolean DEFAULT true | |
| synced_at | timestamptz | Час останнього оновлення |

Індекси: `name` (trigram для пошуку), `tax_id` (btree)

### Таблиця `raw_materials_1c_cache`

| Поле | Тип | Опис |
|---|---|---|
| raw_material_1c_id | text PK | |
| name | text NOT NULL | |
| default_uom | text DEFAULT 'кг' | |
| is_active | boolean DEFAULT true | |
| synced_at | timestamptz | |

Індекс: `name` (trigram для пошуку)

---

## Ролі та доступи

Використовуємо існуючі ролі з `app_role` enum:

| Функція в модулі | Роль в системі | Права |
|---|---|---|
| Автор рахунку | `foreign_trade_manager` | Створює/редагує чернетки, подає на погодження, бачить свої рахунки |
| Погоджувач 1 | `admin_director` | Approve/Reject у статусі SUBMITTED |
| Погоджувач 2 | `coo` | Approve/Reject у статусі SUBMITTED |
| Погоджувач 3 | `ceo` | Approve/Reject у статусі SUBMITTED |
| Суперадмін | `admin` | Повний доступ: перегляд, керування, повторна відправка в 1С |

### Правила доступу (RLS)

- Автор може редагувати рахунок лише у статусах DRAFT або REJECTED (і тільки свій).
- Після SUBMITTED автор бачить рахунок read-only.
- Погоджувачі приймають рішення лише у статусі SUBMITTED, лише один раз на раунд.
- Після APPROVED рахунок read-only (окрім технічних полів інтеграції для admin).

---

## Логіка погодження (паралельна)

### Механізм

Рішення зберігаються в полях шапки рахунку (аналогічно TMC-модулю):

- `admin_director_decision`, `admin_director_decided_by`, `admin_director_decided_at`, `admin_director_comment`
- `coo_decision`, `coo_decided_by`, `coo_decided_at`, `coo_comment`
- `ceo_decision`, `ceo_decided_by`, `ceo_decided_at`, `ceo_comment`

**DB-тригер** після кожного UPDATE перевіряє:
- Якщо є хоча б один REJECTED → статус = REJECTED
- Якщо 3/3 APPROVED → статус = APPROVED
- Інакше залишається SUBMITTED

### Повторна подача після REJECTED

- `approval_round` збільшується на 1
- Всі поля рішень скидаються в NULL
- Статус переходить в SUBMITTED
- Попередні рішення зберігаються в логах

### State machine (статуси)

```
DRAFT → SUBMITTED → APPROVED → SENDING_TO_1C → PO_CREATED_1C
                 \→ REJECTED → SUBMITTED (новий раунд)
                                APPROVED → ... → INTEGRATION_ERROR
                                                    \→ (Resend) SENDING_TO_1C
DRAFT → CANCELLED (опційно)
```

Enum `raw_material_invoice_status`:
- `DRAFT`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`
- `SENDING_TO_1C`
- `PO_CREATED_1C`
- `INTEGRATION_ERROR`
- `CANCELLED`

---

## Логи та вкладення

### Логи

Використовуємо існуючу таблицю `purchase_logs`:
- Додати `'RAW_INVOICE'` до enum `purchase_log_entity_type`
- Використовувати існуючу функцію `log_purchase_event()` з `entity_type = 'RAW_INVOICE'`

### Вкладення

Створити таблицю `raw_material_invoice_attachments` з аналогічною структурою до `purchase_invoice_attachments`.

---

## Правила валідації

### Перед SUBMITTED

- `supplier_1c_id` заповнено (постачальник обраний)
- `payer_entity` обрано
- Хоча б 1 позиція
- У позиціях: qty > 0, price >= 0
- Рахунок постачальника (PDF) завантажений

### При REJECT

- Коментар обов'язковий

---

## UX/UI (екрани)

### Форма "Нова заявка на закупівлю"

При виборі типу "Закупівля сировини" форма змінюється:
- Автокомпліт постачальника з `suppliers_1c_cache` (пошук по name, tax_id)
- Вибір `payer_entity` (FOODTECH / FOP)
- Дати (очікувана поставка, планована оплата)
- Таблиця позицій з автокомплітом сировини з `raw_materials_1c_cache`
- uom по замовчуванню з кешу (`default_uom`)
- Авторозрахунок line_amount і total_amount
- Кнопки: "Зберегти чернетку", "Відправити на погодження"
- Кнопка "Оновити довідник" (синхронізація кешу on-demand)

### Список рахунків (об'єднаний)

- Відображає рахунки з `purchase_invoices` та `raw_material_invoices`
- Колонки: Номер, Постачальник, Умови (для сировини — payer_entity), Сума, Статус, Створено
- Фільтр по статусу (dropdown)
- Клік на TMC/SERVICE → `/purchase/invoices/:id`
- Клік на сировину → `/purchase/raw-invoices/:id`

### Картка рахунку на сировину

Блоки:
1. **Дані рахунку** + позиції
2. **Погодження** — 3 рядки (admin_director / coo / ceo): статус, дата, коментар. Кнопки Approve/Reject для відповідної ролі у статусі SUBMITTED
3. **Логи**
4. **Вкладення**
5. **Блок 1С**: статус інтеграції, номер замовлення, помилка; кнопка "Resend to 1C" (тільки admin при INTEGRATION_ERROR)

---

## Бізнес-логіка в БД

### Тригер погодження

DB trigger на `raw_material_invoices` AFTER UPDATE:
- Перевіряє admin_director_decision, coo_decision, ceo_decision
- Якщо хоча б один = REJECTED → status = REJECTED
- Якщо всі три = APPROVED → status = APPROVED
- Інакше status залишається SUBMITTED

### Повторна подача

RPC-функція:
- Інкремент `approval_round`
- Скидання всіх *_decision, *_decided_by, *_decided_at, *_comment в NULL
- status = SUBMITTED
- Лог "RESUBMITTED"

### Автонумерація

DB trigger BEFORE INSERT: генерація `number` у форматі `RAW-XXXX` (4 цифри з лідируючими нулями).

---

## Інтеграція з 1С

### Синхронізація довідників

Edge Function `sync-1c-cache`:
- Виклик 1С API для suppliers та raw materials
- Інкрементальна синхронізація по `updated_since`
- Запускається за cron (кожні 15 хв) + on-demand через кнопку

### Створення "Заказ постачальника"

Edge Function `create-1c-supplier-order`:
- Тригер: рахунок переходить в APPROVED
- Встановлює integration_status = 'pending', генерує idempotency_key
- HTTP POST до 1С з реквізитами + позиціями
- Успіх: статус PO_CREATED_1C, зберігає one_c_po_*
- Помилка: статус INTEGRATION_ERROR, зберігає error_message
- Resend: та сама функція з тим же idempotency_key (дублів не буде)

---

## Кеш 1С — стратегія синхронізації

**Гібридний підхід** для мінімальної затримки:
- **Фонова синхронізація**: Supabase Edge Function за cron (кожні 15 хв), яка викликає 1С API з параметром `updated_since` для інкрементального оновлення.
- **Ручна кнопка "Оновити довідник"**: На формі створення рахунку, яка запускає ту саму Edge Function on-demand.

---

## Розбивка на промти (задачі)

### Промт 1: SQL-міграція — таблиці, enum, тригери, RLS

Створити SQL-міграцію:
- Enum `raw_material_invoice_status` (DRAFT, SUBMITTED, APPROVED, REJECTED, SENDING_TO_1C, PO_CREATED_1C, INTEGRATION_ERROR, CANCELLED)
- Enum `payer_entity` (FOODTECH, FOP)
- Додати `RAW_MATERIAL` до `purchase_type` enum
- Додати `RAW_INVOICE` до `purchase_log_entity_type` enum
- Таблиця `raw_material_invoices` (всі поля шапки, включаючи 3 блоки погодження та поля 1С)
- Таблиця `raw_material_invoice_items` (з `line_amount` як generated column)
- Таблиці `suppliers_1c_cache` та `raw_materials_1c_cache` з trigram-індексами
- Тригер автонумерації RAW-XXXX
- Тригер паралельного погодження (перевірка 3 рішень)
- RLS-політики для всіх нових таблиць

### Промт 2: TypeScript-типи та API-сервіси

- `src/types/rawMaterial.ts` — типи для нових таблиць
- `src/services/rawMaterialApi.ts` — CRUD для рахунків на сировину
- `src/services/rawMaterial1cCacheApi.ts` — пошук в кеш-таблицях (постачальники, сировина)
- Оновити `src/types/purchase.ts` — додати `RAW_MATERIAL` до `PurchaseType`

### Промт 3: Форма створення рахунку на сировину

Змінити `NewPurchaseRequest.tsx`:
- Додати опцію "Закупівля сировини" до Select типу закупівлі
- При виборі "Закупівля сировини" рендерити окрему форму рахунку:
  - Автокомпліт постачальника (новий компонент `SupplierAutocomplete`)
  - Вибір payer_entity (FOODTECH / FOP)
  - Дати (очікувана поставка, планована оплата)
  - Таблиця позицій з автокомплітом сировини (`RawMaterialAutocomplete`)
  - Авторозрахунок line_amount та total_amount
  - Кнопки: "Зберегти чернетку", "Відправити на погодження"
  - Кнопка "Оновити довідник"

### Промт 4: Об'єднаний список рахунків + фільтр по статусу

Змінити `PurchaseInvoices.tsx`:
- Завантажувати рахунки з обох таблиць (`purchase_invoices` + `raw_material_invoices`)
- Використовувати ті ж колонки (Номер, Постачальник, Умови/Платник, Сума, Статус, Створено)
- Додати dropdown-фільтр по статусу
- Розрізняти по кліку: TMC/SERVICE рахунки → `/purchase/invoices/:id`, сировина → `/purchase/raw-invoices/:id`

### Промт 5: Картка рахунку на сировину (деталі, редагування, погодження)

- Нова сторінка `RawMaterialInvoiceDetail.tsx`
- Блок даних рахунку + позиції (read-only або editable залежно від статусу)
- Блок паралельного погодження: 3 рядки (admin_director, coo, ceo) з кнопками Approve/Reject
- Логіка повторної подачі після REJECTED (скидання рішень, інкремент approval_round)
- Блок логів та вкладень
- Маршрут `/purchase/raw-invoices/:id` в App.tsx

### Промт 6: Інтеграція в чергу погодження

- Оновити `ApprovedRequestsQueue.tsx` — додати секцію з рахунками на сировину, що чекають погодження
- Показувати тільки SUBMITTED рахунки, де поточний користувач ще не прийняв рішення

### Промт 7: Edge Function — sync-1c-cache

- Supabase Edge Function для синхронізації кеш-таблиць з 1С
- Інкрементальна синхронізація по `updated_since`
- Cron-запуск кожні 15 хв + API для on-demand виклику

### Промт 8: Edge Function — create-1c-supplier-order

- Supabase Edge Function для створення "Заказ постачальника" в 1С
- Виклик після переходу в APPROVED
- Idempotency через `integration_idempotency_key`
- Обробка помилок, статус INTEGRATION_ERROR, кнопка Resend для admin

---

## Порядок виконання

Промти виконуються послідовно: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Після кожного промта — тестування та корекція перед наступним.
