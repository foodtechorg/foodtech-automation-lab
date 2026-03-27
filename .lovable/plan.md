

## План: Надати `finance_deputy` ті самі права, що й `chief_accountant`

### Поточний стан

Роль `finance_deputy` (Заст. директора з фінансів) існує в системі типів, але **не має жодних функціональних прав** — ані у фронтенді, ані в RLS-політиках бази даних. Роль `chief_accountant` (Головний бухгалтер) натомість має доступ до черги закупівель, рахунків до оплати та відповідних дій.

### Місця, де потрібно додати `finance_deputy` поруч з `chief_accountant`

#### Фронтенд (6 файлів):

1. **`src/App.tsx`** — маршрут `/purchase/queue`: додати `'finance_deputy'` до `allowedRoles`
2. **`src/components/purchase/PurchaseNavTabs.tsx`** — `canSeeQueue`: додати `|| profile?.role === 'finance_deputy'`
3. **`src/pages/purchase/PurchaseInvoiceDetail.tsx`** — `isTreasurer`: додати `|| profile?.role === "finance_deputy"`
4. **`src/pages/purchase/ApprovedRequestsQueue.tsx`** — `isTreasurer` (рядок 89): додати `|| profile?.role === 'finance_deputy'`; `getPageTitle` (рядок 801): додати `|| profile?.role === 'finance_deputy'`
5. **`src/components/AppSidebar.tsx`** — `queueRoles`: додати `'finance_deputy'`

#### RLS-політики (міграція SQL):

Додати `has_role(auth.uid(), 'finance_deputy'::app_role)` у всі політики, де вже є `chief_accountant`:

- **purchase_invoices**: SELECT та UPDATE
- **purchase_invoice_items**: SELECT, INSERT, UPDATE
- **purchase_invoice_attachments**: SELECT
- **purchase_requests**: SELECT, UPDATE
- **purchase_request_items**: SELECT
- **purchase_request_attachments**: SELECT
- **purchase_logs**: SELECT (для entity_type REQUEST та INVOICE)
- **raw_material_invoices**: SELECT та UPDATE (якщо `chief_accountant` там присутній)

### Технічна деталь

Кожна RLS-політика буде пересотворена (`DROP POLICY` + `CREATE POLICY`) з додаванням `OR has_role(auth.uid(), 'finance_deputy'::app_role)` поруч з кожним `has_role(auth.uid(), 'chief_accountant'::app_role)`.

### Результат

Заступник директора з фінансів отримає повний доступ до черги закупівель, рахунків до оплати, та зможе виконувати ті самі дії, що й головний бухгалтер.

