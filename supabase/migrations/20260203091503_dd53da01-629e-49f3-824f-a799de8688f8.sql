-- Migration: Add read-only access for financial_analyst role
-- 1. Requests table - allow viewing all requests

DROP POLICY IF EXISTS "Users can view requests" ON requests;

CREATE POLICY "Users can view requests" ON requests
FOR SELECT USING (
  (has_role(auth.uid(), 'sales_manager'::app_role) AND (author_email = (
    SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
  )))
  OR has_role(auth.uid(), 'rd_dev'::app_role)
  OR has_role(auth.uid(), 'rd_manager'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role)
  OR has_role(auth.uid(), 'admin_director'::app_role)
  OR has_role(auth.uid(), 'financial_analyst'::app_role)
);

-- 2. Request events table - allow viewing chronology

DROP POLICY IF EXISTS "Users can view request events" ON request_events;

CREATE POLICY "Users can view request events" ON request_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = request_events.request_id
    AND (
      (has_role(auth.uid(), 'sales_manager'::app_role) AND r.author_email = (
        SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
      ))
      OR has_role(auth.uid(), 'rd_dev'::app_role)
      OR has_role(auth.uid(), 'rd_manager'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'quality_manager'::app_role)
      OR has_role(auth.uid(), 'admin_director'::app_role)
      OR has_role(auth.uid(), 'financial_analyst'::app_role)
    )
  )
);

-- 3. Test results table - allow viewing test results

DROP POLICY IF EXISTS "Users can view test results" ON test_results;

CREATE POLICY "Users can view test results" ON test_results
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = test_results.request_id
    AND (
      (has_role(auth.uid(), 'sales_manager'::app_role) AND r.author_email = (
        SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
      ))
      OR has_role(auth.uid(), 'rd_dev'::app_role)
      OR has_role(auth.uid(), 'rd_manager'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'quality_manager'::app_role)
      OR has_role(auth.uid(), 'admin_director'::app_role)
      OR has_role(auth.uid(), 'financial_analyst'::app_role)
    )
  )
);

-- 4. Purchase invoices table - allow viewing TO_PAY and PAID invoices

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
    (has_role(auth.uid(), 'treasurer'::app_role) 
     OR has_role(auth.uid(), 'chief_accountant'::app_role) 
     OR has_role(auth.uid(), 'accountant'::app_role)
     OR has_role(auth.uid(), 'financial_analyst'::app_role))
    AND (status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status]))
  )
);