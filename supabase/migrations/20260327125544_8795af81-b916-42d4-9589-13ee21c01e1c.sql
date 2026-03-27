-- Add finance_deputy role alongside chief_accountant in all relevant RLS policies

-- 1. purchase_invoices SELECT
DROP POLICY "Users can view purchase invoices" ON public.purchase_invoices;
CREATE POLICY "Users can view purchase invoices" ON public.purchase_invoices
FOR SELECT USING (
  (created_by = auth.uid())
  OR ((status <> 'DRAFT'::purchase_invoice_status) AND (request_id IS NOT NULL) AND (EXISTS (
    SELECT 1 FROM purchase_requests pr WHERE pr.id = purchase_invoices.request_id AND pr.created_by = auth.uid()
  )))
  OR has_role(auth.uid(), 'procurement_manager'::app_role)
  OR ((status <> 'DRAFT'::purchase_invoice_status) AND (
    has_role(auth.uid(), 'coo'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'business_analyst'::app_role)
    OR has_role(auth.uid(), 'admin_director'::app_role)
  ))
  OR ((has_role(auth.uid(), 'treasurer'::app_role)
    OR has_role(auth.uid(), 'chief_accountant'::app_role)
    OR has_role(auth.uid(), 'finance_deputy'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role)
    OR has_role(auth.uid(), 'financial_analyst'::app_role))
    AND (status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status])))
);

-- 2. purchase_invoices UPDATE (USING)
DROP POLICY "Users can update purchase invoices" ON public.purchase_invoices;
CREATE POLICY "Users can update purchase invoices" ON public.purchase_invoices
FOR UPDATE
USING (
  ((created_by = auth.uid()) AND (status = 'DRAFT'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'coo'::app_role) AND (status = ANY (ARRAY['PENDING_COO'::purchase_invoice_status, 'PENDING_CEO'::purchase_invoice_status])))
  OR (has_role(auth.uid(), 'ceo'::app_role) AND (status = ANY (ARRAY['PENDING_COO'::purchase_invoice_status, 'PENDING_CEO'::purchase_invoice_status])))
  OR (has_role(auth.uid(), 'treasurer'::app_role) AND (status = 'TO_PAY'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'chief_accountant'::app_role) AND (status = 'TO_PAY'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'finance_deputy'::app_role) AND (status = 'TO_PAY'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'accountant'::app_role) AND (status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status])))
  OR (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status])))
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  ((created_by = auth.uid()) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status])))
  OR (has_role(auth.uid(), 'coo'::app_role) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status, 'PENDING_CEO'::purchase_invoice_status, 'TO_PAY'::purchase_invoice_status, 'REJECTED'::purchase_invoice_status])))
  OR (has_role(auth.uid(), 'ceo'::app_role) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status, 'PENDING_CEO'::purchase_invoice_status, 'TO_PAY'::purchase_invoice_status, 'REJECTED'::purchase_invoice_status])))
  OR ((has_role(auth.uid(), 'treasurer'::app_role) OR has_role(auth.uid(), 'chief_accountant'::app_role) OR has_role(auth.uid(), 'finance_deputy'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)) AND (status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status, 'DELIVERED'::purchase_invoice_status])))
  OR (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status])))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 3. purchase_invoice_items SELECT
DROP POLICY "Users can view purchase invoice items" ON public.purchase_invoice_items;
CREATE POLICY "Users can view purchase invoice items" ON public.purchase_invoice_items
FOR SELECT USING (
  EXISTS (SELECT 1 FROM purchase_invoices pi WHERE pi.id = purchase_invoice_items.invoice_id AND (
    (pi.created_by = auth.uid())
    OR ((pi.status <> 'DRAFT'::purchase_invoice_status) AND (
      has_role(auth.uid(), 'procurement_manager'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'chief_accountant'::app_role)
      OR has_role(auth.uid(), 'finance_deputy'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'business_analyst'::app_role)
      OR has_role(auth.uid(), 'admin_director'::app_role)
    ))
  ))
);

