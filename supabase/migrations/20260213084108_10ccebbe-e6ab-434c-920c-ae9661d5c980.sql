
-- Update SELECT RLS policies to include business_analyst

-- R&D attachments
DROP POLICY IF EXISTS "Users can view rd attachments" ON public.rd_request_attachments;
CREATE POLICY "Users can view rd attachments" ON public.rd_request_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = rd_request_attachments.request_id
    AND (
      r.author_email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
      OR has_role(auth.uid(), 'rd_dev'::app_role)
      OR has_role(auth.uid(), 'rd_manager'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'quality_manager'::app_role)
      OR has_role(auth.uid(), 'admin_director'::app_role)
      OR has_role(auth.uid(), 'business_analyst'::app_role)
    )
  )
);

-- Testing samples
DROP POLICY IF EXISTS "Users can view testing samples" ON public.rd_request_testing_samples;
CREATE POLICY "Users can view testing samples" ON public.rd_request_testing_samples
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'rd_dev'::app_role)
  OR has_role(auth.uid(), 'rd_manager'::app_role)
  OR has_role(auth.uid(), 'business_analyst'::app_role)
  OR EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = rd_request_testing_samples.request_id
    AND r.author_email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())
  )
);

-- Development tables
DROP POLICY IF EXISTS "View development_recipes" ON public.development_recipes;
CREATE POLICY "View development_recipes" ON public.development_recipes
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role) OR has_role(auth.uid(), 'admin_director'::app_role)
  OR has_role(auth.uid(), 'business_analyst'::app_role)
);

DROP POLICY IF EXISTS "View development_recipe_ingredients" ON public.development_recipe_ingredients;
CREATE POLICY "View development_recipe_ingredients" ON public.development_recipe_ingredients
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role) OR has_role(auth.uid(), 'admin_director'::app_role)
  OR has_role(auth.uid(), 'business_analyst'::app_role)
);

DROP POLICY IF EXISTS "View development_samples" ON public.development_samples;
CREATE POLICY "View development_samples" ON public.development_samples
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role) OR has_role(auth.uid(), 'admin_director'::app_role)
  OR has_role(auth.uid(), 'business_analyst'::app_role)
);

DROP POLICY IF EXISTS "View development_sample_ingredients" ON public.development_sample_ingredients;
CREATE POLICY "View development_sample_ingredients" ON public.development_sample_ingredients
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role) OR has_role(auth.uid(), 'admin_director'::app_role)
  OR has_role(auth.uid(), 'business_analyst'::app_role)
);

DROP POLICY IF EXISTS "View development_sample_lab_results" ON public.development_sample_lab_results;
CREATE POLICY "View development_sample_lab_results" ON public.development_sample_lab_results
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role) OR has_role(auth.uid(), 'admin_director'::app_role)
  OR has_role(auth.uid(), 'business_analyst'::app_role)
);

DROP POLICY IF EXISTS "View development_sample_pilot" ON public.development_sample_pilot;
CREATE POLICY "View development_sample_pilot" ON public.development_sample_pilot
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role) OR has_role(auth.uid(), 'admin_director'::app_role)
  OR has_role(auth.uid(), 'business_analyst'::app_role)
);

-- Purchase tables
DROP POLICY IF EXISTS "Users can view purchase requests" ON public.purchase_requests;
CREATE POLICY "Users can view purchase requests" ON public.purchase_requests
FOR SELECT USING (
  created_by = auth.uid()
  OR (status <> 'DRAFT'::purchase_request_status AND (
    has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'coo'::app_role)
    OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'treasurer'::app_role)
    OR has_role(auth.uid(), 'chief_accountant'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'business_analyst'::app_role)
  ))
);

DROP POLICY IF EXISTS "Users can view purchase request items" ON public.purchase_request_items;
CREATE POLICY "Users can view purchase request items" ON public.purchase_request_items
FOR SELECT USING (
  EXISTS (SELECT 1 FROM purchase_requests pr WHERE pr.id = purchase_request_items.request_id
    AND (pr.created_by = auth.uid() OR (pr.status <> 'DRAFT'::purchase_request_status AND (
      has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'business_analyst'::app_role)
    ))))
);

