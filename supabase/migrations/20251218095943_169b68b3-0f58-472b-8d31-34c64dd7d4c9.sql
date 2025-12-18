-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view purchase invoices" ON purchase_invoices;

-- Create updated SELECT policy that includes request creators
CREATE POLICY "Users can view purchase invoices" ON purchase_invoices
FOR SELECT USING (
  -- 1. Invoice creator sees their own invoices (including DRAFT)
  (created_by = auth.uid())
  OR
  -- 2. Request creator sees non-DRAFT invoices linked to their requests
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
  -- 3. Users with procurement roles see all non-DRAFT invoices
  (
    (status <> 'DRAFT'::purchase_invoice_status) 
    AND (
      has_role(auth.uid(), 'procurement_manager'::app_role) OR 
      has_role(auth.uid(), 'coo'::app_role) OR 
      has_role(auth.uid(), 'ceo'::app_role) OR 
      has_role(auth.uid(), 'treasurer'::app_role) OR 
      has_role(auth.uid(), 'accountant'::app_role) OR 
      has_role(auth.uid(), 'admin'::app_role)
    )
  )
);