-- 1. Оновлення SELECT політики для purchase_requests - видалення accountant
DROP POLICY IF EXISTS "Users can view purchase requests" ON purchase_requests;

CREATE POLICY "Users can view purchase requests" ON purchase_requests
FOR SELECT TO authenticated
USING (
  (created_by = auth.uid())
  OR (
    (status <> 'DRAFT'::purchase_request_status)
    AND (
      has_role(auth.uid(), 'procurement_manager'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- 2. Оновлення SELECT політики для purchase_invoices
-- procurement_manager бачить ВСІ рахунки (включно з DRAFT)
-- accountant бачить тільки TO_PAY/PAID/DELIVERED (як treasurer)
DROP POLICY IF EXISTS "Users can view purchase invoices" ON purchase_invoices;

CREATE POLICY "Users can view purchase invoices" ON purchase_invoices
FOR SELECT TO authenticated
USING (
  -- Власні рахунки - завжди бачить
  (created_by = auth.uid())
  -- Рахунки до власних заявок (не DRAFT)
  OR (
    (status <> 'DRAFT'::purchase_invoice_status)
    AND (request_id IS NOT NULL)
    AND (EXISTS (
      SELECT 1 FROM purchase_requests pr
      WHERE pr.id = purchase_invoices.request_id
      AND pr.created_by = auth.uid()
    ))
  )
  -- procurement_manager бачить ВСІ рахунки (включно з DRAFT)
  OR has_role(auth.uid(), 'procurement_manager'::app_role)
  -- coo, ceo, admin бачать всі не-DRAFT рахунки
  OR (
    (status <> 'DRAFT'::purchase_invoice_status)
    AND (
      has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
  -- treasurer та accountant бачать тільки TO_PAY/PAID/DELIVERED
  OR (
    (has_role(auth.uid(), 'treasurer'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))
    AND (status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status, 'DELIVERED'::purchase_invoice_status]))
  )
);