-- 4. purchase_invoice_attachments SELECT
DROP POLICY "Users can view invoice attachments" ON public.purchase_invoice_attachments;
CREATE POLICY "Users can view invoice attachments" ON public.purchase_invoice_attachments
FOR SELECT USING (
  EXISTS (SELECT 1 FROM purchase_invoices pi WHERE pi.id = purchase_invoice_attachments.invoice_id AND (
    (pi.created_by = auth.uid())
    OR ((pi.status <> 'DRAFT'::purchase_invoice_status) AND (
      has_role(auth.uid(), 'procurement_manager'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'chief_accountant'::app_role)
      OR has_role(auth.uid(), 'finance_deputy'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'business_analyst'::app_role)
      OR has_role(auth.uid(), 'admin_director'::app_role)
    ))
  ))
);

-- 5. purchase_requests SELECT
DROP POLICY "Users can view purchase requests" ON public.purchase_requests;
CREATE POLICY "Users can view purchase requests" ON public.purchase_requests
FOR SELECT USING (
  (created_by = auth.uid())
  OR ((status <> 'DRAFT'::purchase_request_status) AND (
    has_role(auth.uid(), 'procurement_manager'::app_role)
    OR has_role(auth.uid(), 'coo'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'treasurer'::app_role)
    OR has_role(auth.uid(), 'chief_accountant'::app_role)
    OR has_role(auth.uid(), 'finance_deputy'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'business_analyst'::app_role)
    OR has_role(auth.uid(), 'admin_director'::app_role)
  ))
);

-- 6. purchase_requests UPDATE
DROP POLICY "Users can update purchase requests" ON public.purchase_requests;
CREATE POLICY "Users can update purchase requests" ON public.purchase_requests
FOR UPDATE
USING (
  ((created_by = auth.uid()) AND (status = 'DRAFT'::purchase_request_status))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status = 'IN_PROGRESS'::purchase_request_status))
  OR ((has_role(auth.uid(), 'treasurer'::app_role) OR has_role(auth.uid(), 'chief_accountant'::app_role) OR has_role(auth.uid(), 'finance_deputy'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)) AND (status = ANY (ARRAY['IN_PROGRESS'::purchase_request_status, 'INVOICE_PENDING'::purchase_request_status, 'DELIVERING'::purchase_request_status])))
)
WITH CHECK (
  ((created_by = auth.uid()) AND (status = ANY (ARRAY['DRAFT'::purchase_request_status, 'IN_PROGRESS'::purchase_request_status])))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status = 'IN_PROGRESS'::purchase_request_status))
  OR ((has_role(auth.uid(), 'treasurer'::app_role) OR has_role(auth.uid(), 'chief_accountant'::app_role) OR has_role(auth.uid(), 'finance_deputy'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)) AND (status = ANY (ARRAY['INVOICE_PENDING'::purchase_request_status, 'DELIVERING'::purchase_request_status, 'COMPLETED'::purchase_request_status])))
);

-- 7. purchase_request_items SELECT
DROP POLICY "Users can view purchase request items" ON public.purchase_request_items;
CREATE POLICY "Users can view purchase request items" ON public.purchase_request_items
FOR SELECT USING (
  EXISTS (SELECT 1 FROM purchase_requests pr WHERE pr.id = purchase_request_items.request_id AND (
    (pr.created_by = auth.uid())
    OR ((pr.status <> 'DRAFT'::purchase_request_status) AND (
      has_role(auth.uid(), 'procurement_manager'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'chief_accountant'::app_role)
      OR has_role(auth.uid(), 'finance_deputy'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'business_analyst'::app_role)
      OR has_role(auth.uid(), 'admin_director'::app_role)
    ))
  ))
);

-- 8. purchase_request_attachments SELECT
DROP POLICY "Users can view request attachments" ON public.purchase_request_attachments;
CREATE POLICY "Users can view request attachments" ON public.purchase_request_attachments
FOR SELECT USING (
  EXISTS (SELECT 1 FROM purchase_requests pr WHERE pr.id = purchase_request_attachments.request_id AND (
    (pr.created_by = auth.uid())
    OR ((pr.status <> 'DRAFT'::purchase_request_status) AND (
      has_role(auth.uid(), 'procurement_manager'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'chief_accountant'::app_role)
      OR has_role(auth.uid(), 'finance_deputy'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'business_analyst'::app_role)
      OR has_role(auth.uid(), 'admin_director'::app_role)
    ))
  ))
);

