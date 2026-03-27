

## План: Додати поле "Платник" до рахунків на закупівлю ТМЦ

### Поточний стан

- Таблиця `purchase_invoices` **не має** колонки `payer_entity`
- Enum `payer_entity` в БД має лише 2 значення: `FOODTECH`, `FOP`
- Потрібно 4 платники: **Фудтек, Макрос, Фудтек+, ФОП**
- Поле використовується тільки в модулі сировини (`raw_material_invoices`)

### Зміни

#### 1. Міграція БД

- Додати нові значення до enum: `ALTER TYPE payer_entity ADD VALUE 'MAKROS'; ALTER TYPE payer_entity ADD VALUE 'FOODTECH_PLUS';`
- Додати колонку `payer_entity` до `purchase_invoices` (nullable для існуючих записів, але обов'язкова на фронтенді при відправці)
- Оновити RLS-політики, якщо потрібно (колонка не впливає на доступ — не потрібно)

#### 2. Типи (`src/types/purchase.ts`)

- Додати `PayerEntity` тип: `'FOODTECH' | 'FOP' | 'MAKROS' | 'FOODTECH_PLUS'`
- Додати `payer_entity: PayerEntity | null` до `PurchaseInvoice`
- Додати `payer_entity?: PayerEntity` до `CreatePurchaseInvoicePayload`

#### 3. Також оновити `src/types/rawMaterial.ts`

- Розширити `PayerEntity` тип новими значеннями

#### 4. Форма рахунку (`src/pages/purchase/PurchaseInvoiceDetail.tsx`)

- Додати стейт `payerEntity` та Select з 4 варіантами
- Розмістити між "Контактна особа" та "Заявка" в сітці
- Включити в `handleSave` та `handleSubmitForApproval` (валідація — обов'язкове поле)
- Показувати в read-only режимі

#### 5. Список рахунків (`src/pages/purchase/PurchaseInvoices.tsx`)

- Додати колонку "Платник" в таблицю

#### 6. Черга — рахунки на погодження та до оплати (`src/pages/purchase/ApprovedRequestsQueue.tsx`)

- Додати колонку "Платник" в таблиці COO/CEO рахунків та TO_PAY

#### 7. Мапа лейблів

Створити спільну мапу для відображення:
```typescript
const payerEntityLabels: Record<string, string> = {
  FOODTECH: 'Фудтек',
  FOP: 'ФОП',
  MAKROS: 'Макрос',
  FOODTECH_PLUS: 'Фудтек+',
};
```

### Файли, що змінюються

| Файл | Зміна |
|---|---|
| Міграція SQL | Розширення enum + нова колонка |
| `src/types/purchase.ts` | Тип PayerEntity, поле в PurchaseInvoice |
| `src/types/rawMaterial.ts` | Розширення PayerEntity |
| `src/pages/purchase/PurchaseInvoiceDetail.tsx` | Select платника в формі + read-only + save/submit |
| `src/pages/purchase/PurchaseInvoices.tsx` | Колонка "Платник" |
| `src/pages/purchase/ApprovedRequestsQueue.tsx` | Колонка "Платник" в 3 таблицях рахунків |

