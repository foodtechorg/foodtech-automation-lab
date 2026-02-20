

## Додати роль `admin_director` до модуля Закупівля ТМЦ (read-only)

Адміністративний директор зможе бачити всі заявки та рахунки інших користувачів (крім чернеток), а також чергу погодження. Без права редагування чи погодження.

---

### 1. SQL міграція — додати `admin_director` до RLS SELECT-політик

Оновити 7 таблиць, додавши `has_role(auth.uid(), 'admin_director'::app_role)` до SELECT-політик:

| Таблиця | Політика |
|---|---|
| `purchase_requests` | "Users can view purchase requests" |
| `purchase_invoices` | "Users can view purchase invoices" |
| `purchase_request_items` | "Users can view purchase request items" |
| `purchase_invoice_items` | "Users can view purchase invoice items" |
| `purchase_request_attachments` | "Users can view request attachments" |
| `purchase_invoice_attachments` | "Users can view invoice attachments" |
| `purchase_logs` | "Users can view purchase logs" |

Логіка: до кожної з цих політик додається `OR has_role(auth.uid(), 'admin_director'::app_role)` поруч з іншими "наглядовими" ролями (coo, ceo, business_analyst тощо). Чернетки (`status <> 'DRAFT'`) залишаються прихованими.

### 2. Frontend — `PurchaseNavTabs.tsx`

Додати `admin_director` до списку `canSeeQueue`, щоб вкладка "Черга" була видимою:

```
const canSeeQueue = profile?.role === 'procurement_manager'
    || profile?.role === 'admin_director'   // <-- додати
    || ...
```

---

### Технічні деталі

Кожна SELECT-політика буде перестворена (`DROP POLICY` + `CREATE POLICY`) з тим самим виразом, але з додаванням `admin_director`. Приклад для `purchase_requests`:

```sql
DROP POLICY "Users can view purchase requests" ON purchase_requests;
CREATE POLICY "Users can view purchase requests" ON purchase_requests
FOR SELECT USING (
  (created_by = auth.uid())
  OR (
    (status <> 'DRAFT'::purchase_request_status)
    AND (
      has_role(auth.uid(), 'procurement_manager'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'chief_accountant'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'business_analyst'::app_role)
      OR has_role(auth.uid(), 'admin_director'::app_role)  -- NEW
    )
  )
);
```

Аналогічний підхід для решти 6 таблиць.

### Файли для зміни

| Файл | Дія |
|---|---|
| SQL міграція | Оновити 7 SELECT-політик |
| `src/components/purchase/PurchaseNavTabs.tsx` | Додати `admin_director` до `canSeeQueue` |
