-- Drop existing update policies for purchase_requests
DROP POLICY IF EXISTS "Users can update purchase requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "COO/CEO can update purchase requests" ON public.purchase_requests;

-- Create new RLS policy that allows authors to change DRAFT to IN_PROGRESS directly
CREATE POLICY "Users can update purchase requests" ON public.purchase_requests
    FOR UPDATE
    USING (
        -- Author can edit their drafts
        (created_by = auth.uid() AND status = 'DRAFT')
        OR
        -- Admin has full access
        has_role(auth.uid(), 'admin'::app_role)
        OR
        -- Procurement manager can update requests in progress
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND status = 'IN_PROGRESS')
    )
    WITH CHECK (
        -- Author can change DRAFT → IN_PROGRESS (skip COO approval)
        (created_by = auth.uid() AND status IN ('DRAFT', 'IN_PROGRESS'))
        OR
        has_role(auth.uid(), 'admin'::app_role)
        OR
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND status = 'IN_PROGRESS')
    );