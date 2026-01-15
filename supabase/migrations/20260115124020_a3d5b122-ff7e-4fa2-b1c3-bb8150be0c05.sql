-- Drop existing SELECT policy for purchase_requests
DROP POLICY IF EXISTS "Users can view purchase requests" ON purchase_requests;

-- Create updated SELECT policy that includes financial roles
CREATE POLICY "Users can view purchase requests" ON purchase_requests
FOR SELECT TO authenticated
USING (
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
    )
  )
);