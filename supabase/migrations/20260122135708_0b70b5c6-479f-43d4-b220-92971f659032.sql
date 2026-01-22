-- Fix RLS policy for rd_request_testing_samples to allow rd_dev to create testing samples
DROP POLICY IF EXISTS "Admin and COO can create testing samples" ON rd_request_testing_samples;

CREATE POLICY "Authorized users can create testing samples" 
ON rd_request_testing_samples 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'coo'::app_role)
  OR has_role(auth.uid(), 'rd_dev'::app_role)
);