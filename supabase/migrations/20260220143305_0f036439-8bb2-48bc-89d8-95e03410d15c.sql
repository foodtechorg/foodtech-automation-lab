
-- 1. purchase_requests
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
      OR has_role(auth.uid(), 'admin_director'::app_role)
    )
  )
);

-- 2. purchase_invoices
DROP POLICY "Users can view purchase invoices" ON purchase_invoices;
CREATE POLICY "Users can view purchase invoices" ON purchase_invoices
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
    OR has_role(auth.uid(), 'accountant'::app_role)
    OR has_role(auth.uid(), 'financial_analyst'::app_role))
    AND (status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status])))
);

-- 3. purchase_request_items
DROP POLICY "Users can view purchase request items" ON purchase_request_items;
CREATE POLICY "Users can view purchase request items" ON purchase_request_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM purchase_requests pr
    WHERE pr.id = purchase_request_items.request_id
    AND (
      pr.created_by = auth.uid()
      OR (
        pr.status <> 'DRAFT'::purchase_request_status
        AND (
          has_role(auth.uid(), 'procurement_manager'::app_role)
          OR has_role(auth.uid(), 'coo'::app_role)
          OR has_role(auth.uid(), 'ceo'::app_role)
          OR has_role(auth.uid(), 'treasurer'::app_role)
          OR has_role(auth.uid(), 'accountant'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'business_analyst'::app_role)
          OR has_role(auth.uid(), 'admin_director'::app_role)
        )
      )
    )
  )
);

-- 4. purchase_invoice_items
DROP POLICY "Users can view purchase invoice items" ON purchase_invoice_items;
CREATE POLICY "Users can view purchase invoice items" ON purchase_invoice_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM purchase_invoices pi
    WHERE pi.id = purchase_invoice_items.invoice_id
    AND (
      pi.created_by = auth.uid()
      OR (
        pi.status <> 'DRAFT'::purchase_invoice_status
        AND (
          has_role(auth.uid(), 'procurement_manager'::app_role)
          OR has_role(auth.uid(), 'coo'::app_role)
          OR has_role(auth.uid(), 'ceo'::app_role)
          OR has_role(auth.uid(), 'treasurer'::app_role)
          OR has_role(auth.uid(), 'chief_accountant'::app_role)
          OR has_role(auth.uid(), 'accountant'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'business_analyst'::app_role)
          OR has_role(auth.uid(), 'admin_director'::app_role)
        )
      )
    )
  )
);

-- 5. purchase_request_attachments
DROP POLICY "Users can view request attachments" ON purchase_request_attachments;
CREATE POLICY "Users can view request attachments" ON purchase_request_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM purchase_requests pr
    WHERE pr.id = purchase_request_attachments.request_id
    AND (
      pr.created_by = auth.uid()
      OR (
        pr.status <> 'DRAFT'::purchase_request_status
        AND (
          has_role(auth.uid(), 'procurement_manager'::app_role)
          OR has_role(auth.uid(), 'coo'::app_role)
          OR has_role(auth.uid(), 'ceo'::app_role)
          OR has_role(auth.uid(), 'treasurer'::app_role)
          OR has_role(auth.uid(), 'chief_accountant'::app_role)
          OR has_role(auth.uid(), 'accountant'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'business_analyst'::app_role)
          OR has_role(auth.uid(), 'admin_director'::app_role)
        )
      )
    )
  )
);

-- 6. purchase_invoice_attachments
DROP POLICY "Users can view invoice attachments" ON purchase_invoice_attachments;
CREATE POLICY "Users can view invoice attachments" ON purchase_invoice_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM purchase_invoices pi
    WHERE pi.id = purchase_invoice_attachments.invoice_id
    AND (
      pi.created_by = auth.uid()
      OR (
        pi.status <> 'DRAFT'::purchase_invoice_status
        AND (
          has_role(auth.uid(), 'procurement_manager'::app_role)
          OR has_role(auth.uid(), 'coo'::app_role)
          OR has_role(auth.uid(), 'ceo'::app_role)
          OR has_role(auth.uid(), 'treasurer'::app_role)
          OR has_role(auth.uid(), 'chief_accountant'::app_role)
          OR has_role(auth.uid(), 'accountant'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'business_analyst'::app_role)
          OR has_role(auth.uid(), 'admin_director'::app_role)
        )
      )
    )
  )
);

-- 7. purchase_logs
DROP POLICY "Users can view purchase logs" ON purchase_logs;
CREATE POLICY "Users can view purchase logs" ON purchase_logs
FOR SELECT USING (
  ((entity_type = 'REQUEST'::purchase_log_entity_type) AND (EXISTS (
    SELECT 1 FROM purchase_requests pr
    WHERE pr.id = purchase_logs.entity_id
    AND (
      pr.created_by = auth.uid()
      OR (
        pr.status <> 'DRAFT'::purchase_request_status
        AND (
          has_role(auth.uid(), 'procurement_manager'::app_role)
          OR has_role(auth.uid(), 'coo'::app_role)
          OR has_role(auth.uid(), 'ceo'::app_role)
          OR has_role(auth.uid(), 'treasurer'::app_role)
          OR has_role(auth.uid(), 'chief_accountant'::app_role)
          OR has_role(auth.uid(), 'accountant'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'business_analyst'::app_role)
          OR has_role(auth.uid(), 'admin_director'::app_role)
        )
      )
    )
  )))
  OR
  ((entity_type = 'INVOICE'::purchase_log_entity_type) AND (EXISTS (
    SELECT 1 FROM purchase_invoices pi
    WHERE pi.id = purchase_logs.entity_id
    AND (
      pi.created_by = auth.uid()
      OR (
        pi.status <> 'DRAFT'::purchase_invoice_status
        AND (
          has_role(auth.uid(), 'procurement_manager'::app_role)
          OR has_role(auth.uid(), 'coo'::app_role)
          OR has_role(auth.uid(), 'ceo'::app_role)
          OR has_role(auth.uid(), 'treasurer'::app_role)
          OR has_role(auth.uid(), 'chief_accountant'::app_role)
          OR has_role(auth.uid(), 'accountant'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'business_analyst'::app_role)
          OR has_role(auth.uid(), 'admin_director'::app_role)
        )
      )
    )
  )))
);
