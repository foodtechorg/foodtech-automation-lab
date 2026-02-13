

## План: Додавання ролі "Бізнес-аналітик" (business_analyst)

### Огляд

Нова роль `business_analyst` надає **read-only доступ до всіх модулів** (R&D, Розробка, Закупівлі, Бібліотека знань), але **без права редагування**. У модулі "Закупівля ТМЦ" працює як звичайний замовник (може створювати свої заявки на закупівлю).

---

### 1. Зміни в базі даних (SQL міграція)

**1.1 Додати значення до enum `app_role`:**
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'business_analyst';
```

**1.2 Додати SELECT RLS-політики** для таблиць, до яких зараз немає доступу:

| Таблиця | Дія |
|---------|-----|
| `requests` | Додати `business_analyst` до SELECT-політики |
| `request_events` | Додати `business_analyst` до SELECT-політики |
| `rd_request_attachments` | Додати `business_analyst` до SELECT-політики |
| `rd_request_testing_samples` | Додати `business_analyst` до SELECT-політики |
| `development_recipes` | Додати `business_analyst` до SELECT-політики |
| `development_recipe_ingredients` | Додати `business_analyst` до SELECT-політики |
| `development_samples` | Додати `business_analyst` до SELECT-політики |
| `development_sample_ingredients` | Додати `business_analyst` до SELECT-політики |
| `development_sample_lab_results` | Додати `business_analyst` до SELECT-політики |
| `development_sample_pilot` | Додати `business_analyst` до SELECT-політики |
| `purchase_requests` | Додати `business_analyst` до SELECT (non-DRAFT) |
| `purchase_request_items` | Додати `business_analyst` до SELECT (non-DRAFT) |
| `purchase_request_attachments` | Додати `business_analyst` до SELECT (non-DRAFT) |
| `purchase_invoices` | Додати `business_analyst` до SELECT (non-DRAFT) |
| `purchase_invoice_items` | Додати `business_analyst` до SELECT (non-DRAFT) |
| `purchase_invoice_attachments` | Додати `business_analyst` до SELECT (non-DRAFT) |
| `purchase_logs` | Додати `business_analyst` до SELECT |
| `kb_documents` | Додати `business_analyst` до SELECT |
| `kb_chunks` | Додати `business_analyst` до SELECT |
| `kb_vector_documents` | Додати `business_analyst` до SELECT |

Закупівельні INSERT/UPDATE/DELETE політики залишаються без змін -- `business_analyst` вже може створювати свої заявки як звичайний користувач (через `created_by = auth.uid()`).

---

### 2. Зміни в Edge Functions

**`supabase/functions/update-user-role/index.ts`** -- додати `'business_analyst'` до масиву `validRoles`.

---

### 3. Зміни у фронтенді

| Файл | Зміна |
|------|-------|
| `src/lib/i18n.ts` | Додати переклад: `business_analyst: "Бізнес-аналітик"` |
| `src/hooks/useAuth.tsx` | Додати `'business_analyst'` до типу `UserRole` |
| `src/components/AppSidebar.tsx` | Додати `'business_analyst'` до UserRole та до масивів ролей всіх модулів (R&D, Розробка, Закупівля, Бібліотека знань). Маршрут за замовчуванням: `/rd/board` для R&D, `/purchase/requests` для закупівель |
| `src/pages/AdminPanel.tsx` | Додати `'business_analyst'` до UserRole та `availableRoles` |
| `src/App.tsx` | Додати `'business_analyst'` до `allowedRoles` всіх маршрутів: `/rd/board`, `/rd/analytics`, `/analytics`, `/development`, `/development/requests/:id`, `/kb`, `/kb/:id`, `/purchase/queue` (read-only перегляд черги) |

---

### 4. Read-only логіка в UI

Роль `business_analyst` буде працювати аналогічно до `ceo`/`coo`/`admin_director` -- ці ролі вже мають view-only доступ у Development та R&D модулях. Потрібно перевірити та додати `business_analyst` до перевірок read-only у компонентах:

- **R&D модуль**: вже обмежений -- лише `sales_manager` і `rd_dev` можуть редагувати
- **Development модуль**: перевірки `isViewOnly` в компонентах (DevelopmentBoard, DevelopmentRequestDetail) -- додати `business_analyst`
- **Procurement модуль**: як звичайний користувач бачить свої заявки і може створювати нові. Також бачить non-DRAFT заявки/рахунки інших (read-only)
- **KB модуль**: тільки перегляд, без кнопок створення/редагування -- додати перевірку ролі

---

### 5. Порядок виконання

1. SQL міграція: додати enum + RLS-політики
2. Оновити Edge Function `update-user-role`
3. Оновити `i18n.ts`, `useAuth.tsx`, `AppSidebar.tsx`, `AdminPanel.tsx`
4. Оновити `App.tsx` -- маршрути
5. Додати read-only перевірки в компоненти Development та KB модулів

