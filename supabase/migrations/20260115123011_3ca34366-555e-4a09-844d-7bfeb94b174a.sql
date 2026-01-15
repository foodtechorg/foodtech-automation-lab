-- Drop existing UPDATE policy for purchase_invoices
DROP POLICY IF EXISTS "Users can update purchase invoices" ON public.purchase_invoices;

-- Create updated UPDATE policy with accountant having same rights as treasurer/chief_accountant
CREATE POLICY "Users can update purchase invoices"
ON public.purchase_invoices
FOR UPDATE
USING (
  -- Creator can update their own DRAFT invoices
  ((created_by = auth.uid()) AND (status = 'DRAFT'::purchase_invoice_status))
  -- COO can update PENDING_COO and PENDING_CEO invoices
  OR (has_role(auth.uid(), 'coo'::app_role) AND (status = ANY (ARRAY['PENDING_COO'::purchase_invoice_status, 'PENDING_CEO'::purchase_invoice_status])))
  -- CEO can update PENDING_COO and PENDING_CEO invoices
  OR (has_role(auth.uid(), 'ceo'::app_role) AND (status = ANY (ARRAY['PENDING_COO'::purchase_invoice_status, 'PENDING_CEO'::purchase_invoice_status])))
  -- Treasurer, Chief Accountant, AND Accountant can update TO_PAY invoices
  OR (has_role(auth.uid(), 'treasurer'::app_role) AND (status = 'TO_PAY'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'chief_accountant'::app_role) AND (status = 'TO_PAY'::purchase_invoice_status))
  OR (has_role(auth.uid(), 'accountant'::app_role) AND (status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status])))
  -- Procurement manager can update DRAFT and PENDING_COO
  OR (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status])))
  -- Admin can update all
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  -- Creator can set DRAFT or PENDING_COO
  ((created_by = auth.uid()) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status])))
  -- COO can set statuses up to TO_PAY
  OR (has_role(auth.uid(), 'coo'::app_role) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status, 'PENDING_CEO'::purchase_invoice_status, 'TO_PAY'::purchase_invoice_status, 'REJECTED'::purchase_invoice_status])))
  -- CEO can set statuses up to TO_PAY
  OR (has_role(auth.uid(), 'ceo'::app_role) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status, 'PENDING_CEO'::purchase_invoice_status, 'TO_PAY'::purchase_invoice_status, 'REJECTED'::purchase_invoice_status])))
  -- Treasurer, Chief Accountant, AND Accountant can set TO_PAY, PAID, DELIVERED
  OR ((has_role(auth.uid(), 'treasurer'::app_role) OR has_role(auth.uid(), 'chief_accountant'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)) AND (status = ANY (ARRAY['TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status, 'DELIVERED'::purchase_invoice_status])))
  -- Procurement manager can set DRAFT or PENDING_COO
  OR (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status = ANY (ARRAY['DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status])))
  -- Admin can set all
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update purchase_logs SELECT policy to include chief_accountant
DROP POLICY IF EXISTS "Users can view purchase logs" ON public.purchase_logs;

CREATE POLICY "Users can view purchase logs"
ON public.purchase_logs
FOR SELECT
USING (
  (
    (entity_type = 'REQUEST'::purchase_log_entity_type) AND 
    (EXISTS ( 
      SELECT 1 FROM purchase_requests pr
      WHERE (pr.id = purchase_logs.entity_id) AND 
        ((pr.created_by = auth.uid()) OR 
        ((pr.status <> 'DRAFT'::purchase_request_status) AND 
          (has_role(auth.uid(), 'procurement_manager'::app_role) OR 
           has_role(auth.uid(), 'coo'::app_role) OR 
           has_role(auth.uid(), 'ceo'::app_role) OR 
           has_role(auth.uid(), 'treasurer'::app_role) OR 
           has_role(auth.uid(), 'chief_accountant'::app_role) OR
           has_role(auth.uid(), 'accountant'::app_role) OR 
           has_role(auth.uid(), 'admin'::app_role))))
    ))
  ) OR 
  (
    (entity_type = 'INVOICE'::purchase_log_entity_type) AND 
    (EXISTS ( 
      SELECT 1 FROM purchase_invoices pi
      WHERE (pi.id = purchase_logs.entity_id) AND 
        ((pi.created_by = auth.uid()) OR 
        ((pi.status <> 'DRAFT'::purchase_invoice_status) AND 
          (has_role(auth.uid(), 'procurement_manager'::app_role) OR 
           has_role(auth.uid(), 'coo'::app_role) OR 
           has_role(auth.uid(), 'ceo'::app_role) OR 
           has_role(auth.uid(), 'treasurer'::app_role) OR 
           has_role(auth.uid(), 'chief_accountant'::app_role) OR
           has_role(auth.uid(), 'accountant'::app_role) OR 
           has_role(auth.uid(), 'admin'::app_role))))
    ))
  )
);