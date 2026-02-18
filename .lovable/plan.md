
## Баг: рахунок INV-0059 "застряг" в PENDING_COO після подвійного погодження

### Причина (Root Cause)

У `PurchaseInvoiceDetail.tsx` функції `handleCOOApprove` і `handleCEOApprove` перевіряють рішення іншої сторони через **локальний React state** (`invoice?.coo_decision` / `invoice?.ceo_decision`), а не через свіжі дані з БД:

```ts
// handleCEOApprove — баг тут
const cooAlreadyApproved = invoice?.coo_decision === "APPROVED"; // stale state!
const newStatus = cooAlreadyApproved ? "TO_PAY" : "PENDING_COO";
```

Якщо COO і CEO погоджують незалежно (не оновлюючи сторінку між собою), один із них отримає застарілий стан і виставить неправильний статус.

---

### Два рішення

**1. Fix стейт-логіки (frontend)** — перед визначенням `newStatus` робити свіжий `SELECT` з БД, щоб отримати актуальний стан рішень.

**2. Перенести логіку на сервер (DB trigger)** — PostgreSQL-тригер `AFTER UPDATE ON purchase_invoices` автоматично виставляє `TO_PAY`, якщо `coo_decision='APPROVED' AND ceo_decision='APPROVED'`. Це усуває race condition на рівні БД і не залежить від фронтенду.

Рекомендую **обидва**: DB-тригер як надійний захист + frontend-фікс для коректного UX-відображення.

---

### Зміни

#### 1. SQL міграція (два кроки)

**a) Виправити поточний запис INV-0059:**
```sql
UPDATE purchase_invoices
SET status = 'TO_PAY'
WHERE number = 'INV-0059'
  AND coo_decision = 'APPROVED'
  AND ceo_decision = 'APPROVED'
  AND status = 'PENDING_COO';
```

**b) Створити тригер для захисту від майбутніх race conditions:**
```sql
CREATE OR REPLACE FUNCTION fn_auto_approve_invoice()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.coo_decision = 'APPROVED'
     AND NEW.ceo_decision = 'APPROVED'
     AND NEW.status NOT IN ('TO_PAY', 'PAID', 'DELIVERED', 'REJECTED')
  THEN
    NEW.status := 'TO_PAY';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_approve_invoice
BEFORE UPDATE ON purchase_invoices
FOR EACH ROW EXECUTE FUNCTION fn_auto_approve_invoice();
```

#### 2. Frontend fix — `PurchaseInvoiceDetail.tsx`

У `handleCOOApprove` і `handleCEOApprove` замінити читання рішення іншої сторони з локального state на свіжий запит до БД:

```ts
// handleCOOApprove — БУЛО (stale state):
const ceoAlreadyApproved = invoice?.ceo_decision === "APPROVED";

// СТАНЕ (fresh from DB):
const { data: freshInvoice } = await supabase
  .from("purchase_invoices").select("ceo_decision").eq("id", id).single();
const ceoAlreadyApproved = freshInvoice?.ceo_decision === "APPROVED";
```

Аналогічно для `handleCEOApprove` — перечитувати `coo_decision` перед визначенням `newStatus`.

---

### Файли для зміни

| Файл | Дія |
|---|---|
| SQL міграція | Виправити INV-0059 + створити тригер `trg_auto_approve_invoice` |
| `src/pages/purchase/PurchaseInvoiceDetail.tsx` | Замінити stale state на fresh DB read у handleCOOApprove і handleCEOApprove |
