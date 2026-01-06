-- Update SELECT policy for purchase_requests: Treasurer sees ONLY their own requests
DROP POLICY IF EXISTS "Users can view purchase requests" ON public.purchase_requests;

CREATE POLICY "Users can view purchase requests" ON public.purchase_requests
FOR SELECT USING (
  -- Creator can see all their own requests (including DRAFT)
  (created_by = auth.uid())
  OR
  -- Procurement roles (EXCEPT treasurer) can see non-DRAFT requests
  (
    status <> 'DRAFT'::purchase_request_status
    AND (
      has_role(auth.uid(), 'procurement_manager'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
    -- Note: treasurer is NOT included here - they only see their own requests
  )
);

-- Update SELECT policy for purchase_invoices: Treasurer sees own + request invoices + TO_PAY/PAID/DELIVERED from others
DROP POLICY IF EXISTS "Users can view purchase invoices" ON public.purchase_invoices;

CREATE POLICY "Users can view purchase invoices" ON public.purchase_invoices
FOR SELECT USING (
  -- 1. Invoice creator can see all their invoices (including DRAFT)
  (created_by = auth.uid())
  OR
  -- 2. Request creator can see non-DRAFT invoices linked to their requests
  (
    (status <> 'DRAFT'::purchase_invoice_status) 
    AND request_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM purchase_requests pr 
      WHERE pr.id = purchase_invoices.request_id 
      AND pr.created_by = auth.uid()
    )
  )
  OR
  -- 3. Procurement roles (EXCEPT treasurer) can see all non-DRAFT invoices
  (
    (status <> 'DRAFT'::purchase_invoice_status) 
    AND (
      has_role(auth.uid(), 'procurement_manager'::app_role) OR 
      has_role(auth.uid(), 'coo'::app_role) OR 
      has_role(auth.uid(), 'ceo'::app_role) OR 
      has_role(auth.uid(), 'accountant'::app_role) OR 
      has_role(auth.uid(), 'admin'::app_role)
    )
  )
  OR
  -- 4. Treasurer can see invoices in TO_PAY, PAID, DELIVERED statuses (from any user)
  (
    has_role(auth.uid(), 'treasurer'::app_role)
    AND status IN ('TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status, 'DELIVERED'::purchase_invoice_status)
  )
);