DROP POLICY IF EXISTS "Users can view request attachments" ON public.purchase_request_attachments;
CREATE POLICY "Users can view request attachments" ON public.purchase_request_attachments
FOR SELECT USING (
  EXISTS (SELECT 1 FROM purchase_requests pr WHERE pr.id = purchase_request_attachments.request_id
    AND (pr.created_by = auth.uid() OR (pr.status <> 'DRAFT'::purchase_request_status AND (
      has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'chief_accountant'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'business_analyst'::app_role)
    ))))
);

DROP POLICY IF EXISTS "Users can view purchase invoices" ON public.purchase_invoices;
CREATE POLICY "Users can view purchase invoices" ON public.purchase_invoices
FOR SELECT USING (
  created_by = auth.uid()
  OR (status <> 'DRAFT'::purchase_invoice_status AND request_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM purchase_requests pr WHERE pr.id = purchase_invoices.request_id AND pr.created_by = auth.uid()
  ))
  OR has_role(auth.uid(), 'procurement_manager'::app_role)
  OR (status <> 'DRAFT'::purchase_invoice_status AND (
    has_role(auth.uid(), 'coo'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'business_analyst'::app_role)
  ))
  OR ((has_role(auth.uid(), 'treasurer'::app_role) OR has_role(auth.uid(), 'chief_accountant'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'financial_analyst'::app_role))
    AND status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status]))
);

DROP POLICY IF EXISTS "Users can view purchase invoice items" ON public.purchase_invoice_items;
CREATE POLICY "Users can view purchase invoice items" ON public.purchase_invoice_items
FOR SELECT USING (
  EXISTS (SELECT 1 FROM purchase_invoices pi WHERE pi.id = purchase_invoice_items.invoice_id
    AND (pi.created_by = auth.uid() OR (pi.status <> 'DRAFT'::purchase_invoice_status AND (
      has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'chief_accountant'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'business_analyst'::app_role)
    ))))
);

DROP POLICY IF EXISTS "Users can view invoice attachments" ON public.purchase_invoice_attachments;
CREATE POLICY "Users can view invoice attachments" ON public.purchase_invoice_attachments
FOR SELECT USING (
  EXISTS (SELECT 1 FROM purchase_invoices pi WHERE pi.id = purchase_invoice_attachments.invoice_id
    AND (pi.created_by = auth.uid() OR (pi.status <> 'DRAFT'::purchase_invoice_status AND (
      has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'chief_accountant'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'business_analyst'::app_role)
    ))))
);

DROP POLICY IF EXISTS "Users can view purchase logs" ON public.purchase_logs;
CREATE POLICY "Users can view purchase logs" ON public.purchase_logs
FOR SELECT USING (
  (entity_type = 'REQUEST'::purchase_log_entity_type AND EXISTS (
    SELECT 1 FROM purchase_requests pr WHERE pr.id = purchase_logs.entity_id
    AND (pr.created_by = auth.uid() OR (pr.status <> 'DRAFT'::purchase_request_status AND (
      has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'chief_accountant'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'business_analyst'::app_role)
    )))
  ))
  OR (entity_type = 'INVOICE'::purchase_log_entity_type AND EXISTS (
    SELECT 1 FROM purchase_invoices pi WHERE pi.id = purchase_logs.entity_id
    AND (pi.created_by = auth.uid() OR (pi.status <> 'DRAFT'::purchase_invoice_status AND (
      has_role(auth.uid(), 'procurement_manager'::app_role) OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role) OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'chief_accountant'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'business_analyst'::app_role)
    )))
  ))
);

-- KB tables
DROP POLICY IF EXISTS "COO can view kb_documents" ON public.kb_documents;
CREATE POLICY "COO can view kb_documents" ON public.kb_documents
FOR SELECT USING (is_coo() OR has_role('admin'::text) OR has_role(auth.uid(), 'business_analyst'::app_role));

DROP POLICY IF EXISTS "COO can view kb_chunks" ON public.kb_chunks;
CREATE POLICY "COO can view kb_chunks" ON public.kb_chunks
FOR SELECT USING (is_coo() OR has_role('admin'::text) OR has_role(auth.uid(), 'business_analyst'::app_role));

DROP POLICY IF EXISTS "COO can view kb_vector_documents" ON public.kb_vector_documents;
CREATE POLICY "COO can view kb_vector_documents" ON public.kb_vector_documents
FOR SELECT USING (is_coo() OR has_role('admin'::text) OR has_role(auth.uid(), 'business_analyst'::app_role));