-- 9. purchase_logs SELECT (REQUEST)
DROP POLICY "Users can view purchase logs" ON public.purchase_logs;
CREATE POLICY "Users can view purchase logs" ON public.purchase_logs
FOR SELECT USING (
  ((entity_type = 'REQUEST'::purchase_log_entity_type) AND (EXISTS (
    SELECT 1 FROM purchase_requests pr WHERE pr.id = purchase_logs.entity_id AND (
      (pr.created_by = auth.uid())
      OR ((pr.status <> 'DRAFT'::purchase_request_status) AND (
        has_role(auth.uid(), 'procurement_manager'::app_role)
        OR has_role(auth.uid(), 'coo'::app_role)
        OR has_role(auth.uid(), 'ceo'::app_role)
        OR has_role(auth.uid(), 'treasurer'::app_role)
        OR has_role(auth.uid(), 'chief_accountant'::app_role)
        OR has_role(auth.uid(), 'finance_deputy'::app_role)
        OR has_role(auth.uid(), 'accountant'::app_role)
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'business_analyst'::app_role)
        OR has_role(auth.uid(), 'admin_director'::app_role)
      ))
    )
  )))
  OR ((entity_type = 'INVOICE'::purchase_log_entity_type) AND (EXISTS (
    SELECT 1 FROM purchase_invoices pi WHERE pi.id = purchase_logs.entity_id AND (
      (pi.created_by = auth.uid())
      OR ((pi.status <> 'DRAFT'::purchase_invoice_status) AND (
        has_role(auth.uid(), 'procurement_manager'::app_role)
        OR has_role(auth.uid(), 'coo'::app_role)
        OR has_role(auth.uid(), 'ceo'::app_role)
        OR has_role(auth.uid(), 'treasurer'::app_role)
        OR has_role(auth.uid(), 'chief_accountant'::app_role)
        OR has_role(auth.uid(), 'finance_deputy'::app_role)
        OR has_role(auth.uid(), 'accountant'::app_role)
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'business_analyst'::app_role)
        OR has_role(auth.uid(), 'admin_director'::app_role)
      ))
    )
  )))
);

-- 10. raw_material_invoices SELECT
DROP POLICY "raw_inv_select" ON public.raw_material_invoices;
CREATE POLICY "raw_inv_select" ON public.raw_material_invoices
FOR SELECT USING (
  (created_by = auth.uid())
  OR ((status <> 'DRAFT'::raw_material_invoice_status) AND (
    has_role(auth.uid(), 'admin_director'::app_role)
    OR has_role(auth.uid(), 'coo'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'business_analyst'::app_role)
    OR has_role(auth.uid(), 'treasurer'::app_role)
    OR has_role(auth.uid(), 'chief_accountant'::app_role)
    OR has_role(auth.uid(), 'finance_deputy'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role)
    OR has_role(auth.uid(), 'financial_analyst'::app_role)
  ))
);

-- 11. purchase_logs for RAW_INVOICE (also add finance_deputy)
DROP POLICY "Users can view raw invoice logs" ON public.purchase_logs;
CREATE POLICY "Users can view raw invoice logs" ON public.purchase_logs
FOR SELECT USING (
  (entity_type = 'RAW_INVOICE'::purchase_log_entity_type) AND (EXISTS (
    SELECT 1 FROM raw_material_invoices ri WHERE ri.id = purchase_logs.entity_id AND (
      (ri.created_by = auth.uid())
      OR ((ri.status <> 'DRAFT'::raw_material_invoice_status) AND (
        has_role(auth.uid(), 'admin_director'::app_role)
        OR has_role(auth.uid(), 'coo'::app_role)
        OR has_role(auth.uid(), 'ceo'::app_role)
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'business_analyst'::app_role)
        OR has_role(auth.uid(), 'treasurer'::app_role)
        OR has_role(auth.uid(), 'chief_accountant'::app_role)
        OR has_role(auth.uid(), 'finance_deputy'::app_role)
        OR has_role(auth.uid(), 'accountant'::app_role)
      ))
    )
  ))
);