-- Оновити заявки, де рахунок на погодженні COO/CEO -> INVOICE_PENDING
UPDATE purchase_requests pr
SET status = 'INVOICE_PENDING', updated_at = now()
FROM purchase_invoices pi
WHERE pi.request_id = pr.id
  AND pi.status IN ('PENDING_COO', 'PENDING_CEO')
  AND pr.status = 'IN_PROGRESS';

-- Оновити заявки, де рахунок до оплати або доставляється -> DELIVERING
UPDATE purchase_requests pr
SET status = 'DELIVERING', updated_at = now()
FROM purchase_invoices pi
WHERE pi.request_id = pr.id
  AND pi.status IN ('TO_PAY', 'DELIVERED')
  AND pr.status IN ('IN_PROGRESS', 'INVOICE_PENDING');

-- Оновити заявки, де рахунок оплачено -> COMPLETED
UPDATE purchase_requests pr
SET status = 'COMPLETED', updated_at = now()
FROM purchase_invoices pi
WHERE pi.request_id = pr.id
  AND pi.status = 'PAID'
  AND pr.status IN ('IN_PROGRESS', 'INVOICE_PENDING', 'DELIVERING');