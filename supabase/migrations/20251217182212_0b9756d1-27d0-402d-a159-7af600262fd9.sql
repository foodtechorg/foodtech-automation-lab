-- Drop old policy
DROP POLICY IF EXISTS "Users can update purchase invoices" ON public.purchase_invoices;

-- Create updated policy with WITH CHECK clause for parallel approval
CREATE POLICY "Users can update purchase invoices" ON public.purchase_invoices
    FOR UPDATE
    USING (
        -- Author can edit their drafts
        ((created_by = auth.uid()) AND (status = 'DRAFT'::purchase_invoice_status))
        OR
        -- COO can approve PENDING_COO invoices
        (has_role(auth.uid(), 'coo'::app_role) AND (status = 'PENDING_COO'::purchase_invoice_status))
        OR
        -- CEO can approve PENDING_COO invoices (parallel approval)
        (has_role(auth.uid(), 'ceo'::app_role) AND (status = 'PENDING_COO'::purchase_invoice_status))
        OR
        -- Treasurer can mark as paid
        (has_role(auth.uid(), 'treasurer'::app_role) AND (status = 'TO_PAY'::purchase_invoice_status))
        OR
        -- Accountant can mark as delivered
        (has_role(auth.uid(), 'accountant'::app_role) AND (status = 'PAID'::purchase_invoice_status))
        OR
        -- Procurement manager can edit drafts and submit
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status IN ('DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status)))
        OR
        -- Admin has full access
        has_role(auth.uid(), 'admin'::app_role)
    )
    WITH CHECK (
        -- Author can save draft or submit for approval
        ((created_by = auth.uid()) AND (status IN ('DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status)))
        OR
        -- COO/CEO can set status to PENDING_COO (partial approval), TO_PAY (both approved), or REJECTED
        ((has_role(auth.uid(), 'coo'::app_role) OR has_role(auth.uid(), 'ceo'::app_role)) 
         AND (status IN ('PENDING_COO'::purchase_invoice_status, 'TO_PAY'::purchase_invoice_status, 'REJECTED'::purchase_invoice_status)))
        OR
        -- Treasurer can mark payment
        (has_role(auth.uid(), 'treasurer'::app_role) AND (status IN ('TO_PAY'::purchase_invoice_status, 'PAID'::purchase_invoice_status)))
        OR
        -- Accountant can mark delivery
        (has_role(auth.uid(), 'accountant'::app_role) AND (status IN ('PAID'::purchase_invoice_status, 'DELIVERED'::purchase_invoice_status)))
        OR
        -- Procurement manager
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status IN ('DRAFT'::purchase_invoice_status, 'PENDING_COO'::purchase_invoice_status)))
        OR
        -- Admin has full access
        has_role(auth.uid(), 'admin'::app_role)
    );