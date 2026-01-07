-- Крок 2: Оновлення RLS політик з використанням нових ролей

-- 1. Оновлення SELECT політики для purchase_invoices - додати chief_accountant
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
    (has_role(auth.uid(), 'treasurer'::app_role) OR has_role(auth.uid(), 'chief_accountant'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))
    AND (status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status, 'DELIVERED'::purchase_invoice_status]))
  )
);

-- 2. Оновлення UPDATE політики для purchase_invoices - додати chief_accountant
DROP POLICY IF EXISTS "Users can update purchase invoices" ON purchase_invoices;

CREATE POLICY "Users can update purchase invoices" ON purchase_invoices
FOR UPDATE TO authenticated
USING (
  ((created_by = auth.uid()) AND (status = 'DRAFT'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'coo'::app_role) AND (status = 'PENDING_COO'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'ceo'::app_role) AND (status = 'PENDING_COO'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'treasurer'::app_role) AND (status = 'TO_PAY'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'chief_accountant'::app_role) AND (status = 'TO_PAY'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'accountant'::app_role) AND (status = 'PAID'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status])))
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  ((created_by = auth.uid()) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status])))
  OR ((has_role(auth.uid(), 'coo'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)) AND (status = ANY (ARRAY['PENDING_COO'::purchase_invoice_status, 'TO_PAY'::purchase_invoice_status, 'REJECTED'::purchase_invoice_status])))
  OR ((has_role(auth.uid(), 'treasurer'::app_role) OR has_role(auth.uid(), 'chief_accountant'::app_role)) AND (status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status])))
  OR (has_role(auth.uid(), 'accountant'::app_role) AND (status = ANY (ARRAY['PAID'::purchase_invoice_status, 'DELIVERED'::purchase_invoice_status])))
  OR (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status])))
  OR has_role(auth.uid(), 'admin'::app_role)
);