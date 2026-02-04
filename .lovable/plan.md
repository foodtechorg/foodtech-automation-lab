

## План: Виправлення відхилення рахунків з Черги

### Причина проблеми

При відхиленні рахунку зі сторінки деталей (`PurchaseInvoiceDetail.tsx`) використовується RPC функція `reject_purchase_invoice`, яка працює з `SECURITY DEFINER` і обходить RLS.

При відхиленні з Черги (`ApprovedRequestsQueue.tsx`) використовується прямий SQL UPDATE, який підпадає під RLS політику. Коли статус змінюється на `DRAFT`, SELECT політика не дозволяє COO бачити рядок зі статусом `DRAFT`, тому PostgREST не може підтвердити успішність операції і повертає помилку.

### Рішення

Замінити прямі UPDATE виклики в `ApprovedRequestsQueue.tsx` на виклики існуючої RPC функції `reject_purchase_invoice` - аналогічно до того, як це зроблено в `PurchaseInvoiceDetail.tsx`.

---

### Зміни у файлі `src/pages/purchase/ApprovedRequestsQueue.tsx`

#### 1. Функція `handleRejectInvoiceCOO` (рядки 619-650)

**Було:**
```typescript
const handleRejectInvoiceCOO = async (invoiceId: string) => {
  setProcessingId(invoiceId);
  try {
    const { error } = await supabase
      .from('purchase_invoices')
      .update({
        status: 'DRAFT',
        coo_decision: 'PENDING',
        coo_decided_by: null,
        coo_decided_at: null,
        coo_comment: rejectComment || null,
        ceo_decision: 'PENDING',
        ceo_decided_by: null,
        ceo_decided_at: null,
        ceo_comment: null,
      })
      .eq('id', invoiceId);

    if (error) throw error;
    // ...
  }
}
```

**Стане:**
```typescript
const handleRejectInvoiceCOO = async (invoiceId: string) => {
  setProcessingId(invoiceId);
  try {
    const { error } = await supabase.rpc('reject_purchase_invoice', {
      p_invoice_id: invoiceId,
      p_role: 'COO',
      p_comment: rejectComment.trim() || null
    });

    if (error) throw error;
    // ...
  }
}
```

#### 2. Функція `handleRejectInvoiceCEO` (рядки 697-730)

**Було:**
```typescript
const handleRejectInvoiceCEO = async (invoiceId: string) => {
  setProcessingId(invoiceId);
  try {
    const { error } = await supabase
      .from('purchase_invoices')
      .update({
        status: 'DRAFT',
        // ...
      })
      .eq('id', invoiceId);
    // ...
  }
}
```

**Стане:**
```typescript
const handleRejectInvoiceCEO = async (invoiceId: string) => {
  setProcessingId(invoiceId);
  try {
    const { error } = await supabase.rpc('reject_purchase_invoice', {
      p_invoice_id: invoiceId,
      p_role: 'CEO',
      p_comment: rejectComment.trim() || null
    });

    if (error) throw error;
    // ...
  }
}
```

---

### Таблиця змін

| Файл | Дія | Опис |
|------|-----|------|
| `src/pages/purchase/ApprovedRequestsQueue.tsx` | Редагувати | Замінити прямі UPDATE на RPC `reject_purchase_invoice` у функціях `handleRejectInvoiceCOO` та `handleRejectInvoiceCEO` |

---

### Переваги рішення

1. **Консистентність** - обидва місця (деталі рахунку та черга) використовують однаковий механізм
2. **Без змін в базі даних** - RPC функція вже існує і працює
3. **Швидке виправлення** - лише зміна 2 функцій у фронтенді
4. **Надійність** - RPC з `SECURITY DEFINER` гарантовано обходить RLS

---

### Тестування

Після застосування змін:
1. Увійти як COO (p.seminoga@foodtech.org.ua)
2. Відкрити Закупівля ТМЦ → Черга
3. Спробувати відхилити рахунок з черги
4. Перевірити, що рахунок успішно повертається на статус DRAFT
5. Перевірити, що коментар зберігається

