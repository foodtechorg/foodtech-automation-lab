-- Drop existing policy
DROP POLICY IF EXISTS "Users can update purchase requests" ON public.purchase_requests;

-- Create updated policy that allows financial roles to update request status when processing invoices
CREATE POLICY "Users can update purchase requests" ON public.purchase_requests
    FOR UPDATE
    USING (
        -- Owner can edit their draft requests
        ((created_by = auth.uid()) AND (status = 'DRAFT'::purchase_request_status))
        OR
        -- Admin has full access
        has_role(auth.uid(), 'admin'::app_role)
        OR
        -- Procurement manager can update requests in progress
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status = 'IN_PROGRESS'::purchase_request_status))
        OR
        -- Financial roles can update request status when processing invoices
        (
            (
                has_role(auth.uid(), 'treasurer'::app_role)
                OR has_role(auth.uid(), 'chief_accountant'::app_role)
                OR has_role(auth.uid(), 'accountant'::app_role)
            )
            AND status IN ('IN_PROGRESS'::purchase_request_status, 'INVOICE_PENDING'::purchase_request_status, 'DELIVERING'::purchase_request_status)
        )
    )
    WITH CHECK (
        -- Owner can transition DRAFT -> IN_PROGRESS
        ((created_by = auth.uid()) AND (status = ANY (ARRAY['DRAFT'::purchase_request_status, 'IN_PROGRESS'::purchase_request_status])))
        OR
        -- Admin has full access
        has_role(auth.uid(), 'admin'::app_role)
        OR
        -- Procurement manager can update IN_PROGRESS requests
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND (status = 'IN_PROGRESS'::purchase_request_status))
        OR
        -- Financial roles can transition to INVOICE_PENDING, DELIVERING, COMPLETED
        (
            (
                has_role(auth.uid(), 'treasurer'::app_role)
                OR has_role(auth.uid(), 'chief_accountant'::app_role)
                OR has_role(auth.uid(), 'accountant'::app_role)
            )
            AND status IN ('INVOICE_PENDING'::purchase_request_status, 'DELIVERING'::purchase_request_status, 'COMPLETED'::purchase_request_status)
        )
    );

-- Fix existing data: Update requests where invoice is PAID but request is still INVOICE_PENDING
UPDATE public.purchase_requests pr
SET status = 'COMPLETED'::purchase_request_status, updated_at = now()
FROM public.purchase_invoices pi
WHERE pi.request_id = pr.id
AND pi.status = 'PAID'::purchase_invoice_status
AND pr.status = 'INVOICE_PENDING'::purchase_request_status;