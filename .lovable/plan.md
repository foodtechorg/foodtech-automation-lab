

## План: Доступ для ролі "Фінансовий аналітик" (read-only)

### Огляд

Надання ролі `financial_analyst` доступу тільки для перегляду (без редагування) до:
1. **Модуль "Заявки R&D"**: Всі заявки на розробку (аналогічно до ролей ceo, coo, admin_director)
2. **Модуль "Закупівля ТМЦ"**: Рахунки зі статусами "До оплати" (TO_PAY) та "Оплачено" (PAID)

---

### 1. Зміни в RLS політиках (Database)

#### 1.1 Таблиця `requests` - SELECT

Поточна політика дозволяє перегляд для ролей: `sales_manager` (свої), `rd_dev`, `rd_manager`, `admin`, `ceo`, `coo`, `quality_manager`, `admin_director`.

**Зміна:** Додати `financial_analyst` до списку ролей з повним доступом на читання.

```sql
DROP POLICY IF EXISTS "Users can view requests" ON requests;

CREATE POLICY "Users can view requests" ON requests
FOR SELECT USING (
  (has_role(auth.uid(), 'sales_manager'::app_role) AND (author_email = (
    SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
  )))
  OR has_role(auth.uid(), 'rd_dev'::app_role)
  OR has_role(auth.uid(), 'rd_manager'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role)
  OR has_role(auth.uid(), 'admin_director'::app_role)
  OR has_role(auth.uid(), 'financial_analyst'::app_role)  -- NEW
);
```

#### 1.2 Таблиця `request_events` - SELECT

**Зміна:** Додати `financial_analyst` до політики перегляду хронології.

#### 1.3 Таблиця `test_results` - SELECT

**Зміна:** Додати `financial_analyst` до політики перегляду результатів тестування.

#### 1.4 Таблиця `purchase_invoices` - SELECT

Поточна політика дозволяє перегляд TO_PAY/PAID/DELIVERED для ролей: `treasurer`, `chief_accountant`, `accountant`.

**Зміна:** Додати `financial_analyst` до цього списку для доступу до рахунків TO_PAY та PAID.

```sql
DROP POLICY IF EXISTS "Users can view purchase invoices" ON purchase_invoices;

CREATE POLICY "Users can view purchase invoices" ON purchase_invoices
FOR SELECT TO authenticated
USING (
  (created_by = auth.uid())
  OR (
    (status <> 'DRAFT'::purchase_invoice_status)
    AND (request_id IS NOT NULL)
    AND (EXISTS (
      SELECT 1 FROM purchase_requests pr
      WHERE pr.id = purchase_invoices.request_id
      AND pr.created_by = auth.uid()
    ))
  )
  OR has_role(auth.uid(), 'procurement_manager'::app_role)
  OR (
    (status <> 'DRAFT'::purchase_invoice_status)
    AND (
      has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
  OR (
    (has_role(auth.uid(), 'treasurer'::app_role) 
     OR has_role(auth.uid(), 'chief_accountant'::app_role) 
     OR has_role(auth.uid(), 'accountant'::app_role)
     OR has_role(auth.uid(), 'financial_analyst'::app_role))  -- NEW
    AND (status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status]))
  )
);
```

**Примітка:** Для `financial_analyst` доступні лише статуси TO_PAY та PAID (без DELIVERED), оскільки його функції пов'язані з фінансовим аналізом, а не з логістикою.

---

### 2. Зміни в навігації (Frontend)

#### 2.1 AppSidebar.tsx

**Зміна:** Додати `financial_analyst` до списку ролей модуля "Заявки R&D".

```typescript
{
  id: 'rd',
  label: 'Заявки R&D',
  icon: FileText,
  roles: ['sales_manager', 'rd_dev', 'rd_manager', 'admin', 'quality_manager', 'admin_director', 'ceo', 'coo', 'financial_analyst'],
  getPath: role => (role === 'sales_manager' || role === 'quality_manager') ? '/requests/my' : '/rd/board'
}
```

**Примітка:** `financial_analyst` буде направлятись на `/rd/board` (перегляд всіх заявок).

#### 2.2 PurchaseNavTabs.tsx (опціонально)

Фінансовий аналітик вже має доступ до модуля "Закупівля ТМЦ" (роль = 'all'), але не потребує вкладки "Черга".

Поточна логіка вже коректна - `financial_analyst` не включений до `canSeeQueue`, тому він бачитиме тільки вкладки "Заявки" та "Рахунки".

---

### 3. Зміни в маршрутизації (App.tsx)

#### 3.1 Маршрут `/rd/board`

**Зміна:** Додати `financial_analyst` до списку дозволених ролей.

```typescript
<Route
  path="/rd/board"
  element={
    <ProtectedRoute allowedRoles={['rd_dev', 'rd_manager', 'admin', 'ceo', 'coo', 'quality_manager', 'admin_director', 'financial_analyst']}>
      ...
    </ProtectedRoute>
  }
/>
```

#### 3.2 Маршрут `/rd/analytics`

**Зміна:** Додати `financial_analyst` до списку (для перегляду аналітики R&D).

```typescript
allowedRoles={['rd_dev', 'rd_manager', 'admin', 'ceo', 'coo', 'quality_manager', 'admin_director', 'sales_manager', 'financial_analyst']}
```

---

### 4. Таблиця змін

| Файл | Зміна |
|------|-------|
| `supabase/migrations/XXXXXX_financial_analyst_access.sql` | RLS політики для requests, request_events, test_results, purchase_invoices |
| `src/components/AppSidebar.tsx` | Додати `financial_analyst` до модуля "rd" |
| `src/App.tsx` | Додати `financial_analyst` до маршрутів `/rd/board` та `/rd/analytics` |

---

### 5. Матриця доступу для financial_analyst

| Модуль/Функція | Доступ |
|----------------|--------|
| **Заявки R&D** | ✅ Перегляд всіх заявок |
| R&D Board | ✅ Перегляд |
| R&D Analytics | ✅ Перегляд |
| Деталі заявки | ✅ Перегляд |
| Хронологія заявки | ✅ Перегляд |
| Редагування заявки | ❌ Не дозволено |
| **Закупівля ТМЦ** | |
| Заявки на закупівлю | ✅ Тільки власні |
| Рахунки TO_PAY | ✅ Перегляд |
| Рахунки PAID | ✅ Перегляд |
| Рахунки DRAFT/PENDING | ❌ Не видно |
| Черга | ❌ Не доступна |
| Дії з рахунками | ❌ Не дозволено (тільки перегляд) |

---

### 6. Безпека

- **Тільки SELECT**: Фінансовий аналітик не отримує права на UPDATE/INSERT/DELETE для жодної з таблиць
- **Обмежений доступ до рахунків**: Бачить тільки статуси TO_PAY та PAID - це дозволяє аналізувати фінансові потоки без доступу до чернеток чи заявок в процесі погодження
- **Консистентність**: UI не показує кнопки редагування/дій, RLS забезпечує захист на рівні бази даних

